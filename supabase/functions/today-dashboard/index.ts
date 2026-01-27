// Today Dashboard Edge Function
// Handles today's dashboard data
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const tomorrowIso = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // GET /today-dashboard - Get today's dashboard data
    if (req.method === 'GET') {
      // Get today's appointments
      const { data: appointments } = await admin
        .from('appointments')
        .select(
          `
          *,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .gte('start_time', todayIso)
        .lt('start_time', tomorrowIso)
        .order('start_time', { ascending: true });

      // Get today's tasks
      const { data: tasks } = await admin
        .from('tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`due_date.gte.${todayIso},due_date.lt.${tomorrowIso}`)
        .eq('status', 'pending');

      // Get overdue tasks
      const { data: overdueTasks } = await admin
        .from('tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .lt('due_date', todayIso)
        .eq('status', 'pending');

      // Get recent activities
      const { data: recentActivities } = await admin
        .from('activities')
        .select(
          `
          *,
          user:user_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get pending approvals
      const { data: pendingApprovals } = await admin
        .from('deal_desk_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      // Get key metrics
      const { data: newLeads } = await admin
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', todayIso);

      const { data: wonDeals } = await admin
        .from('deals')
        .select('value')
        .eq('tenant_id', tenantId)
        .eq('status', 'won')
        .gte('closed_at', todayIso);

      const todayRevenue = wonDeals?.reduce((sum: number, d: any) => sum + (d.value || 0), 0) || 0;

      return createCorsResponse(
        {
          date: todayIso,
          appointments: appointments || [],
          appointmentCount: appointments?.length || 0,
          tasks: tasks || [],
          taskCount: tasks?.length || 0,
          overdueTasks: overdueTasks || [],
          overdueCount: overdueTasks?.length || 0,
          recentActivities: recentActivities || [],
          pendingApprovals: pendingApprovals || [],
          pendingApprovalCount: pendingApprovals?.length || 0,
          metrics: {
            newLeads: newLeads?.length || 0,
            todayRevenue,
            dealsWon: wonDeals?.length || 0,
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in today-dashboard function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
