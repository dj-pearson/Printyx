/**
 * Contract P&L X-ray Routes (US-SUPER-003).
 *
 * Real-time per-contract margin (CPC revenue minus parts, labor, supplies,
 * financing) for the OWNER persona, so dealers see which service contracts are
 * profitable, which are bleeding, and where to focus renewal negotiation.
 *
 * Data model: two Postgres MATERIALIZED VIEWS (see
 * drizzle/migrations/_backfill_contract_pnl.sql) hold RAW trailing-12-month
 * aggregates; this router applies the per-tenant dollar rates from
 * contract_pnl_settings at READ time, so changing rates never needs a refresh.
 *
 *   - contract_pnl_v          : one row per contract (aggregate)
 *   - contract_pnl_monthly_v  : one row per (contract, month), last 12 months
 *
 * Endpoints:
 *   GET  /api/contract-pnl                 — list (filters + sort by GP%), + sparkline
 *   GET  /api/contract-pnl/export.csv      — CSV margin report
 *   GET  /api/contract-pnl/settings        — rates / alert threshold / digest toggle
 *   PUT  /api/contract-pnl/settings
 *   POST /api/contract-pnl/refresh         — REFRESH both views (rate-limited, cron-callable)
 *   POST /api/contract-pnl/digest/preview  — contracts below GP threshold (weekly OWNER digest)
 *   GET  /api/contract-pnl/:contractId     — per-contract 12-month breakdown by cost category
 *
 * Auth: requireAuth + tenant scoping on every query.
 * TODO(rbac): gate with requirePermission(['finance.contract.view_pnl']) once
 * that permission string is added to the RBAC matrix (default-granted to OWNER
 * + PLATFORM_ADMIN per the story). Mirrors the predictive-failure/churn
 * exemplars, which use requireAuth + tenant scoping until their perms exist.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { contractPnlSettings } from '@shared/schema';

const log = createModuleLogger('routes-contract-pnl');

/** Per-tenant on-demand refresh cooldown (ms). REFRESH MV is global; this keeps
 *  the button from hammering it. The nightly cron is exempt of the UI gate. */
const REFRESH_COOLDOWN_MS = 60_000;

const DEFAULTS = {
  techBurdenedRate: 75,
  avgPartCost: 45,
  financingRate: 0,
  gpAlertThreshold: 20,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Postgres "relation does not exist" — tolerate a not-yet-migrated view. */
function isMissingRelationError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  return e?.code === '42P01' || /does not exist/i.test(e?.message ?? '');
}

interface ResolvedRates {
  burdenedRate: number;
  avgPartCost: number;
  financingRate: number;
  gpAlertThreshold: number;
}

function ratesFrom(settings: {
  techBurdenedRate?: string | null;
  avgPartCost?: string | null;
  financingRate?: number | null;
  gpAlertThreshold?: number | null;
}): ResolvedRates {
  return {
    burdenedRate:
      settings.techBurdenedRate != null
        ? num(settings.techBurdenedRate)
        : DEFAULTS.techBurdenedRate,
    avgPartCost: settings.avgPartCost != null ? num(settings.avgPartCost) : DEFAULTS.avgPartCost,
    financingRate:
      settings.financingRate != null ? num(settings.financingRate) : DEFAULTS.financingRate,
    gpAlertThreshold:
      settings.gpAlertThreshold != null ? settings.gpAlertThreshold : DEFAULTS.gpAlertThreshold,
  };
}

interface PnlComputed {
  revenue12: number;
  cost12: number;
  laborCost: number;
  partsCost: number;
  suppliesCost: number;
  financingCost: number;
  copiesRevenue: number;
  baseRevenue: number;
  grossProfit: number;
  gpPercent: number | null;
  monthlyRevenue: number;
  monthlyCost: number;
}

