// Manufacturer order exceptions — CRUD + resolve + retry.
//
// Paths:
//   ['for-order', orderId]      — list for a specific order
//   ['unresolved']              — list unresolved across tenant
//   [<exceptionId?>]            — CRUD on /exceptions
//   [id, 'resolve']             — POST /exceptions/:id/resolve
//   [id, 'retry']               — POST /exceptions/:id/retry

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleExceptions(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isForOrder = pathParts[0] === 'for-order';
  const orderId = isForOrder ? pathParts[1] : null;
  const after = isForOrder ? pathParts.slice(2) : pathParts;
  const first = after[0];
  const second = after[1];

  // GET /exceptions/unresolved
  if (method === 'GET' && first === 'unresolved') {
    const { data, error } = await db
      .from('manufacturer_order_exceptions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('resolved', false)
      .order('severity', { ascending: false })
      .order('occurred_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch unresolved exceptions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:orderId/exceptions
  if (method === 'GET' && isForOrder && !first && orderId) {
    const { data, error } = await db
      .from('manufacturer_order_exceptions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('order_id', orderId)
      .order('occurred_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch exceptions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /exceptions/:id/resolve
  if (method === 'POST' && !isForOrder && first && second === 'resolve') {
    const body = (await req.json().catch(() => ({}))) as { resolutionNotes?: string };
    const { data, error } = await db
      .from('manufacturer_order_exceptions')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: auth.userId,
        resolution_notes: body.resolutionNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to resolve exception', error);
    if (!data)
      return errorResponse(404, 'Exception not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /exceptions/:id/retry — increments retry_count, resets next_retry_at.
  // Actual retry of the failed operation is deferred (same reason as /orders/:id/submit).
  if (method === 'POST' && !isForOrder && first && second === 'retry') {
    const { data: existing } = await db
      .from('manufacturer_order_exceptions')
      .select('retry_count, retryable')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (!existing) {
      return errorResponse(404, 'Exception not found', req, { code: 'NOT_FOUND', requestId });
    }
    if (!existing.retryable) {
      return errorResponse(400, 'Exception is not retryable', req, {
        code: 'NOT_RETRYABLE',
        requestId,
      });
    }

    const { data, error } = await db
      .from('manufacturer_order_exceptions')
      .update({
        retry_count: ((existing.retry_count as number | null) ?? 0) + 1,
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // +5 min
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to queue retry', error);
    return jsonResponse(
      {
        ...data,
        stub: true,
        message:
          'Retry queued in DB. Actual re-dispatch requires the manufacturer-integration-service port (follow-up).',
      },
      200,
      req,
      requestId,
    );
  }

  // Flat /exceptions/:id — GET, PUT
  if (!isForOrder && first && !second) {
    if (method === 'GET') {
      const { data, error } = await db
        .from('manufacturer_order_exceptions')
        .select('*')
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch exception', error);
      if (!data)
        return errorResponse(404, 'Exception not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapException(body);
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('manufacturer_order_exceptions')
        .update(row)
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update exception', error);
      if (!data)
        return errorResponse(404, 'Exception not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
  }

  // POST /exceptions — manual create
  if (method === 'POST' && !isForOrder && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapException(body);
    row.tenant_id = auth.tenantId;
    if (!row.exception_type || !row.exception_message) {
      return errorResponse(400, 'exception_type and exception_message required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('manufacturer_order_exceptions')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create exception', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

function mapException(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('order_id', 'orderId', 'order_id');
  set('connection_id', 'connectionId', 'connection_id');
  set('exception_type', 'exceptionType', 'exception_type');
  if (body.severity !== undefined) r.severity = body.severity;
  set('exception_message', 'exceptionMessage', 'exception_message');
  set('exception_code', 'exceptionCode', 'exception_code');
  if (body.context !== undefined) r.context = body.context;
  set('affected_line_items', 'affectedLineItems', 'affected_line_items');
  set('error_details', 'errorDetails', 'error_details');
  set('stack_trace', 'stackTrace', 'stack_trace');
  set('request_payload', 'requestPayload', 'request_payload');
  set('response_payload', 'responsePayload', 'response_payload');
  if (body.retryable !== undefined) r.retryable = body.retryable;
  set('custom_fields', 'customFields', 'custom_fields');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
