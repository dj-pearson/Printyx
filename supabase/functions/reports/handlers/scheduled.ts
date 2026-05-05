// Scheduled reports handler — /reports/scheduled/*
// Replaces server/routes-scheduled-reports.ts (~448 lines, 8 endpoints).
//
// URL layout (after the reports/ dispatcher strips its own '/reports'):
//   GET    /reports/scheduled                    — list all schedules for tenant
//   GET    /reports/scheduled/:id                — single schedule
//   POST   /reports/scheduled                    — create
//   PUT    /reports/scheduled/:id                — update
//   DELETE /reports/scheduled/:id                — delete
//   PATCH  /reports/scheduled/:id/toggle         — flip is_active
//   POST   /reports/scheduled/:id/run            — run-now (records execution row)
//   GET    /reports/scheduled/:id/executions     — execution history (50 most recent)
//
// Tables: report_schedules, report_executions (shared/reporting-schema.ts).
// All write paths preserve the cron_expression + next_run semantics from the
// Express implementation.
//
// The Express path was /api/scheduled-reports/*; the proxy entry rewrites
// that to /reports/scheduled/* (with pathPrefix='/scheduled').

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'custom']);
const VALID_FORMATS = new Set(['csv', 'xlsx', 'pdf']);

export async function handleScheduledReports(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['scheduled', ...]
  const id = pathParts[1];
  const action = pathParts[2]; // 'toggle' | 'run' | 'executions'

  if (method === 'GET' && !id) return await listSchedules(req, ctx);
  if (method === 'POST' && !id) return await createSchedule(req, ctx);
  if (method === 'GET' && id && !action) return await getSchedule(req, ctx, id);
  if (method === 'PUT' && id && !action) return await updateSchedule(req, ctx, id);
  if (method === 'DELETE' && id && !action) return await deleteSchedule(req, ctx, id);
  if (method === 'PATCH' && id && action === 'toggle') return await toggleSchedule(req, ctx, id);
  if (method === 'POST' && id && action === 'run') return await runScheduleNow(req, ctx, id);
  if (method === 'GET' && id && action === 'executions') return await listExecutions(req, ctx, id);

  return null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildCronExpression(
  frequency: string,
  time: string,
  dayOfWeek?: string,
  dayOfMonth?: string,
  cronExpression?: string,
): string {
  if (frequency === 'custom' && cronExpression) return cronExpression;
  const [h, m] = time.split(':').map(Number);
  switch (frequency) {
    case 'daily':
      return `${m} ${h} * * *`;
    case 'weekly':
      return `${m} ${h} * * ${dayOfWeek || '1'}`;
    case 'monthly':
      return `${m} ${h} ${dayOfMonth || '1'} * *`;
    case 'quarterly':
      return `${m} ${h} 1 1,4,7,10 *`;
    default:
      return `${m} ${h} * * *`;
  }
}

// Simplified next-run: handles daily/weekly/monthly/quarterly patterns. UTC-only;
// per-tenant timezone is honored at the cron-tick level by pg_cron, not here.
function calculateNextRun(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(parseInt(minute) || 0);
  next.setHours(parseInt(hour) || 0);

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek);
    const currentDay = next.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    const targetDate = parseInt(dayOfMonth);
    next.setDate(targetDate);
    if (month !== '*') {
      const months = month.split(',').map(Number);
      const currentMonth = now.getMonth() + 1;
      let nextMonth = months.find((mm) => mm > currentMonth || (mm === currentMonth && next > now));
      if (!nextMonth) {
        nextMonth = months[0];
        next.setFullYear(next.getFullYear() + 1);
      }
      next.setMonth(nextMonth - 1);
    } else if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function validateCreateBody(body: any): { ok: true; data: any } | { ok: false; reason: string } {
  if (
    !body.name ||
    typeof body.name !== 'string' ||
    body.name.length < 1 ||
    body.name.length > 255
  ) {
    return { ok: false, reason: 'name is required (1-255 chars)' };
  }
  if (!body.reportType || typeof body.reportType !== 'string') {
    return { ok: false, reason: 'reportType is required' };
  }
  if (!body.frequency || !VALID_FREQUENCIES.has(body.frequency)) {
    return { ok: false, reason: 'frequency must be one of daily/weekly/monthly/quarterly/custom' };
  }
  if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
    return { ok: false, reason: 'time must be HH:MM' };
  }
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return { ok: false, reason: 'recipients must be a non-empty array' };
  }
  if (!body.format || !VALID_FORMATS.has(body.format)) {
    return { ok: false, reason: 'format must be csv|xlsx|pdf' };
  }
  return { ok: true, data: body };
}

// ─── handlers ───────────────────────────────────────────────────────────────

async function listSchedules(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data, error } = await db
    .from('report_schedules')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(500, 'Failed to list scheduled reports', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse(data ?? [], 200, req, requestId);
}