/** Apply the per-tenant rates to one view row's raw 12-month aggregates. */
function computePnl(
  row: {
    copies_revenue_12mo?: unknown;
    base_revenue_12mo?: unknown;
    labor_hours_12mo?: unknown;
    parts_count_12mo?: unknown;
    supplies_cost_12mo?: unknown;
  },
  r: ResolvedRates,
): PnlComputed {
  const copiesRevenue = num(row.copies_revenue_12mo);
  const baseRevenue = num(row.base_revenue_12mo);
  const revenue12 = copiesRevenue + baseRevenue;
  const laborCost = num(row.labor_hours_12mo) * r.burdenedRate;
  const partsCost = num(row.parts_count_12mo) * r.avgPartCost;
  const suppliesCost = num(row.supplies_cost_12mo);
  const financingCost = baseRevenue * r.financingRate;
  const cost12 = laborCost + partsCost + suppliesCost + financingCost;
  const grossProfit = revenue12 - cost12;
  const gpPercent = revenue12 > 0 ? (grossProfit / revenue12) * 100 : null;
  return {
    revenue12,
    cost12,
    laborCost,
    partsCost,
    suppliesCost,
    financingCost,
    copiesRevenue,
    baseRevenue,
    grossProfit,
    gpPercent,
    monthlyRevenue: revenue12 / 12,
    monthlyCost: cost12 / 12,
  };
}

