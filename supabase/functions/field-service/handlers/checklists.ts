// Installation checklists — CRUD + bulk insert + list-for-installation.
//
// Paths (dispatcher stripped /field-service/installation-checklists):
//   GET    /?installation_id=...          (or pathParts[0]===checklist id for single)
//   GET    /:id
//   POST   /                              (single)
//   POST   /bulk                          (many, cap 100, single table insert)
//   PATCH  /:id
//   DELETE /:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

const MAX_BULK = 100;

export async function handleChecklists(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];

  // POST /bulk
  if (method === 'POST' && first === 'bulk') {
    const body = (await req.json().catch(() => null)) as {
      items?: Array<Record<string, unknown>>;
    } | null;
    if (!Array.isArray(body?.items) || body!.items.length === 0) {
      return errorResponse(400, 'items array required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    if (body!.items.length > MAX_BULK) {
      return errorResponse(400, `items exceeds limit of ${MAX_BULK}`, req, {
        code: 'BATCH_TOO_LARGE',
        requestId,
      });
    }
    const rows = body!.items.map((item) => {
      const row = mapChecklist(item);
      row.tenant_id = auth.tenantId;
      return row;
    });
    const { data, error } = await db.from('installation_checklists').insert(rows).select();
    if (error) return dbErr(req, requestId, 'Bulk insert failed', error);
    return jsonResponse({ inserted: data?.length ?? 0, items: data ?? [] }, 201, req, requestId);
  }

  if (method === 'GET' && !first) {
    const installationId =
      url.searchParams.get('installation_id') ?? url.searchParams.get('installationId');
    let q = db.from('installation_checklists').select('*').eq('tenant_id', auth.tenantId);
    if (installationId) q = q.eq('installation_id', installationId);
    q = q.order('item_order', { ascending: true });
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch checklists', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first) {
    const { data, error } = await db
      .from('installation_checklists')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch checklist', error);
    if (!data)
      return errorResponse(404, 'Checklist not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapChecklist(body);
    row.tenant_id = auth.tenantId;
    if (!row.installation_id || row.item_order === undefined || !row.category || !row.item_name) {
      return errorResponse(400, 'installation_id, item_order, category, item_name required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('installation_checklists')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create checklist', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapChecklist(body);
    row.updated_at = new Date().toISOString();
    // Auto-stamp completed_at when is_completed flips to true
    if (row.is_completed === true && !row.completed_at) {
      row.completed_at = new Date().toISOString();
      row.completed_by = auth.userId;
    }
    const { data, error } = await db
      .from('installation_checklists')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update checklist', error);
    if (!data)
      return errorResponse(404, 'Checklist not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && first) {
    const { error } = await db
      .from('installation_checklists')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete checklist', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapChecklist(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('installation_id', 'installationId', 'installation_id');
  set('item_order', 'itemOrder', 'item_order');
  if (body.category !== undefined) r.category = body.category;
  set('item_name', 'itemName', 'item_name');
  set('item_description', 'itemDescription', 'item_description');
  set('is_completed', 'isCompleted', 'is_completed');
  set('is_required', 'isRequired', 'is_required');
  set('completed_at', 'completedAt', 'completed_at');
  set('completed_by', 'completedBy', 'completed_by');
  if (body.notes !== undefined) r.notes = body.notes;
  set('photo_ids', 'photoIds', 'photo_ids');
  set('requires_photo', 'requiresPhoto', 'requires_photo');
  set('requires_signature', 'requiresSignature', 'requires_signature');
  set('expected_value', 'expectedValue', 'expected_value');
  set('actual_value', 'actualValue', 'actual_value');
  if (body.passed !== undefined) r.passed = body.passed;
  return r;
}
