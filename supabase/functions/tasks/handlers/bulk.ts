// Task bulk ops — replaces supabase/functions/tasks-bulk/.
//
// Paths (dispatcher stripped /tasks/bulk):
//   POST /update    — body: { taskIds: string[], patch: Record<string, unknown> }
//   POST /delete    — body: { taskIds: string[] }

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const MAX_BULK = 500;

const ALLOWED_BULK_FIELDS = new Set([
  'status',
  'priority',
  'assigned_to',
  'project_id',
  'due_date',
  'completion_percentage',
  'tags',
]);

export async function handleBulk(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  if (method !== 'POST') return null;
  const op = pathParts[0];

  const body = (await req.json().catch(() => null)) as {
    taskIds?: string[];
    task_ids?: string[];
    patch?: Record<string, unknown>;
  } | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
  const ids = (body.taskIds ?? body.task_ids ?? []) as string[];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(400, 'taskIds array required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  if (ids.length > MAX_BULK) {
    return errorResponse(400, `taskIds exceeds limit of ${MAX_BULK}`, req, {
      code: 'BATCH_TOO_LARGE',
      requestId,
    });
  }

  if (op === 'update') {
    if (!body.patch || typeof body.patch !== 'object') {
      return errorResponse(400, 'patch object required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.patch)) {
      // Map camelCase → snake_case for allowed fields
      const snake = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      if (ALLOWED_BULK_FIELDS.has(snake)) clean[snake] = v;
    }
    if (Object.keys(clean).length === 0) {
      return errorResponse(
        400,
        `patch must contain at least one of: ${[...ALLOWED_BULK_FIELDS].join(', ')}`,
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    clean.updated_at = new Date().toISOString();
    if (clean.status === 'completed' && !clean.completed_at) {
      clean.completed_at = new Date().toISOString();
    }

    const { data, error, count } = await db
      .from('tasks')
      .update(clean)
      .in('id', ids)
      .eq('tenant_id', auth.tenantId)
      .select();
    if (error) {
      return errorResponse(500, 'Bulk update failed', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(
      { updated: data?.length ?? count ?? 0, tasks: data ?? [] },
      200,
      req,
      requestId,
    );
  }

  if (op === 'delete') {
    const { error, count } = await db
      .from('tasks')
      .delete({ count: 'exact' })
      .in('id', ids)
      .eq('tenant_id', auth.tenantId);
    if (error) {
      return errorResponse(500, 'Bulk delete failed', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse({ deleted: count ?? 0 }, 200, req, requestId);
  }

  return null;
}
