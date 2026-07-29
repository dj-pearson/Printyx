// Contract P&L X-ray Edge Function (EDGE-023).
//
// Prod parity for server/routes-contract-pnl.ts (US-SUPER-003): real-time
// per-contract margin — CPC revenue minus parts, labor, supplies and financing.
//
// WHY THIS EXISTS: ContractProfitability.tsx and ContractPnlDetail.tsx read
// /api/contract-pnl/*, which only Express served — no edge function, so every
// endpoint 404'd in PRODUCTION where the frontend targets functions.printyx.net.
// Found by npm run check:routes.
//
// URL layout (all under /contract-pnl):
//   GET  /                  — list (filters + sort by GP%) with 12-month sparkline
//   GET  /export.csv        — CSV margin report
//   GET  /settings          — rates / alert threshold / digest toggle
//   PUT  /settings
//   POST /refresh           — REFRESH both materialized views (rate-limited)
//   POST /digest/preview    — contracts below the GP threshold
//   GET  /:contractId       — per-contract 12-month breakdown by cost category
//
// ROUTING GOTCHA: `export.csv`, `settings`, `refresh` and `digest` are LITERAL
// first segments that share a position with :contractId. Every literal branch
// MUST be matched before the :contractId fallthrough, or /settings is read as a
// contract id and 404s.
//
// THE MATH IS A REPLICA — KEEP IT IN SYNC. shared/contract-pnl-math.ts is
// canonical and is imported by the Express router; Deno cannot import from
// shared/, so computePnl/computeMonthly/ratesFrom/num are duplicated below. This
// is the same arrangement CLAUDE.md records for quote-math and the proposals fn.
// The formulas are pinned by server/tests/unit/contract-pnl-math.test.ts — if you
// change one side, change both and update that test.
//
// THE VIEW→TABLE JOIN IS TWO QUERIES, NOT ONE. Express does
// `FROM contract_pnl_v v LEFT JOIN business_records b ON b.id = v.customer_id`.
// PostgREST can only embed across a declared FOREIGN KEY, and a materialized
// view has none, so an embedded select would error rather than degrade. The
// customer columns are fetched separately and joined in JS. A consequence worth
// knowing: the industry/salesRep/territory/search filters span BOTH sides, so
// they are applied after the join rather than pushed into the query.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// ── Replica of shared/contract-pnl-math.ts — keep in sync (see header) ───────
const CONTRACT_PNL_DEFAULTS = {
  techBurdenedRate: 75,
  avgPartCost: 45,
  financingRate: 0,
  gpAlertThreshold: 20,
};

