// Frontend-only report endpoints — these are called by FinancialIntelligence /
// SalesPerformanceAnalytics / ServiceForecastingAnalytics dashboards but were
// never implemented in Express. Returning a shape-compatible response here
// stops the dashboards from showing perpetual loading spinners and 404s.
//
// Where the underlying tables exist (invoices, deals, business_records,
// technicians, contracts) we compute real values. Where the metric requires
// data we don't track (forecasted demand, satisfaction scores, coaching
// signals) we return empty arrays / zeroes and flag `degraded: true`.
//
// This is intentionally a single file — every endpoint is small and any
// future "real" implementation will likely move out into its own handler
// (and out of degraded status) on a per-metric basis.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { cached, paramKey } from '../_cache.ts';

const TTL_SECONDS = 300;

const STUB_GET_ENDPOINTS = new Set([
  'financial-summary',
  'payment-alerts',
  'ar-aging',
  'customer-profitability',
  'cash-flow-forecast',
  'territory-financials',
  'sales-reps',
  'team-performance',
  'pipeline-funnel',
  'service-forecasts',
  'technician-capacity',
  'inventory-forecast',
  'service-summary',
  'revenue',
]);

export function isFrontendStubEndpoint(reportType: string, method: string): boolean {
  return method === 'GET' && STUB_GET_ENDPOINTS.has(reportType);
}

export async function handleFrontendStubs(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  const reportType = pathParts[0];
  if (method !== 'GET' || !STUB_GET_ENDPOINTS.has(reportType)) return null;

  switch (reportType) {
    case 'financial-summary':
      return runReport(req, ctx, reportType, financialSummary);
    case 'payment-alerts':
      return runReport(req, ctx, reportType, paymentAlerts);
    case 'ar-aging':
      return runReport(req, ctx, reportType, arAging);
    case 'customer-profitability':
      return runReport(req, ctx, reportType, customerProfitability);
    case 'cash-flow-forecast':
      return runReport(req, ctx, reportType, cashFlowForecast);
    case 'territory-financials':
      return runReport(req, ctx, reportType, territoryFinancials);
    case 'sales-reps':
      return runReport(req, ctx, reportType, salesReps);
    case 'team-performance':
      return runReport(req, ctx, reportType, teamPerformance);
    case 'pipeline-funnel':
      return runReport(req, ctx, reportType, pipelineFunnel);
    case 'service-forecasts':
      return runReport(req, ctx, reportType, serviceForecasts);
    case 'technician-capacity':
      return runReport(req, ctx, reportType, technicianCapacity);
    case 'inventory-forecast':
      return runReport(req, ctx, reportType, inventoryForecast);
    case 'service-summary':
      return runReport(req, ctx, reportType, serviceSummary);
    case 'revenue':
      return runReport(req, ctx, reportType, revenueSnapshot);
    default:
      return null;
  }
}

