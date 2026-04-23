// Order confirmations — CRUD + process.
//
// Paths:
//   ['for-order', orderId]       — list for a specific order
//   [<confirmationId?>]          — flat /confirmations/:id, POST /, PUT /:id
//   [id, 'process']              — POST /confirmations/:id/process

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleConfirmations(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isForOrder = pathParts[0] === 'for-order';
  const orderId = isForOrder ? pathParts[1] : null;
  const after = isForOrder ? pathParts.slice(2) : pathParts;
  const id = after[0];
  const sub = after[1];

  // GET /:orderId/confirmations — list
  if (method === 'GET' && isForOrder && !id && orderId) {
    const { data, error } = await db
      .from('manufacturer_order_confirmations')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('order_id', orderId)
      .order('confirmed_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch confirmations', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:orderId/confirmations — create
  if (method === 'POST' && isForOrder && !id && orderId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapConfirmation(body);
    row.tenant_id = auth.tenantId;
    row.order_id = orderId;
    if (!row.confirmation_type) {
      return errorResponse(400, 'confirmation_type required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('manufacturer_order_confirmations')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create confirmation', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // POST /confirmations/:id/process
  if (method === 'POST' && !isForOrder && id && sub === 'process') {
    const { data, error } = await db
      .from('manufacturer_order_confirmations')
      .update({
        confirmation_status: 'processed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to process confirmation', error);
    if (!data)
      return errorResponse(404, 'Confirmation not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // Flat /confirmations/:id — GET, PUT
  if (!isForOrder && id && !sub) {
    if (method === 'GET') {
      const { data, error } = await db
        .from('manufacturer_order_confirmations')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch confirmation', error);
      if (!data)
        return errorResponse(404, 'Confirmation not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapConfirmation(body);
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('manufacturer_order_confirmations')
        .update(row)
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update confirmation', error);
      if (!data)
        return errorResponse(404, 'Confirmation not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
  }

  return null;
}

function mapConfirmation(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('confirmation_number', 'confirmationNumber', 'confirmation_number');
  set('confirmation_type', 'confirmationType', 'confirmation_type');
  set('confirmation_status', 'confirmationStatus', 'confirmation_status');
  set('confirmed_amount', 'confirmedAmount', 'confirmed_amount');
  set('confirmed_delivery_date', 'confirmedDeliveryDate', 'confirmed_delivery_date');
  set('raw_confirmation_data', 'rawConfirmationData', 'raw_confirmation_data');
  set('parsed_data', 'parsedData', 'parsed_data');
  set('processing_errors', 'processingErrors', 'processing_errors');
  if (body.notes !== undefined) r.notes = body.notes;
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
