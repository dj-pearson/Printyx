// Core task CRUD.
//
// Paths:
//   GET    /                 (?status&priority&assignedTo&projectId&parentTaskId)
//   GET    /:id
//   POST   /
//   PUT    /:id
//   PATCH  /:id
//   DELETE /:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleTasks(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    let q = db.from('tasks').select('*', { count: 'exact' }).eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assignedTo = url.searchParams.get('assignedTo') ?? url.searchParams.get('assigned_to');
    const projectId = url.searchParams.get('projectId') ?? url.searchParams.get('project_id');
    const parentTaskId =
      url.searchParams.get('parentTaskId') ?? url.searchParams.get('parent_task_id');
    if (status) q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);
    if (assignedTo) q = q.eq('assigned_to', assignedTo);
    if (projectId) q = q.eq('project_id', projectId);
    if (parentTaskId) q = q.eq('parent_task_id', parentTaskId);

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10) || 100);
    const offset = (page - 1) * limit;
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch tasks', error);
    return jsonResponse({ data: data ?? [], total: count ?? 0, page, limit }, 200, req, requestId);
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
    return jsonResponse(data, 200, req, requestId);
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
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
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
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db.from('tasks').delete().eq('id', id).eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete task', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapTask(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.title !== undefined) r.title = body.title;
  if (body.description !== undefined) r.description = body.description;
  if (body.status !== undefined) r.status = body.status;
  if (body.priority !== undefined) r.priority = body.priority;
  set('assigned_to', 'assignedTo', 'assigned_to');
  set('project_id', 'projectId', 'project_id');
  set('parent_task_id', 'parentTaskId', 'parent_task_id');
  set('due_date', 'dueDate', 'due_date');
  set('start_date', 'startDate', 'start_date');
  set('estimated_hours', 'estimatedHours', 'estimated_hours');
  set('actual_hours', 'actualHours', 'actual_hours');
  set('completion_percentage', 'completionPercentage', 'completion_percentage');
  if (body.dependencies !== undefined) r.dependencies = body.dependencies;
  if (body.watchers !== undefined) r.watchers = body.watchers;
  if (body.tags !== undefined) r.tags = body.tags;
  set('custom_fields', 'customFields', 'custom_fields');
  set('completed_at', 'completedAt', 'completed_at');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