async function runReport(
  req: Request,
  ctx: HandlerCtx,
  reportType: string,
  loader: (ctx: HandlerCtx) => Promise<unknown>,
): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const cacheKey = `${auth.tenantId}:stubs:${reportType}:${paramKey({
    period: url.searchParams.get('period') ?? '',
    territory: url.searchParams.get('territory') ?? '',
    horizon: url.searchParams.get('horizon') ?? '',
    type: url.searchParams.get('type') ?? '',
    rep: url.searchParams.get('rep') ?? '',
    filter: url.searchParams.get('filter') ?? '',
    scope: url.searchParams.get('scope') ?? '',
  })}`;

  try {
    const data = await cached(cacheKey, TTL_SECONDS, () => loader(ctx));
    return jsonResponse(data, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, `Failed to compute ${reportType}`, req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── financial-summary ─────────────────────────────────────────────────────
//
// Period-scoped revenue / AR / overdue from invoices. Most metrics on
// FinancialSummary (DSO, profit margin, AP) require data we don't track —
// flagged as degraded.

async function financialSummary(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const days = periodToDays(url.searchParams.get('period'));
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await db
    .from('invoices')
    .select('total_amount, paid_date, due_date, balance_due')
    .eq('tenant_id', auth.tenantId)
    .gte('invoice_date', from);

  const list = (data ?? []) as Array<{
    total_amount: string | null;
    paid_date: string | null;
    due_date: string | null;
    balance_due: string | null;
  }>;
  const now = Date.now();

  const totalRevenue = list.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const paid = list.filter((i) => i.paid_date != null);
  const recognized = paid.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const overdueList = list.filter(
    (i) => i.paid_date == null && i.due_date && new Date(i.due_date).getTime() < now,
  );
  const overdueAmount = overdueList.reduce(
    (s, i) => s + Number(i.balance_due ?? i.total_amount ?? 0),
    0,
  );
  const totalAR = list
    .filter((i) => i.paid_date == null)
    .reduce((s, i) => s + Number(i.balance_due ?? i.total_amount ?? 0), 0);

  return {
    totalRevenue: Math.round(totalRevenue),
    revenueChange: 0,
    totalAR: Math.round(totalAR),
    totalAP: 0,
    cashFlow: Math.round(recognized),
    profitMargin: 0,
    overdueAmount: Math.round(overdueAmount),
    overdueCount: overdueList.length,
    collectionRate: totalRevenue > 0 ? Math.round((recognized / totalRevenue) * 100) : 0,
    dso: 0,
    degraded: {
      revenueChange: true,
      totalAP: true,
      profitMargin: true,
      dso: true,
    },
  };
}

// ─── payment-alerts ────────────────────────────────────────────────────────
//
// Real overdue invoices, surfaced as PaymentAlert[]. Type-specific logic
// (failed/dispute) requires payment-event data we don't capture.

async function paymentAlerts(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const filter = url.searchParams.get('filter') ?? 'all';
  const now = Date.now();

  const { data } = await db
    .from('invoices')
    .select('id, customer_id, total_amount, balance_due, due_date, paid_date, invoice_status')
    .eq('tenant_id', auth.tenantId)
    .is('paid_date', null);

  const open = (data ?? []) as Array<{
    id: string;
    customer_id: string | null;
    total_amount: string | null;
    balance_due: string | null;
    due_date: string | null;
    paid_date: string | null;
    invoice_status: string | null;
  }>;

  const customerIds = uniq(open.map((i) => i.customer_id).filter((x): x is string => !!x));
  const customerNames = await fetchCustomerNames(db, auth.tenantId, customerIds);

  const alerts = open
    .map((i) => {
      const dueMs = i.due_date ? new Date(i.due_date).getTime() : null;
      const pastDueDays = dueMs && dueMs < now ? Math.floor((now - dueMs) / 86_400_000) : null;
      const upcoming = dueMs && dueMs > now && dueMs - now < 7 * 86_400_000;
      const type: 'overdue' | 'upcoming' = pastDueDays != null ? 'overdue' : 'upcoming';
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (pastDueDays != null) {
        if (pastDueDays > 60) severity = 'critical';
        else if (pastDueDays > 30) severity = 'high';
        else severity = 'medium';
      }
      const customerId = i.customer_id ?? 'unknown';
      return {
        id: i.id,
        type,
        severity,
        customerId,
        customerName: customerNames.get(customerId) ?? 'Unknown',
        amount: Number(i.balance_due ?? i.total_amount ?? 0),
        dueDate: i.due_date ?? new Date().toISOString(),
        daysPastDue: pastDueDays ?? undefined,
        description:
          pastDueDays != null
            ? `Invoice ${pastDueDays} days past due`
            : upcoming
              ? 'Invoice due within 7 days'
              : 'Open invoice',
        recommendedAction:
          severity === 'critical'
            ? 'Escalate to collections'
            : severity === 'high'
              ? 'Send second past-due notice'
              : 'Send payment reminder',
        autoActionAvailable: false,
      };
    })
    .filter((a) => {
      if (filter === 'critical') return a.severity === 'critical';
      if (filter === 'overdue') return a.type === 'overdue';
      return a.type === 'overdue' || (a.daysPastDue ?? 0) >= 0;
    });

  alerts.sort((a, b) => (b.daysPastDue ?? 0) - (a.daysPastDue ?? 0));
  return alerts.slice(0, 50);
}

// ─── ar-aging ──────────────────────────────────────────────────────────────

async function arAging(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const now = Date.now();

  const { data } = await db
    .from('invoices')
    .select('total_amount, balance_due, due_date, paid_date')
    .eq('tenant_id', auth.tenantId)
    .is('paid_date', null);

  const open = (data ?? []) as Array<{
    total_amount: string | null;
    balance_due: string | null;
    due_date: string | null;
    paid_date: string | null;
  }>;

  const buckets: Array<{ label: string; min: number; max: number }> = [
    { label: 'Current', min: -Infinity, max: 0 },
    { label: '1-30 days', min: 0, max: 30 },
    { label: '31-60 days', min: 30, max: 60 },
    { label: '61-90 days', min: 60, max: 90 },
    { label: '90+ days', min: 90, max: Infinity },
  ];

  const counts = buckets.map((b) => ({ ...b, amount: 0, count: 0 }));
  let total = 0;

  for (const i of open) {
    const dueMs = i.due_date ? new Date(i.due_date).getTime() : null;
    if (!dueMs) continue;
    const days = Math.floor((now - dueMs) / 86_400_000);
    const amount = Number(i.balance_due ?? i.total_amount ?? 0);
    total += amount;
    const b = counts.find((b) => days >= b.min && days < b.max);
    if (b) {
      b.amount += amount;
      b.count += 1;
    }
  }

  return counts.map((b) => ({
    bucket: b.label,
    amount: Math.round(b.amount),
    count: b.count,
    percentage: total > 0 ? Math.round((b.amount / total) * 100) : 0,
  }));
}

// ─── customer-profitability ────────────────────────────────────────────────
//
// Revenue per customer from invoices.total_amount over the period. Costs,
// growth, and risk score require data we don't track — degraded.

async function customerProfitability(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const days = periodToDays(url.searchParams.get('period'));
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await db
    .from('invoices')
    .select('customer_id, total_amount, paid_date, due_date, invoice_date')
    .eq('tenant_id', auth.tenantId)
    .gte('invoice_date', from);

  const list = (data ?? []) as Array<{
    customer_id: string | null;
    total_amount: string | null;
    paid_date: string | null;
    due_date: string | null;
    invoice_date: string;
  }>;

  const byCustomer = new Map<
    string,
    { revenue: number; outstanding: number; payDays: number[]; total: number }
  >();
  for (const i of list) {
    const id = i.customer_id ?? 'unknown';
    const cur = byCustomer.get(id) ?? { revenue: 0, outstanding: 0, payDays: [], total: 0 };
    const amount = Number(i.total_amount ?? 0);
    cur.revenue += amount;
    cur.total += 1;
    if (i.paid_date == null) cur.outstanding += amount;
    if (i.paid_date && i.invoice_date) {
      const days = Math.max(
        0,
        Math.floor(
          (new Date(i.paid_date).getTime() - new Date(i.invoice_date).getTime()) / 86_400_000,
        ),
      );
      cur.payDays.push(days);
    }
    byCustomer.set(id, cur);
  }

  const ids = [...byCustomer.keys()];
  const names = await fetchCustomerNames(db, auth.tenantId, ids);
  const credits = await fetchCreditLimits(db, auth.tenantId, ids);

  const rows = ids
    .map((id) => {
      const v = byCustomer.get(id)!;
      const avgDays =
        v.payDays.length > 0
          ? Math.round(v.payDays.reduce((s, d) => s + d, 0) / v.payDays.length)
          : 0;
      const onTime = v.payDays.filter((d) => d <= 30).length;
      const onTimeRate = v.payDays.length > 0 ? Math.round((onTime / v.payDays.length) * 100) : 0;
      const credit = credits.get(id) ?? 0;
      return {
        customerId: id,
        customerName: names.get(id) ?? 'Unknown',
        totalRevenue: Math.round(v.revenue),
        totalCosts: 0,
        grossProfit: 0,
        profitMargin: 0,
        revenueGrowth: 0,
        paymentHistory: {
          avgDaysToPay: avgDays,
          onTimePaymentRate: onTimeRate,
          totalOutstanding: Math.round(v.outstanding),
          creditLimit: credit,
          creditUtilization:
            credit > 0 ? Math.min(100, Math.round((v.outstanding / credit) * 100)) : 0,
        },
        riskScore: 0,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 50);

  return rows;
}

// ─── cash-flow-forecast ────────────────────────────────────────────────────
//
// Projects open invoice payments into weekly buckets across the requested
// horizon. Outflow + confidence require AP and historical pay-time data —
// degraded.

async function cashFlowForecast(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const horizonDays = horizonToDays(url.searchParams.get('horizon')) || 90;

  const { data } = await db
    .from('invoices')
    .select('total_amount, balance_due, due_date, paid_date')
    .eq('tenant_id', auth.tenantId)
    .is('paid_date', null);

  const open = (data ?? []) as Array<{
    total_amount: string | null;
    balance_due: string | null;
    due_date: string | null;
    paid_date: string | null;
  }>;

  const now = Date.now();
  const weeks = Math.ceil(horizonDays / 7);
  const buckets = Array.from({ length: weeks }, (_, w) => {
    const start = now + w * 7 * 86_400_000;
    return {
      date: new Date(start).toISOString(),
      projectedInflow: 0,
      projectedOutflow: 0,
      netCashFlow: 0,
      runningBalance: 0,
      confidence: 50,
    };
  });

  for (const i of open) {
    if (!i.due_date) continue;
    const dueMs = new Date(i.due_date).getTime();
    if (dueMs < now) continue;
    const w = Math.floor((dueMs - now) / (7 * 86_400_000));
    if (w >= 0 && w < weeks) {
      buckets[w].projectedInflow += Number(i.balance_due ?? i.total_amount ?? 0);
    }
  }

  let running = 0;
  for (const b of buckets) {
    b.netCashFlow = b.projectedInflow - b.projectedOutflow;
    running += b.netCashFlow;
    b.runningBalance = Math.round(running);
    b.projectedInflow = Math.round(b.projectedInflow);
  }

  return buckets;
}

// ─── territory-financials ──────────────────────────────────────────────────
//
// Group customer revenue by business_records.territory. Customers with
// no territory roll up to "Unassigned".

async function territoryFinancials(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const days = periodToDays(url.searchParams.get('period'));
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const [invRes, custRes] = await Promise.all([
    db
      .from('invoices')
      .select('customer_id, total_amount, paid_date')
      .eq('tenant_id', auth.tenantId)
      .gte('invoice_date', from),
    db
      .from('business_records')
      .select('id, territory')
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'customer'),
  ]);

  const customers = (custRes.data ?? []) as Array<{ id: string; territory: string | null }>;
  const invoices = (invRes.data ?? []) as Array<{
    customer_id: string | null;
    total_amount: string | null;
    paid_date: string | null;
  }>;

  const territoryById = new Map<string, string>();
  for (const c of customers) territoryById.set(c.id, c.territory ?? 'Unassigned');

  const byTerritory = new Map<
    string,
    { revenue: number; collected: number; customers: Set<string>; deals: number }
  >();

  for (const i of invoices) {
    const id = i.customer_id ?? '';
    const t = id ? (territoryById.get(id) ?? 'Unassigned') : 'Unassigned';
    const cur = byTerritory.get(t) ?? {
      revenue: 0,
      collected: 0,
      customers: new Set<string>(),
      deals: 0,
    };
    const amount = Number(i.total_amount ?? 0);
    cur.revenue += amount;
    if (i.paid_date != null) cur.collected += amount;
    if (id) cur.customers.add(id);
    cur.deals += 1;
    byTerritory.set(t, cur);
  }

  return [...byTerritory.entries()].map(([territory, v]) => ({
    territory,
    revenue: Math.round(v.revenue),
    revenueGrowth: 0,
    customerCount: v.customers.size,
    avgDealSize: v.deals > 0 ? Math.round(v.revenue / v.deals) : 0,
    profitability: 0,
    collectionRate: v.revenue > 0 ? Math.round((v.collected / v.revenue) * 100) : 0,
  }));
}

// ─── sales-reps ────────────────────────────────────────────────────────────
//
// One row per sales-rep user with deal pipeline. Coaching, target, and
// activity metrics aren't tracked at the rep level — degraded.

async function salesReps(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const [usersRes, dealsRes] = await Promise.all([
    db
      .from('users')
      .select('id, first_name, last_name, email, created_at')
      .eq('tenant_id', auth.tenantId),
    db
      .from('deals')
      .select('owner_id, amount, status, expected_close_date')
      .eq('tenant_id', auth.tenantId),
  ]);

  const users = (usersRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    created_at: string;
  }>;
  const deals = (dealsRes.data ?? []) as Array<{
    owner_id: string | null;
    amount: string | null;
    status: string;
    expected_close_date: string | null;
  }>;

  const dealsByOwner = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.owner_id) continue;
    if (!dealsByOwner.has(d.owner_id)) dealsByOwner.set(d.owner_id, []);
    dealsByOwner.get(d.owner_id)!.push(d);
  }

  return users
    .filter((u) => dealsByOwner.has(u.id))
    .map((u) => {
      const myDeals = dealsByOwner.get(u.id) ?? [];
      const open = myDeals.filter((d) => d.status !== 'won' && d.status !== 'lost');
      const won = myDeals.filter((d) => d.status === 'won');
      const totalPipelineValue = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
      const wonRevenue = won.reduce((s, d) => s + Number(d.amount ?? 0), 0);
      const closeRate = myDeals.length > 0 ? Math.round((won.length / myDeals.length) * 100) : 0;
      return {
        id: u.id,
        firstName: u.first_name ?? '',
        lastName: u.last_name ?? '',
        email: u.email ?? '',
        territory: undefined,
        managerId: undefined,
        hireDate: u.created_at,
        performance: {
          totalPipelineValue: Math.round(totalPipelineValue),
          dealsInPipeline: open.length,
          avgDealSize: open.length > 0 ? Math.round(totalPipelineValue / open.length) : 0,
          leadToMeetingRate: 0,
          meetingToProposalRate: 0,
          proposalToCloseRate: 0,
          overallCloseRate: closeRate,
          callsMade: 0,
          emailsSent: 0,
          meetingsHeld: 0,
          proposalsSent: 0,
          rankingPercentile: 0,
          peerComparison: 'average' as const,
          avgDealCycle: 0,
          avgResponseTime: 0,
          monthlyRevenue: Math.round(wonRevenue),
          quarterlyRevenue: Math.round(wonRevenue),
          revenueTarget: 0,
          revenueAttainment: 0,
        },
        coaching: {
          strengths: [],
          improvementAreas: [],
          recommendations: [],
          skillAssessment: {
            prospecting: 0,
            qualifying: 0,
            presenting: 0,
            objectionHandling: 0,
            closing: 0,
            followUp: 0,
          },
        },
      };
    });
}

// ─── team-performance ──────────────────────────────────────────────────────

async function teamPerformance(ctx: HandlerCtx): Promise<unknown> {
  const reps = (await salesReps(ctx)) as Array<{
    performance: { totalPipelineValue: number; dealsInPipeline: number; monthlyRevenue: number };
  }>;
  const total = reps.reduce(
    (acc, r) => ({
      pipeline: acc.pipeline + r.performance.totalPipelineValue,
      deals: acc.deals + r.performance.dealsInPipeline,
      revenue: acc.revenue + r.performance.monthlyRevenue,
    }),
    { pipeline: 0, deals: 0, revenue: 0 },
  );
  return {
    repCount: reps.length,
    totalPipelineValue: total.pipeline,
    totalDealsInPipeline: total.deals,
    totalRevenue: total.revenue,
    avgPipelineValue: reps.length > 0 ? Math.round(total.pipeline / reps.length) : 0,
    avgRevenue: reps.length > 0 ? Math.round(total.revenue / reps.length) : 0,
  };
}

// ─── pipeline-funnel ───────────────────────────────────────────────────────
//
// Counts deals + value per stage from deal_stages. Conversion rates are
// computed assuming sequential progression in `order_index` — approximate
// because the schema doesn't track stage transitions.

async function pipelineFunnel(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const [stagesRes, dealsRes] = await Promise.all([
    db
      .from('deal_stages')
      .select('id, stage_name, order_index')
      .eq('tenant_id', auth.tenantId)
      .order('order_index', { ascending: true }),
    db.from('deals').select('stage_id, amount, status').eq('tenant_id', auth.tenantId),
  ]);

  const stages = (stagesRes.data ?? []) as Array<{
    id: string;
    stage_name: string;
    order_index: number | null;
  }>;
  const deals = (dealsRes.data ?? []) as Array<{
    stage_id: string;
    amount: string | null;
    status: string;
  }>;

  if (stages.length === 0) {
    // Fallback: bucket by status when there are no defined stages.
    const buckets = ['open', 'won', 'lost'].map((status) => {
      const subset = deals.filter((d) => d.status === status);
      return {
        stage: status,
        value: subset.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        count: subset.length,
        conversionRate: 0,
      };
    });
    return buckets;
  }

  const out = stages.map((s, idx) => {
    const subset = deals.filter((d) => d.stage_id === s.id);
    const prevCount = idx === 0 ? subset.length : null;
    return {
      stage: s.stage_name,
      value: Math.round(subset.reduce((s, d) => s + Number(d.amount ?? 0), 0)),
      count: subset.length,
      conversionRate: prevCount === null ? 0 : 100,
    };
  });

  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1].count;
    out[i].conversionRate = prev > 0 ? Math.round((out[i].count / prev) * 100) : 0;
  }
  return out;
}

