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
//
// PROD-008b: every schedule row goes out camelCase. ScheduledReportsDashboard.tsx
// types ScheduleFromAPI in camelCase because it was written against the Express
// handler, which returned drizzle rows. Returning PostgREST's snake_case made
// isActive, runCount, nextRun, exportFormat and cronExpression all undefined, so
// the page showed every schedule as Paused with 0 sent and no next run. The
// conversion is shallow on purpose: parameters and filters are jsonb whose inner
// keys belong to the caller and must not be rewritten.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { addMonths, daysInMonth } from '../../_shared/date-months.ts';
import { toCamelShallow } from '../../_shared/case.ts';
import type { HandlerCtx } from '../_context.ts';

/**
 * WHAT A RUN RECORDS WHEN NOTHING WAS DELIVERED.
 *
 * `runScheduleNow` used to insert `status: 'success'` and increment
 * `run_count` for a report it never generated and never sent - while the
 * RESPONSE it returned said `degraded: { emailDelivery: true }`. The honest
 * disclaimer was in the body, which nothing persists, and the claim was in the
 * row, which everything reads afterwards: ScheduledReportsDashboard renders
 * `runCount` as "N sent", sums it into a "Delivered" card, prints it at 6xl
 * under "Reports Delivered Automatically", and multiplies it by 0.25 to claim
 * hours of manual work saved.
 *
 * The sibling handler in this same function already had it right:
 * reporting-engine.ts records `status: 'failed'` with
 * `error_message: 'execute_degraded: ...'` and an error_code. Two handlers in
 * one edge function disagreeing about whether the same missing capability is a
 * success is the shape to grep for (round 132 found the same thing between a
 * bulk update and the bulk delete twenty lines below it).
 *
 * `report_status` is ('success','failed','running','timeout','cancelled') -
 * checked against migration 0000, not assumed - so 'failed' is the only member
 * that can carry "this did not happen".
 */
export const DELIVERY_DEGRADED_CODE = 'DELIVERY_DEGRADED';
export const DELIVERY_DEGRADED_MESSAGE =
  'delivery_degraded: report generation and email delivery are not implemented; no file was produced and nothing was sent';
export const DELIVERY_DEGRADED_REASON =
  'Export-to-Storage and email delivery are not implemented. The run was recorded as failed rather than counted as a delivery: run_count is what this page renders as "sent".';

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
export function calculateNextRun(cronExpression: string): Date {
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
      // setMonth on a date carrying a day-of-month past the target month's length
      // overflows into the month after: a report scheduled for the 31st and rolled
      // to February would fire in March. Clamp the day first.
      next.setDate(Math.min(next.getDate(), daysInMonth(next.getFullYear(), nextMonth - 1)));
      next.setMonth(nextMonth - 1);
    } else if (next <= now) {
      next.setTime(addMonths(next, 1).getTime());
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
  return jsonResponse((data ?? []).map(toCamelShallow), 200, req, requestId);
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
  return jsonResponse(toCamelShallow(data), 200, req, requestId);
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
  return jsonResponse(toCamelShallow(schedule), 201, req, requestId);
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
  return jsonResponse(toCamelShallow(schedule), 200, req, requestId);
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
  return jsonResponse(toCamelShallow(schedule), 200, req, requestId);
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

  // Record the ATTEMPT. The export pipeline (file generation + email) is not
  // implemented - the same blocker as the reporting engine's /execute path,
  // which records this as a failure. Recording it as a success is what made
  // the audit trail and the run count INACCURATE, which is the opposite of
  // what the old comment here claimed.
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
      status: 'failed',
      started_at: now,
      completed_at: now,
      execution_time_ms: 0,
      error_message: DELIVERY_DEGRADED_MESSAGE,
      error_code: DELIVERY_DEGRADED_CODE,
    })
    .select()
    .single();

  // Update schedule tracking
  await db
    .from('report_schedules')
    .update({
      last_run: now,
      // run_count is NOT incremented: the page renders it as "N sent" and sums
      // it into a Delivered card, so counting an undelivered run inflates a
      // figure about mail that was never posted.
      last_status: 'failed',
      next_run: calculateNextRun((s.cron_expression as string) || '0 9 * * *').toISOString(),
      updated_at: now,
    })
    .eq('id', s.id);

  return jsonResponse(
    {
      message: `Report "${s.name as string}" was NOT delivered: report generation and email delivery are not implemented. The attempt is recorded as a failed run.`,
      executionId: (execution as Record<string, unknown> | null)?.id ?? null,
      delivered: false,
      degraded: {
        emailDelivery: true,
        reason: DELIVERY_DEGRADED_REASON,
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
  return jsonResponse((data ?? []).map(toCamelShallow), 200, req, requestId);
}
