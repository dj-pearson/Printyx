// Reporting catalog + dashboard summary + export endpoints — /reports/reporting/*
// Replaces server/routes-reporting.ts /reports, /kpis (alias), /reports/export,
// /exports/:id/download, /exports/stats, /dashboard/summary endpoints.
//
// URL layout:
//   GET  /reports/reporting/reports                — list reports (frontend uses this)
//   GET  /reports/reporting/kpis                   — list KPIs (frontend uses this; alias of /reports/kpis)
//   GET  /reports/reporting/dashboard/summary      — dashboard summary
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
