// Cross-domain dashboard reports — /reports/dashboards/*
// Migrated from the prior reports/index.ts monolith. Each endpoint is a
// pre-baked aggregation across business_records, quotes, service_tickets,
// quote_line_items, sales_territories, users.
//
// These pre-date the persona split; they remain in place because the
// frontend still calls them by their original paths. Per-persona reports
// (director / executive / sales / service / etc.) live in handlers/<persona>.ts
// once ported.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey } from '../_cache.ts';

const DASHBOARDS_TTL_SECONDS = 300; // 5 min

export async function handleDashboards(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['dashboards', <reportType>]
  if (method !== 'GET') return null;
  const reportType = pathParts[1];
  if (!reportType) return null;

  switch (reportType) {
    case 'executive-summary':
      return cachedReport(req, ctx, reportType, executiveSummary);
    case 'kpi-scorecards':
      return cachedReport(req, ctx, reportType, kpiScorecards);
    case 'business-insights':
      return cachedReport(req, ctx, reportType, businessInsights);
    case 'competitive-metrics':
      return cachedReport(req, ctx, reportType, competitiveMetrics);
    case 'territory-performance':
      return cachedReport(req, ctx, reportType, territoryPerformance);
    case 'revenue-attribution':
      return cachedReport(req, ctx, reportType, revenueAttribution);
    default:
      return null;
  }
}

async function cachedReport(
  req: Request,
  ctx: HandlerCtx,
  reportType: string,
  loader: (ctx: HandlerCtx) => Promise<unknown>,
): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:dashboards:${reportType}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const data = await cached(key, DASHBOARDS_TTL_SECONDS, () => loader(ctx));
    return jsonResponse(data, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, `Failed to compute ${reportType}`, req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── executive-summary ─────────────────────────────────────────────────────

async function executiveSummary(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const startIso = range.start.toISOString();

  const [customers, quotes, tickets, revenue] = await Promise.all([
    db
      .from('business_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'customer'),
    db
      .from('quotes')
      .select('id, status, total_amount')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
    db
      .from('service_tickets')
      .select('id, status')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
    db
      .from('quotes')
      .select('total_amount')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'accepted')
      .gte('accepted_date', startIso),
  ]);

  const totalRevenue =
    (revenue.data ?? []).reduce((sum, q) => sum + parseFloat(String(q.total_amount ?? '0')), 0) ??
    0;
  const quotesData = quotes.data ?? [];
  const ticketsData = tickets.data ?? [];

  return {
    period: range.period,
    metrics: {
      totalCustomers: customers.count ?? 0,
      totalQuotes: quotesData.length,
      activeQuotes: quotesData.filter((q) => q.status === 'sent').length,
      wonQuotes: quotesData.filter((q) => q.status === 'accepted').length,
      totalRevenue,
      openTickets: ticketsData.filter((t) => ['open', 'assigned', 'in-progress'].includes(t.status))
        .length,
      totalTickets: ticketsData.length,
    },
  };
}

// ─── kpi-scorecards ────────────────────────────────────────────────────────

async function kpiScorecards(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const startIso = range.start.toISOString();

  const [quotes, tickets, customers] = await Promise.all([
    db
      .from('quotes')
      .select('status, total_amount, created_at, sent_date, accepted_date')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
    db
      .from('service_tickets')
      .select('status, created_at, resolved_at')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
    db
      .from('business_records')
      .select('record_type, status, created_at')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
  ]);

  const quotesData = quotes.data ?? [];
  const ticketsData = tickets.data ?? [];
  const customersData = customers.data ?? [];

  const totalQuotes = quotesData.length;
  const wonQuotes = quotesData.filter((q) => q.status === 'accepted').length;
  const winRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;

  const resolvedTickets = ticketsData.filter((t) => t.status === 'completed').length;
  const resolvedWithTime = ticketsData.filter((t) => t.resolved_at);
  const avgResolutionTime =
    resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, t) => {
          return sum + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime());
        }, 0) / resolvedWithTime.length
      : 0;

  const newCustomers = customersData.filter((c) => c.record_type === 'customer').length;
  const newLeads = customersData.filter((c) => c.record_type === 'lead').length;

  const wonRevenue = quotesData
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + parseFloat(String(q.total_amount ?? '0')), 0);

  return {
    period: range.period,
    kpis: {
      sales: {
        winRate: Math.round(winRate),
        totalQuotes,
        wonQuotes,
        avgDealSize: wonQuotes > 0 ? wonRevenue / wonQuotes : 0,
      },
      service: {
        totalTickets: ticketsData.length,
        resolvedTickets,
        avgResolutionHours: Math.round(avgResolutionTime / (1000 * 60 * 60)),
        openTickets: ticketsData.filter((t) =>
          ['open', 'assigned', 'in-progress'].includes(t.status),
        ).length,
      },
      customers: {
        newCustomers,
        newLeads,
        conversionRate: newLeads > 0 ? Math.round((newCustomers / newLeads) * 100) : 0,
      },
    },
  };
}

// ─── business-insights ─────────────────────────────────────────────────────

