// Sales Pipeline Edge Function
// Handles sales pipeline metrics, opportunities, and analytics
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subRoute = pathParts[1]; // e.g., 'rep-metrics', 'opportunities', 'summary'

    // GET /sales-pipeline/rep-metrics - Sales rep performance metrics
    if (req.method === 'GET' && subRoute === 'rep-metrics') {
      // TODO: Fetch actual metrics from database
      const mockMetrics = {
        totalRevenue: 0,
        dealsWon: 0,
        dealsInProgress: 0,
        averageDealSize: 0,
        conversionRate: 0,
        topReps: [],
      };
      return createCorsResponse(mockMetrics, 200, req);
    }

    // GET /sales-pipeline/opportunities - List opportunities
    if (req.method === 'GET' && subRoute === 'opportunities') {
      const stage = url.searchParams.get('stage');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('deals')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('expected_close_date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (stage) {
        query = query.eq('stage', stage);
      }

      const { data: opportunities, error, count } = await query;

      if (error) {
        console.error('Error fetching opportunities:', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities' }, 500, req);
      }

      return createCorsResponse(
        {
          data: opportunities || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /sales-pipeline/summary - Pipeline summary stats
    if (req.method === 'GET' && subRoute === 'summary') {
      // TODO: Calculate real metrics from database
      const mockSummary = {
        totalPipelineValue: 0,
        weightedPipelineValue: 0,
        totalOpportunities: 0,
        opportunitiesByStage: {},
        averageDealSize: 0,
        expectedCloseThisMonth: 0,
      };
      return createCorsResponse(mockSummary, 200, req);
    }

    return createCorsResponse({ error: 'Route not found' }, 404, req);
  } catch (error) {
    console.error('Error in sales-pipeline function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
