// Lease dispositions.
//
// Paths (dispatcher stripped /lease-dispositions):
//   GET    /                  (all, ?action filter)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//
// Forwarded from /leases/:leaseId/disposition with pathParts=['for-lease', leaseId].

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleDispositions(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  if (method === 'GET' && first === 'for-lease' && second) {
    const { data } = await db
      .from('lease_dispositions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('lease_id', second)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return errorResponse(404, 'No disposition for this lease', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'GET' && !first) {
    let q = db.from('lease_dispositions').select('*').eq('tenant_id', auth.tenantId);
    const action = url.searchParams.get('action');
    if (action) q = q.eq('action', action);
    q = q.order('action_date', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch dispositions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('lease_dispositions')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch disposition', error);
    if (!data) {
      return errorResponse(404, 'Disposition not found', req, { code: 'NOT_FOUND', requestId });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapDisposition(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.lease_id || !row.action || !row.action_date) {
      return errorResponse(400, 'lease_id, action, action_date are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('lease_dispositions').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create disposition', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapDisposition(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('lease_dispositions')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update disposition', error);
    if (!data) {
      return errorResponse(404, 'Disposition not found', req, { code: 'NOT_FOUND', requestId });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && first && !second) {
    const { error } = await db
      .from('lease_dispositions')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete disposition', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapDisposition(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('lease_id', 'leaseId', 'lease_id');
  if (body.action !== undefined) r.action = body.action;
  set('action_date', 'actionDate', 'action_date');
  set('return_scheduled_date', 'returnScheduledDate', 'return_scheduled_date');
  set('return_completed_date', 'returnCompletedDate', 'return_completed_date');
  set('return_condition', 'returnCondition', 'return_condition');
  set('return_notes', 'returnNotes', 'return_notes');
  set('purchase_price', 'purchasePrice', 'purchase_price');
  set('purchase_date', 'purchaseDate', 'purchase_date');
  set('purchase_invoice_id', 'purchaseInvoiceId', 'purchase_invoice_id');
  set('upgrade_proposal_id', 'upgradeProposalId', 'upgrade_proposal_id');
  set('upgrade_lease_id', 'upgradeLeaseId', 'upgrade_lease_id');
  set('trade_in_value', 'tradeInValue', 'trade_in_value');
  set('settlement_amount', 'settlementAmount', 'settlement_amount');
  set('damage_fees', 'damageFees', 'damage_fees');
  set('excess_usage_fees', 'excessUsageFees', 'excess_usage_fees');
  set('other_fees', 'otherFees', 'other_fees');
  set('fee_notes', 'feeNotes', 'fee_notes');
  set('equipment_condition_report', 'equipmentConditionReport', 'equipment_condition_report');
  set('photo_urls', 'photoUrls', 'photo_urls');
  set('final_status', 'finalStatus', 'final_status');
  set('completion_date', 'completionDate', 'completion_date');
  set('assigned_to', 'assignedTo', 'assigned_to');
  set('completed_by', 'completedBy', 'completed_by');
  if (body.notes !== undefined) r.notes = body.notes;
  set('internal_notes', 'internalNotes', 'internal_notes');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
