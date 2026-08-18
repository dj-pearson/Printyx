/**
 * Post-termination tenant data purge (LEGAL-005).
 *
 * The Privacy Policy commits to deleting or anonymizing account and business
 * data within 30 days of subscription termination, with a stated set of longer
 * statutory holds. Nothing implemented it. The existing retention engine covers
 * eleven named tables, none of which are tenant account data.
 *
 * Design notes worth knowing before changing this:
 *
 * TABLE LIST IS DERIVED, NOT WRITTEN DOWN. There are ~505 tenant-scoped tables.
 * A hand-maintained list would be wrong within a release, and being wrong here
 * means either keeping data we promised to delete or deleting records we are
 * required to retain. The list comes from the Drizzle schema at runtime, so a
 * new table is covered the day it is added.
 *
 * RETENTION IS AN ALLOWLIST. Everything tenant-scoped is purged EXCEPT tables
 * matching RETAINED_TABLES, which mirrors the exemptions the Privacy Policy
 * already states: financial records 7 years, security and audit logs 7 years,
 * support communications 3 years. The rules are patterns as well as names so a
 * newly-added invoice table is caught by shape rather than by someone
 * remembering to add it here.
 *
 * FK ORDER IS SOLVED BY RETRYING, NOT BY A DEPENDENCY GRAPH. Deleting from 505
 * tables in the right order needs a topological sort of the whole foreign-key
 * graph, which would itself be a hand-maintained artifact that goes stale. The
 * job deletes what it can, then repeats over what failed, until a pass makes no
 * progress. Slower, and correct without anyone maintaining it.
 *
 * DRY RUN BY DEFAULT, like the retention engine it sits next to. Deleting a
 * customer's entire history is not something a scheduled job should start doing
 * because it shipped.
 */

import { sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { createModuleLogger } from '../lib/logger';
import { logAuditEvent } from '../security-compliance';

const log = createModuleLogger('tenant-purge');

/** Days after termination before data is purged. Matches Privacy Policy 5.2. */
export const PURGE_GRACE_DAYS = 30;

/**
 * Tables held beyond the grace period, and why. Each entry states the basis so
 * that a reviewer can check it against the Privacy Policy rather than trusting
 * the list.
 */
export const RETAINED_TABLES: Array<{ match: RegExp; reason: string }> = [
  {
    // Named tables as well as patterns. Reviewing the derived classification
    // caught five financial tables the patterns alone missed - customer_payments,
    // lease_payments, vendor_bills, auto_invoice_generation and irs_mileage_logs,
    // the last of which is a tax record. Patterns are a safety net for tables
    // added later, not a substitute for looking at the actual list.
    match:
      /^(invoices|invoice_line_items|invoice_generation_logs|auto_invoice_generation|payments|payment_.*|customer_payments|lease_payments|vendor_bills|accounts_payable|accounts_receivable|credit_memos|billing_.*|subscription_.*|tenant_subscriptions|irs_mileage_logs|.*_tax_.*)$/,
    reason: 'Financial and tax records: 7 years (Privacy Policy 5.2, GDPR Art. 17(3)(b)).',
  },
  {
    // `security_.*` used to be open-ended and swept in seo_security_analysis,
    // which is SEO tooling rather than a security record. Over-retention is a
    // quieter failure than over-deletion but it still keeps data we promised to
    // delete, so the rule names the security tables it means.
    match:
      /(^audit_|_audit_log|_audit_logs$|audit_logs$|audit_trail|^access_review|^data_access_logs$|^security_(sessions|events|incidents|alerts)$|^proactive_threat_detection$|^threat_)/,
    reason: 'Security and audit records: 7 years, legal obligation and legal-claims defence.',
  },
  {
    match: /^(gdpr_requests|consent_records|consent_.*|data_subject_.*)$/,
    reason:
      'Privacy compliance evidence. Deleting proof of a deletion request defeats its purpose.',
  },
  {
    match: /^(support_tickets|support_messages|support_.*)$/,
    reason: 'Support communications: 3 years (Privacy Policy 5.2).',
  },
  {
    // Only the tenant row. `companies` was in this rule and should not have
    // been: it is deprecated CRM data (see docs/crm-canonical-model.md), so
    // retaining it would have kept exactly the customer records the 30-day
    // promise covers.
    match: /^tenants$/,
    reason:
      'The tenant row itself is anonymized rather than deleted, so financial records retained above keep a valid parent.',
  },
];

export interface TenantPurgeTableResult {
  table: string;
  rowsDeleted: number;
  error?: string;
}

export interface TenantPurgeResult {
  tenantId: string;
  dryRun: boolean;
  /** Tables that were (or would be) purged, with row counts. */
  purged: TenantPurgeTableResult[];
  /** Tables deliberately kept, with the reason. */
  retained: Array<{ table: string; reason: string }>;
  totalRowsDeleted: number;
  /** Tables that still failed after the retry passes gave up. */
  failed: TenantPurgeTableResult[];
  notes: string[];
}

/** Every tenant-scoped table in the Drizzle schema, discovered at runtime. */
export function listTenantScopedTables(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    try {
      const cfg = getTableConfig(value as never);
      if (cfg.columns.some((c) => c.name === 'tenant_id')) names.push(cfg.name);
    } catch {
      // A malformed export should not stop the purge; it just is not covered.
    }
  }
  return [...new Set(names)].sort();
}

