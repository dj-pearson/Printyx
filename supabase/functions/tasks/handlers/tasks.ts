// Core task CRUD.
//
// Paths:
//   GET    /                 (?status&priority&assignedTo&projectId&parentTaskId)
//   GET    /:id
//   POST   /
//   PUT    /:id
//   PATCH  /:id
//   DELETE /:id
//
// Reads go out camelCase. mapTask has always ACCEPTED camelCase on writes, but
// every read returned the raw PostgREST row, so the components on the other end
// - which read task.dueDate, task.completionPercentage, task.timeTracked,
// task.assignedTo - got undefined for all of them and rendered blank cells
// beside a title that worked. handlers/time-entries.ts already converts; this
// makes the pair symmetric.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { toCamel } from '../../_shared/case.ts';
import type { HandlerCtx } from '../_context.ts';
import { applyUserScope, resolveScope, rowInScope } from '../../_shared/scope.ts';
import { mapTask, unpersistedTaskFields } from './_task-mapper.ts';

export async function handleTasks(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    let q = db.from('tasks').select('*', { count: 'exact' }).eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assignedTo = url.searchParams.get('assignedTo') ?? url.searchParams.get('assigned_to');
    // WF-P-08: filter by what the task is ABOUT. Only projectId was offered,
    // and parentTaskId filtered on a column migration 0002 dropped - so that
    // filter was a 42703 rather than an empty result.
    const param = (camel: string, snake: string) =>
      url.searchParams.get(camel) ?? url.searchParams.get(snake);
    const projectId = param('projectId', 'project_id');
    const customerId = param('customerId', 'customer_id');
    const dealId = param('dealId', 'deal_id');
    const handoffId = param('handoffId', 'handoff_id');
    if (status) q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);
    if (assignedTo) q = q.eq('assigned_to', assignedTo);
    if (projectId) q = q.eq('project_id', projectId);
    if (customerId) q = q.eq('customer_id', customerId);
    if (dealId) q = q.eq('deal_id', dealId);
    if (handoffId) q = q.eq('handoff_id', handoffId);

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10) || 100);
    const offset = (page - 1) * limit;
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    // WF-R-04: a task list filtered on tenant_id alone is every task in the
    // company. The `assignedTo` query param above is a caller preference, not a
    // control; this is applied on top of it.
    const scope = await resolveScope(db, {
      userId: auth.userId,
      tenantId: auth.tenantId,
      appMetadata: auth.supabaseUser.app_metadata,
      requestedScope: url.searchParams.get('scope'),
    });
    q = applyUserScope(q, ['assigned_to', 'created_by'], scope);

    const { data, error, count } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch tasks', error);
    return jsonResponse(
      { data: toCamel(data ?? []), total: count ?? 0, page, limit },
      200,
      req,
      requestId,
    );
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch task', error);
    if (!data) return errorResponse(404, 'Task not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(toCamel(data), 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapTask(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.title) {
      return errorResponse(400, 'title is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('tasks').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create task', error);
    // Fields the table no longer has are named rather than silently dropped.
    const unpersisted = unpersistedTaskFields(body);
    return jsonResponse(
      unpersisted.length > 0 ? { ...toCamel(data), unpersisted } : toCamel(data),
      201,
      req,
      requestId,
    );
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

    // WF-R-06: the list filter narrows what a caller can BROWSE. Reassigning or
    // closing somebody else's task is a write aimed straight at an id, and nothing
    // checked whose task it was.
    const denied = await denyIfOutOfScope(ctx, req, id);
    if (denied) return denied;
    const row = mapTask(body);
    row.updated_at = new Date().toISOString();
    // Auto-stamp completed_at when status flips to 'completed'
    if (row.status === 'completed' && !row.completed_at) {
      row.completed_at = new Date().toISOString();
    }
    const { data, error } = await db
      .from('tasks')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update task', error);
    if (!data) return errorResponse(404, 'Task not found', req, { code: 'NOT_FOUND', requestId });
    const unpersistedUpdate = unpersistedTaskFields(body);
    return jsonResponse(
      unpersistedUpdate.length > 0
        ? { ...toCamel(data), unpersisted: unpersistedUpdate }
        : toCamel(data),
      200,
      req,
      requestId,
    );
  }

  if (method === 'DELETE' && id) {
    const denied = await denyIfOutOfScope(ctx, req, id);
    if (denied) return denied;

    const { error } = await db.from('tasks').delete().eq('id', id).eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete task', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

/**
 * 403 when the task exists but belongs to somebody outside the caller's scope,
 * null when the write may proceed. A missing task returns null so the handler
 * keeps answering its own 404 rather than leaking existence through the 403.
 */
async function denyIfOutOfScope(
  ctx: HandlerCtx,
  req: Request,
  id: string,
): Promise<Response | null> {
  const { auth, db, requestId } = ctx;
  const { data: existing } = await db
    .from('tasks')
    .select('id, assigned_to, created_by')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!existing) return null;

  const scope = await resolveScope(db, {
    userId: auth.userId,
    tenantId: auth.tenantId,
    appMetadata: auth.supabaseUser.app_metadata,
  });
  if (rowInScope(existing, ['assigned_to', 'created_by'], scope)) return null;

  return errorResponse(403, 'This task is outside your scope', req, {
    code: 'ROW_OUT_OF_SCOPE',
    requestId,
  });
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
