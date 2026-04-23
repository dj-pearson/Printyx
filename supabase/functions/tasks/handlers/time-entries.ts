// Task time entries.
//
// Paths (dispatcher normalizes to):
//   POST /:taskId/time-entry            → pathParts = ['create', taskId]
//   GET  /:taskId/time-entries          → pathParts = ['list', taskId]

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

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
      .order('entry_date', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch time entries', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (op === 'create' && method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      hours?: number;
      description?: string;
      entryDate?: string;
      entry_date?: string;
    } | null;
    if (!body?.hours || body.hours <= 0) {
      return errorResponse(400, 'hours is required (positive integer)', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const entryDate = body.entryDate ?? body.entry_date ?? new Date().toISOString();
    const { data, error } = await db
      .from('time_entries')
      .insert({
        tenant_id: auth.tenantId,
        task_id: taskId,
        user_id: auth.userId,
        description: body.description ?? null,
        hours: body.hours,
        entry_date: entryDate,
      })
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to log time', error);

    // Bump task time_tracked (cosmetic — tolerable race)
    const { data: task } = await db
      .from('tasks')
      .select('time_tracked')
      .eq('id', taskId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    await db
      .from('tasks')
      .update({
        time_tracked: ((task?.time_tracked as number | null) ?? 0) + body.hours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('tenant_id', auth.tenantId);

    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
