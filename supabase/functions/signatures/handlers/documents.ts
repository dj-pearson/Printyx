// Signature documents.
//
// Paths (dispatcher stripped /signatures/signature-documents):
//   GET    /?request_id=...
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleDocuments(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    const reqId = url.searchParams.get('request_id') ?? url.searchParams.get('requestId');
    let q = db.from('signature_documents').select('*').eq('tenant_id', auth.tenantId);
    if (reqId) q = q.eq('request_id', reqId);
    q = q.order('document_order', { ascending: true });
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch documents', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('signature_documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch document', error);
    if (!data)
      return errorResponse(404, 'Document not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapDocument(body);
    row.tenant_id = auth.tenantId;
    if (!row.request_id || !row.document_name) {
      return errorResponse(400, 'request_id and document_name required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('signature_documents').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to add document', error);

    await bumpDocCount(db, auth.tenantId, String(row.request_id));
    await appendAudit(db, auth.tenantId, {
      request_id: row.request_id,
      document_id: (data as { id: string })?.id,
      event_type: 'document_added',
      event_description: `Document added: ${row.document_name}`,
      actor_type: 'user',
      actor_id: auth.userId,
    });

    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapDocument(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('signature_documents')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update document', error);
    if (!data)
      return errorResponse(404, 'Document not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { data: existing } = await db
      .from('signature_documents')
      .select('request_id')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();

    const { error } = await db
      .from('signature_documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete document', error);

    if (existing?.request_id) {
      await bumpDocCount(db, auth.tenantId, existing.request_id as string);
    }
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// deno-lint-ignore no-explicit-any
async function bumpDocCount(db: any, tenantId: string, requestId: string) {
  const { count } = await db
    .from('signature_documents')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId);
  await db
    .from('signature_requests')
    .update({
      total_documents: count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('tenant_id', tenantId);
}

function mapDocument(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('request_id', 'requestId', 'request_id');
  set('document_order', 'documentOrder', 'document_order');
  set('document_name', 'documentName', 'document_name');
  set('document_type', 'documentType', 'document_type');
  set('original_file_url', 'originalFileUrl', 'original_file_url');
  set('signed_file_url', 'signedFileUrl', 'signed_file_url');
  set('certificate_url', 'certificateUrl', 'certificate_url');
  set('file_size', 'fileSize', 'file_size');
  set('external_document_id', 'externalDocumentId', 'external_document_id');
  if (body.status !== undefined) r.status = body.status;
  set('total_fields', 'totalFields', 'total_fields');
  set('completed_fields', 'completedFields', 'completed_fields');
  return r;
}

// deno-lint-ignore no-explicit-any
async function appendAudit(db: any, tenantId: string, row: Record<string, unknown>) {
  try {
    await db.from('signature_audit_logs').insert({ tenant_id: tenantId, ...row });
  } catch {
    // never fail primary op on audit failure
  }
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
