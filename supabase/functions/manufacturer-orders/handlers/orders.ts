// Manufacturer orders — CRUD + submit + acknowledge + fulfillment.
//
// Paths (dispatcher may pass two shapes):
//   [<orderId?>]           — core CRUD
//   ['submit', orderId]    — POST /:id/submit
//   ['acknowledge', id]    — POST /:id/acknowledge
//   ['fulfillment', id]    — PATCH /:id/fulfillment

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleOrders(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  if (method === 'POST' && first === 'submit' && second) {
    return await submitOrder(req, ctx, second);
  }

  if (method === 'POST' && first === 'acknowledge' && second) {
    return await acknowledgeOrder(req, ctx, second);
  }

  if ((method === 'PATCH' || method === 'PUT') && first === 'fulfillment' && second) {
    return await updateFulfillment(req, ctx, second);
  }

  // Core CRUD — first is orderId when set
  const id = first;

  if (method === 'GET' && !id) {
    let q = db.from('manufacturer_orders').select('*').eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('orderStatus') ?? url.searchParams.get('status');
    const connectionId =
      url.searchParams.get('connectionId') ?? url.searchParams.get('connection_id');
    if (status) q = q.eq('order_status', status);
    if (connectionId) q = q.eq('connection_id', connectionId);
    q = q.order('order_date', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch orders', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('manufacturer_orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch order', error);
    if (!data) return errorResponse(404, 'Order not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapOrder(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.connection_id || !row.order_number || !row.order_method) {
      return errorResponse(400, 'connection_id, order_number, order_method required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('manufacturer_orders').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create order', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapOrder(body);
    row.updated_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('manufacturer_orders')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update order', error);
    if (!data) return errorResponse(404, 'Order not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id) {
    const { error } = await db
      .from('manufacturer_orders')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete order', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// Submit — the real provider API call lives in the manufacturer integration
// service (Node-only today). This port persists the submission intent +
// payload; actual dispatch is deferred to a follow-up that ports each
// provider's REST client to fetch.
async function submitOrder(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: order } = await db
    .from('manufacturer_orders')
    .select('id, order_status, connection_id')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!order) return errorResponse(404, 'Order not found', req, { code: 'NOT_FOUND', requestId });

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('manufacturer_orders')
    .update({
      order_status: 'submitted',
      submitted_at: now,
      submission_payload: body.payload ?? null,
      updated_by: auth.userId,
      updated_at: now,
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to submit order', error);

  return jsonResponse(
    {
      success: true,
      stub: true,
      message:
        'Order marked submitted. Actual manufacturer API dispatch requires porting the Node-only manufacturer-integration-service — deferred to follow-up.',
      order: data,
    },
    200,
    req,
    requestId,
  );
}

async function acknowledgeOrder(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as {
    manufacturerOrderNumber?: string;
    manufacturer_order_number?: string;
  };
  const update: Record<string, unknown> = {
    order_status: 'acknowledged',
    acknowledged_at: new Date().toISOString(),
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };
  const mfrOrderNum = body.manufacturerOrderNumber ?? body.manufacturer_order_number;
  if (mfrOrderNum) update.manufacturer_order_number = mfrOrderNum;

  const { data, error } = await db
    .from('manufacturer_orders')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to acknowledge order', error);
  if (!data) return errorResponse(404, 'Order not found', req, { code: 'NOT_FOUND', requestId });
  return jsonResponse(data, 200, req, requestId);
}

async function updateFulfillment(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };
  const fields = [
    ['order_status', 'orderStatus'],
    ['total_quantity_shipped', 'totalQuantityShipped'],
    ['total_quantity_delivered', 'totalQuantityDelivered'],
    ['total_quantity_cancelled', 'totalQuantityCancelled'],
    ['shipment_count', 'shipmentCount'],
    ['tracking_numbers', 'trackingNumbers'],
    ['carrier_info', 'carrierInfo'],
    ['estimated_delivery_date', 'estimatedDeliveryDate'],
  ] as const;
  for (const [snake, camel] of fields) {
    if (body[camel] !== undefined || body[snake] !== undefined) {
      update[snake] = body[camel] ?? body[snake];
    }
  }

  const { data, error } = await db
    .from('manufacturer_orders')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to update fulfillment', error);
  if (!data) return errorResponse(404, 'Order not found', req, { code: 'NOT_FOUND', requestId });
  return jsonResponse(data, 200, req, requestId);
}

function mapOrder(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('connection_id', 'connectionId', 'connection_id');
  set('purchase_order_id', 'purchaseOrderId', 'purchase_order_id');
  set('order_number', 'orderNumber', 'order_number');
  set('manufacturer_order_number', 'manufacturerOrderNumber', 'manufacturer_order_number');
  set('reference_number', 'referenceNumber', 'reference_number');
  set('order_status', 'orderStatus', 'order_status');
  set('order_method', 'orderMethod', 'order_method');
  if (body.subtotal !== undefined) r.subtotal = body.subtotal;
  set('tax_amount', 'taxAmount', 'tax_amount');
  set('shipping_cost', 'shippingCost', 'shipping_cost');
  set('total_amount', 'totalAmount', 'total_amount');
  if (body.currency !== undefined) r.currency = body.currency;
  set('ship_to_name', 'shipToName', 'ship_to_name');
  set('ship_to_address', 'shipToAddress', 'ship_to_address');
  set('ship_to_city', 'shipToCity', 'ship_to_city');
  set('ship_to_state', 'shipToState', 'ship_to_state');
  set('ship_to_zip', 'shipToZip', 'ship_to_zip');
  set('ship_to_country', 'shipToCountry', 'ship_to_country');
  set('shipping_method', 'shippingMethod', 'shipping_method');
  set('requested_delivery_date', 'requestedDeliveryDate', 'requested_delivery_date');
  set('contact_name', 'contactName', 'contact_name');
  set('contact_email', 'contactEmail', 'contact_email');
  set('contact_phone', 'contactPhone', 'contact_phone');
  set('special_instructions', 'specialInstructions', 'special_instructions');
  set('internal_notes', 'internalNotes', 'internal_notes');
  set('custom_fields', 'customFields', 'custom_fields');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
