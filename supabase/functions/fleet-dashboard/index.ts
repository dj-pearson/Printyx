// Fleet Dashboard Edge Function
// Handles fleet monitoring dashboard data
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

    // GET /fleet/dashboard - Get fleet dashboard data
    if (req.method === 'GET') {
      // Get all devices
      const { data: devices } = await admin
        .from('devices')
        .select('id, status, manufacturer, model')
        .eq('tenant_id', tenantId);

      // Get recent metrics
      const { data: recentMetrics } = await admin
        .from('device_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('collected_at', { ascending: false })
        .limit(100);

      // Calculate stats
      const totalDevices = devices?.length || 0;
      const onlineDevices = devices?.filter((d: any) => d.status === 'online').length || 0;
      const offlineDevices = devices?.filter((d: any) => d.status === 'offline').length || 0;

      // Get low toner alerts
      const lowTonerDevices = (recentMetrics || []).filter(
        (m: any) =>
          (m.toner_black && m.toner_black < 20) ||
          (m.toner_cyan && m.toner_cyan < 20) ||
          (m.toner_magenta && m.toner_magenta < 20) ||
          (m.toner_yellow && m.toner_yellow < 20),
      );

      // Get devices by manufacturer
      const byManufacturer: Record<string, number> = {};
      (devices || []).forEach((d: any) => {
        const mfr = d.manufacturer || 'Unknown';
        byManufacturer[mfr] = (byManufacturer[mfr] || 0) + 1;
      });

      return createCorsResponse(
        {
          summary: {
            totalDevices,
            onlineDevices,
            offlineDevices,
            lowTonerAlerts: lowTonerDevices.length,
          },
          byManufacturer,
          recentAlerts: lowTonerDevices.slice(0, 10),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in fleet-dashboard function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
