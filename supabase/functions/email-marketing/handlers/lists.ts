// Email lists — CRUD + refresh-counts + members sub-resource.
//
// Paths (dispatcher stripped /email-marketing/email-lists):
//   GET    /
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/refresh-counts
//   GET    /:listId/members             — forwards to list-members handler

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { handleListMembers } from './list-members.ts';

export async function handleLists(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];

  // GET /:listId/members — forward to list-members handler
  if (method === 'GET' && id && sub === 'members') {
    return await handleListMembers(req, {
      ...ctx,
      // list-members handler expects pathParts = [] for list-scoped queries
      // and uses listId from the query-string, so we pass it via the url.
      pathParts: [],
      url: new URL(`${ctx.url.origin}${ctx.url.pathname}?list_id=${encodeURIComponent(id)}`),
    });
  }

  // POST /:id/refresh-counts
  if (method === 'POST' && id && sub === 'refresh-counts') {
    return await refreshCounts(req, ctx, id);
  }

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('email_lists')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false });
    if (error) return dbError(req, requestId, 'Failed to fetch lists', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !sub) {
    const { data, error } = await db
      .from('email_lists')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to fetch list', error);
    if (!data) return errorResponse(404, 'List not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapList(body);
    row.tenant_id = auth.tenantId;
    row.owner_id = row.owner_id ?? auth.userId;
    row.created_by = auth.userId;
    if (!row.list_name || !row.list_type) {
      return errorResponse(400, 'list_name and list_type are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('email_lists').insert(row).select().maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to create list', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapList(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('email_lists')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to update list', error);
    if (!data) return errorResponse(404, 'List not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id && !sub) {
    const { error } = await db
      .from('email_lists')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbError(req, requestId, 'Failed to delete list', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

async function refreshCounts(req: Request, ctx: HandlerCtx, listId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const [total, active, unsub] = await Promise.all([
    db
      .from('email_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('list_id', listId),
    db
      .from('email_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('list_id', listId)
      .eq('status', 'active'),
    db
      .from('email_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('list_id', listId)
      .eq('status', 'unsubscribed'),
  ]);

  const { data, error } = await db
    .from('email_lists')
    .update({
      total_members: total.count ?? 0,
      active_members: active.count ?? 0,
      unsubscribed_members: unsub.count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbError(req, requestId, 'Failed to refresh counts', error);
  if (!data) return errorResponse(404, 'List not found', req, { code: 'NOT_FOUND', requestId });
  return jsonResponse(data, 200, req, requestId);
}

function mapList(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('list_name', 'listName', 'list_name');
  set('list_description', 'listDescription', 'list_description');
  set('list_type', 'listType', 'list_type');
  set('segment_criteria', 'segmentCriteria', 'segment_criteria');
  if (body.tags !== undefined) r.tags = body.tags;
  if (body.category !== undefined) r.category = body.category;
  set('is_active', 'isActive', 'is_active');
  set('owner_id', 'ownerId', 'owner_id');
  return r;
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
