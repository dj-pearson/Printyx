// CRM Goals Edge Function
// Handles CRM goal setting and tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { toUserProfile, USER_PROFILE_COLUMNS, type UserRow } from '../_shared/user-profile.ts';
import { normalizePath } from '../_shared/path.ts';

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
    // /crm-goals, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'crm-goals');
    const resource = parts[0]; // goals, teams, activity-reports, etc.
    const resourceId = parts[1];

    // POST /crm/goals - Create goal
    if (req.method === 'POST' && resource === 'goals') {
      const body = await req.json();

      const { data: goal, error } = await admin
        .from('crm_goals')
        .insert({
          tenant_id: tenantId,
          user_id: body.userId || body.user_id,
          team_id: body.teamId || body.team_id,
          goal_type: body.goalType || body.goal_type,
          target_value: body.targetValue || body.target_value,
          current_value: 0,
          period: body.period || 'monthly',
          start_date: body.startDate || body.start_date,
          end_date: body.endDate || body.end_date,
          status: 'active',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create goal' }, 500, req);
      }

      return createCorsResponse(goal, 201, req);
    }

    // GET /crm/goals - List goals
    if (req.method === 'GET' && resource === 'goals') {
      const userId = url.searchParams.get('userId');
      const teamId = url.searchParams.get('teamId');
      const period = url.searchParams.get('period');

      let query = admin
        .from('crm_goals')
        .select(
          `
          *,
          user:user_id (id, first_name, last_name),
          team:team_id (id, name)
        `,
        )
        .eq('tenant_id', tenantId);

      if (userId) query = query.eq('user_id', userId);
      if (teamId) query = query.eq('team_id', teamId);
      if (period) query = query.eq('period', period);

      const { data: goals, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch goals' }, 500, req);
      }

      return createCorsResponse(goals || [], 200, req);
    }

    // GET /crm/teams - List teams
    if (req.method === 'GET' && resource === 'teams') {
      const { data: teams, error } = await admin
        .from('crm_teams')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch teams' }, 500, req);
      }

      return createCorsResponse(teams || [], 200, req);
    }

    // POST /crm/teams - Create team
    if (req.method === 'POST' && resource === 'teams') {
      const body = await req.json();

      const { data: team, error } = await admin
        .from('crm_teams')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          manager_id: body.managerId || body.manager_id,
          members: body.members || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create team' }, 500, req);
      }

      return createCorsResponse(team, 201, req);
    }

    // GET /crm/teams/:teamId/members - Get team members
    if (req.method === 'GET' && resource === 'teams' && resourceId && parts[2] === 'members') {
      const { data: team } = await admin
        .from('crm_teams')
        .select('members')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!team) {
        return createCorsResponse({ error: 'Team not found' }, 404, req);
      }

      const memberIds = team.members || [];

      if (memberIds.length === 0) {
        return createCorsResponse([], 200, req);
      }

      // COP-M01: full_name and job_title are not columns on `users` (the shape
      // is first_name/last_name plus a metadata jsonb), so this returned an
      // empty team every time.
      const { data: members } = await admin
        .from('users')
        .select(USER_PROFILE_COLUMNS)
        .in('id', memberIds);

      return createCorsResponse(
        (members ?? []).map((m: any) => ({ ...m, ...toUserProfile(m as UserRow) })),
        200,
        req,
      );
    }

    // GET /crm/activity-reports - Get activity reports
    if (req.method === 'GET' && resource === 'activity-reports') {
      const userId = url.searchParams.get('userId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let query = admin
        .from('crm_activity_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (userId) query = query.eq('user_id', userId);
      if (startDate) query = query.gte('report_date', startDate);
      if (endDate) query = query.lte('report_date', endDate);

      const { data: reports, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch activity reports' }, 500, req);
      }

      return createCorsResponse(reports || [], 200, req);
    }

    // GET /crm/goal-progress - Get goal progress
    if (req.method === 'GET' && resource === 'goal-progress') {
      const userId = url.searchParams.get('userId');

      let query = admin
        .from('crm_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (userId) query = query.eq('user_id', userId);

      const { data: goals, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch goal progress' }, 500, req);
      }

      // Calculate progress for each goal
      const goalsWithProgress = (goals || []).map((goal: any) => ({
        ...goal,
        progress:
          goal.target_value > 0 ? Math.round((goal.current_value / goal.target_value) * 100) : 0,
        remaining: Math.max(0, goal.target_value - goal.current_value),
      }));

      return createCorsResponse(goalsWithProgress, 200, req);
    }

    // GET /crm/dashboard-stats - Get dashboard statistics
    if (req.method === 'GET' && resource === 'dashboard-stats') {
      const { data: leads } = await admin.from('leads').select('status').eq('tenant_id', tenantId);

      const { data: deals } = await admin
        .from('deals')
        .select('status, amount')
        .eq('tenant_id', tenantId);

      const { data: activities } = await admin
        .from('activities')
        .select('type')
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      return createCorsResponse(
        {
          totalLeads: leads?.length || 0,
          activeLeads: leads?.filter((l: any) => l.status === 'active').length || 0,
          totalDeals: deals?.length || 0,
          totalDealValue: (deals ?? []).reduce(
            (sum: number, d: any) => sum + toNumber(d.amount),
            0,
          ),
          recentActivities: activities?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /crm/manager-insights - Get manager insights
    if (req.method === 'GET' && resource === 'manager-insights') {
      // Get team performance data
      const { data: teamPerformance } = await admin
        .from('crm_goals')
        .select(
          `
          *,
          user:user_id (id, first_name, last_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      return createCorsResponse(
        {
          teamPerformance: teamPerformance || [],
          insights: [{ type: 'info', message: 'Team is on track to meet Q1 goals' }],
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in crm-goals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
