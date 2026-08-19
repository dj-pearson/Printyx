// Parts Orders Edge Function
// Handles parts ordering for service operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /parts-orders, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'parts-orders');
    const orderId = parts[0];
    const subResource = parts[1];

    // GET /parts-orders - List parts orders
    if (req.method === 'GET' && !orderId) {
      const status = url.searchParams.get('status');
      const vendorId = url.searchParams.get('vendorId');

      let query = admin
        .from('parts_orders')
        .select(
          `
          *,
          vendor:vendor_id (id, name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (vendorId) query = query.eq('vendor_id', vendorId);

      const { data: orders, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch parts orders' }, 500, req);
      }

      return createCorsResponse(orders || [], 200, req);
    }

    // GET /parts-orders/:id - Get single order
    if (req.method === 'GET' && orderId && !subResource) {
      const { data: order, error } = await admin
        .from('parts_orders')
        .select(
          `
          *,
          vendor:vendor_id (*),
          ordered_by_user:ordered_by (id, full_name, email)
        `,
        )
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Parts order not found' }, 404, req);
      }

      return createCorsResponse(order, 200, req);
    }

    // POST /parts-orders - Create order
    if (req.method === 'POST' && !orderId) {
      const body = await req.json();

      const { data: order, error } = await admin
        .from('parts_orders')
        // COP-M01: ticket_id, parts, total_cost, shipping_address, notes and
        // ordered_by are none of them columns. parts_orders keys the ticket as
        // service_ticket_id, holds the money in subtotal/tax/shipping/total,
        // calls the address delivery_address and the free text
        // special_instructions — and has no `parts` column at all, because the
        // lines live in parts_order_items, which is what POST /:id/items is for.
        // There is no ordered_by column either.
        .insert({
          tenant_id: tenantId,
          vendor_id: body.vendorId || body.vendor_id,
          analysis_id: body.analysisId || body.analysis_id,
          service_ticket_id: body.ticketId || body.ticket_id || body.serviceTicketId || null,
          order_number: body.orderNumber || body.order_number || null,
          status: 'pending',
          order_date: body.orderDate || body.order_date || new Date().toISOString(),
          expected_delivery_date: body.expectedDeliveryDate || body.expected_delivery_date || null,
          subtotal: body.subtotal ?? null,
          total: body.total ?? body.totalCost ?? body.total_cost ?? null,
          priority: body.priority || null,
          delivery_address:
            body.shippingAddress || body.shipping_address || body.deliveryAddress || null,
          special_instructions: body.notes || body.specialInstructions || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating parts order:', error);
        return createCorsResponse(
          { error: 'Failed to create parts order', details: error.message },
          500,
          req,
        );
      }

      const unpersisted =
        body.parts && body.parts.length
          ? ['parts: order lines belong in parts_order_items — POST /parts-orders/:id/items']
          : [];

      return createCorsResponse({ ...order, unpersisted }, 201, req);
    }

    // PATCH /parts-orders/:id - Update order
    if (req.method === 'PATCH' && orderId && !subResource) {
      const body = await req.json();

      const { data: order, error } = await admin
        .from('parts_orders')
        // shipped_at, delivered_at and notes are not columns. The delivery date
        // is actual_delivery_date; the free text is special_instructions; and a
        // ship date has no column at all, which the tracking number stands in
        // for.
        .update({
          status: body.status,
          tracking_number: body.trackingNumber || body.tracking_number,
          actual_delivery_date: body.deliveredAt || body.delivered_at || null,
          special_instructions: body.notes ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update parts order' }, 500, req);
      }

      return createCorsResponse(order, 200, req);
    }

    // GET /parts-orders/:id/items - Get order items
    if (req.method === 'GET' && orderId && subResource === 'items') {
      const { data: items, error } = await admin
        .from('parts_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch order items' }, 500, req);
      }

      return createCorsResponse(items || [], 200, req);
    }

    // POST /parts-orders/:id/items - Add order item
    if (req.method === 'POST' && orderId && subResource === 'items') {
      const body = await req.json();

      // COP-M01, two faults. The columns: part_id, description, quantity,
      // unit_cost and total_cost do not exist — they are part_number/part_name,
      // part_description, quantity_ordered, unit_price and line_total — and
      // tenant_id was never set. And the shape: ServiceTicketAnalysis.tsx posts
      // { items: [...] }, while this only ever read a single flat body, so even
      // with the right columns it would have stored nothing the caller sent.
      const rawItems = Array.isArray(body.items) ? body.items : [body];
      const now = new Date().toISOString();
      const rows = rawItems.map((item: Record<string, any>) => ({
        tenant_id: tenantId,
        order_id: orderId,
        part_number: item.partNumber ?? item.part_number ?? null,
        part_name: item.partName ?? item.part_name ?? null,
        part_description: item.partDescription ?? item.part_description ?? item.description ?? null,
        quantity_ordered: Number(
          item.quantityOrdered ?? item.quantity_ordered ?? item.quantity ?? 1,
        ),
        unit_price: item.unitPrice ?? item.unit_price ?? item.unitCost ?? item.unit_cost ?? null,
        line_total: item.lineTotal ?? item.line_total ?? item.totalCost ?? item.total_cost ?? null,
        discount_percent: item.discountPercent ?? item.discount_percent ?? null,
        item_status: item.itemStatus ?? item.item_status ?? 'ordered',
        expected_date: item.expectedDate ?? item.expected_date ?? null,
        created_at: now,
      }));

      const { data: items, error } = await admin.from('parts_order_items').insert(rows).select();

      if (error) {
        console.error('Error adding order items:', error);
        return createCorsResponse(
          { error: 'Failed to add order item', details: error.message },
          500,
          req,
        );
      }

      // A single-item post still gets a single object back, as before.
      return createCorsResponse(
        Array.isArray(body.items) ? { items: items ?? [], added: items?.length ?? 0 } : items?.[0],
        201,
        req,
      );
    }

    // DELETE /parts-orders/:id - Delete order
    if (req.method === 'DELETE' && orderId) {
      // Delete items first
      await admin.from('parts_order_items').delete().eq('order_id', orderId);

      const { error } = await admin
        .from('parts_orders')
        .delete()
        .eq('id', orderId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete parts order' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Parts order deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in parts-orders function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