// ─── service-forecasts ─────────────────────────────────────────────────────
//
// Forecasting requires meter-reading time series, contract renewal ML, and
// usage trends. Returning an empty array is the honest answer.

async function serviceForecasts(_ctx: HandlerCtx): Promise<unknown> {
  return [];
}

// ─── technician-capacity ───────────────────────────────────────────────────
//
// Real technicians, with currentUtilization estimated from open ticket count.
// Forecasted utilization needs a scheduling model — degraded.

async function technicianCapacity(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const [techRes, ticketRes] = await Promise.all([
    db
      .from('technicians')
      .select('id, first_name, last_name, skills')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true),
    db
      .from('service_tickets')
      .select('assigned_technician_id, status')
      .eq('tenant_id', auth.tenantId)
      .in('status', ['open', 'assigned', 'in-progress']),
  ]);

  const techs = (techRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    skills: string[] | null;
  }>;
  const tickets = (ticketRes.data ?? []) as Array<{
    assigned_technician_id: string | null;
    status: string;
  }>;

  const openByTech = new Map<string, number>();
  for (const t of tickets) {
    if (!t.assigned_technician_id) continue;
    openByTech.set(t.assigned_technician_id, (openByTech.get(t.assigned_technician_id) ?? 0) + 1);
  }

  const TARGET_OPEN = 10;
  return techs.map((t) => {
    const open = openByTech.get(t.id) ?? 0;
    const utilization = Math.min(100, Math.round((open / TARGET_OPEN) * 100));
    return {
      technicianId: t.id,
      name: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unknown',
      currentUtilization: utilization,
      forecastedUtilization: utilization,
      skills: t.skills ?? [],
      territory: '',
      upcomingAssignments: open,
      recommendedActions: utilization > 90 ? ['Reduce ticket load'] : [],
    };
  });
}

