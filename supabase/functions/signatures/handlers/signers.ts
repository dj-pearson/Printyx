// Signature signers.
//
// Paths:
//   GET    /signature-requests/:requestId/signers  — handled here by checking parts
//   GET    /signature-signers/:id
//   POST   /signature-signers
//   PATCH  /signature-signers/:id
//   DELETE /signature-signers/:id
//
// Dispatcher strips /signatures/signature-signers OR passes through requests path
// for the list-by-request case.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleSigners(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    // List — supports ?request_id= filter
    const reqId = ctx.url.searchParams.get('request_id') ?? ctx.url.searchParams.get('requestId');
    let q = db.from('signature_signers').select('*').eq('tenant_id', auth.tenantId);
    if (reqId) q = q.eq('request_id', reqId);
    q = q.order('signer_order', { ascending: true });
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch signers', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('signature_signers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch signer', error);
    if (!data) return errorResponse(404, 'Signer not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapSigner(body);
    row.tenant_id = auth.tenantId;
    if (!row.request_id || !row.name || !row.email) {
      return errorResponse(400, 'request_id, name, email required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('signature_signers').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to add signer', error);

    // Bump total_signers on request
    await bumpSignerCount(db, auth.tenantId, String(row.request_id));

    await appendAudit(db, auth.tenantId, {
      request_id: row.request_id,
      signer_id: (data as { id: string })?.id,
      event_type: 'signer_added',
      event_description: `Signer added: ${row.name}`,
      actor_type: 'user',
      actor_id: auth.userId,
    });

    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapSigner(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('signature_signers')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update signer', error);
    if (!data) return errorResponse(404, 'Signer not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { data: existing } = await db
      .from('signature_signers')
      .select('request_id')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();

    const { error } = await db
      .from('signature_signers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete signer', error);

    if (existing?.request_id) {
      await bumpSignerCount(db, auth.tenantId, existing.request_id as string);
    }
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// Recount signers + completed signers for a request. Not race-proof but
// fine for this cosmetic counter.
// deno-lint-ignore no-explicit-any
async function bumpSignerCount(db: any, tenantId: string, requestId: string) {
  const [total, done] = await Promise.all([
    db
      .from('signature_signers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId),
    db
      .from('signature_signers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId)
      .eq('status', 'signed'),
  ]);
  await db
    .from('signature_requests')
    .update({
      total_signers: total.count ?? 0,
      signers_completed: done.count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('tenant_id', tenantId);
}

function mapSigner(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('request_id', 'requestId', 'request_id');
  set('signer_order', 'signerOrder', 'signer_order');
  set('signer_type', 'signerType', 'signer_type');
  if (body.name !== undefined) r.name = body.name;
  if (body.email !== undefined) r.email = body.email;
  if (body.phone !== undefined) r.phone = body.phone;
  set('contact_id', 'contactId', 'contact_id');
  set('user_id', 'userId', 'user_id');
  set('external_signer_id', 'externalSignerId', 'external_signer_id');
  if (body.status !== undefined) r.status = body.status;
  set('signature_method', 'signatureMethod', 'signature_method');
  set('decline_reason', 'declineReason', 'decline_reason');
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
