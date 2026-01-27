// Platform Deals Edge Function
// Manages the sales pipeline for platform-level tenant acquisition (Root Admin only)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

const PIPELINE_STAGES = [
  { stage: 'prospecting', order: 1, probability: 10, category: 'pipeline' },
  { stage: 'qualification', order: 2, probability: 20, category: 'pipeline' },
  { stage: 'demo_scheduled', order: 3, probability: 30, category: 'best_case' },
  { stage: 'demo_completed', order: 4, probability: 40, category: 'best_case' },
  { stage: 'trial_started', order: 5, probability: 60, category: 'committed' },
  { stage: 'proposal', order: 6, probability: 75, category: 'committed' },
  { stage: 'negotiation', order: 7, probability: 90, category: 'committed' },
  { stage: 'closed_won', order: 8, probability: 100, category: 'closed' },
  { stage: 'closed_lost', order: 9, probability: 0, category: 'closed' },
];

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+)
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1]; // /platform-deals, /platform-deals/pipeline, etc.
    const dealId =
      pathParts[1] !== 'pipeline' && pathParts[1] !== 'stats' && pathParts[1] !== 'pipeline-stages'
        ? pathParts[1]
        : null;
    const subResource = pathParts[2];

    // GET /platform-deals/pipeline-stages - Get pipeline stage configuration
    if (req.method === 'GET' && endpoint === 'pipeline-stages') {
      return createCorsResponse({ stages: PIPELINE_STAGES }, 200, req);
    }

    // GET /platform-deals/pipeline - Get pipeline view with deals grouped by stage
    if (req.method === 'GET' && endpoint === 'pipeline') {
      const { data: deals } = await admin
        .from('platform_deals')
        .select('*')
        .eq('status', 'open')
        .order('expected_close_date', { ascending: false });

      const allDeals = deals || [];

      // Group deals by stage
      const pipeline = PIPELINE_STAGES.map((stageConfig) => {
        const stageDeals = allDeals.filter((d: any) => d.stage === stageConfig.stage);
        const totalValue = stageDeals.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0);
        const weightedValue = stageDeals.reduce(
          (sum: number, d: any) => sum + (d.weighted_value || 0),
          0,
        );

        return {
          ...stageConfig,
          count: stageDeals.length,
          totalValue,
          weightedValue,
          deals: stageDeals,
        };
      });

      const totalPipelineValue = allDeals.reduce(
        (sum: number, d: any) => sum + (d.deal_value || 0),
        0,
      );
      const totalWeightedValue = allDeals.reduce(
        (sum: number, d: any) => sum + (d.weighted_value || 0),
        0,
      );

      return createCorsResponse(
        {
          pipeline,
          summary: {
            totalPipelineValue,
            totalWeightedValue,
            totalDeals: allDeals.length,
          },
        },
        200,
        req,
      );
    }

    // GET /platform-deals/stats - Get deal statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const period = url.searchParams.get('period') || 'month';

      let daysBack = 30;
      if (period === 'week') daysBack = 7;
      else if (period === 'quarter') daysBack = 90;
      else if (period === 'year') daysBack = 365;

      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const { data: wonDeals } = await admin
        .from('platform_deals')
        .select('id, deal_value')
        .eq('status', 'won')
        .gte('created_at', startDate);

      const { data: lostDeals } = await admin
        .from('platform_deals')
        .select('id')
        .eq('status', 'lost')
        .gte('created_at', startDate);

      const wonCount = wonDeals?.length || 0;
      const lostCount = lostDeals?.length || 0;
      const totalClosed = wonCount + lostCount;
      const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;
      const totalARRBooked =
        wonDeals?.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) || 0;
      const avgDealSize = wonCount > 0 ? totalARRBooked / wonCount : 0;

      return createCorsResponse(
        {
          period,
          metrics: {
            winRate: Math.round(winRate * 10) / 10,
            totalARRBooked,
            avgDealSize,
            avgSalesCycle: 30,
            dealsWon: wonCount,
            dealsLost: lostCount,
          },
        },
        200,
        req,
      );
    }

    // GET /platform-deals - List deals
    if (req.method === 'GET' && !endpoint) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const stage = url.searchParams.get('stage');
      const status = url.searchParams.get('status');

      let query = admin
        .from('platform_deals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (stage) query = query.eq('stage', stage);
      if (status) query = query.eq('status', status);

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching deals:', error);
        return createCorsResponse({ error: 'Failed to fetch deals' }, 500, req);
      }

      return createCorsResponse(
        {
          deals: deals || [],
          pagination: {
            page,
            limit,
            totalRecords: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            hasMore: page < Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /platform-deals/:id - Get single deal
    if (req.method === 'GET' && dealId && !subResource) {
      const { data: deal, error } = await admin
        .from('platform_deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Deal not found' }, 404, req);
      }

      return createCorsResponse({ deal }, 200, req);
    }

    // POST /platform-deals - Create new deal
    if (req.method === 'POST' && !endpoint) {
      const body = await req.json();

      const dealData = {
        ...body,
        stage: body.stage || 'prospecting',
        status: body.status || 'open',
        weighted_value:
          body.deal_value && body.probability ? (body.deal_value * body.probability) / 100 : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: deal, error } = await admin
        .from('platform_deals')
        .insert(dealData)
        .select()
        .single();

      if (error) {
        console.error('Error creating deal:', error);
        return createCorsResponse({ error: 'Failed to create deal' }, 500, req);
      }

      return createCorsResponse(deal, 201, req);
    }

    // PATCH /platform-deals/:id - Update deal
    if (req.method === 'PATCH' && dealId && !subResource) {
      const body = await req.json();

      const { data: deal, error } = await admin
        .from('platform_deals')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        console.error('Error updating deal:', error);
        return createCorsResponse({ error: 'Failed to update deal' }, 500, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // POST /platform-deals/:id/move-stage - Move deal to a new stage
    if (req.method === 'POST' && dealId && subResource === 'move-stage') {
      const body = await req.json();
      const { stage } = body;

      const stageConfig = PIPELINE_STAGES.find((s) => s.stage === stage);
      if (!stageConfig) {
        return createCorsResponse({ error: 'Invalid stage' }, 400, req);
      }

      const { data: currentDeal } = await admin
        .from('platform_deals')
        .select('deal_value, stage')
        .eq('id', dealId)
        .single();

      const { data: deal, error } = await admin
        .from('platform_deals')
        .update({
          stage,
          previous_stage: currentDeal?.stage,
          probability: stageConfig.probability,
          forecast_category: stageConfig.category,
          weighted_value: ((currentDeal?.deal_value || 0) * stageConfig.probability) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to move deal stage' }, 500, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // POST /platform-deals/:id/close-won - Mark deal as won
    if (req.method === 'POST' && dealId && subResource === 'close-won') {
      const body = await req.json();

      const { data: deal, error } = await admin
        .from('platform_deals')
        .update({
          stage: 'closed_won',
          status: 'won',
          win_reason: body.winReason,
          actual_close_date: body.actualCloseDate || new Date().toISOString(),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to close deal as won' }, 500, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // POST /platform-deals/:id/close-lost - Mark deal as lost
    if (req.method === 'POST' && dealId && subResource === 'close-lost') {
      const body = await req.json();

      const { data: deal, error } = await admin
        .from('platform_deals')
        .update({
          stage: 'closed_lost',
          status: 'lost',
          lost_reason: body.lostReason,
          lost_to_competitor: body.lostToCompetitor,
          actual_close_date: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to close deal as lost' }, 500, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // DELETE /platform-deals/:id - Delete deal
    if (req.method === 'DELETE' && dealId) {
      const { error } = await admin.from('platform_deals').delete().eq('id', dealId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete deal' }, 500, req);
      }

      return createCorsResponse({ message: 'Deal deleted successfully' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in platform-deals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
