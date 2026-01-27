// Parts Orders Edge Function
// Handles parts ordering for service operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const orderId = pathParts[1];
    const subResource = pathParts[2];

    // GET /parts-orders - List parts orders
    if (req.method === 'GET' && !orderId) {
      const status = url.searchParams.get('status');
      const vendorId = url.searchParams.get('vendorId');

      let query = admin
        .from('parts_orders')
        .select(
          `
          *,
          vendor:vendor_id (id, name),
          ordered_by_user:ordered_by (id, full_name)
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
        .insert({
          tenant_id: tenantId,
          vendor_id: body.vendorId || body.vendor_id,
          analysis_id: body.analysisId || body.analysis_id,
          ticket_id: body.ticketId || body.ticket_id,
          parts: body.parts || [],
          status: 'pending',
          total_cost: body.totalCost || body.total_cost,
          shipping_address: body.shippingAddress || body.shipping_address,
          notes: body.notes,
          ordered_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create parts order' }, 500, req);
      }

      return createCorsResponse(order, 201, req);
    }

    // PATCH /parts-orders/:id - Update order
    if (req.method === 'PATCH' && orderId && !subResource) {
      const body = await req.json();

      const { data: order, error } = await admin
        .from('parts_orders')
        .update({
          status: body.status,
          tracking_number: body.trackingNumber || body.tracking_number,
          shipped_at: body.shippedAt || body.shipped_at,
          delivered_at: body.deliveredAt || body.delivered_at,
          notes: body.notes,
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

      const { data: item, error } = await admin
        .from('parts_order_items')
        .insert({
          order_id: orderId,
          part_id: body.partId || body.part_id,
          part_number: body.partNumber || body.part_number,
          description: body.description,
          quantity: body.quantity || 1,
          unit_cost: body.unitCost || body.unit_cost,
          total_cost: body.totalCost || body.total_cost,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add order item' }, 500, req);
      }

      return createCorsResponse(item, 201, req);
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
