// Lease renewals.
//
// Paths (dispatcher stripped /lease-renewals):
//   GET    /                  (all renewals, filter ?customerDecision)
//   GET    /action-needed     (renewal_deadline < now+30d, no decision)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//
// Forwarded from /leases/:leaseId/renewal with pathParts=['for-lease', leaseId].

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleRenewals(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // Forwarded from /leases/:leaseId/renewal
  if (method === 'GET' && first === 'for-lease' && second) {
    const { data } = await db
      .from('lease_renewals')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('lease_id', second)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return errorResponse(404, 'No renewal for this lease', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'GET' && first === 'action-needed') {
    const cutoff = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data, error } = await db
      .from('lease_renewals')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lte('renewal_deadline', cutoff)
      .is('decision_date', null)
      .order('renewal_deadline', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch action-needed renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && !first) {
    let q = db.from('lease_renewals').select('*').eq('tenant_id', auth.tenantId);
    const decision = url.searchParams.get('customerDecision');
    if (decision) q = q.eq('customer_decision', decision);
    q = q.order('created_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('lease_renewals')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch renewal', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRenewal(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.lease_id) {
      return errorResponse(400, 'lease_id is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('lease_renewals').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create renewal', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRenewal(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('lease_renewals')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update renewal', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && first && !second) {
    const { error } = await db
      .from('lease_renewals')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete renewal', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapRenewal(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('lease_id', 'leaseId', 'lease_id');
  set('renewal_offered', 'renewalOffered', 'renewal_offered');
  set('renewal_offer_date', 'renewalOfferDate', 'renewal_offer_date');
  set('renewal_deadline', 'renewalDeadline', 'renewal_deadline');
  set('renewal_term', 'renewalTerm', 'renewal_term');
  set('renewal_monthly_payment', 'renewalMonthlyPayment', 'renewal_monthly_payment');
  set('renewal_total_amount', 'renewalTotalAmount', 'renewal_total_amount');
  set('renewal_type', 'renewalType', 'renewal_type');
  set('customer_decision', 'customerDecision', 'customer_decision');
  set('decision_date', 'decisionDate', 'decision_date');
  set('decision_by', 'decisionBy', 'decision_by');
  if (body.notes !== undefined) r.notes = body.notes;
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