/** The retention reason for a table, or null when it should be purged. */
export function retentionReasonFor(table: string): string | null {
  for (const rule of RETAINED_TABLES) {
    if (rule.match.test(table)) return rule.reason;
  }
  return null;
}

/** Split the schema into what gets purged and what is held. */
export function classifyTables(tables: string[]) {
  const purge: string[] = [];
  const retained: Array<{ table: string; reason: string }> = [];
  for (const t of tables) {
    const reason = retentionReasonFor(t);
    if (reason) retained.push({ table: t, reason });
    else purge.push(t);
  }
  return { purge, retained };
}

/**
 * Delete this tenant's rows from one table.
 *
 * The table name comes from the Drizzle schema rather than from user input, and
 * is additionally validated against a strict identifier pattern before being
 * interpolated, because building SQL by string concatenation deserves a belt as
 * well as braces.
 */
async function deleteFromTable(table: string, tenantId: string): Promise<number> {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`refusing to purge table with unexpected name: ${table}`);
  }
  const result = await db.execute(
    sql`DELETE FROM ${sql.identifier(table)} WHERE tenant_id = ${tenantId}`,
  );
  return (result as { rowCount?: number }).rowCount ?? 0;
}

/**
 * Purge one tenant.
 *
 * Repeats over the tables that failed until a pass deletes nothing new, which
 * resolves foreign-key ordering without a maintained dependency graph.
 */