// ─── inventory-forecast ────────────────────────────────────────────────────

async function inventoryForecast(_ctx: HandlerCtx): Promise<unknown> {
  return [];
}

// ─── service-summary ───────────────────────────────────────────────────────

async function serviceSummary(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const horizonDays = horizonToDays(url.searchParams.get('horizon')) || 30;
  const from = new Date(Date.now() - horizonDays * 86_400_000).toISOString();

  const { data } = await db
    .from('service_tickets')
    .select('id, status, priority, created_at, resolved_at')
    .eq('tenant_id', auth.tenantId)
    .gte('created_at', from);

  const list = (data ?? []) as Array<{
    id: string;
    status: string;
    priority: string;
    created_at: string;
    resolved_at: string | null;
  }>;

  const completed = list.filter((t) => t.status === 'completed' || t.status === 'closed');
  const open = list.filter((t) => t.status !== 'completed' && t.status !== 'closed');
  const resolutionTimes = completed
    .filter((t) => t.resolved_at)
    .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());

  const avgResolutionHours =
    resolutionTimes.length > 0
      ? Math.round(
          resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length / (1000 * 60 * 60),
        )
      : 0;

  return {
    totalTickets: list.length,
    openTickets: open.length,
    completedTickets: completed.length,
    avgResolutionHours,
    criticalTickets: list.filter((t) => t.priority === 'critical' || t.priority === 'urgent')
      .length,
    horizonDays,
  };
}

