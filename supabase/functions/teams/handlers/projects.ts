// Projects — CRUD + assignments/optimize (stub) + dependencies (stub).
//
// Paths (dispatcher stripped /projects):
//   GET    /
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/assignments/optimize    — stub (no project_assignments table)
//   GET    /:id/dependencies            — reads dependencies from tasks.dependencies jsonb

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleProjects(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];
  const subSub = pathParts[2];

  // POST /:id/assignments/optimize (stub)
  if (method === 'POST' && id && sub === 'assignments' && subSub === 'optimize') {
    return jsonResponse(
      {
        projectId: id,
        stub: true,
        message:
          'Project assignment optimizer requires a project_assignments table — deferred to follow-up.',
        recommendedAssignments: [],
      },
      200,
      req,
      requestId,
    );
  }

  // GET /:id/dependencies (computed from tasks.dependencies jsonb)
  if (method === 'GET' && id && sub === 'dependencies') {
    const { data, error } = await db
      .from('tasks')
      .select('id, title, dependencies')
      .eq('tenant_id', auth.tenantId)
      .eq('project_id', id);
    if (error) return dbErr(req, requestId, 'Failed to fetch project dependencies', error);

    type TaskDep = { id: string; title: string; dependencies: string[] | null };
    const rows = (data ?? []) as TaskDep[];
    const edges = rows.flatMap((t) =>
      (t.dependencies ?? []).map((dep) => ({ from: dep, to: t.id })),
    );
    return jsonResponse(
      { projectId: id, tasks: rows, edges, taskCount: rows.length, edgeCount: edges.length },
      200,
      req,
      requestId,
    );
  }

  if (method === 'GET' && !id) {
    let q = db.from('projects').select('*').eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('status');
    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch projects', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !sub) {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch project', error);
    if (!data)
      return errorResponse(404, 'Project not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapProject(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.name) {
      return errorResponse(400, 'name is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('projects').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create project', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapProject(body);
    row.updated_at = new Date().toISOString();
    if (row.status === 'completed' && !row.completed_at) {
      row.completed_at = new Date().toISOString();
    }
    const { data, error } = await db
      .from('projects')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update project', error);
    if (!data)
      return errorResponse(404, 'Project not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id && !sub) {
    const { error } = await db
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete project', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapProject(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.name !== undefined) r.name = body.name;
  if (body.description !== undefined) r.description = body.description;
  if (body.status !== undefined) r.status = body.status;
  set('project_manager', 'projectManager', 'project_manager');
  set('customer_id', 'customerId', 'customer_id');
  set('contract_id', 'contractId', 'contract_id');
  set('start_date', 'startDate', 'start_date');
  set('end_date', 'endDate', 'end_date');
  set('estimated_budget', 'estimatedBudget', 'estimated_budget');
  set('actual_budget', 'actualBudget', 'actual_budget');
  set('completion_percentage', 'completionPercentage', 'completion_percentage');
  if (body.color !== undefined) r.color = body.color;
  if (body.template !== undefined) r.template = body.template;
  if (body.workflow !== undefined) r.workflow = body.workflow;
  if (body.tags !== undefined) r.tags = body.tags;
  set('custom_fields', 'customFields', 'custom_fields');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