interface ResolvedRates {
  burdenedRate: number;
  avgPartCost: number;
  financingRate: number;
  gpAlertThreshold: number;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// deno-lint-ignore no-explicit-any
function ratesFrom(settings: any): ResolvedRates {
  const s = settings ?? {};
  return {
    burdenedRate:
      s.tech_burdened_rate != null
        ? num(s.tech_burdened_rate)
        : CONTRACT_PNL_DEFAULTS.techBurdenedRate,
    avgPartCost: s.avg_part_cost != null ? num(s.avg_part_cost) : CONTRACT_PNL_DEFAULTS.avgPartCost,
    financingRate:
      s.financing_rate != null ? num(s.financing_rate) : CONTRACT_PNL_DEFAULTS.financingRate,
    gpAlertThreshold:
      s.gp_alert_threshold != null ? s.gp_alert_threshold : CONTRACT_PNL_DEFAULTS.gpAlertThreshold,
  };
}

// deno-lint-ignore no-explicit-any
function computePnl(row: any, r: ResolvedRates) {
  const copiesRevenue = num(row.copies_revenue_12mo);
  const baseRevenue = num(row.base_revenue_12mo);
  const revenue12 = copiesRevenue + baseRevenue;
  const laborCost = num(row.labor_hours_12mo) * r.burdenedRate;
  const partsCost = num(row.parts_count_12mo) * r.avgPartCost;
  const suppliesCost = num(row.supplies_cost_12mo);
  const financingCost = baseRevenue * r.financingRate;
  const cost12 = laborCost + partsCost + suppliesCost + financingCost;
  const grossProfit = revenue12 - cost12;
  // null, not 0, when there is no revenue — an undefined margin must not sort
  // in with break-even contracts or trip the below-threshold alert.
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

// deno-lint-ignore no-explicit-any
function computeMonthly(row: any, r: ResolvedRates) {
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
// ── end replica ─────────────────────────────────────────────────────────────

const REFRESH_COOLDOWN_MS = 60_000;
const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

/** Postgres "relation does not exist" — tolerate a not-yet-migrated view. */
// deno-lint-ignore no-explicit-any
function isMissingRelation(error: any): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /does not exist|could not find the table/i.test(error.message ?? '');
}

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

// deno-lint-ignore no-explicit-any
async function getOrCreateSettings(admin: any, tenantId: string) {
  const { data: existing } = await admin
    .from('contract_pnl_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await admin
    .from('contract_pnl_settings')
    .insert({ tenant_id: tenantId })
    .select()
    .maybeSingle();
  if (created) return created;

  // Lost an insert race — re-read.
  const { data: reread } = await admin
    .from('contract_pnl_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread ?? null;
}

/** Fetch + compute the P&L list. Mirrors fetchPnlList() in the Express router. */
async function fetchPnlList(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  rates: ResolvedRates,
  filters: ListFilters,
) {
  const aggQ = admin.from('contract_pnl_v').select('*').eq('tenant_id', tenantId);
  if (filters.status) aggQ.eq('status', filters.status);

  const [aggRes, monthlyRes] = await Promise.all([
    aggQ,
    admin
      .from('contract_pnl_monthly_v')
      .select(
        'contract_id, month, copies_revenue, base_revenue, labor_hours, parts_count, supplies_cost',
      )
      .eq('tenant_id', tenantId)
      .order('contract_id', { ascending: true })
      .order('month', { ascending: true }),
  ]);

  if (isMissingRelation(aggRes.error) || isMissingRelation(monthlyRes.error)) {
    return { rows: [], viewMissing: true, error: null };
  }
  if (aggRes.error) return { rows: [], viewMissing: false, error: aggRes.error };
  if (monthlyRes.error) return { rows: [], viewMissing: false, error: monthlyRes.error };

  // Customer columns, standing in for the LEFT JOIN (see the header note).
  // deno-lint-ignore no-explicit-any
  const customerIds = [
    ...new Set((aggRes.data ?? []).map((r: any) => r.customer_id).filter(Boolean)),
  ];
  // deno-lint-ignore no-explicit-any
  const customerById = new Map<string, any>();
  if (customerIds.length > 0) {
    const { data: customers } = await admin
      .from('business_records')
      .select('id, company_name, industry, assigned_sales_rep, territory')
      .eq('tenant_id', tenantId)
      .in('id', customerIds);
    // deno-lint-ignore no-explicit-any
    for (const c of customers ?? []) customerById.set((c as any).id, c);
  }

  // 12-month GP% sparkline per contract.
  const trendByContract = new Map<string, number[]>();
  // deno-lint-ignore no-explicit-any
  for (const m of (monthlyRes.data ?? []) as any[]) {
    const { gpPercent } = computeMonthly(m, rates);
    const arr = trendByContract.get(m.contract_id) ?? [];
    arr.push(gpPercent == null ? 0 : Math.round(gpPercent));
    trendByContract.set(m.contract_id, arr);
  }

  // deno-lint-ignore no-explicit-any
  let rows = ((aggRes.data ?? []) as any[]).map((row) => {
    const c = customerById.get(row.customer_id) ?? {};
    const p = computePnl(row, rates);
    return {
      contractId: row.contract_id,
      contractNumber: row.contract_number ?? null,
      customerId: row.customer_id ?? null,
      companyName: c.company_name ?? null,
      industry: c.industry ?? null,
      salesRep: c.assigned_sales_rep ?? null,
      territory: c.territory ?? null,
      status: row.status ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      monthlyRevenue: p.monthlyRevenue,
      monthlyCost: p.monthlyCost,
      grossProfit: p.grossProfit,
      gpPercent: round1(p.gpPercent),
      costBreakdown: {
        labor: Math.round(p.laborCost),
        parts: Math.round(p.partsCost),
        supplies: Math.round(p.suppliesCost),
        financing: Math.round(p.financingCost),
      },
      trend: trendByContract.get(row.contract_id) ?? [],
    };
  });

  // Customer-side filters: applied post-join because they live on the other
  // table (see the header note), which is exactly what Express expresses in SQL.
  if (filters.industry) rows = rows.filter((r) => r.industry === filters.industry);
  if (filters.salesRep) rows = rows.filter((r) => r.salesRep === filters.salesRep);
  if (filters.territory) rows = rows.filter((r) => r.territory === filters.territory);
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.contractNumber ?? '').toLowerCase().includes(needle) ||
        (r.companyName ?? '').toLowerCase().includes(needle),
    );
  }

  // GP-threshold filters are computed, so also post-aggregation.
  if (filters.minGp != null)
    rows = rows.filter((r) => r.gpPercent != null && r.gpPercent >= filters.minGp!);
  if (filters.maxGp != null)
    rows = rows.filter((r) => r.gpPercent != null && r.gpPercent <= filters.maxGp!);

  // Default: worst margin first. null GP sorts last (treated as +Infinity).
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

  return { rows, viewMissing: false, error: null };
}

function filtersFromQuery(sp: URLSearchParams): ListFilters {
  const get = (k: string) => sp.get(k) ?? undefined;
  return {
    status: get('status'),
    industry: get('industry'),
    salesRep: get('salesRep'),
    territory: get('territory'),
    search: get('search'),
    minGp: sp.get('minGp') != null ? num(sp.get('minGp')) : undefined,
    maxGp: sp.get('maxGp') != null ? num(sp.get('maxGp')) : undefined,
    sort: get('sort'),
  };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'contract-pnl');
    const seg = parts[0];
    const method = req.method;

