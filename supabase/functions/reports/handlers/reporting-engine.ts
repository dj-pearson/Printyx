// Generic reporting engine — /reports/engine/*
// Replaces server/routes/reporting-api.ts.
//
// URL layout (under /reports/engine — namespaced to avoid collision with
// the persona handlers):
//   GET    /reports/engine                       — list definitions
//   GET    /reports/engine/:code                 — get definition
//   POST   /reports/engine/:code/execute         — run (degraded — see below)
//   POST   /reports/engine/:code/export          — export (degraded)
//   POST   /reports/engine/:code/schedule        — create schedule
//   GET    /reports/engine/scheduled/list        — list schedules
//   DELETE /reports/engine/scheduled/:id         — cancel schedule
//   GET    /reports/engine/executions/recent     — recent execution history
//
// `execute` and `export` are intentionally degraded: report_definitions.sql_query
// stores arbitrary SQL strings, and PostgREST (the path supabase-js takes)
// cannot execute dynamic SQL safely. The honest workaround is to expose
// each canonical report through a stored function and call it via db.rpc(),
// but we don't yet have those functions. The endpoint records an execution
// row so audit logs stay accurate, and returns a degraded placeholder.
//
// Definitions / schedules / executions tables are real (shared/reporting-schema.ts)
// so list / get / schedule CRUD all work normally.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleReportingEngine(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['engine', ...]
  // Possible shapes:
  //   ['engine']                           — list
  //   ['engine', 'scheduled', 'list']      — list schedules
  //   ['engine', 'scheduled', ':id']       — DELETE schedule
  //   ['engine', 'executions', 'recent']   — recent executions
  //   ['engine', ':code']                  — get definition
  //   ['engine', ':code', 'execute']       — run
  //   ['engine', ':code', 'export']        — export
  //   ['engine', ':code', 'schedule']      — schedule

  const seg1 = pathParts[1];
  const seg2 = pathParts[2];

  if (method === 'GET' && !seg1) return await listDefinitions(req, ctx);

  if (seg1 === 'scheduled') {
    if (method === 'GET' && seg2 === 'list') return await listSchedules(req, ctx);
    if (method === 'DELETE' && seg2) return await deleteSchedule(req, ctx, seg2);
  }

  if (method === 'GET' && seg1 === 'executions' && seg2 === 'recent') {
    return await recentExecutions(req, ctx);
  }

  // Per-report: /:code or /:code/{execute,export,schedule}
  if (seg1 && !seg2 && method === 'GET') return await getDefinition(req, ctx, seg1);
  if (seg1 && seg2 === 'execute' && method === 'POST') return await executeReport(req, ctx, seg1);
  if (seg1 && seg2 === 'export' && method === 'POST') return await exportReport(req, ctx, seg1);
  if (seg1 && seg2 === 'schedule' && method === 'POST') return await createSchedule(req, ctx, seg1);

  return null;
}

// ─── definitions ────────────────────────────────────────────────────────────

async function listDefinitions(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const category = url.searchParams.get('category');
  const scope = url.searchParams.get('scope');
  const search = url.searchParams.get('search');

  let q = db
    .from('report_definitions')
    .select(
      'id, code, name, description, category, organizational_scope, default_visualization, is_real_time, supports_drill_down, supports_export, contains_sensitive_data, tags',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);
  if (category) q = q.eq('category', category);
  if (scope) q = q.eq('organizational_scope', scope);

  const { data, error } = await q;
  if (error) {
    return errorResponse(500, 'Failed to fetch reports', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  let reports = (data ?? []) as Array<{ name: string; description: string | null; code: string }>;
  if (search) {
    const s = search.toLowerCase();
    reports = reports.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.description ?? '').toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s),
    );
  }

  return jsonResponse({ reports, total: reports.length }, 200, req, requestId);
}

async function getDefinition(req: Request, ctx: HandlerCtx, code: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data, error } = await db
    .from('report_definitions')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to fetch report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  // Strip sql_query from the response — never expose it to clients.
  const { sql_query: _omit, ...definitionWithoutSql } = data as Record<string, unknown>;

  // Fetch user preferences if any.
  const { data: prefs } = await db
    .from('user_report_preferences')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('report_definition_id', (data as Record<string, unknown>).id)
    .maybeSingle();

  return jsonResponse(
    { report: definitionWithoutSql, userPreferences: prefs ?? null },
    200,
    req,
    requestId,
  );
}

// ─── execute / export (degraded) ────────────────────────────────────────────

