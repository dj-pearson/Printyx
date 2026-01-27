// CRM Edge Function
// Handles CRM goals, dashboard stats, teams, and progress tracking
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
    const subRoute = pathParts[1]; // e.g., 'goals', 'dashboard-stats', 'teams', 'goal-progress'

    // GET /crm/goals - List CRM goals
    if (req.method === 'GET' && subRoute === 'goals') {
      // TODO: Fetch actual goals from database
      return createCorsResponse([], 200, req);
    }

    // POST /crm/goals - Create CRM goal
    if (req.method === 'POST' && subRoute === 'goals') {
      const body = await req.json();
      // TODO: Create goal in database
      return createCorsResponse({ success: true, message: 'Goal created' }, 201, req);
    }

    // GET /crm/dashboard-stats - Dashboard statistics
    if (req.method === 'GET' && subRoute === 'dashboard-stats') {
      // TODO: Calculate real stats from database
      const mockStats = {
        totalLeads: 0,
        totalCustomers: 0,
        totalRevenue: 0,
        activeDeals: 0,
        revenueThisMonth: 0,
        leadsThisMonth: 0,
        customersThisMonth: 0,
        conversionRate: 0,
      };
      return createCorsResponse(mockStats, 200, req);
    }

    // GET /crm/teams - List teams
    if (req.method === 'GET' && subRoute === 'teams') {
      const { data: teams, error } = await admin
        .from('teams')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) {
        console.error('Error fetching teams:', error);
        return createCorsResponse({ error: 'Failed to fetch teams' }, 500, req);
      }

      return createCorsResponse(teams || [], 200, req);
    }

    // GET /crm/goal-progress - Goal progress tracking
    if (req.method === 'GET' && subRoute === 'goal-progress') {
      const goalId = url.searchParams.get('goalId');
      // TODO: Calculate goal progress from database
      const mockProgress = {
        goalId,
        current: 0,
        target: 0,
        percentage: 0,
        trend: 'up',
      };
      return createCorsResponse(mockProgress, 200, req);
    }

    return createCorsResponse({ error: 'Route not found' }, 404, req);
  } catch (error) {
    console.error('Error in crm function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
