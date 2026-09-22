// Reporting catalog + dashboard summary + export endpoints — /reports/reporting/*
// Replaces server/routes-reporting.ts /reports, /kpis (alias), /reports/export,
// /exports/:id/download, /exports/stats, /dashboard/summary endpoints.
//
// URL layout:
//   GET  /reports/reporting/reports                — list reports (frontend uses this)
//   GET  /reports/reporting/kpis                   — list KPIs (frontend uses this; alias of /reports/kpis)
//   GET  /reports/reporting/dashboard/summary      — dashboard summary
//   GET  /reports/reporting/charts?category=&period=  — the three dashboard charts
//   POST /reports/reporting/reports/export         — degraded: export pipeline not ported
//   GET  /reports/reporting/exports/stats          — degraded
//   GET  /reports/reporting/exports/:id/download   — degraded
//
// Live reports + KPIs CRUD work normally. Dashboard summary aggregates from
// existing tables. Export-pipeline endpoints are degraded because the original
// implementation depends on file-system writes + email + dynamic SQL — those
// pieces need separate ports (Supabase Storage + sendgrid fetch + db.rpc).

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { fetchAllRows } from '../../_shared/paged-select.ts';
import { startOfNextUtcDay, startOfUtcDay } from '../../_shared/date-months.ts';
import { parsePeriod, previousRange, rangeForPeriod } from '../_date.ts';
import {
  buildChartSeries,
  CHARTED_CATEGORIES,
  isChartedCategory,
  UNCHARTED_REASON,
  type ReportCategory,
  type SourceRow,
} from '../../../../shared/report-chart-series.ts';

export async function handleReporting(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['reporting', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];
  const sub3 = pathParts[3];

  if (method === 'GET' && sub === 'reports' && !sub2) return await listReports(req, ctx);
  if (method === 'GET' && sub === 'kpis' && !sub2) return await listKpisAlias(req, ctx);
  if (method === 'GET' && sub === 'dashboard' && sub2 === 'summary') {
    return await dashboardSummary(req, ctx);
  }
  if (method === 'GET' && sub === 'charts' && !sub2) return await dashboardCharts(req, ctx);

  if (method === 'POST' && sub === 'reports' && sub2 === 'export') {
    return await exportReportDegraded(req, ctx);
  }
  if (method === 'GET' && sub === 'exports' && sub2 === 'stats') {
    return await exportStatsDegraded(req, ctx);
  }
  if (method === 'GET' && sub === 'exports' && sub3 === 'download') {
    return await exportDownloadDegraded(req, ctx);
  }

  return null;
}

// ─── lists ──────────────────────────────────────────────────────────────────

