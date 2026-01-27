// Opportunities Dashboard Edge Function
// Handles opportunity dashboard data
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

    // GET /opportunities/dashboard - Get dashboard data
    if (req.method === 'GET') {
      const { data: opportunities } = await admin
        .from('opportunities')
        .select('id, stage, value, probability, status')
        .eq('tenant_id', tenantId);

      const total = opportunities?.length || 0;
      const totalValue =
        opportunities?.reduce((sum: number, o: any) => sum + (o.value || 0), 0) || 0;
      const weightedValue =
        opportunities?.reduce(
          (sum: number, o: any) => sum + ((o.value || 0) * (o.probability || 0)) / 100,
          0,
        ) || 0;

      // Group by stage
      const byStage: Record<string, { count: number; value: number }> = {};
      (opportunities || []).forEach((o: any) => {
        const stage = o.stage || 'unknown';
        if (!byStage[stage]) {
          byStage[stage] = { count: 0, value: 0 };
        }
        byStage[stage].count++;
        byStage[stage].value += o.value || 0;
      });

      // Group by status
      const byStatus: Record<string, number> = {};
      (opportunities || []).forEach((o: any) => {
        const status = o.status || 'open';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      return createCorsResponse(
        {
          summary: {
            total,
            totalValue,
            weightedValue,
            averageValue: total > 0 ? Math.round(totalValue / total) : 0,
          },
          byStage,
          byStatus,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in opportunities-dashboard function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
