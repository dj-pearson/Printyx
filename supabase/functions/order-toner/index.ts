// Order Toner Edge Function
// Handles toner ordering for devices
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
    const deviceId = pathParts[1]; // devices/:id/order-toner

    // POST /devices/:id/order-toner - Create toner order
    if (req.method === 'POST' && deviceId) {
      const body = await req.json();

      // Get device info
      const { data: device } = await admin
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!device) {
        return createCorsResponse({ error: 'Device not found' }, 404, req);
      }

      // Create supply order
      const { data: order, error } = await admin
        .from('supply_orders')
        .insert({
          tenant_id: tenantId,
          device_id: deviceId,
          customer_id: device.customer_id,
          order_type: 'toner',
          items: body.items || [
            {
              type: 'toner',
              color: body.color || 'black',
              quantity: body.quantity || 1,
            },
          ],
          status: 'pending',
          priority: body.priority || 'normal',
          notes: body.notes,
          shipping_address: body.shippingAddress || body.shipping_address,
          requested_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create toner order' }, 500, req);
      }

      return createCorsResponse(
        {
          order,
          message: 'Toner order created successfully',
        },
        201,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in order-toner function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
