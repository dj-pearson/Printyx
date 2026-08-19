// Team Reports Edge Function
// Handles team performance reporting and analytics
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { displayName, USER_NAME_COLUMNS, type UserRow } from '../_shared/user-profile.ts';

// COP-M01: this file addressed business_records as deal_value / assigned_to /
// pipeline_stage. The columns are estimated_deal_value, assigned_sales_rep and
// sales_stage, so every query here answered 42703, `deals` came back undefined,
// and each report returned zeroes through `|| 0` rather than an error. Note
// estimated_deal_value is numeric, which PostgREST returns as a STRING — the
// sums coerce through toNumber, or they would concatenate.

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /team-reports, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'team-reports');
    const reportType = parts[0];
    const teamId = url.searchParams.get('teamId');

    // Helper to get date range
    const period = url.searchParams.get('period') || 'month';
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // GET /team-reports/summary - Team summary report
    if (req.method === 'GET' && reportType === 'summary') {
      // Get team members
      const { data: members } = await admin
        .from('team_members')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .eq('team_id', teamId || '');

      const memberIds = (members || []).map((m: any) => m.user_id);

      // Get activities by team members
      const { count: totalActivities } = await admin
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('user_id', memberIds)
        .gte('created_at', startDate.toISOString());

      // Get deals by team
      const { data: deals } = await admin
        .from('business_records')
        .select('estimated_deal_value, status')
        .eq('tenant_id', tenantId)
        .in('assigned_sales_rep', memberIds)
        .gte('created_at', startDate.toISOString());

      const totalDealValue = (deals || []).reduce(
        (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
        0,
      );
      const wonDeals = (deals || []).filter((d: any) => d.status === 'won');
      const wonValue = wonDeals.reduce(
        (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
        0,
      );

      return createCorsResponse(
        {
          period,
          teamMembers: members?.length || 0,
          totalActivities: totalActivities || 0,
          totalDeals: deals?.length || 0,
          totalDealValue,
          wonDeals: wonDeals.length,
          wonValue,
          winRate: deals?.length ? Math.round((wonDeals.length / deals.length) * 100) : 0,
        },
        200,
        req,
      );
    }

    // GET /team-reports/leaderboard - Team leaderboard
    if (req.method === 'GET' && reportType === 'leaderboard') {
      const metric = url.searchParams.get('metric') || 'deals';

      let query;
      if (metric === 'deals') {
        query = admin
          .from('business_records')
          .select('assigned_sales_rep, estimated_deal_value')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('created_at', startDate.toISOString());
      } else if (metric === 'activities') {
        query = admin
          .from('activities')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString());
      }

      const { data: records } = await query;

      // Aggregate by user
      const userStats = new Map<string, { count: number; value: number }>();
      (records || []).forEach((r: any) => {
        const userId = r.assigned_sales_rep || r.user_id;
        const current = userStats.get(userId) || { count: 0, value: 0 };
        userStats.set(userId, {
          count: current.count + 1,
          value: current.value + toNumber(r.estimated_deal_value),
        });
      });

      // Get user details
      const userIds = Array.from(userStats.keys());
      const { data: users } = await admin
        .from('users')
        .select(`${USER_NAME_COLUMNS}, email`)
        .in('id', userIds);

      const leaderboard = Array.from(userStats.entries())
        .map(([userId, stats]) => {
          const userInfo = users?.find((u: any) => u.id === userId);
          return {
            userId,
            name: displayName(userInfo as UserRow, userInfo?.email || 'Unknown'),
            count: stats.count,
            value: stats.value,
          };
        })
        .sort((a, b) => (metric === 'deals' ? b.value - a.value : b.count - a.count))
        .slice(0, 10);

      return createCorsResponse(leaderboard, 200, req);
    }

    // GET /team-reports/activity - Activity breakdown
    if (req.method === 'GET' && reportType === 'activity') {
      const { data: activities } = await admin
        .from('activities')
        .select('activity_type, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      // Group by type
      const byType = new Map<string, number>();
      (activities || []).forEach((a: any) => {
        byType.set(a.activity_type, (byType.get(a.activity_type) || 0) + 1);
      });

      // Group by day
      const byDay = new Map<string, number>();
      (activities || []).forEach((a: any) => {
        const day = a.created_at.split('T')[0];
        byDay.set(day, (byDay.get(day) || 0) + 1);
      });

      return createCorsResponse(
        {
          total: activities?.length || 0,
          byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
          byDay: Array.from(byDay.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
        200,
        req,
      );
    }

    // GET /team-reports/pipeline - Pipeline report
    if (req.method === 'GET' && reportType === 'pipeline') {
      const { data: deals } = await admin
        .from('business_records')
        .select('status, estimated_deal_value, sales_stage')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'opportunity');

      // Group by stage
      const byStage = new Map<string, { count: number; value: number }>();
      (deals || []).forEach((d: any) => {
        const stage = d.sales_stage || d.status || 'unknown';
        const current = byStage.get(stage) || { count: 0, value: 0 };
        byStage.set(stage, {
          count: current.count + 1,
          value: current.value + toNumber(d.estimated_deal_value),
        });
      });

      return createCorsResponse(
        {
          totalDeals: deals?.length || 0,
          totalValue: (deals || []).reduce(
            (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
            0,
          ),
          byStage: Array.from(byStage.entries()).map(([stage, stats]) => ({
            stage,
            count: stats.count,
            value: stats.value,
          })),
        },
        200,
        req,
      );
    }

    // GET /team-reports/performance - Individual performance metrics
    if (req.method === 'GET' && reportType === 'performance') {
      const userId = url.searchParams.get('userId');

      if (!userId) {
        return createCorsResponse({ error: 'userId required' }, 400, req);
      }

      // Get user's activities
      const { count: activityCount } = await admin
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      // Get user's deals
      const { data: deals } = await admin
        .from('business_records')
        .select('estimated_deal_value, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('assigned_sales_rep', userId)
        .gte('created_at', startDate.toISOString());

      const wonDeals = (deals || []).filter((d: any) => d.status === 'won');
      const lostDeals = (deals || []).filter((d: any) => d.status === 'lost');

      return createCorsResponse(
        {
          userId,
          period,
          activities: activityCount || 0,
          totalDeals: deals?.length || 0,
          wonDeals: wonDeals.length,
          lostDeals: lostDeals.length,
          pendingDeals: (deals?.length || 0) - wonDeals.length - lostDeals.length,
          totalValue: (deals || []).reduce(
            (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
            0,
          ),
          wonValue: wonDeals.reduce(
            (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
            0,
          ),
          winRate: deals?.length ? Math.round((wonDeals.length / deals.length) * 100) : 0,
        },
        200,
        req,
      );
    }

    // GET /team-reports/comparison - Team comparison
    if (req.method === 'GET' && reportType === 'comparison') {
      const { data: teams } = await admin
        .from('teams')
        .select('id, name')
        .eq('tenant_id', tenantId);

      const teamStats = await Promise.all(
        (teams || []).map(async (team: any) => {
          const { data: members } = await admin
            .from('team_members')
            .select('user_id')
            .eq('team_id', team.id);

          const memberIds = (members || []).map((m: any) => m.user_id);

          const { data: deals } = await admin
            .from('business_records')
            .select('estimated_deal_value, status')
            .eq('tenant_id', tenantId)
            .in('assigned_sales_rep', memberIds)
            .gte('created_at', startDate.toISOString());

          const wonValue = (deals || [])
            .filter((d: any) => d.status === 'won')
            .reduce((sum: number, d: any) => sum + toNumber(d.estimated_deal_value), 0);

          return {
            teamId: team.id,
            teamName: team.name,
            memberCount: members?.length || 0,
            totalDeals: deals?.length || 0,
            wonValue,
          };
        }),
      );

      return createCorsResponse(teamStats, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in team-reports function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
