// Place an approved purchase order with the manufacturer (WF-P-06).
//
// POST /manufacturer-orders/from-purchase-order
//   { purchaseOrderId, connectionId, orderMethod?, requestedDeliveryDate? }
//
// The mapping and the PO effect are in
// supabase/functions/_shared/manufacturer-order-from-po.ts, so the column names
// are unit-tested against the Drizzle schema rather than trusted.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import {
  ORDER_METHODS,
  type OrderMethod,
  buildManufacturerLineItems,
  buildManufacturerOrder,
  canPlace,
  purchaseOrderPlacementUpdate,
} from '../../_shared/manufacturer-order-from-po.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleFromPurchaseOrder(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'POST') return null;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

  const purchaseOrderId = String(body.purchaseOrderId ?? body.purchase_order_id ?? '');
  const connectionId = String(body.connectionId ?? body.connection_id ?? '');
  if (!purchaseOrderId || !connectionId) {
    return errorResponse(400, 'purchaseOrderId and connectionId are required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const { data: po, error: poError } = await db
    .from('purchase_orders')
    .select(
      'id, po_number, status, subtotal, tax_amount, shipping_amount, total_amount, expected_date, delivery_address, special_instructions',
    )
    .eq('id', purchaseOrderId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (poError) {
    return errorResponse(500, 'Failed to read the purchase order', req, {
      code: 'DB_ERROR',
      details: { message: poError.message },
      requestId,
    });
  }
  if (!po) {
    return errorResponse(404, 'Purchase order not found', req, { code: 'NOT_FOUND', requestId });
  }
  if (!canPlace(po)) {
    // Named rather than generic: "approve it first" is the action, and a 409
    // distinguishes a workflow state from a bad request.
    return errorResponse(
      409,
      `A ${po.status} purchase order cannot be placed; approve it first.`,
      req,
      {
        code: 'PO_NOT_APPROVED',
        details: { status: po.status },
        requestId,
      },
    );
  }

  // Placing the same PO twice would order the machines twice. There are no
  // transactions in PostgREST, so this is a read-then-check rather than a
  // constraint - the window is small and the alternative is a unique index on a
  // nullable column that legitimately repeats for orders with no PO.
  const { data: already } = await db
    .from('manufacturer_orders')
    .select('id, order_number, order_status')
    .eq('tenant_id', auth.tenantId)
    .eq('purchase_order_id', purchaseOrderId)
    .limit(1)
    .maybeSingle();
  if (already) {
    return errorResponse(409, 'This purchase order has already been placed.', req, {
      code: 'ALREADY_PLACED',
      details: { manufacturerOrderId: already.id, orderNumber: already.order_number },
      requestId,
    });
  }

  const { data: connection, error: connectionError } = await db
    .from('manufacturer_connections')
    .select('id, manufacturer_name, manufacturer_type, order_method')
    .eq('id', connectionId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (connectionError || !connection) {
    return errorResponse(404, 'Manufacturer connection not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  const { data: items, error: itemsError } = await db
    .from('purchase_order_items')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('purchase_order_id', purchaseOrderId)
    .order('line_number', { ascending: true });
  if (itemsError) {
    return errorResponse(500, 'Failed to read the purchase order lines', req, {
      code: 'DB_ERROR',
      details: { message: itemsError.message },
      requestId,
    });
  }
  if (!items || items.length === 0) {
    return errorResponse(400, 'This purchase order has no lines to order.', req, {
      code: 'NO_LINES',
      requestId,
    });
  }

  // order_method is a pgEnum, so an unknown value is a 22P02 rather than a bad
  // row - validated here, defaulting to the connection's own configured method.
  const requestedMethod = String(
    body.orderMethod ?? body.order_method ?? connection.order_method ?? 'manual',
  );
  const orderMethod = ORDER_METHODS.includes(requestedMethod as OrderMethod)
    ? requestedMethod
    : 'manual';

  const orderRow = buildManufacturerOrder(po, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    connectionId,
    orderMethod,
    requestedDeliveryDate: (body.requestedDeliveryDate ?? body.requested_delivery_date ?? null) as
      | string
      | null,
  });

  const { data: order, error: orderError } = await db
    .from('manufacturer_orders')
    .insert(orderRow)
    .select()
    .maybeSingle();
  if (orderError || !order) {
    return errorResponse(500, 'Failed to create the manufacturer order', req, {
      code: 'DB_ERROR',
      details: { message: orderError?.message },
      requestId,
    });
  }

  const { rows, unfulfillable } = buildManufacturerLineItems(items, {
    tenantId: auth.tenantId,
    orderId: order.id,
  });

  if (rows.length === 0) {
    // Every line was unfulfillable, so the order would be empty. Roll the
    // header back by hand - there is no transaction - rather than leave a
    // manufacturer order with nothing in it that blocks the retry above.
    // A rollback whose own failure is discarded leaves exactly the empty
    // header this branch exists to remove, and it blocks the retry above.
    const { error: rollbackError } = await db
      .from('manufacturer_orders')
      .delete()
      .eq('id', order.id)
      .eq('tenant_id', auth.tenantId);
    if (rollbackError) {
      console.error(
        `Failed to roll back empty manufacturer order ${order.id}:`,
        rollbackError.message,
      );
    }
    return errorResponse(
      400,
      'No line has a part number and a description, so nothing can be ordered.',
      req,
      {
        code: 'NO_ORDERABLE_LINES',
        details: { unfulfillable },
        requestId,
      },
    );
  }

  const { error: lineError } = await db.from('manufacturer_order_line_items').insert(rows);
  if (lineError) {
    // Same rollback, same rule: a delete whose failure is discarded leaves a
    // headerless order behind and blocks the retry.
    const { error: rollbackError } = await db
      .from('manufacturer_orders')
      .delete()
      .eq('id', order.id)
      .eq('tenant_id', auth.tenantId);
    if (rollbackError) {
      console.error(
        `Failed to roll back manufacturer order ${order.id} after a line insert failure:`,
        rollbackError.message,
      );
    }
    return errorResponse(500, 'Failed to create the order lines', req, {
      code: 'DB_ERROR',
      details: { message: lineError.message },
      requestId,
    });
  }

  const quantity = rows.reduce((sum, r) => sum + Number(r.quantity_ordered ?? 0), 0);
  // The lines are already written, so a failure here is not worth refusing the
  // order over - but a header reading zero quantity over real lines is a
  // discrepancy a buyer has to reconcile by hand, so it is reported rather
  // than discarded.
  const { error: quantityError } = await db
    .from('manufacturer_orders')
    .update({ total_quantity_ordered: quantity, updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('tenant_id', auth.tenantId);
  if (quantityError) {
    console.error(
      `Manufacturer order ${order.id} lines saved but the header quantity did not:`,
      quantityError.message,
    );
  }

  const { error: poUpdateError } = await db
    .from('purchase_orders')
    .update(purchaseOrderPlacementUpdate(auth.userId))
    .eq('id', purchaseOrderId)
    .eq('tenant_id', auth.tenantId);
  if (poUpdateError) {
    // The order exists and the lines exist; the PO's status did not move. Say
    // so rather than answering 500 and leaving the caller to guess whether the
    // order was placed - it was.
    console.error('PO status update failed after placing order:', poUpdateError.message);
  }

  return jsonResponse(
    {
      ...order,
      lineCount: rows.length,
      totalQuantityOrdered: quantity,
      purchaseOrderStatus: poUpdateError ? po.status : 'ordered',
      // Lines that could not be ordered are NAMED. Dropping them silently
      // would produce an order that looks complete and is short.
      unfulfillableLineIds: unfulfillable,
      warnings: [
        ...(unfulfillable.length > 0
          ? [
              `${unfulfillable.length} line(s) had no part number or description and were not ordered.`,
            ]
          : []),
        ...(poUpdateError
          ? ['The order was placed but the purchase order status did not update.']
          : []),
        // Said on every response, because the button must not read as "sent".
        'The order is recorded against the manufacturer connection. No message has been transmitted to the manufacturer - submission is manual today.',
      ],
    },
    201,
    req,
    requestId,
  );
}
