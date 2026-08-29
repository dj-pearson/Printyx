/**
 * A tenant_id column has to be able to hold a tenant id (AUDIT-032).
 *
 * tenants.id is `varchar PRIMARY KEY DEFAULT gen_random_uuid()`. Twenty-one
 * tables across four schema files declared `tenant_id integer NOT NULL`, which
 * a uuid cannot go into, so neither half of multi-tenancy worked on any of
 * them. Both failures were reproduced against Postgres 16 before the fix:
 *
 *   SELECT ... WHERE tenant_id = '<uuid>'      -> 22P02 invalid input syntax
 *   INSERT ... (tenant_id) VALUES ('<uuid>')   -> 42804 column is of type
 *                                                 integer but expression is of
 *                                                 type character varying
 *
 * Under PostgREST the read error leaves .data null and this codebase writes
 * `?? []` around it, so the symptom was an empty dashboard - which is why
 * several of these tables were recorded as "nothing writes to them" when the
 * truth is that nothing could. contract_renewal_tracking is the clearest case:
 * AUDIT-028 lists it as unwritten and the routed /contract-renewal-autopilot
 * dashboard reads it.
 *
 * This locks the shape rather than re-testing the guard's own logic: the guard
 * (scripts/check-tenant-id-types.mjs) is the CI gate, and these assertions are
 * what a reader needs to see to know which tables were affected.
 */
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as autoSupply from '../../../shared/auto-supply-replenishment-schema';
import * as renewal from '../../../shared/contract-renewal-schema';
import * as documentAutomation from '../../../shared/document-automation-schema';
import * as printyxClient from '../../../shared/printyx-client-schema';

const repo = join(__dirname, '..', '..', '..');

/** The 21 tables migration 0062 converts. */
const CONVERTED = [
  'auto_supply_orders',
  'client_collected_metrics',
  'client_registrations',
  'contract_renewal_tracking',
  'device_meter_history',
  'document_field_mappings',
  'document_notifications',
  'document_templates',
  'document_uploads',
  'document_workflow_actions',
  'generated_documents',
  'monitored_devices',
  'renewal_analytics',
  'renewal_automation_rules',
  'renewal_communication_log',
  'renewal_proposals',
  'supply_monitoring',
  'supply_replenishment_analytics',
  'supply_replenishment_rules',
  'supply_usage_history',
  'toner_alerts',
];

const modules = [autoSupply, renewal, documentAutomation, printyxClient];

describe('the Drizzle schemas', () => {
  const tables = new Map<string, ReturnType<typeof getTableConfig>>();
  for (const module of modules) {
    for (const value of Object.values(module)) {
      try {
        const config = getTableConfig(value as never);
        tables.set(config.name, config);
      } catch {
        // Not a table export (zod schema, enum, relation).
      }
    }
  }

  it('declares every one of the 21 converted tables', () => {
    for (const name of CONVERTED) expect(tables.has(name)).toBe(true);
  });

  it.each(CONVERTED)('gives %s a tenant_id that can hold a uuid', (name) => {
    const column = tables.get(name)!.columns.find((c) => c.name === 'tenant_id');
    expect(column).toBeDefined();
    // Read the declared SQL type off Drizzle itself rather than the source text,
    // so a rename or a re-import cannot make this assertion vacuous.
    expect(column!.getSQLType()).toMatch(/^(varchar|text|uuid|char)/);
  });

  it('leaves no numeric tenantId anywhere in shared/', () => {
    const strip = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const offenders: string[] = [];
    for (const entry of readdirSync(join(repo, 'shared'))) {
      if (!entry.endsWith('.ts')) continue;
      const source = strip(readFileSync(join(repo, 'shared', entry), 'utf8'));
      for (const m of source.matchAll(/tenantId:\s*(\w+)\(\s*'tenant_id'/g)) {
        if (!['varchar', 'text', 'uuid', 'char'].includes(m[1])) {
          offenders.push(`${entry}: ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('migration 0062', () => {
  const migration = join(repo, 'drizzle', 'migrations', '0062_round_sway.sql');
  const sql = existsSync(migration) ? readFileSync(migration, 'utf8') : '';

  it('converts all 21 columns', () => {
    for (const name of CONVERTED) {
      expect(sql).toContain(`ALTER TABLE "${name}" ALTER COLUMN "tenant_id" SET DATA TYPE varchar`);
    }
  });

  it('is safe to run twice and on a database that ran the hand-run webhook file', () => {
    // The generated CREATE for inbound_webhook_events is not drift: that table
    // shipped as an unjournaled hand-run .sql, so drizzle-kit sees it missing
    // from the snapshot. Folding it in beats hand-editing the generated file,
    // which is what desynced the snapshot in COP-M00 - but only if it cannot
    // collide with a database that already ran the hand-run version.
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "inbound_webhook_events"');
    const creates = sql.match(/CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)?/g) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    for (const create of creates) expect(create).toContain('IF NOT EXISTS');
  });

  it('is journaled, so drizzle actually applies it', () => {
    const journal = JSON.parse(
      readFileSync(join(repo, 'drizzle', 'migrations', 'meta', '_journal.json'), 'utf8'),
    );
    expect(journal.entries.some((e: { tag: string }) => e.tag === '0062_round_sway')).toBe(true);
  });
});

describe('the workarounds the wrong type forced', () => {
  it('no longer parseInts a uuid to satisfy an integer column', () => {
    // parseInt('550e8400-...') is 550, and parseInt of a uuid starting with a
    // letter is NaN - either way the filter named a tenant that does not exist.
    const source = readFileSync(
      join(repo, 'server', 'services', 'predictive-service-dispatch-service.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(source).not.toContain('parseInt(tenantId)');
    expect(source).toContain('eq(clientCollectedMetrics.tenantId, tenantId)');
  });
});