    // ─── GET /settings ───────────────────────────────────────────────
    if (seg === 'settings' && method === 'GET') {
      const settings = await getOrCreateSettings(admin, tenantId);
      return createCorsResponse(settings, 200, req);
    }

    // ─── PUT /settings ───────────────────────────────────────────────
    if (seg === 'settings' && (method === 'PUT' || method === 'PATCH')) {
      const body = await req.json().catch(() => ({}));
      const err = validateSettings(body);
      if (err) return createCorsResponse({ message: err }, 400, req);

      await getOrCreateSettings(admin, tenantId);

      const updates: Record<string, unknown> = {
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      // toFixed(2) on the two decimal columns matches the Express handler, which
      // writes them as fixed-scale strings.
      if (body.techBurdenedRate !== undefined)
        updates.tech_burdened_rate = Number(body.techBurdenedRate).toFixed(2);
      if (body.avgPartCost !== undefined)
        updates.avg_part_cost = Number(body.avgPartCost).toFixed(2);
      if (body.financingRate !== undefined) updates.financing_rate = body.financingRate;
      if (body.gpAlertThreshold !== undefined) updates.gp_alert_threshold = body.gpAlertThreshold;
      if (body.digestEnabled !== undefined) updates.digest_enabled = body.digestEnabled;

      const { data, error } = await admin
        .from('contract_pnl_settings')
        .update(updates)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) return createCorsResponse({ message: error.message }, 500, req);
      return createCorsResponse(data, 200, req);
    }