async function listReports(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  const offset = (page - 1) * limit;

  let q = db
    .from('report_definitions')
    .select(
      'id, code, name, description, category, organizational_scope, default_visualization, is_real_time, supports_drill_down, supports_export, contains_sensitive_data, tags, version, updated_at',
      { count: 'exact' },
    )
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);

  if (category) q = q.eq('category', category);

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) {
    return errorResponse(500, 'Failed to fetch reports', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  let reports = (data ?? []) as Array<Record<string, unknown>>;
  if (search) {
    const s = search.toLowerCase();
    reports = reports.filter((r) => {
      const name = (r.name as string | null) ?? '';
      const desc = (r.description as string | null) ?? '';
      return name.toLowerCase().includes(s) || desc.toLowerCase().includes(s);
    });
  }

  return jsonResponse(
    {
      reports,
      total: count ?? reports.length,
      page,
      limit,
    },
    200,
    req,
    requestId,
  );
}

async function listKpisAlias(req: Request, ctx: HandlerCtx): Promise<Response> {
  // Same as GET /reports/kpis — re-implement lightweight here so we don't
  // import across handler files.
  const { auth, db, requestId, url } = ctx;
  const category = url.searchParams.get('category');

  let q = db
    .from('kpi_definitions')
    .select(
      'id, code, name, description, category, target_value, target_type, display_format, prefix, suffix, decimal_places, organizational_scope, is_high_priority, tags, updated_at',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);
  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) {
    return errorResponse(500, 'Failed to fetch KPIs', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  return jsonResponse({ kpis: data ?? [], total: (data ?? []).length }, 200, req, requestId);
}

// ─── dashboard summary ──────────────────────────────────────────────────────

async function dashboardSummary(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const category = url.searchParams.get('category');

  // Reports grouped by category
  let rq = db
    .from('report_definitions')
    .select('id, code, name, category, default_visualization, is_real_time, tags')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);
  if (category) rq = rq.eq('category', category);

  const { data: reports, error: rErr } = await rq;
  if (rErr) {
    return errorResponse(500, 'Failed to fetch dashboard summary', req, {
      code: 'DB_ERROR',
      details: rErr.message,
      requestId,
    });
  }

  // KPIs (high-priority first)
  let kq = db
    .from('kpi_definitions')
    .select('id, code, name, category, display_format, is_high_priority')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);
  if (category) kq = kq.eq('category', category);

  const { data: kpis } = await kq;

  // Recent activity (last 10 report executions/views)
  const { data: recent } = await db
    .from('user_report_activity')
    .select('id, activity_type, report_definition_id, created_at')
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const reportsByCategory: Record<string, Array<Record<string, unknown>>> = {};
  for (const r of (reports ?? []) as Array<Record<string, unknown>>) {
    const cat = (r.category as string) ?? 'uncategorized';
    if (!reportsByCategory[cat]) reportsByCategory[cat] = [];
    reportsByCategory[cat].push(r);
  }

  const highPriorityKpis = (kpis ?? []).filter(
    (k: any) => (k as Record<string, unknown>).is_high_priority === true,
  );

  return jsonResponse(
    {
      reports: reports ?? [],
      reportsByCategory,
      kpis: kpis ?? [],
      highPriorityKpis,
      recentActivity: recent ?? [],
      totals: {
        reports: (reports ?? []).length,
        kpis: (kpis ?? []).length,
        categories: Object.keys(reportsByCategory).length,
      },
    },
    200,
    req,
    requestId,
  );
}

// ─── exports (degraded) ─────────────────────────────────────────────────────