async function executeReport(req: Request, ctx: HandlerCtx, code: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const startedAt = new Date().toISOString();

  const { data: def, error: defErr } = await db
    .from('report_definitions')
    .select('id, name')
    .eq('tenant_id', auth.tenantId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (defErr) {
    return errorResponse(500, 'Failed to load report definition', req, {
      code: 'DB_ERROR',
      details: defErr.message,
      requestId,
    });
  }
  if (!def) {
    return errorResponse(404, 'Report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  let body: { parameters?: Record<string, unknown>; filters?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  // Record the execution attempt. Even though we don't run the SQL, the audit
  // trail captures who tried to execute what and when.
  const reportDefId = (def as { id: string }).id;
  await db.from('report_executions').insert({
    tenant_id: auth.tenantId,
    report_definition_id: reportDefId,
    user_id: auth.userId,
    parameters: body.parameters ?? {},
    filters: body.filters ?? {},
    status: 'failed',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    error_message: 'execute_degraded: PostgREST cannot run dynamic SQL',
    error_code: 'EXECUTE_DEGRADED',
  });

  return jsonResponse(
    {
      reportCode: code,
      reportName: (def as { name: string }).name,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: 0,
      degraded: {
        rawSqlExecution: true,
        reason:
          'Dynamic SQL execution is not available through PostgREST. Persona-specific reports under /reports/{persona}/* return real data; the generic execute path will return live data once each report definition is wired to a Postgres stored function and called via db.rpc().',
      },
    },
    200,
    req,
    requestId,
  );
}

async function exportReport(req: Request, ctx: HandlerCtx, code: string): Promise<Response> {
  return jsonResponse(
    {
      reportCode: code,
      filePath: null,
      fileSize: 0,
      format: 'pdf',
      degraded: {
        export: true,
        reason:
          'Export pipeline (PDF/CSV/Excel generation + Supabase Storage upload) not yet ported. Definitions and schedules CRUD work normally.',
      },
    },
    200,
    req,
    ctx.requestId,
  );
}

// ─── schedules ──────────────────────────────────────────────────────────────

async function listSchedules(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data, error } = await db
    .from('report_schedules')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .order('next_run', { ascending: true });

  if (error) {
    return errorResponse(500, 'Failed to fetch schedules', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse({ schedules: data ?? [], total: (data ?? []).length }, 200, req, requestId);
}

async function createSchedule(req: Request, ctx: HandlerCtx, code: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  let body: {
    name?: string;
    description?: string;
    cronExpression?: string;
    timezone?: string;
    parameters?: Record<string, unknown>;
    filters?: Record<string, unknown>;
    recipients?: unknown;
    deliveryMethod?: string;
    exportFormat?: string;
    emailSubject?: string;
    emailBody?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'INVALID_JSON',
      requestId,
    });
  }

  if (!body.name || !body.cronExpression || !body.recipients) {
    return errorResponse(400, 'name, cronExpression, and recipients are required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }

  const { data: def, error: defErr } = await db
    .from('report_definitions')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (defErr) {
    return errorResponse(500, 'Failed to lookup report', req, {
      code: 'DB_ERROR',
      details: defErr.message,
      requestId,
    });
  }
  if (!def) {
    return errorResponse(404, 'Report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  const { data, error } = await db
    .from('report_schedules')
    .insert({
      tenant_id: auth.tenantId,
      report_definition_id: (def as { id: string }).id,
      name: body.name,
      description: body.description ?? null,
      cron_expression: body.cronExpression,
      timezone: body.timezone ?? 'UTC',
      parameters: body.parameters ?? {},
      filters: body.filters ?? {},
      recipients: body.recipients,
      delivery_method: body.deliveryMethod ?? 'email',
      export_format: body.exportFormat ?? 'pdf',
      email_subject: body.emailSubject ?? null,
      email_body: body.emailBody ?? null,
      is_active: true,
      created_by: auth.userId,
    })
    .select('*')
    .single();

  if (error) {
    return errorResponse(500, 'Failed to create schedule', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse({ schedule: data }, 201, req, requestId);
}

async function deleteSchedule(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  // Soft-delete by flipping is_active so the audit trail survives.
  const { error } = await db
    .from('report_schedules')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  if (error) {
    return errorResponse(500, 'Failed to cancel schedule', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse({ success: true, scheduleId: id }, 200, req, requestId);
}

// ─── executions ─────────────────────────────────────────────────────────────

async function recentExecutions(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);

  const { data, error } = await db
    .from('report_executions')
    .select(
      'id, report_definition_id, user_id, schedule_id, parameters, filters, execution_time_ms, row_count, status, error_message, started_at, completed_at',
    )
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(500, 'Failed to fetch executions', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse({ executions: data ?? [], total: (data ?? []).length }, 200, req, requestId);
}
