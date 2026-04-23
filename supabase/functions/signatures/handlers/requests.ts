// Signature requests.
//
// Paths (dispatcher stripped /signatures/signature-requests):
//   GET    /
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/send         — STUB today (provider integration deferred)
//   POST   /:id/void
//   GET    /expiring/soon    — expires_at < now+7d, status not completed/voided
//
// Forwarded from dispatcher:
//   GET /by-customer/:customerId  (via /customers/:id/signature-requests)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const TERMINAL_STATUSES = ['completed', 'voided', 'declined'];

export async function handleRequests(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /by-customer/:customerId
  if (method === 'GET' && first === 'by-customer' && second) {
    const { data, error } = await db
      .from('signature_requests')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('created_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch customer requests', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /expiring/soon
  if (method === 'GET' && first === 'expiring' && second === 'soon') {
    const cutoff = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data, error } = await db
      .from('signature_requests')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lte('expires_at', cutoff)
      .gte('expires_at', new Date().toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
      .order('expires_at', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch expiring requests', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:id/send (stub)
  if (method === 'POST' && first && second === 'send') {
    return await sendRequest(req, ctx, first);
  }

  // POST /:id/void
  if (method === 'POST' && first && second === 'void') {
    return await voidRequest(req, ctx, first);
  }

  // GET /
  if (method === 'GET' && !first) {
    const status = ctx.url.searchParams.get('status');
    let q = db.from('signature_requests').select('*').eq('tenant_id', auth.tenantId);
    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch requests', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('signature_requests')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch request', error);
    if (!data)
      return errorResponse(404, 'Request not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRequest(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.request_number || !row.title || !row.provider) {
      return errorResponse(400, 'request_number, title, provider required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('signature_requests').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create request', error);
    await appendAudit(db, auth.tenantId, {
      request_id: (data as { id: string }).id,
      event_type: 'request_created',
      event_description: `Request "${row.title}" created`,
      actor_type: 'user',
      actor_id: auth.userId,
    });
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRequest(body);
    row.updated_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('signature_requests')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update request', error);
    if (!data)
      return errorResponse(404, 'Request not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // DELETE /:id
  if (method === 'DELETE' && first && !second) {
    const { error } = await db
      .from('signature_requests')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete request', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// STUB — mirrors Express's line-357 TODO. Marks the request as 'sent' in our
// DB so the UI progresses, but no envelope is actually created with a provider.
// Real DocuSign/Adobe Sign/HelloSign wiring is a follow-up PRD (§11).
async function sendRequest(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: existing } = await db
    .from('signature_requests')
    .select('id, status, title')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!existing)
    return errorResponse(404, 'Request not found', req, { code: 'NOT_FOUND', requestId });

  const { data, error } = await db
    .from('signature_requests')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to update status', error);

  await appendAudit(db, auth.tenantId, {
    request_id: id,
    event_type: 'request_sent_stub',
    event_description: `Stub send: marked as sent in DB, but no provider envelope was created. Follow-up: wire provider integration.`,
    actor_type: 'user',
    actor_id: auth.userId,
  });

  return jsonResponse(
    {
      success: true,
      stub: true,
      message: 'Request marked as sent. Provider integration pending — no envelope dispatched.',
      request: data,
    },
    200,
    req,
    requestId,
  );
}

async function voidRequest(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const { data, error } = await db
    .from('signature_requests')
    .update({
      status: 'voided',
      voided_reason: body.reason ?? null,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to void request', error);
  if (!data) return errorResponse(404, 'Request not found', req, { code: 'NOT_FOUND', requestId });

  await appendAudit(db, auth.tenantId, {
    request_id: id,
    event_type: 'request_voided',
    event_description: body.reason ?? 'Request voided',
    actor_type: 'user',
    actor_id: auth.userId,
  });

  return jsonResponse(data, 200, req, requestId);
}

function mapRequest(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('request_number', 'requestNumber', 'request_number');
  if (body.title !== undefined) r.title = body.title;
  if (body.description !== undefined) r.description = body.description;
  set('customer_id', 'customerId', 'customer_id');
  set('proposal_id', 'proposalId', 'proposal_id');
  set('contract_id', 'contractId', 'contract_id');
  set('lease_id', 'leaseId', 'lease_id');
  if (body.provider !== undefined) r.provider = body.provider;
  set('integration_id', 'integrationId', 'integration_id');
  set('external_id', 'externalId', 'external_id');
  if (body.status !== undefined) r.status = body.status;
  set('expires_at', 'expiresAt', 'expires_at');
  set('email_subject', 'emailSubject', 'email_subject');
  set('email_message', 'emailMessage', 'email_message');
  set('reminder_enabled', 'reminderEnabled', 'reminder_enabled');
  set('reminder_days', 'reminderDays', 'reminder_days');
  set('sequential_signing', 'sequentialSigning', 'sequential_signing');
  set('voided_reason', 'voidedReason', 'voided_reason');
  set('declined_reason', 'declinedReason', 'declined_reason');
  return r;
}

// deno-lint-ignore no-explicit-any
async function appendAudit(db: any, tenantId: string, row: Record<string, unknown>) {
  try {
    await db.from('signature_audit_logs').insert({ tenant_id: tenantId, ...row });
  } catch {
    // audit log failure should never break the primary op; swallow
  }
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
