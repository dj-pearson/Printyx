// Manufacturer order shipments — CRUD + tracking ops.
//
// Paths:
//   ['for-order', orderId]                 — list for specific order
//   ['tracking', trackingNumber]           — lookup by tracking number
//   [<shipmentId?>]                        — CRUD + patches
//   [id, 'tracking']                       — PATCH /shipments/:id/tracking
//   [id, 'deliver']                        — POST /shipments/:id/deliver

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { expectedDateFrom } from '../../_shared/manufacturer-order-from-po.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleShipments(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isForOrder = pathParts[0] === 'for-order';
  const orderId = isForOrder ? pathParts[1] : null;
  const after = isForOrder ? pathParts.slice(2) : pathParts;
  const first = after[0];
  const second = after[1];

  // GET /shipments/tracking/:trackingNumber
  if (method === 'GET' && first === 'tracking' && second) {
    const { data, error } = await db
      .from('manufacturer_order_shipments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('tracking_number', decodeURIComponent(second))
      .limit(1)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to look up tracking', error);
    if (!data)
      return errorResponse(404, 'Shipment not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /:orderId/shipments
  if (method === 'GET' && isForOrder && !first && orderId) {
    const { data, error } = await db
      .from('manufacturer_order_shipments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('order_id', orderId)
      .order('shipped_date', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch shipments', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:orderId/shipments — create
  if (method === 'POST' && isForOrder && !first && orderId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapShipment(body);
    row.tenant_id = auth.tenantId;
    row.order_id = orderId;
    const { data, error } = await db
      .from('manufacturer_order_shipments')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create shipment', error);
    await syncPurchaseOrderExpectedDate(db, auth.tenantId, orderId, data);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /shipments/:id/tracking
  if (method === 'PATCH' && !isForOrder && first && second === 'tracking') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {
      last_tracking_update: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    for (const [snake, camel] of [
      ['tracking_number', 'trackingNumber'],
      ['carrier', 'carrier'],
      ['carrier_service', 'carrierService'],
      ['shipment_status', 'shipmentStatus'],
      ['tracking_events', 'trackingEvents'],
      ['estimated_delivery_date', 'estimatedDeliveryDate'],
    ] as const) {
      if (body[camel] !== undefined || body[snake] !== undefined) {
        update[snake] = body[camel] ?? body[snake];
      }
    }
    const { data, error } = await db
      .from('manufacturer_order_shipments')
      .update(update)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update tracking', error);
    if (!data)
      return errorResponse(404, 'Shipment not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /shipments/:id/deliver
  if (method === 'POST' && !isForOrder && first && second === 'deliver') {
    const body = (await req.json().catch(() => ({}))) as {
      deliveredTo?: string;
      delivered_to?: string;
      signatureName?: string;
      signature_name?: string;
    };
    const { data, error } = await db
      .from('manufacturer_order_shipments')
      .update({
        shipment_status: 'delivered',
        actual_delivery_date: new Date().toISOString(),
        delivered_to: body.deliveredTo ?? body.delivered_to ?? null,
        signature_name: body.signatureName ?? body.signature_name ?? null,
        signature_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to mark delivered', error);
    if (!data)
      return errorResponse(404, 'Shipment not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // Flat /shipments/:id — GET / PUT / DELETE
  if (!isForOrder && first && !second) {
    if (method === 'GET') {
      const { data, error } = await db
        .from('manufacturer_order_shipments')
        .select('*')
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch shipment', error);
      if (!data)
        return errorResponse(404, 'Shipment not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapShipment(body);
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('manufacturer_order_shipments')
        .update(row)
        .eq('id', first)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update shipment', error);
      if (!data)
        return errorResponse(404, 'Shipment not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'DELETE') {
      const { error } = await db
        .from('manufacturer_order_shipments')
        .delete()
        .eq('id', first)
        .eq('tenant_id', auth.tenantId);
      if (error) return dbErr(req, requestId, 'Failed to delete shipment', error);
      return jsonResponse({ success: true }, 200, req, requestId);
    }
  }

  return null;
}

function mapShipment(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('shipment_number', 'shipmentNumber', 'shipment_number');
  set('tracking_number', 'trackingNumber', 'tracking_number');
  if (body.carrier !== undefined) r.carrier = body.carrier;
  set('carrier_service', 'carrierService', 'carrier_service');
  set('shipment_status', 'shipmentStatus', 'shipment_status');
  set('shipped_date', 'shippedDate', 'shipped_date');
  set('estimated_delivery_date', 'estimatedDeliveryDate', 'estimated_delivery_date');
  set('actual_delivery_date', 'actualDeliveryDate', 'actual_delivery_date');
  set('package_count', 'packageCount', 'package_count');
  set('total_weight', 'totalWeight', 'total_weight');
  set('weight_unit', 'weightUnit', 'weight_unit');
  set('line_items_shipped', 'lineItemsShipped', 'line_items_shipped');
  set('tracking_url', 'trackingUrl', 'tracking_url');
  set('tracking_events', 'trackingEvents', 'tracking_events');
  set('delivered_to', 'deliveredTo', 'delivered_to');
  set('signature_required', 'signatureRequired', 'signature_required');
  set('signature_name', 'signatureName', 'signature_name');
  set('shipping_cost', 'shippingCost', 'shipping_cost');
  set('insurance_amount', 'insuranceAmount', 'insurance_amount');
  set('special_instructions', 'specialInstructions', 'special_instructions');
  if (body.notes !== undefined) r.notes = body.notes;
  set('custom_fields', 'customFields', 'custom_fields');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}

/**
 * Carry a manufacturer's delivery date back onto the purchase order (WF-P-06).
 *
 * Never throws and never blocks the answer: the confirmation or shipment was
 * recorded, and failing the request would tell the caller nothing happened.
 * A null date is NOT written - a confirmation that carries no date says nothing
 * about delivery, and overwriting the buyer's own estimate with null in the
 * name of an update that carried no information is worse than leaving it.
 */
// deno-lint-ignore no-explicit-any
async function syncPurchaseOrderExpectedDate(
  // deno-lint-ignore no-explicit-any
  db: any,
  tenantId: string,
  orderId: string,
  // deno-lint-ignore no-explicit-any
  row: any,
): Promise<void> {
  const date = expectedDateFrom(row);
  if (!date) return;
  try {
    const { data: order } = await db
      .from('manufacturer_orders')
      .select('purchase_order_id')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!order?.purchase_order_id) return;

    // The try/catch around this cannot see a failed write: PostgREST returns
    // { error } rather than throwing, so it only ever fires on a network
    // fault. Both errors are read, and a failure to sync the delivery date is
    // logged with the ids - a purchase order still showing last month's
    // expected date is what a buyer chases the manufacturer about.
    const { error: orderError } = await db
      .from('manufacturer_orders')
      .update({ estimated_delivery_date: date, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('tenant_id', tenantId);
    if (orderError) {
      console.error(
        `Failed to set the manufacturer order delivery date (order ${orderId}):`,
        orderError.message,
      );
    }

    const { error: poError } = await db
      .from('purchase_orders')
      .update({ expected_date: date, updated_at: new Date().toISOString() })
      .eq('id', order.purchase_order_id)
      .eq('tenant_id', tenantId);
    if (poError) {
      console.error(
        `Failed to sync the purchase order expected date (PO ${order.purchase_order_id}):`,
        poError.message,
      );
    }
  } catch (err) {
    console.error('Failed to sync the purchase order delivery date:', String(err));
  }
}
