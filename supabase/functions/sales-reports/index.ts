// Sales Reports Edge Function
// Provides sales reporting endpoints for different role levels
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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

    // Extract tenant ID
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
    const reportType = pathParts[1]; // personal, team, regional, etc.
    const subReport = pathParts[2]; // pipeline, activity, quota, etc.

    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    // GET /sales-reports/personal/pipeline - Personal pipeline report
    if (req.method === 'GET' && reportType === 'personal' && subReport === 'pipeline') {
      const { data: deals } = await admin
        .from('deals')
        .select('id, stage, deal_value, probability, weighted_value')
        .eq('tenant_id', tenantId)
        .eq('owner_id', user.id)
        .eq('status', 'open');

      // Group by stage
      const stageMap = new Map<
        string,
        { count: number; totalValue: number; weightedValue: number }
      >();
      (deals || []).forEach((deal: any) => {
        const current = stageMap.get(deal.stage) || { count: 0, totalValue: 0, weightedValue: 0 };
        stageMap.set(deal.stage, {
          count: current.count + 1,
          totalValue: current.totalValue + (deal.deal_value || 0),
          weightedValue: current.weightedValue + (deal.weighted_value || 0),
        });
      });

      const pipeline = Array.from(stageMap.entries()).map(([stage, stats]) => ({
        stage,
        ...stats,
      }));

      return createCorsResponse(
        {
          pipeline,
          totalDeals: deals?.length || 0,
          totalValue: pipeline.reduce((sum, s) => sum + s.totalValue, 0),
          weightedValue: pipeline.reduce((sum, s) => sum + s.weightedValue, 0),
        },
        200,
        req,
      );
    }

    // GET /sales-reports/personal/activity - Personal activity report
    if (req.method === 'GET' && reportType === 'personal' && subReport === 'activity') {
      const { data: activities } = await admin
        .from('activities')
        .select('id, activity_type, created_at')
        .eq('tenant_id', tenantId)
        .eq('created_by', user.id)
        .gte(
          'created_at',
          dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .lte('created_at', dateTo || new Date().toISOString());

      // Count by type
      const totals = {
        calls: 0,
        emails: 0,
        meetings: 0,
        demos: 0,
        proposals: 0,
      };

      (activities || []).forEach((a: any) => {
        const type = a.activity_type?.toLowerCase();
        if (type === 'call') totals.calls++;
        else if (type === 'email') totals.emails++;
        else if (type === 'meeting') totals.meetings++;
        else if (type === 'demo') totals.demos++;
        else if (type === 'proposal') totals.proposals++;
      });

      return createCorsResponse({ activities: activities || [], totals }, 200, req);
    }

    // GET /sales-reports/personal/quota - Personal quota attainment
    if (req.method === 'GET' && reportType === 'personal' && subReport === 'quota') {
      // Get quota for user
      const { data: quota } = await admin
        .from('sales_quotas')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .single();

      // Get won deals
      const { data: wonDeals } = await admin
        .from('deals')
        .select('deal_value')
        .eq('tenant_id', tenantId)
        .eq('owner_id', user.id)
        .eq('status', 'won');

      const actualRevenue =
        wonDeals?.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) || 0;
      const quotaAmount = quota?.amount || 100000;
      const attainmentPercent = quotaAmount > 0 ? (actualRevenue / quotaAmount) * 100 : 0;

      return createCorsResponse(
        {
          quotaAmount,
          actualRevenue,
          attainmentPercent: Math.round(attainmentPercent * 10) / 10,
          gap: quotaAmount - actualRevenue,
          onTrack: attainmentPercent >= 100,
        },
        200,
        req,
      );
    }

    // GET /sales-reports/team/performance - Team performance report
    if (req.method === 'GET' && reportType === 'team' && subReport === 'performance') {
      const { data: teamDeals } = await admin
        .from('deals')
        .select('owner_id, deal_value, status')
        .eq('tenant_id', tenantId);

      // Group by owner
      const ownerMap = new Map<
        string,
        { wonValue: number; pipelineValue: number; dealCount: number }
      >();
      (teamDeals || []).forEach((deal: any) => {
        const current = ownerMap.get(deal.owner_id) || {
          wonValue: 0,
          pipelineValue: 0,
          dealCount: 0,
        };
        if (deal.status === 'won') {
          current.wonValue += deal.deal_value || 0;
        } else if (deal.status === 'open') {
          current.pipelineValue += deal.deal_value || 0;
        }
        current.dealCount++;
        ownerMap.set(deal.owner_id, current);
      });

      const teamPerformance = Array.from(ownerMap.entries()).map(([ownerId, stats]) => ({
        userId: ownerId,
        ...stats,
      }));

      return createCorsResponse(
        {
          teamPerformance,
          totalWonValue: teamPerformance.reduce((sum, t) => sum + t.wonValue, 0),
          totalPipelineValue: teamPerformance.reduce((sum, t) => sum + t.pipelineValue, 0),
        },
        200,
        req,
      );
    }

    // GET /sales-reports/summary - Overall sales summary
    if (req.method === 'GET' && reportType === 'summary') {
      const { count: totalDeals } = await admin
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { data: wonDeals } = await admin
        .from('deals')
        .select('deal_value')
        .eq('tenant_id', tenantId)
        .eq('status', 'won');

      const { data: openDeals } = await admin
        .from('deals')
        .select('deal_value, weighted_value')
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      const totalWonValue =
        wonDeals?.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) || 0;
      const totalPipelineValue =
        openDeals?.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) || 0;
      const totalWeightedValue =
        openDeals?.reduce((sum: number, d: any) => sum + (d.weighted_value || 0), 0) || 0;

      return createCorsResponse(
        {
          totalDeals: totalDeals || 0,
          totalWonValue,
          totalPipelineValue,
          totalWeightedValue,
          wonCount: wonDeals?.length || 0,
          openCount: openDeals?.length || 0,
        },
        200,
        req,
      );
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-reports function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
