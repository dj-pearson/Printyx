// Email list members — CRUD + bulk add.
//
// Paths (dispatcher stripped /email-marketing/email-list-members):
//   GET    /?list_id=...    — list (via /email-lists/:id/members forward)
//   GET    /:id
//   POST   /                — single add
//   POST   /bulk            — bulk add (cap 1000)
//   PATCH  /:id
//   DELETE /:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const MAX_BULK_MEMBERS = 1000;

export async function handleListMembers(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];

  // POST /bulk
  if (method === 'POST' && first === 'bulk') {
    return await bulkAdd(req, ctx);
  }

  // GET /?list_id=...
  if (method === 'GET' && !first) {
    const listId = url.searchParams.get('list_id') ?? url.searchParams.get('listId');
    if (!listId) {
      return errorResponse(400, 'list_id query param required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('email_list_members')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('list_id', listId)
      .order('subscribed_at', { ascending: false });
    if (error) return dbError(req, requestId, 'Failed to fetch members', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first) {
    const { data, error } = await db
      .from('email_list_members')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to fetch member', error);
    if (!data) return errorResponse(404, 'Member not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapMember(body);
    row.tenant_id = auth.tenantId;
    if (!row.list_id || !row.email) {
      return errorResponse(400, 'list_id and email are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('email_list_members').insert(row).select().maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to add member', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapMember(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('email_list_members')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to update member', error);
    if (!data) return errorResponse(404, 'Member not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // DELETE /:id
  if (method === 'DELETE' && first) {
    const { error } = await db
      .from('email_list_members')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbError(req, requestId, 'Failed to remove member', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

async function bulkAdd(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => null)) as {
    listId?: string;
    list_id?: string;
    members?: Array<Record<string, unknown>>;
  } | null;
  const listId = body?.listId ?? body?.list_id;
  if (!listId || !Array.isArray(body?.members) || body!.members.length === 0) {
    return errorResponse(400, 'listId and members[] required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  if (body!.members.length > MAX_BULK_MEMBERS) {
    return errorResponse(400, `members count exceeds limit of ${MAX_BULK_MEMBERS}`, req, {
      code: 'BATCH_TOO_LARGE',
      requestId,
    });
  }

  const rows = body!.members.map((m) => {
    const row = mapMember(m);
    row.tenant_id = auth.tenantId;
    row.list_id = listId;
    return row;
  });

  const valid = rows.filter((r) => typeof r.email === 'string' && r.email);
  if (valid.length === 0) {
    return errorResponse(400, 'No valid member rows (email required)', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const { data, error } = await db
    .from('email_list_members')
    .upsert(valid, { onConflict: 'list_id,email', ignoreDuplicates: false })
    .select();
  if (error) return dbError(req, requestId, 'Failed to bulk add members', error);
  return jsonResponse({ inserted: (data ?? []).length, members: data ?? [] }, 201, req, requestId);
}

function mapMember(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('list_id', 'listId', 'list_id');
  if (body.email !== undefined) r.email = body.email;
  set('contact_id', 'contactId', 'contact_id');
  set('first_name', 'firstName', 'first_name');
  set('last_name', 'lastName', 'last_name');
  if (body.company !== undefined) r.company = body.company;
  set('custom_fields', 'customFields', 'custom_fields');
  if (body.tags !== undefined) r.tags = body.tags;
  if (body.status !== undefined) r.status = body.status;
  set('subscription_source', 'subscriptionSource', 'subscription_source');
  set('engagement_score', 'engagementScore', 'engagement_score');
  return r;
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
