// Today Dashboard Edge Function
// Handles today's dashboard data
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { mergeCrewDay } from '../_shared/delivery-scheduling.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const tomorrowIso = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // GET /today-dashboard - Get today's dashboard data
    if (req.method === 'GET') {
      // WF-L-06: TODAY'S APPOINTMENTS ARE DELIVERIES AND INSTALLS.
      //
      // This read `appointments`, a table with no schema, no migration and no
      // writer anywhere - so `.data` came back null, the `|| []` below turned
      // that into an empty list, and the iOS app's Today screen has shown zero
      // appointments for every tenant since it shipped. A missing relation that
      // reads as "nothing scheduled" is the AUDIT-028 shape, and it is worse
      // here than a 500 would have been.
      //
      // delivery_schedules and installation_schedules are the real tables and
      // they are what a dealer's day is made of. scheduled_date holds a
      // calendar date at UTC midnight, so the window is a day boundary and the
      // upper bound is exclusive (DATE-LOCAL-002).
      const [deliveryRows, installRows] = await Promise.all([
        admin
          .from('delivery_schedules')
          .select('id, equipment_id, customer_id, scheduled_date, time_window, status, driver_id')
          .eq('tenant_id', tenantId)
          .gte('scheduled_date', todayIso)
          .lt('scheduled_date', tomorrowIso),
        admin
          .from('installation_schedules')
          .select(
            'id, equipment_id, customer_id, scheduled_date, estimated_duration, status, technician_id',
          )
          .eq('tenant_id', tenantId)
          .gte('scheduled_date', todayIso)
          .lt('scheduled_date', tomorrowIso),
      ]);

      const appointments = mergeCrewDay(deliveryRows.data ?? [], installRows.data ?? []);

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

      const wonDeals = await fetchAllRows<any>(() =>
        admin
          .from('deals')
          // AUDIT-037: `deals` has amount and actual_close_date, not value and
          // closed_at, so this 42703'd and today's revenue was always 0 - a
          // number the dashboard printed with no way to tell it apart from a
          // genuinely quiet morning.
          .select('amount')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('actual_close_date', todayIso),
      );

      const todayRevenue =
        wonDeals?.reduce((sum: number, d: any) => sum + Number(d.amount ?? 0), 0) || 0;

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