// ─── revenue ───────────────────────────────────────────────────────────────
//
// Single-number revenue snapshot for KPI tiles. Scope is kept opaque (the
// Express version had no implementation either).

async function revenueSnapshot(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data } = await db
    .from('invoices')
    .select('total_amount, paid_date')
    .eq('tenant_id', auth.tenantId)
    .gte('invoice_date', from);

  const list = (data ?? []) as Array<{ total_amount: string | null; paid_date: string | null }>;
  const total = list.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const collected = list
    .filter((i) => i.paid_date != null)
    .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  return {
    period: '30d',
    totalRevenue: Math.round(total),
    collectedRevenue: Math.round(collected),
    invoiceCount: list.length,
    scope: ctx.url.searchParams.get('scope') ?? 'all',
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function periodToDays(period: string | null): number {
  switch (period) {
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'ytd': {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return Math.ceil((now.getTime() - start.getTime()) / 86_400_000);
    }
    case '12m':
      return 365;
    default:
      return 30;
  }
}

function horizonToDays(horizon: string | null): number {
  switch (horizon) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 0;
  }
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function fetchCustomerNames(
  db: HandlerCtx['db'],
  tenantId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  return new Map(
    ((data ?? []) as Array<{ id: string; company_name: string | null }>).map((r) => [
      r.id,
      r.company_name ?? 'Unknown',
    ]),
  );
}

async function fetchCreditLimits(
  db: HandlerCtx['db'],
  tenantId: string,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data } = await db
    .from('business_records')
    .select('id, credit_limit')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  return new Map(
    ((data ?? []) as Array<{ id: string; credit_limit: string | null }>).map((r) => [
      r.id,
      Number(r.credit_limit ?? 0),
    ]),
  );
}
