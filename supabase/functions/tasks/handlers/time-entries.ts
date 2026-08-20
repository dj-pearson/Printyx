// Task time entries and the running timer.
//
// PROD-008/PROD-008b: this handler used to serve only list + create, while
// TaskTimeTracker.tsx - live, rendered from TaskBoardView and TaskDialogs -
// calls five endpoints. /api/tasks is proxied, so the Express implementations
// of the other three were shadowed and the whole time-tracking feature was dead
// on BOTH hosts: start timer, stop timer and delete entry all 404'd, and the
// manual-entry POST went to /:id/time while only /:id/time-entry was routed.
//
// The list was broken too, more quietly: it returned raw snake_case rows, and
// the component reads isRunning / startedAt / entryDate, so `entries.find(e =>
// e.isRunning)` never matched and the UI could never show a running timer even
// if one existed.
//
// `hours` is MINUTES, despite the name (shared/task-schema.ts:154 says so). The
// page posts `minutes`; both spellings are accepted here.
//
// Paths (dispatcher normalizes to):
//   GET    /:taskId/time-entries           → ['list', taskId]
//   POST   /:taskId/time-entry             → ['create', taskId]
//   POST   /:taskId/time                   → ['create', taskId]
//   DELETE /:taskId/time-entries/:entryId  → ['delete', taskId, entryId]
//   POST   /:taskId/timer/start            → ['timer-start', taskId]
//   POST   /:taskId/timer/stop             → ['timer-stop', taskId]

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { elapsedMinutes } from '../../_shared/time-entry-math.ts';
import type { HandlerCtx } from '../_context.ts';

type EntryRow = {
  id: string;
  task_id: string;
  user_id: string;
  description: string | null;
  hours: number;
  entry_date: string;
  started_at: string | null;
  is_running: boolean | null;
  created_at: string;
};

/** The component types camelCase and reads isRunning/startedAt unguarded. */
function toCamel(row: EntryRow, userName: string | null = null) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    description: row.description,
    hours: row.hours,
    entryDate: row.entry_date,
    startedAt: row.started_at,
    isRunning: row.is_running ?? false,
    createdAt: row.created_at,
    userName,
  };
}

async function bumpTracked(
  db: HandlerCtx['db'],
  tenantId: string,
  taskId: string,
  deltaMinutes: number,
) {
  // No atomic increment through PostgREST, so this is read-modify-write. It is
  // a display total, and the Express version had the same race.
  const { data: task } = await db
    .from('tasks')
    .select('time_tracked')
    .eq('id', taskId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const current = (task?.time_tracked as number | null) ?? 0;
  await db
    .from('tasks')
    .update({
      time_tracked: Math.max(current + deltaMinutes, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('tenant_id', tenantId);
}

export async function handleTimeEntries(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const op = pathParts[0];
  const taskId = pathParts[1];
  if (!taskId) return null;

  if (op === 'list' && method === 'GET') {
    const { data, error } = await db
      .from('time_entries')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch time entries', error);

    const rows = (data ?? []) as EntryRow[];
    // One lookup for the whole page rather than a join: users has no declared
    // FK from time_entries, so a PostgREST embed is not available here.
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await db
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds);
      for (const u of users ?? []) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
        if (name) names.set(u.id as string, name);
      }
    }
    return jsonResponse(
      rows.map((r) => toCamel(r, names.get(r.user_id) ?? null)),
      200,
      req,
      requestId,
    );
  }

  if (op === 'create' && method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      hours?: number;
      minutes?: number;
      description?: string;
      date?: string;
      entryDate?: string;
      entry_date?: string;
    } | null;
    // The page posts `minutes`; `hours` is the column name and is also the unit
    // in minutes. Accept either.
    const minutes = body?.minutes ?? body?.hours;
    if (!minutes || minutes <= 0) {
      return errorResponse(400, 'minutes is required (positive integer)', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const entryDate = body?.entryDate ?? body?.entry_date ?? body?.date ?? new Date().toISOString();
    const { data, error } = await db
      .from('time_entries')
      .insert({
        tenant_id: auth.tenantId,
        task_id: taskId,
        user_id: auth.userId,
        description: body?.description ?? null,
        hours: minutes,
        entry_date: entryDate,
        is_running: false,
      })
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to log time', error);

    await bumpTracked(db, auth.tenantId, taskId, minutes);
    return jsonResponse(toCamel(data as EntryRow), 201, req, requestId);
  }

  if (op === 'delete' && method === 'DELETE') {
    const entryId = pathParts[2];
    if (!entryId) return null;

    const { data: entry } = await db
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .eq('task_id', taskId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (!entry) {
      return errorResponse(404, 'Time entry not found', req, { code: 'NOT_FOUND', requestId });
    }
    if ((entry as EntryRow).is_running) {
      return errorResponse(400, 'Stop the timer before deleting', req, {
        code: 'TIMER_RUNNING',
        requestId,
      });
    }

    const { error } = await db.from('time_entries').delete().eq('id', entryId);
    if (error) return dbErr(req, requestId, 'Failed to delete time entry', error);

    const minutes = (entry as EntryRow).hours ?? 0;
    if (minutes > 0) await bumpTracked(db, auth.tenantId, taskId, -minutes);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  if (op === 'timer-start' && method === 'POST') {
    const now = new Date();
    const body = (await req.json().catch(() => null)) as { description?: string } | null;

    // Close any timer this user already has running on this task first, so a
    // double-click cannot leave two running entries and double-count the time.
    const { data: running } = await db
      .from('time_entries')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('task_id', taskId)
      .eq('user_id', auth.userId)
      .eq('is_running', true);
    for (const entry of (running ?? []) as EntryRow[]) {
      const minutes = elapsedMinutes(entry.started_at, now);
      await db
        .from('time_entries')
        .update({ is_running: false, hours: minutes })
        .eq('id', entry.id);
      await bumpTracked(db, auth.tenantId, taskId, minutes);
    }

    const { data, error } = await db
      .from('time_entries')
      .insert({
        tenant_id: auth.tenantId,
        task_id: taskId,
        user_id: auth.userId,
        description: body?.description ?? null,
        hours: 0,
        entry_date: now.toISOString(),
        started_at: now.toISOString(),
        is_running: true,
      })
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to start timer', error);
    return jsonResponse(toCamel(data as EntryRow), 201, req, requestId);
  }

  if (op === 'timer-stop' && method === 'POST') {
    const now = new Date();
    const { data: running } = await db
      .from('time_entries')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('task_id', taskId)
      .eq('user_id', auth.userId)
      .eq('is_running', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!running) {
      return errorResponse(404, 'No running timer found', req, { code: 'NOT_FOUND', requestId });
    }

    const minutes = elapsedMinutes((running as EntryRow).started_at, now);
    const { data, error } = await db
      .from('time_entries')
      .update({ is_running: false, hours: minutes })
      .eq('id', (running as EntryRow).id)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to stop timer', error);

    await bumpTracked(db, auth.tenantId, taskId, minutes);
    return jsonResponse(toCamel(data as EntryRow), 200, req, requestId);
  }

  return null;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
