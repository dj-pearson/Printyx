// Customer Metrics Edge Function
// Handles customer metrics history
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
    const customerId = pathParts[1];

    // GET /customers/:customerId/metrics/history - Get metrics history
    if (req.method === 'GET' && customerId) {
      const period = url.searchParams.get('period') || '30d';

      // Get customer devices
      const { data: devices } = await admin
        .from('devices')
        .select('id')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      const deviceIds = (devices || []).map((d: any) => d.id);

      if (deviceIds.length === 0) {
        return createCorsResponse(
          {
            metrics: [],
            summary: {
              totalPageCount: 0,
              avgTonerLevel: 0,
            },
          },
          200,
          req,
        );
      }

      // Get metrics for customer devices
      const { data: metrics, error } = await admin
        .from('device_metrics')
        .select('*')
        .in('device_id', deviceIds)
        .eq('tenant_id', tenantId)
        .order('collected_at', { ascending: false })
        .limit(1000);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch customer metrics' }, 500, req);
      }

      // Calculate summary
      const totalPageCount = (metrics || []).reduce(
        (sum: number, m: any) => sum + (m.page_count_total || 0),
        0,
      );

      const tonerLevels = (metrics || [])
        .filter((m: any) => m.toner_black !== null)
        .map((m: any) => m.toner_black);
      const avgTonerLevel =
        tonerLevels.length > 0
          ? Math.round(tonerLevels.reduce((a: number, b: number) => a + b, 0) / tonerLevels.length)
          : 0;

      return createCorsResponse(
        {
          metrics: metrics || [],
          summary: {
            totalPageCount,
            avgTonerLevel,
            deviceCount: deviceIds.length,
            dataPoints: metrics?.length || 0,
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in customer-metrics function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