    // ─── POST /refresh ───────────────────────────────────────────────
    if (seg === 'refresh' && method === 'POST') {
      const settings = await getOrCreateSettings(admin, tenantId);
      const last = settings?.last_refreshed_at ? new Date(settings.last_refreshed_at).getTime() : 0;
      const elapsed = Date.now() - last;
      if (elapsed < REFRESH_COOLDOWN_MS) {
        return createCorsResponse(
          {
            message: 'Refresh recently ran; please wait before refreshing again.',
            retryAfterMs: REFRESH_COOLDOWN_MS - elapsed,
          },
          429,
          req,
        );
      }

      // REFRESH MATERIALIZED VIEW cannot be expressed through PostgREST — see
      // drizzle/functions/contract-pnl-refresh.sql.
      const { data: rpcData, error: rpcError } = await admin.rpc('refresh_contract_pnl_views');
      if (rpcError) {
        if (isMissingRelation(rpcError) || rpcError.code === 'PGRST202') {
          return createCorsResponse(
            {
              message:
                'Contract P&L refresh function is not installed. Apply drizzle/functions/contract-pnl-refresh.sql.',
              viewMissing: true,
            },
            503,
            req,
          );
        }
        return createCorsResponse({ message: rpcError.message }, 500, req);
      }
      if (rpcData && rpcData.viewMissing) {
        return createCorsResponse(
          {
            message:
              'Contract P&L views are not yet created. Run drizzle/migrations/_backfill_contract_pnl.sql.',
            viewMissing: true,
          },
          503,
          req,
        );
      }

      const now = new Date().toISOString();
      await admin
        .from('contract_pnl_settings')
        .update({ last_refreshed_at: now })
        .eq('tenant_id', tenantId);

      return createCorsResponse({ refreshedAt: now }, 200, req);
    }

    // ─── POST /digest/preview ────────────────────────────────────────
    if (seg === 'digest' && parts[1] === 'preview' && method === 'POST') {
      const settings = await getOrCreateSettings(admin, tenantId);
      const rates = ratesFrom(settings);
      const { rows, viewMissing, error } = await fetchPnlList(admin, tenantId, rates, {
        sort: 'gp_asc',
      });
      if (error) return createCorsResponse({ message: error.message }, 500, req);

      const items = rows
        .filter((r) => r.gpPercent != null && r.gpPercent < rates.gpAlertThreshold)
        .slice(0, 25);

      // Assembly is real; delivery is a STUB on both backends — the weekly OWNER
      // cron owns sending, and this endpoint only previews.
      return createCorsResponse(
        {
          title: 'Weekly Contract Margin Alert',
          generatedAt: new Date(),
          gpAlertThreshold: rates.gpAlertThreshold,
          digestEnabled: settings?.digest_enabled ?? true,
          belowThresholdCount: items.length,
          viewMissing,
          contracts: items,
        },
        200,
        req,
      );
    }

    // ─── GET /export.csv ─────────────────────────────────────────────
    if (seg === 'export.csv' && method === 'GET') {
      const settings = await getOrCreateSettings(admin, tenantId);
      const rates = ratesFrom(settings);
      const { rows, error } = await fetchPnlList(
        admin,
        tenantId,
        rates,
        filtersFromQuery(url.searchParams),
      );
      if (error) return createCorsResponse({ message: error.message }, 500, req);

      const esc = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        [
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
        ].join(','),
      ];
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

