// Manufacturer order line items — CRUD + bulk + shipment patch.
//
// Paths (dispatcher passes two shapes):
//   ['for-order', orderId, ...]  — from /:orderId/line-items[/bulk]
//   [<lineItemId?>, ...]         — flat /line-items/:id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const MAX_BULK = 100;

export async function handleLineItems(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isForOrder = pathParts[0] === 'for-order';
  const orderId = isForOrder ? pathParts[1] : null;
  const after = isForOrder ? pathParts.slice(2) : pathParts;
  const id = after[0];
  const sub = after[1];

  // GET /:orderId/line-items
  if (method === 'GET' && isForOrder && !id && orderId) {
    const { data, error } = await db
      .from('manufacturer_order_line_items')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('order_id', orderId)
      .order('line_number', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch line items', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:orderId/line-items
  if (method === 'POST' && isForOrder && !id && orderId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapItem(body);
    row.tenant_id = auth.tenantId;
    row.order_id = orderId;
    if (
      row.line_number === undefined ||
      !row.product_code ||
      !row.description ||
      row.quantity_ordered === undefined ||
      row.unit_price === undefined
    ) {
      return errorResponse(
        400,
        'line_number, product_code, description, quantity_ordered, unit_price required',
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    // Auto-compute line_total if missing
    if (row.line_total === undefined) {
      const qty = Number(row.quantity_ordered);
      const price = Number(row.unit_price);
      const disc = Number(row.discount_amount ?? 0);
      row.line_total = (qty * price - disc).toFixed(2);
    }
    const { data, error } = await db
      .from('manufacturer_order_line_items')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to add line item', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // POST /:orderId/line-items/bulk
  if (method === 'POST' && isForOrder && id === 'bulk' && orderId) {
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
    const rows = body!.items.map((item, idx) => {
      const r = mapItem(item);
      r.tenant_id = auth.tenantId;
      r.order_id = orderId;
      if (r.line_number === undefined) r.line_number = idx + 1;
      if (r.line_total === undefined) {
        const qty = Number(r.quantity_ordered ?? 0);
        const price = Number(r.unit_price ?? 0);
        r.line_total = (qty * price).toFixed(2);
      }
      return r;
    });
    const { data, error } = await db.from('manufacturer_order_line_items').insert(rows).select();
    if (error) return dbErr(req, requestId, 'Bulk insert failed', error);
    return jsonResponse({ inserted: data?.length ?? 0, items: data ?? [] }, 201, req, requestId);
  }

  // PATCH /line-items/:id/shipment
  if (method === 'PATCH' && !isForOrder && id && sub === 'shipment') {
    const body = (await req.json().catch(() => ({}))) as {
      quantityShipped?: number;
      quantity_shipped?: number;
      actualShipDate?: string;
      actual_ship_date?: string;
      lineStatus?: string;
      line_status?: string;
    };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.quantityShipped !== undefined || body.quantity_shipped !== undefined)
      update.quantity_shipped = body.quantityShipped ?? body.quantity_shipped;
    if (body.actualShipDate !== undefined || body.actual_ship_date !== undefined)
      update.actual_ship_date = body.actualShipDate ?? body.actual_ship_date;
    if (body.lineStatus !== undefined || body.line_status !== undefined)
      update.line_status = body.lineStatus ?? body.line_status;
    const { data, error } = await db
      .from('manufacturer_order_line_items')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update line item shipment', error);
    if (!data)
      return errorResponse(404, 'Line item not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // Flat /line-items/:id — GET/PUT/DELETE
  if (!isForOrder && id) {
    if (method === 'GET') {
      const { data, error } = await db
        .from('manufacturer_order_line_items')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch line item', error);
      if (!data)
        return errorResponse(404, 'Line item not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapItem(body);
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('manufacturer_order_line_items')
        .update(row)
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update line item', error);
      if (!data)
        return errorResponse(404, 'Line item not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'DELETE') {
      const { error } = await db
        .from('manufacturer_order_line_items')
        .delete()
        .eq('id', id)
        .eq('tenant_id', auth.tenantId);
      if (error) return dbErr(req, requestId, 'Failed to delete line item', error);
      return jsonResponse({ success: true }, 200, req, requestId);
    }
  }

  return null;
}

function mapItem(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('line_number', 'lineNumber', 'line_number');
  set('product_code', 'productCode', 'product_code');
  set('manufacturer_part_number', 'manufacturerPartNumber', 'manufacturer_part_number');
  if (body.description !== undefined) r.description = body.description;
  set('quantity_ordered', 'quantityOrdered', 'quantity_ordered');
  set('quantity_shipped', 'quantityShipped', 'quantity_shipped');
  set('quantity_delivered', 'quantityDelivered', 'quantity_delivered');
  set('quantity_cancelled', 'quantityCancelled', 'quantity_cancelled');
  set('quantity_backordered', 'quantityBackordered', 'quantity_backordered');
  set('unit_price', 'unitPrice', 'unit_price');
  set('list_price', 'listPrice', 'list_price');
  set('discount_percent', 'discountPercent', 'discount_percent');
  set('discount_amount', 'discountAmount', 'discount_amount');
  set('line_total', 'lineTotal', 'line_total');
  if (body.uom !== undefined) r.uom = body.uom;
  if (body.weight !== undefined) r.weight = body.weight;
  set('weight_unit', 'weightUnit', 'weight_unit');
  set('requested_ship_date', 'requestedShipDate', 'requested_ship_date');
  set('estimated_ship_date', 'estimatedShipDate', 'estimated_ship_date');
  set('actual_ship_date', 'actualShipDate', 'actual_ship_date');
  set('inventory_item_id', 'inventoryItemId', 'inventory_item_id');
  set('product_id', 'productId', 'product_id');
  set('line_status', 'lineStatus', 'line_status');
  set('backorder_date', 'backorderDate', 'backorder_date');
  if (body.notes !== undefined) r.notes = body.notes;
  set('custom_fields', 'customFields', 'custom_fields');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
