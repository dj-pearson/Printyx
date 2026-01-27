// Opportunities By Stage Edge Function
// Handles opportunity grouping by stage
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

    // GET /opportunities/by-stage - Get opportunities grouped by stage
    if (req.method === 'GET') {
      const { data: opportunities, error } = await admin
        .from('opportunities')
        .select(
          `
          *,
          customer:customer_id (id, company_name),
          owner:owner_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch opportunities' }, 500, req);
      }

      // Group by stage
      const stages = [
        'qualification',
        'discovery',
        'proposal',
        'negotiation',
        'closed_won',
        'closed_lost',
      ];

      const byStage: Record<string, any[]> = {};
      stages.forEach((stage) => {
        byStage[stage] = [];
      });

      (opportunities || []).forEach((opp: any) => {
        const stage = opp.stage || 'qualification';
        if (!byStage[stage]) {
          byStage[stage] = [];
        }
        byStage[stage].push(opp);
      });

      // Calculate totals per stage
      const stageSummaries = stages.map((stage) => ({
        stage,
        count: byStage[stage]?.length || 0,
        value: byStage[stage]?.reduce((sum: number, o: any) => sum + (o.value || 0), 0) || 0,
      }));

      return createCorsResponse(
        {
          stages: byStage,
          summaries: stageSummaries,
          total: opportunities?.length || 0,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in opportunities-by-stage function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