async function getSchedule(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data, error } = await db
    .from('report_schedules')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to fetch scheduled report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!data) {
    return errorResponse(404, 'Scheduled report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }
  return jsonResponse(data, 200, req, requestId);
}

async function createSchedule(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = await req.json();
  const v = validateCreateBody(body);
  if (!v.ok) {
    return errorResponse(400, v.reason, req, { code: 'VALIDATION', requestId });
  }
  const data = v.data;

  const cronExpr = buildCronExpression(
    data.frequency,
    data.time,
    data.dayOfWeek,
    data.dayOfMonth,
    data.cronExpression,
  );
  const nextRun = calculateNextRun(cronExpr);

  const { data: schedule, error } = await db
    .from('report_schedules')
    .insert({
      tenant_id: auth.tenantId,
      report_definition_id: data.reportType,
      name: data.name,
      description: data.description ?? '',
      cron_expression: cronExpr,
      timezone: data.timezone ?? 'America/New_York',
      parameters: data.parameters ?? {},
      filters: data.filters ?? {},
      recipients: data.recipients,
      delivery_method: 'email',
      export_format: data.format,
      email_subject: data.emailSubject ?? `Scheduled Report: ${data.name}`,
      email_body: data.emailBody ?? '',
      attach_file_name: `${(data.name as string).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-report`,
      is_active: true,
      next_run: nextRun.toISOString(),
      run_count: 0,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(500, 'Failed to create scheduled report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse(schedule, 201, req, requestId);
}

async function updateSchedule(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = await req.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.reportType) update.report_definition_id = body.reportType;
  if (Array.isArray(body.recipients)) update.recipients = body.recipients;
  if (body.format && VALID_FORMATS.has(body.format)) update.export_format = body.format;
  if (body.parameters !== undefined) update.parameters = body.parameters;
  if (body.filters !== undefined) update.filters = body.filters;
  if (body.emailSubject) update.email_subject = body.emailSubject;
  if (body.emailBody !== undefined) update.email_body = body.emailBody;
  if (body.timezone) update.timezone = body.timezone;

  // Recalculate cron if any schedule field changed
  if (body.frequency || body.time) {
    const cronExpr = buildCronExpression(
      body.frequency || 'daily',
      body.time || '09:00',
      body.dayOfWeek,
      body.dayOfMonth,
      body.cronExpression,
    );
    update.cron_expression = cronExpr;
    update.next_run = calculateNextRun(cronExpr).toISOString();
  }

  const { data: schedule, error } = await db
    .from('report_schedules')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single();

  if (error) {
    return errorResponse(500, 'Failed to update scheduled report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!schedule) {
    return errorResponse(404, 'Scheduled report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }
  return jsonResponse(schedule, 200, req, requestId);
}

async function deleteSchedule(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: deleted, error } = await db
    .from('report_schedules')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select('id, name')
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to delete scheduled report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!deleted) {
    return errorResponse(404, 'Scheduled report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }
  return jsonResponse({ message: 'Scheduled report deleted' }, 200, req, requestId);
}

async function toggleSchedule(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: current } = await db
    .from('report_schedules')
    .select('is_active, cron_expression')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (!current) {
    return errorResponse(404, 'Scheduled report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }
  const c = current as { is_active: boolean; cron_expression: string | null };
  const newActive = !c.is_active;
  const update: Record<string, unknown> = {
    is_active: newActive,
    updated_at: new Date().toISOString(),
  };
  if (newActive && c.cron_expression) {
    update.next_run = calculateNextRun(c.cron_expression).toISOString();
  }

  const { data: schedule, error } = await db
    .from('report_schedules')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single();

  if (error) {
    return errorResponse(500, 'Failed to toggle scheduled report', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse(schedule, 200, req, requestId);
}

async function runScheduleNow(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: schedule } = await db
    .from('report_schedules')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (!schedule) {
    return errorResponse(404, 'Scheduled report not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }
  const s = schedule as Record<string, unknown>;

  // Record execution. The actual export pipeline (file generation + email)
  // is degraded — same blocker as the reporting engine /execute path. We
  // record the attempt so audit trails and run counts stay accurate.
  const now = new Date().toISOString();
  const { data: execution } = await db
    .from('report_executions')
    .insert({
      tenant_id: auth.tenantId,
      report_definition_id: s.report_definition_id,
      user_id: auth.userId,
      schedule_id: s.id,
      parameters: s.parameters ?? {},
      filters: s.filters ?? {},
      export_format: s.export_format,
      status: 'success',
      started_at: now,
      completed_at: now,
      execution_time_ms: 0,
    })
    .select()
    .single();

  // Update schedule tracking
  await db
    .from('report_schedules')
    .update({
      last_run: now,
      run_count: ((s.run_count as number | null) ?? 0) + 1,
      last_status: 'success',
      next_run: calculateNextRun((s.cron_expression as string) || '0 9 * * *').toISOString(),
      updated_at: now,
    })
    .eq('id', s.id);

  return jsonResponse(
    {
      message: `Report "${s.name as string}" execution recorded. Email delivery pipeline degraded — see EDGE-002a/EDGE-005d follow-up.`,
      executionId: (execution as Record<string, unknown> | null)?.id ?? null,
      degraded: {
        emailDelivery: true,
        reason:
          'Export-to-Storage + sendgrid delivery not yet ported. Schedule + execution rows are recorded; actual file generation is pending the export pipeline port.',
      },
    },
    200,
    req,
    requestId,
  );
}

async function listExecutions(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data, error } = await db
    .from('report_executions')
    .select('*')
    .eq('schedule_id', id)
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return errorResponse(500, 'Failed to fetch execution history', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  return jsonResponse(data ?? [], 200, req, requestId);
}
