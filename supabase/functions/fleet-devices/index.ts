// Fleet Devices Edge Function
// Handles fleet device listing and management
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
    const deviceId = pathParts[2]; // fleet/devices/:id
    const action = pathParts[3];

    // GET /fleet/devices - List fleet devices
    if (req.method === 'GET' && !deviceId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');
      const manufacturer = url.searchParams.get('manufacturer');

      let query = admin
        .from('devices')
        .select(
          `
          *,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);
      if (manufacturer) query = query.ilike('manufacturer', `%${manufacturer}%`);

      const { data: devices, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch fleet devices' }, 500, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /fleet/devices/:id - Get single device
    if (req.method === 'GET' && deviceId && !action) {
      const { data: device, error } = await admin
        .from('devices')
        .select(
          `
          *,
          customer:customer_id (*)
        `,
        )
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Device not found' }, 404, req);
      }

      return createCorsResponse(device, 200, req);
    }

    // GET /fleet/devices/:id/metrics - Get device metrics
    if (req.method === 'GET' && deviceId && action === 'metrics') {
      const { data: metrics, error } = await admin
        .from('device_metrics')
        .select('*')
        .eq('device_id', deviceId)
        .eq('tenant_id', tenantId)
        .order('collected_at', { ascending: false })
        .limit(500);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch device metrics' }, 500, req);
      }

      return createCorsResponse(metrics || [], 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in fleet-devices function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