async function businessInsights(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const startIso = range.start.toISOString();

  const [topCustomers, productPerformance, territoryStats] = await Promise.all([
    db
      .from('quotes')
      .select(
        'customer_id, total_amount, customer:business_records!quotes_customer_id_fkey(company_name)',
      )
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'accepted')
      .gte('accepted_date', startIso),
    db
      .from('quote_line_items')
      .select('description, quantity, total_price')
      .eq('tenant_id', auth.tenantId),
    db
      .from('business_records')
      .select('territory, status')
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'customer'),
  ]);

  const customerRevenue = new Map<string, { name: string; revenue: number }>();
  for (const q of topCustomers.data ?? []) {
    const customerId = (q.customer_id as string | null) ?? 'unknown';
    const existing = customerRevenue.get(customerId) ?? {
      name: ((q.customer as { company_name?: string } | null)?.company_name as string) ?? 'Unknown',
      revenue: 0,
    };
    existing.revenue += parseFloat(String(q.total_amount ?? '0'));
    customerRevenue.set(customerId, existing);
  }
  const top5Customers = [...customerRevenue.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const territories = new Map<string, number>();
  for (const c of territoryStats.data ?? []) {
    const t = (c.territory as string | null) ?? 'Unassigned';
    territories.set(t, (territories.get(t) ?? 0) + 1);
  }

  return {
    topCustomers: top5Customers,
    territoryDistribution: [...territories.entries()].map(([name, count]) => ({ name, count })),
    totalProducts: (productPerformance.data ?? []).length,
  };
}

// ─── competitive-metrics ───────────────────────────────────────────────────

async function competitiveMetrics(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const startIso = range.start.toISOString();

  const [quotes, tickets] = await Promise.all([
    db
      .from('quotes')
      .select('status, created_at, sent_date, accepted_date')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
    db
      .from('service_tickets')
      .select('created_at, resolved_at, status')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', startIso),
  ]);

  const quotesData = quotes.data ?? [];
  const ticketsData = tickets.data ?? [];

  const sentQuotes = quotesData.filter((q) => q.sent_date);
  const avgQuoteResponseTime =
    sentQuotes.length > 0
      ? sentQuotes.reduce(
          (sum, q) => sum + (new Date(q.sent_date).getTime() - new Date(q.created_at).getTime()),
          0,
        ) / sentQuotes.length
      : 0;

  const resolvedTickets = ticketsData.filter((t) => t.resolved_at);
  const avgTicketResolution =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce(
          (sum, t) => sum + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()),
          0,
        ) / resolvedTickets.length
      : 0;

  return {
    metrics: {
      avgQuoteResponseHours: Math.round(avgQuoteResponseTime / (1000 * 60 * 60)),
      avgTicketResolutionHours: Math.round(avgTicketResolution / (1000 * 60 * 60)),
      quoteWinRate:
        quotesData.length > 0
          ? Math.round(
              (quotesData.filter((q) => q.status === 'accepted').length / quotesData.length) * 100,
            )
          : 0,
      firstTimeFixRate:
        ticketsData.length > 0
          ? Math.round(
              (ticketsData.filter((t) => t.status === 'completed').length / ticketsData.length) *
                100,
            )
          : 0,
    },
  };
}

// ─── territory-performance ─────────────────────────────────────────────────

async function territoryPerformance(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);

  const [territories, customers] = await Promise.all([
    db
      .from('sales_territories')
      .select('id, territory_name, owner_id')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true),
    db
      .from('business_records')
      .select('territory')
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'customer'),
  ]);

  const customersData = customers.data ?? [];
  const territoryPerformance = (territories.data ?? []).map((t) => ({
    territoryId: t.id as string,
    territoryName: t.territory_name as string,
    customerCount: customersData.filter((c) => c.territory === t.territory_name).length,
    revenue: 0, // Joining quotes by customer→territory left as a follow-up.
  }));

  return { period: range.period, territories: territoryPerformance };
}

// ─── revenue-attribution ───────────────────────────────────────────────────

async function revenueAttribution(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const startIso = range.start.toISOString();

  const { data } = await db
    .from('quotes')
    .select(
      'total_amount, status, created_by, created_by_user:users!quotes_created_by_fkey(first_name, last_name)',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'accepted')
    .gte('accepted_date', startIso);

  const revenueByRep = new Map<string, { name: string; revenue: number; deals: number }>();
  for (const q of data ?? []) {
    const repId = (q.created_by as string | null) ?? 'unknown';
    const u = q.created_by_user as { first_name?: string; last_name?: string } | null;
    const repName = u
      ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown'
      : 'Unknown';
    const existing = revenueByRep.get(repId) ?? { name: repName, revenue: 0, deals: 0 };
    existing.revenue += parseFloat(String(q.total_amount ?? '0'));
    existing.deals += 1;
    revenueByRep.set(repId, existing);
  }

  const attribution = [...revenueByRep.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  return {
    period: range.period,
    attribution,
    totalRevenue: attribution.reduce((sum, a) => sum + a.revenue, 0),
  };
}