async function exportReportDegraded(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;

  let body: { report_id?: string; format?: string; filename?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  // Audit-log the export attempt so the activity table stays useful even
  // though we can't actually generate the file yet.
  if (body.report_id) {
    await db.from('user_report_activity').insert({
      tenant_id: auth.tenantId,
      user_id: auth.userId,
      activity_type: 'export_report',
      report_definition_id: body.report_id,
      session_id: '',
      ip_address: '',
      user_agent: '',
      parameters: { format: body.format, filename: body.filename, degraded: true },
    });
  }

  return jsonResponse(
    {
      exportId: null,
      status: 'pending',
      filePath: null,
      format: body.format ?? 'csv',
      degraded: {
        export: true,
        reason:
          'Export pipeline (file generation + Supabase Storage upload + sendgrid email) not yet ported to edge function. Persona dashboards under /reports/{persona}/* return real data; the generic export path will land in EDGE-002a or a follow-up.',
      },
    },
    202,
    req,
    requestId,
  );
}

async function exportStatsDegraded(req: Request, ctx: HandlerCtx): Promise<Response> {
  return jsonResponse(
    {
      totalExports: 0,
      pendingExports: 0,
      failedExports: 0,
      averageExportTimeMs: 0,
      degraded: {
        export: true,
        reason:
          'Export pipeline not yet ported. Stats will populate once the export queue is live.',
      },
    },
    200,
    req,
    ctx.requestId,
  );
}

async function exportDownloadDegraded(req: Request, ctx: HandlerCtx): Promise<Response> {
  return errorResponse(
    503,
    'Export downloads not yet available — export pipeline pending port to edge function',
    req,
    {
      code: 'EXPORT_DEGRADED',
      requestId: ctx.requestId,
      details: {
        hint: 'Use the persona-scoped report endpoints under /reports/{persona}/* for live data.',
      },
    },
  );
}

// ─── dashboard charts (REPORTS-CHARTS-002) ──────────────────────────────────

/**
 * GET /reports/reporting/charts?category=<c>&period=week|month|quarter|year
 *
 * The three charts /reports draws above its catalog: a trend over the period, a
 * distribution by the category's own grouping column, and the same period
 * against the one before it.
 *
 * ONLY THREE OF THE EIGHT CATEGORIES HAVE A SOURCE. sales reads `deals`,
 * service reads `service_tickets`, finance reads `invoices`. The other five
 * answer 200 with `charted: false` and the reason, because the alternative is
 * the fabrication AUDIT-020 removed from this exact panel - a random series with
 * a 40000 target drawn over it, on a routed page. A refusal that says which
 * category and why is a better screen than a chart nobody can check.
 *
 * COLUMN NAMES ARE THE REAL ONES, and this is where the family usually goes
 * wrong: `deals` has `amount`, `stage_id` and `status` - NOT `deal_value`,
 * `stage`, `value` or `closed_at`, which COP-M01 records eight edge functions
 * querying. `invoices` has `total_amount` and `invoice_status`.
 *
 * `invoice_date` IS A CALENDAR DATE stored at midnight (DATE-LOCAL-002 names it
 * explicitly), so its window is snapped to day boundaries with a strict
 * next-day upper bound. `deals.created_at` and `service_tickets.created_at` are
 * instants and are compared as instants.
 */
async function dashboardCharts(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const category = (url.searchParams.get('category') ?? '') as ReportCategory;

  if (!isChartedCategory(category)) {
    const reason = UNCHARTED_REASON[category as keyof typeof UNCHARTED_REASON];
    return jsonResponse(
      {
        category: category || null,
        charted: false,
        reason:
          reason ?? 'Unknown report category. Charts exist for sales, service and finance only.',
        chartedCategories: Object.keys(CHARTED_CATEGORIES),
      },
      200,
      req,
      requestId,
    );
  }

  const period = parsePeriod(url.searchParams.get('period'));
  const range = rangeForPeriod(period);
  const prior = previousRange(range);

  const source = CHARTED_CATEGORIES[category];
  const calendarDated = category === 'finance';
  // Snap only the calendar-date column. An instant column compared to a
  // day boundary would move the window, which is the inverse of the defect.
  const lower = (d: Date) => (calendarDated ? startOfUtcDay(d) : d).toISOString();
  const upper = (d: Date) => (calendarDated ? startOfNextUtcDay(d) : d).toISOString();

  const spec = {
    deals: { table: 'deals', at: 'created_at', amount: 'amount', key: 'status' },
    service_tickets: {
      table: 'service_tickets',
      at: 'created_at',
      amount: null,
      key: 'status',
    },
    invoices: {
      table: 'invoices',
      at: 'invoice_date',
      amount: 'total_amount',
      key: 'invoice_status',
    },
  }[source.table];

  const columns = [spec.at, spec.key, ...(spec.amount ? [spec.amount] : [])].join(', ');

  // Paged: a tally computed over one PostgREST page is a truncated number that
  // looks like a fact, which is worse than a short list.
  const load = async (from: Date, to: Date) =>
    await fetchAllRows<Record<string, unknown>>(() =>
      db
        .from(spec.table)
        .select(columns)
        .eq('tenant_id', auth.tenantId)
        .gte(spec.at, lower(from))
        .lt(spec.at, upper(to)),
    );

  let currentRows: Array<Record<string, unknown>>;
  let previousRows: Array<Record<string, unknown>>;
  try {
    [currentRows, previousRows] = await Promise.all([
      load(range.start, range.end),
      load(prior.start, prior.end),
    ]);
  } catch (err) {
    return errorResponse(500, 'Failed to build report charts', req, {
      code: 'DB_ERROR',
      details: String(err),
      requestId,
    });
  }

  const toSource = (rows: Array<Record<string, unknown>>): SourceRow[] =>
    rows.map((r) => ({
      at: r[spec.at] as string | null,
      amount: spec.amount ? (r[spec.amount] as number | string | null) : null,
      key: r[spec.key] as string | null,
    }));

  const series = buildChartSeries({
    current: toSource(currentRows),
    previous: toSource(previousRows),
    start: range.start,
    end: range.end,
  });

  return jsonResponse(
    {
      category,
      charted: true,
      period,
      unit: source.unit,
      source: spec.table,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      previousRange: { start: prior.start.toISOString(), end: prior.end.toISOString() },
      // AC3: there is no per-tenant currency goal to draw. See the module.
      target: null,
      ...series,
    },
    200,
    req,
    requestId,
  );
}