/** Monthly GP% for one (contract, month) raw row — drives the sparkline + detail. */
function computeMonthly(
  row: {
    copies_revenue?: unknown;
    base_revenue?: unknown;
    labor_hours?: unknown;
    parts_count?: unknown;
    supplies_cost?: unknown;
  },
  r: ResolvedRates,
) {
  const copiesRevenue = num(row.copies_revenue);
  const baseRevenue = num(row.base_revenue);
  const revenue = copiesRevenue + baseRevenue;
  const laborCost = num(row.labor_hours) * r.burdenedRate;
  const partsCost = num(row.parts_count) * r.avgPartCost;
  const suppliesCost = num(row.supplies_cost);
  const financingCost = baseRevenue * r.financingRate;
  const cost = laborCost + partsCost + suppliesCost + financingCost;
  const grossProfit = revenue - cost;
  const gpPercent = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  return {
    revenue,
    cost,
    laborCost,
    partsCost,
    suppliesCost,
    financingCost,
    grossProfit,
    gpPercent,
  };
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.contractPnlSettings.findFirst({
    where: eq(contractPnlSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(contractPnlSettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.contractPnlSettings.findFirst({
    where: eq(contractPnlSettings.tenantId, tenantId),
  });
}

function audit(
  action: 'REFRESH' | 'UPDATE_SETTINGS' | 'DIGEST_PREVIEW' | 'EXPORT_CSV',
  ctx: { tenantId: string; userId: string | undefined; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] contract-pnl',
  );
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  techBurdenedRate: z.number().min(0).optional(),
  avgPartCost: z.number().min(0).optional(),
  financingRate: z.number().min(0).max(1).optional(),
  gpAlertThreshold: z.number().int().min(0).max(100).optional(),
  digestEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Shared query: fetch + compute the contract P&L list for a tenant.
// ---------------------------------------------------------------------------

interface ListFilters {
  status?: string;
  industry?: string;
  salesRep?: string;
  territory?: string;
  search?: string;
  minGp?: number;
  maxGp?: number;
  sort?: string;
}

interface PnlListRow {
  contractId: string;
  contractNumber: string | null;
  customerId: string | null;
  companyName: string | null;
  industry: string | null;
  salesRep: string | null;
  territory: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  monthlyRevenue: number;
  monthlyCost: number;
  grossProfit: number;
  gpPercent: number | null;
  costBreakdown: {
    labor: number;
    parts: number;
    supplies: number;
    financing: number;
  };
  trend: number[]; // 12-month GP% sparkline (oldest → newest)
}

/** Returns { rows, viewMissing }. Tolerates the view not being migrated yet. */
async function fetchPnlList(
  tenantId: string,
  rates: ResolvedRates,
  filters: ListFilters,
): Promise<{ rows: PnlListRow[]; viewMissing: boolean }> {
  const { status, industry, salesRep, territory, search } = filters;
  const like = search ? `%${search}%` : null;

  let aggRows: any[] = [];
  let monthlyRows: any[] = [];
  try {
    const aggResult = await db.execute(sql`
      SELECT
        v.contract_id, v.contract_number, v.customer_id, v.status,
        v.start_date, v.end_date,
        v.copies_revenue_12mo, v.base_revenue_12mo,
        v.labor_hours_12mo, v.parts_count_12mo, v.supplies_cost_12mo,
        b.company_name, b.industry, b.assigned_sales_rep, b.territory
      FROM contract_pnl_v v
      LEFT JOIN business_records b
        ON b.id = v.customer_id AND b.tenant_id = ${tenantId}
      WHERE v.tenant_id = ${tenantId}
      ${status ? sql`AND v.status = ${status}` : sql``}
      ${industry ? sql`AND b.industry = ${industry}` : sql``}
      ${salesRep ? sql`AND b.assigned_sales_rep = ${salesRep}` : sql``}
      ${territory ? sql`AND b.territory = ${territory}` : sql``}
      ${like ? sql`AND (v.contract_number ILIKE ${like} OR b.company_name ILIKE ${like})` : sql``}
    `);
    aggRows = (aggResult as any).rows ?? (aggResult as any) ?? [];

    const monthlyResult = await db.execute(sql`
      SELECT contract_id, month, copies_revenue, base_revenue,
             labor_hours, parts_count, supplies_cost
      FROM contract_pnl_monthly_v
      WHERE tenant_id = ${tenantId}
      ORDER BY contract_id, month
    `);
    monthlyRows = (monthlyResult as any).rows ?? (monthlyResult as any) ?? [];
  } catch (err) {
    if (isMissingRelationError(err)) {
      return { rows: [], viewMissing: true };
    }
    throw err;
  }

  // Group monthly GP% by contract for the sparkline.
  const trendByContract = new Map<string, number[]>();
  for (const m of monthlyRows) {
    const cid = m.contract_id as string;
    const { gpPercent } = computeMonthly(m, rates);
    const arr = trendByContract.get(cid) ?? [];
    arr.push(gpPercent == null ? 0 : Math.round(gpPercent));
    trendByContract.set(cid, arr);
  }

  let rows: PnlListRow[] = aggRows.map((row) => {
    const p = computePnl(row, rates);
    return {
      contractId: row.contract_id,
      contractNumber: row.contract_number ?? null,
      customerId: row.customer_id ?? null,
      companyName: row.company_name ?? null,
      industry: row.industry ?? null,
      salesRep: row.assigned_sales_rep ?? null,
      territory: row.territory ?? null,
      status: row.status ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      monthlyRevenue: p.monthlyRevenue,
      monthlyCost: p.monthlyCost,
      grossProfit: p.grossProfit,
      gpPercent: p.gpPercent == null ? null : Math.round(p.gpPercent * 10) / 10,
      costBreakdown: {
        labor: Math.round(p.laborCost),
        parts: Math.round(p.partsCost),
        supplies: Math.round(p.suppliesCost),
        financing: Math.round(p.financingCost),
      },
      trend: trendByContract.get(row.contract_id) ?? [],
    };
  });

  // GP-threshold filters (computed, so applied post-aggregation).
  if (filters.minGp != null)
    rows = rows.filter((r) => r.gpPercent != null && r.gpPercent >= filters.minGp!);
  if (filters.maxGp != null)
    rows = rows.filter((r) => r.gpPercent != null && r.gpPercent <= filters.maxGp!);

  // Sort: default by GP% ascending (worst contracts first).
  const sort = filters.sort ?? 'gp_asc';
  rows.sort((a, b) => {
    const ga = a.gpPercent == null ? Number.POSITIVE_INFINITY : a.gpPercent;
    const gb = b.gpPercent == null ? Number.POSITIVE_INFINITY : b.gpPercent;
    switch (sort) {
      case 'gp_desc':
        return gb - ga;
      case 'revenue_desc':
        return b.monthlyRevenue - a.monthlyRevenue;
      case 'revenue_asc':
        return a.monthlyRevenue - b.monthlyRevenue;
      case 'gp_asc':
      default:
        return ga - gb;
    }
  });

  return { rows, viewMissing: false };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerContractPnlRoutes(app: Express) {
  /** GET /api/contract-pnl — sortable, filterable list with 12-month sparkline. */
  app.get('/api/contract-pnl', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      const rates = ratesFrom(settings ?? {});

      const q = req.query;
      const { rows, viewMissing } = await fetchPnlList(tenantId, rates, {
        status: typeof q.status === 'string' ? q.status : undefined,
        industry: typeof q.industry === 'string' ? q.industry : undefined,
        salesRep: typeof q.salesRep === 'string' ? q.salesRep : undefined,
        territory: typeof q.territory === 'string' ? q.territory : undefined,
        search: typeof q.search === 'string' ? q.search : undefined,
        minGp: q.minGp != null ? num(q.minGp) : undefined,
        maxGp: q.maxGp != null ? num(q.maxGp) : undefined,
        sort: typeof q.sort === 'string' ? q.sort : undefined,
      });

      const belowThreshold = rows.filter(
        (r) => r.gpPercent != null && r.gpPercent < rates.gpAlertThreshold,
      ).length;

      res.json({
        data: rows,
        total: rows.length,
        viewMissing,
        gpAlertThreshold: rates.gpAlertThreshold,
        belowThreshold,
        lastRefreshedAt: settings?.lastRefreshedAt ?? null,
      });
    } catch (error: any) {
      log.error('Failed to list contract P&L:', error);
      res.status(500).json({ message: 'Failed to list contract P&L', error: error?.message });
    }
  });

  /** GET /api/contract-pnl/export.csv — margin report download. */
  app.get('/api/contract-pnl/export.csv', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      const rates = ratesFrom(settings ?? {});
      const q = req.query;
      const { rows } = await fetchPnlList(tenantId, rates, {
        status: typeof q.status === 'string' ? q.status : undefined,
        industry: typeof q.industry === 'string' ? q.industry : undefined,
        salesRep: typeof q.salesRep === 'string' ? q.salesRep : undefined,
        territory: typeof q.territory === 'string' ? q.territory : undefined,
        search: typeof q.search === 'string' ? q.search : undefined,
        sort: typeof q.sort === 'string' ? q.sort : undefined,
      });

      const esc = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [
        'Contract',
        'Customer',
        'Industry',
        'Sales Rep',
        'Status',
        'Monthly Revenue',
        'Monthly Cost',
        'Gross Profit (12mo)',
        'GP %',
        'Labor Cost',
        'Parts Cost',
        'Supplies Cost',
        'Financing Cost',
      ];
      const lines = [header.join(',')];
      for (const r of rows) {
        lines.push(
          [
            esc(r.contractNumber),
            esc(r.companyName),
            esc(r.industry),
            esc(r.salesRep),
            esc(r.status),
            r.monthlyRevenue.toFixed(2),
            r.monthlyCost.toFixed(2),
            r.grossProfit.toFixed(2),
            r.gpPercent == null ? '' : r.gpPercent.toFixed(1),
            r.costBreakdown.labor,
            r.costBreakdown.parts,
            r.costBreakdown.supplies,
            r.costBreakdown.financing,
          ].join(','),
        );
      }

      audit('EXPORT_CSV', { tenantId, userId, extra: { rows: rows.length } });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contract-pnl.csv"');
      res.send(lines.join('\n'));
    } catch (error: any) {
      log.error('Failed to export contract P&L:', error);
      res.status(500).json({ message: 'Failed to export contract P&L', error: error?.message });
    }
  });

  /** GET /api/contract-pnl/settings */
  app.get('/api/contract-pnl/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const settings = await getOrCreateSettings(tenantId);
      res.json(settings);
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /** PUT /api/contract-pnl/settings */
  app.put('/api/contract-pnl/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      await getOrCreateSettings(tenantId);

      const updates: Record<string, unknown> = { updatedByUserId: userId, updatedAt: new Date() };
      if (parsed.data.techBurdenedRate !== undefined)
        updates.techBurdenedRate = parsed.data.techBurdenedRate.toFixed(2);
      if (parsed.data.avgPartCost !== undefined)
        updates.avgPartCost = parsed.data.avgPartCost.toFixed(2);
      if (parsed.data.financingRate !== undefined)
        updates.financingRate = parsed.data.financingRate;
      if (parsed.data.gpAlertThreshold !== undefined)
        updates.gpAlertThreshold = parsed.data.gpAlertThreshold;
      if (parsed.data.digestEnabled !== undefined)
        updates.digestEnabled = parsed.data.digestEnabled;

      const [updated] = await db
        .update(contractPnlSettings)
        .set(updates)
        .where(eq(contractPnlSettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * POST /api/contract-pnl/refresh
   * REFRESH both materialized views. Rate-limited per tenant (the views are
   * global, so a short cooldown protects against button-mashing). Cron-callable.
   */
  app.post('/api/contract-pnl/refresh', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      const last = settings?.lastRefreshedAt ? new Date(settings.lastRefreshedAt).getTime() : 0;
      const elapsed = Date.now() - last;
      if (elapsed < REFRESH_COOLDOWN_MS) {
        return res.status(429).json({
          message: 'Refresh recently ran; please wait before refreshing again.',
          retryAfterMs: REFRESH_COOLDOWN_MS - elapsed,
        });
      }

      try {
        await db.execute(sql`REFRESH MATERIALIZED VIEW contract_pnl_v`);
        await db.execute(sql`REFRESH MATERIALIZED VIEW contract_pnl_monthly_v`);
      } catch (err) {
        if (isMissingRelationError(err)) {
          return res.status(503).json({
            message:
              'Contract P&L views are not yet created. Run drizzle/migrations/_backfill_contract_pnl.sql.',
            viewMissing: true,
          });
        }
        throw err;
      }

      const now = new Date();
      await db
        .update(contractPnlSettings)
        .set({ lastRefreshedAt: now })
        .where(eq(contractPnlSettings.tenantId, tenantId));

      audit('REFRESH', { tenantId, userId });
      res.json({ refreshedAt: now });
    } catch (error: any) {
      log.error('Failed to refresh contract P&L:', error);
      res.status(500).json({ message: 'Failed to refresh contract P&L', error: error?.message });
    }
  });

  /**
   * POST /api/contract-pnl/digest/preview
   * Assemble the weekly OWNER digest: contracts below the GP alert threshold,
   * worst margin first. Assembly is real; the actual email send is a STUB.
   */
  app.post(
    '/api/contract-pnl/digest/preview',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const settings = await getOrCreateSettings(tenantId);
        const rates = ratesFrom(settings ?? {});
        const { rows, viewMissing } = await fetchPnlList(tenantId, rates, { sort: 'gp_asc' });

        const items = rows
          .filter((r) => r.gpPercent != null && r.gpPercent < rates.gpAlertThreshold)
          .slice(0, 25);

        const digest = {
          title: 'Weekly Contract Margin Alert',
          generatedAt: new Date(),
          gpAlertThreshold: rates.gpAlertThreshold,
          digestEnabled: settings?.digestEnabled ?? true,
          belowThresholdCount: items.length,
          viewMissing,
          contracts: items,
        };

        // TODO: deliver via the existing email infra on the weekly OWNER cron.
        // Assembly above is real; sending is stubbed so this slice has no
        // outbound-email dependency.
        audit('DIGEST_PREVIEW', { tenantId, userId, extra: { count: items.length } });
        res.json(digest);
      } catch (error: any) {
        log.error('Failed to assemble digest:', error);
        res.status(500).json({ message: 'Failed to assemble digest', error: error?.message });
      }
    },
  );

  /**
   * GET /api/contract-pnl/:contractId
   * Per-contract detail: aggregate P&L + 12-month cost lines by category
   * (labor / parts / supplies / financing) for the stacked bar chart.
   */
  app.get('/api/contract-pnl/:contractId', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const contractId = req.params.contractId;

      const settings = await getOrCreateSettings(tenantId);
      const rates = ratesFrom(settings ?? {});

      let aggRows: any[] = [];
      let monthlyRows: any[] = [];
      try {
        const aggResult = await db.execute(sql`
          SELECT
            v.contract_id, v.contract_number, v.customer_id, v.status,
            v.start_date, v.end_date,
            v.copies_revenue_12mo, v.base_revenue_12mo,
            v.labor_hours_12mo, v.parts_count_12mo, v.supplies_cost_12mo,
            b.company_name, b.industry, b.assigned_sales_rep, b.territory
          FROM contract_pnl_v v
          LEFT JOIN business_records b
            ON b.id = v.customer_id AND b.tenant_id = ${tenantId}
          WHERE v.tenant_id = ${tenantId} AND v.contract_id = ${contractId}
          LIMIT 1
        `);
        aggRows = (aggResult as any).rows ?? (aggResult as any) ?? [];

        const monthlyResult = await db.execute(sql`
          SELECT month, copies_revenue, base_revenue, labor_hours, parts_count, supplies_cost
          FROM contract_pnl_monthly_v
          WHERE tenant_id = ${tenantId} AND contract_id = ${contractId}
          ORDER BY month
        `);
        monthlyRows = (monthlyResult as any).rows ?? (monthlyResult as any) ?? [];
      } catch (err) {
        if (isMissingRelationError(err)) {
          return res.json({ viewMissing: true, contract: null, monthly: [] });
        }
        throw err;
      }

      if (aggRows.length === 0) {
        return res.status(404).json({ message: 'Contract not found in P&L view' });
      }

      const agg = aggRows[0];
      const p = computePnl(agg, rates);
      const monthly = monthlyRows.map((m) => {
        const mc = computeMonthly(m, rates);
        return {
          month: m.month,
          revenue: Math.round(mc.revenue),
          cost: Math.round(mc.cost),
          grossProfit: Math.round(mc.grossProfit),
          gpPercent: mc.gpPercent == null ? null : Math.round(mc.gpPercent * 10) / 10,
          labor: Math.round(mc.laborCost),
          parts: Math.round(mc.partsCost),
          supplies: Math.round(mc.suppliesCost),
          financing: Math.round(mc.financingCost),
        };
      });

      res.json({
        viewMissing: false,
        gpAlertThreshold: rates.gpAlertThreshold,
        contract: {
          contractId: agg.contract_id,
          contractNumber: agg.contract_number ?? null,
          customerId: agg.customer_id ?? null,
          companyName: agg.company_name ?? null,
          industry: agg.industry ?? null,
          salesRep: agg.assigned_sales_rep ?? null,
          territory: agg.territory ?? null,
          status: agg.status ?? null,
          startDate: agg.start_date ?? null,
          endDate: agg.end_date ?? null,
          revenue12: Math.round(p.revenue12),
          cost12: Math.round(p.cost12),
          grossProfit: Math.round(p.grossProfit),
          gpPercent: p.gpPercent == null ? null : Math.round(p.gpPercent * 10) / 10,
          monthlyRevenue: Math.round(p.monthlyRevenue),
          monthlyCost: Math.round(p.monthlyCost),
          costBreakdown: {
            labor: Math.round(p.laborCost),
            parts: Math.round(p.partsCost),
            supplies: Math.round(p.suppliesCost),
            financing: Math.round(p.financingCost),
          },
        },
        monthly,
      });
    } catch (error: any) {
      log.error('Failed to load contract P&L detail:', error);
      res
        .status(500)
        .json({ message: 'Failed to load contract P&L detail', error: error?.message });
    }
  });
}