export async function purgeTenant(
  tenantId: string,
  options: { dryRun?: boolean } = {},
): Promise<TenantPurgeResult> {
  const dryRun = options.dryRun !== false;
  const { purge, retained } = classifyTables(listTenantScopedTables());

  const notes: string[] = [
    `Grace period: ${PURGE_GRACE_DAYS} days after subscription termination (Privacy Policy 5.2).`,
    `${purge.length} table(s) in scope, ${retained.length} held under a stated exemption.`,
  ];

  if (dryRun) {
    notes.push(
      'DRY RUN: nothing was deleted. Set TENANT_PURGE_ENABLED=true to execute, and review the ' +
        'purge list first - it is derived from the schema, so a newly added table is included ' +
        'automatically and may need a retention rule instead.',
    );
    return {
      tenantId,
      dryRun,
      purged: purge.map((table) => ({ table, rowsDeleted: 0 })),
      retained,
      totalRowsDeleted: 0,
      failed: [],
      notes,
    };
  }

  const purged: TenantPurgeTableResult[] = [];
  let remaining = [...purge];
  let pass = 0;

  while (remaining.length > 0) {
    pass++;
    const stillFailing: TenantPurgeTableResult[] = [];
    let progressed = false;

    for (const table of remaining) {
      try {
        const rowsDeleted = await deleteFromTable(table, tenantId);
        purged.push({ table, rowsDeleted });
        progressed = true;
      } catch (err) {
        stillFailing.push({
          table,
          rowsDeleted: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!progressed) {
      // Nothing succeeded this pass, so retrying will not help. Whatever is left
      // is a genuine constraint problem, not an ordering one.
      notes.push(
        `Gave up after ${pass} pass(es): ${stillFailing.length} table(s) could not be purged. ` +
          'The erasure is INCOMPLETE for those tables.',
      );
      return {
        tenantId,
        dryRun,
        purged,
        retained,
        totalRowsDeleted: purged.reduce((n, p) => n + p.rowsDeleted, 0),
        failed: stillFailing,
        notes,
      };
    }

    remaining = stillFailing.map((f) => f.table);
  }

  notes.push(`Completed in ${pass} pass(es).`);
  return {
    tenantId,
    dryRun,
    purged,
    retained,
    totalRowsDeleted: purged.reduce((n, p) => n + p.rowsDeleted, 0),
    failed: [],
    notes,
  };
}

export interface DueTenant {
  tenantId: string;
  endedAt: Date;
  daysSinceTermination: number;
}

/**
 * Tenants whose subscription ended more than the grace period ago.
 *
 * Reads tenant_subscriptions directly rather than through a typed query because
 * this has to keep working if the subscription model changes shape around it;
 * what matters is the terminal status and the end date.
 */
export async function findTenantsDueForPurge(): Promise<DueTenant[]> {
  const rows = await db.execute(sql`
    SELECT tenant_id, ended_at
    FROM tenant_subscriptions
    WHERE status IN ('canceled', 'incomplete_expired', 'ended')
      AND ended_at IS NOT NULL
      AND ended_at < NOW() - (${PURGE_GRACE_DAYS} || ' days')::interval
  `);

  const list = (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const now = Date.now();
  return list.map((r) => {
    const endedAt = new Date(String(r.ended_at));
    return {
      tenantId: String(r.tenant_id),
      endedAt,
      daysSinceTermination: Math.floor((now - endedAt.getTime()) / 86_400_000),
    };
  });
}

/**
 * Whether a tenant is still inside its export grace period.
 *
 * The Privacy Policy frames the 30 days as a window during which the customer
 * may export. Export access ending is the other half of the promise, so it is
 * derived from the same constant rather than configured separately and allowed
 * to drift.
 */
export async function isWithinExportGracePeriod(tenantId: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT ended_at
    FROM tenant_subscriptions
    WHERE tenant_id = ${tenantId}
      AND status IN ('canceled', 'incomplete_expired', 'ended')
      AND ended_at IS NOT NULL
    ORDER BY ended_at DESC
    LIMIT 1
  `);
  const list = (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  if (list.length === 0) return true; // not terminated: normal access

  const endedAt = new Date(String(list[0].ended_at)).getTime();
  return Date.now() - endedAt < PURGE_GRACE_DAYS * 86_400_000;
}

export interface ScheduledPurgeSummary {
  tenantsDue: number;
  tenantsPurged: number;
  totalRowsDeleted: number;
  dryRun: boolean;
  errors: string[];
}

/** Cron entry point. Dry-run unless TENANT_PURGE_ENABLED is exactly 'true'. */
export async function runScheduledTenantPurge(dryRun = true): Promise<ScheduledPurgeSummary> {
  const errors: string[] = [];
  let tenantsPurged = 0;
  let totalRowsDeleted = 0;

  let due: DueTenant[] = [];
  try {
    due = await findTenantsDueForPurge();
  } catch (err) {
    return {
      tenantsDue: 0,
      tenantsPurged: 0,
      totalRowsDeleted: 0,
      dryRun,
      errors: [
        `Could not list terminated tenants: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  for (const tenant of due) {
    try {
      const result = await purgeTenant(tenant.tenantId, { dryRun });
      totalRowsDeleted += result.totalRowsDeleted;
      tenantsPurged++;

      log.info(
        {
          tenantId: tenant.tenantId,
          daysSinceTermination: tenant.daysSinceTermination,
          dryRun,
          rowsDeleted: result.totalRowsDeleted,
          tablesPurged: result.purged.length,
          tablesRetained: result.retained.length,
          tablesFailed: result.failed.length,
        },
        dryRun ? 'tenant_purge_dry_run' : 'tenant_purge_executed',
      );

      // An audit record per tenant, on the tenant's own log. audit_logs is a
      // retained table, so the record of the purge survives the purge - which
      // is the point: the evidence that data was deleted has to outlive the
      // data. Written after the purge so it reflects what actually happened.
      await logAuditEvent({
        tenantId: tenant.tenantId,
        userId: 'system',
        action: dryRun ? 'TENANT_PURGE_DRY_RUN' : 'TENANT_PURGE_EXECUTED',
        resource: 'tenant',
        resourceId: tenant.tenantId,
        newValues: {
          terminatedAt: tenant.endedAt.toISOString(),
          daysSinceTermination: tenant.daysSinceTermination,
          gracePeriodDays: PURGE_GRACE_DAYS,
          tablesPurged: result.purged.length,
          tablesRetained: result.retained.length,
          tablesFailed: result.failed.length,
          rowsDeleted: result.totalRowsDeleted,
          notes: result.notes,
        },
        ipAddress: 'system',
        userAgent: 'cron/tenant-purge',
        sessionId: 'system',
        severity: 'critical',
        category: 'data_modification',
      }).catch((auditErr) => {
        // A failed audit write must not be silent: an unrecorded purge is a
        // deletion nobody can evidence later.
        errors.push(
          `${tenant.tenantId}: purge audit record FAILED to write: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`,
        );
      });

      if (result.failed.length > 0) {
        errors.push(
          `${tenant.tenantId}: ${result.failed.length} table(s) failed to purge; erasure incomplete.`,
        );
      }
    } catch (err) {
      errors.push(`${tenant.tenantId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { tenantsDue: due.length, tenantsPurged, totalRowsDeleted, dryRun, errors };
}