      // Not createCorsResponse: this is a CSV body, not JSON. Header shape
      // matches the other CSV endpoints in this tree (blog-ai-costs,
      // blog-performance-dashboard), which echo the request Origin.
      return new Response(lines.join('\n'), {
        status: 200,
        headers: {
          ...getCorsHeaders(req.headers.get('Origin')),
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="contract-pnl.csv"',
        },
      });
    }

    // ─── GET / (list) ────────────────────────────────────────────────
    if (!seg && method === 'GET') {
      const settings = await getOrCreateSettings(admin, tenantId);
      const rates = ratesFrom(settings);
      const { rows, viewMissing, error } = await fetchPnlList(
        admin,
        tenantId,
        rates,
        filtersFromQuery(url.searchParams),
      );
      if (error) return createCorsResponse({ message: error.message }, 500, req);

      return createCorsResponse(
        {
          data: rows,
          total: rows.length,
          viewMissing,
          gpAlertThreshold: rates.gpAlertThreshold,
          belowThreshold: rows.filter(
            (r) => r.gpPercent != null && r.gpPercent < rates.gpAlertThreshold,
          ).length,
          lastRefreshedAt: settings?.last_refreshed_at ?? null,
        },
        200,
        req,
      );
    }

    // ─── GET /:contractId (must stay LAST — see the routing gotcha) ──
    if (seg && method === 'GET') {
      const settings = await getOrCreateSettings(admin, tenantId);
      const rates = ratesFrom(settings);

      const [aggRes, monthlyRes] = await Promise.all([
        admin
          .from('contract_pnl_v')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('contract_id', seg)
          .maybeSingle(),
        admin
          .from('contract_pnl_monthly_v')
          .select('month, copies_revenue, base_revenue, labor_hours, parts_count, supplies_cost')
          .eq('tenant_id', tenantId)
          .eq('contract_id', seg)
          .order('month', { ascending: true }),
      ]);

      if (isMissingRelation(aggRes.error) || isMissingRelation(monthlyRes.error)) {
        return createCorsResponse({ viewMissing: true, contract: null, monthly: [] }, 200, req);
      }
      if (aggRes.error) return createCorsResponse({ message: aggRes.error.message }, 500, req);
      if (!aggRes.data) {
        return createCorsResponse({ message: 'Contract not found in P&L view' }, 404, req);
      }

      const agg = aggRes.data;
      const p = computePnl(agg, rates);

      let customer: Record<string, unknown> = {};
      if (agg.customer_id) {
        const { data: c } = await admin
          .from('business_records')
          .select('company_name, industry, assigned_sales_rep, territory')
          .eq('tenant_id', tenantId)
          .eq('id', agg.customer_id)
          .maybeSingle();
        customer = c ?? {};
      }

      // deno-lint-ignore no-explicit-any
      const monthly = ((monthlyRes.data ?? []) as any[]).map((m) => {
        const mc = computeMonthly(m, rates);
        return {
          month: m.month,
          revenue: Math.round(mc.revenue),
          cost: Math.round(mc.cost),
          grossProfit: Math.round(mc.grossProfit),
          gpPercent: round1(mc.gpPercent),
          labor: Math.round(mc.laborCost),
          parts: Math.round(mc.partsCost),
          supplies: Math.round(mc.suppliesCost),
          financing: Math.round(mc.financingCost),
        };
      });

      return createCorsResponse(
        {
          viewMissing: false,
          gpAlertThreshold: rates.gpAlertThreshold,
          contract: {
            contractId: agg.contract_id,
            contractNumber: agg.contract_number ?? null,
            customerId: agg.customer_id ?? null,
            companyName: customer.company_name ?? null,
            industry: customer.industry ?? null,
            salesRep: customer.assigned_sales_rep ?? null,
            territory: customer.territory ?? null,
            status: agg.status ?? null,
            startDate: agg.start_date ?? null,
            endDate: agg.end_date ?? null,
            revenue12: Math.round(p.revenue12),
            cost12: Math.round(p.cost12),
            grossProfit: Math.round(p.grossProfit),
            gpPercent: round1(p.gpPercent),
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
        },
        200,
        req,
      );
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}

// deno-lint-ignore no-explicit-any
function validateSettings(body: any): string | null {
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (
    body.techBurdenedRate !== undefined &&
    (!n(body.techBurdenedRate) || body.techBurdenedRate < 0)
  )
    return 'techBurdenedRate must be a number >= 0';
  if (body.avgPartCost !== undefined && (!n(body.avgPartCost) || body.avgPartCost < 0))
    return 'avgPartCost must be a number >= 0';
  if (
    body.financingRate !== undefined &&
    (!n(body.financingRate) || body.financingRate < 0 || body.financingRate > 1)
  )
    return 'financingRate must be a number between 0 and 1';
  if (
    body.gpAlertThreshold !== undefined &&
    (!Number.isInteger(body.gpAlertThreshold) ||
      body.gpAlertThreshold < 0 ||
      body.gpAlertThreshold > 100)
  )
    return 'gpAlertThreshold must be an integer between 0 and 100';
  if (body.digestEnabled !== undefined && typeof body.digestEnabled !== 'boolean')
    return 'digestEnabled must be a boolean';
  return null;
}
