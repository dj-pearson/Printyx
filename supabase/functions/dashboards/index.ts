// Dashboards Edge Function
// Provides dashboard data and configurations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toNumber } from '../_shared/quote-math.ts';

/**
 * Total of a set of deal amounts.
 *
 * deals.amount is numeric(12,2), and PostgREST returns numeric as a STRING —
 * `0 + row.amount` would concatenate rather than add, so every caller has to
 * coerce. Doing it here means no caller can forget.
 */
function sumAmounts(rows: Array<{ amount?: unknown }> | null | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + toNumber(row?.amount), 0);
}

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
    const { parts } = normalizePath(url.pathname, 'dashboards');
    const dashboardType = parts[0];
    const subEndpoint = parts[1];

    // GET /dashboards/sales - Sales dashboard data
    if (req.method === 'GET' && dashboardType === 'sales') {
      // COP-M01: this selected deal_value and stage. Neither is a column on
      // `deals` (they are amount and stage_id), so PostgREST answered 42703, the
      // destructured data came back undefined, and every figure below fell
      // through `|| 0` — the dashboard showed a pipeline of zeroes rather than an
      // error. `stage` was selected and never read, so it is simply gone.
      const { data: deals, error: dealsError } = await admin
        .from('deals')
        .select('id, amount, status, created_at')
        .eq('tenant_id', tenantId);

      if (dealsError) {
        console.error('Error loading deals for sales dashboard:', dealsError);
        return createCorsResponse(
          { error: 'Failed to load sales dashboard', details: dealsError.message },
          500,
          req,
        );
      }

      const allDeals = deals || [];
      const openDeals = allDeals.filter((d: any) => d.status === 'open');
      const wonDeals = allDeals.filter((d: any) => d.status === 'won');

      return createCorsResponse(
        {
          totalPipeline: sumAmounts(openDeals),
          totalWon: sumAmounts(wonDeals),
          dealCount: allDeals.length,
          openCount: openDeals.length,
          wonCount: wonDeals.length,
          winRate: allDeals.length > 0 ? (wonDeals.length / allDeals.length) * 100 : 0,
        },
        200,
        req,
      );
    }

    // GET /dashboards/service - Service dashboard data
    if (req.method === 'GET' && dashboardType === 'service') {
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('id, status, priority, created_at, resolved_at')
        .eq('tenant_id', tenantId);

      const allTickets = tickets || [];
      const openTickets = allTickets.filter((t: any) =>
        ['new', 'open', 'assigned', 'in_progress'].includes(t.status),
      );
      const resolvedTickets = allTickets.filter((t: any) =>
        ['completed', 'resolved', 'closed'].includes(t.status),
      );

      return createCorsResponse(
        {
          totalTickets: allTickets.length,
          openTickets: openTickets.length,
          resolvedTickets: resolvedTickets.length,
          urgentTickets: allTickets.filter(
            (t: any) => t.priority === 'urgent' || t.priority === 'emergency',
          ).length,
        },
        200,
        req,
      );
    }

    // GET /dashboards/executive - Executive dashboard data
    if (req.method === 'GET' && dashboardType === 'executive') {
      // Fetch multiple metrics in parallel
      const [
        { count: totalCustomers },
        { count: totalDeals },
        { data: revenue },
        { count: activeTickets },
      ] = await Promise.all([
        admin
          .from('business_records')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'customer'),
        admin.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        admin.from('deals').select('amount').eq('tenant_id', tenantId).eq('status', 'won'),
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['new', 'open', 'assigned']),
      ]);

      const totalRevenue = sumAmounts(revenue);

      return createCorsResponse(
        {
          totalCustomers: totalCustomers || 0,
          totalDeals: totalDeals || 0,
          totalRevenue,
          activeTickets: activeTickets || 0,
          kpis: {
            revenueGrowth: 12.5, // Placeholder
            customerSatisfaction: 92, // Placeholder
            ticketResolutionRate: 85, // Placeholder
          },
        },
        200,
        req,
      );
    }

    // GET /dashboards/today - Today's dashboard
    if (req.method === 'GET' && dashboardType === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [{ data: todayActivities }, { data: todayTickets }, { data: todayDeals }] =
        await Promise.all([
          admin
            .from('activities')
            .select('id, activity_type')
            .eq('tenant_id', tenantId)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),
          admin
            .from('service_tickets')
            .select('id, status')
            .eq('tenant_id', tenantId)
            .gte('created_at', todayStart.toISOString()),
          admin
            .from('deals')
            .select('id, amount')
            .eq('tenant_id', tenantId)
            .gte('created_at', todayStart.toISOString()),
        ]);

      return createCorsResponse(
        {
          activitiesCount: todayActivities?.length || 0,
          newTickets: todayTickets?.length || 0,
          newDeals: todayDeals?.length || 0,
          newDealValue: sumAmounts(todayDeals),
        },
        200,
        req,
      );
    }

    // GET /dashboards/config - Get user's dashboard configuration
    if (req.method === 'GET' && dashboardType === 'config') {
      const { data: config } = await admin
        .from('dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return createCorsResponse(
        config || {
          layout: 'default',
          widgets: ['sales-summary', 'service-status', 'recent-activities'],
          theme: 'light',
        },
        200,
        req,
      );
    }

    // PUT /dashboards/config - Update dashboard configuration
    if (req.method === 'PUT' && dashboardType === 'config') {
      const body = await req.json();

      const { data: config, error } = await admin
        .from('dashboard_configs')
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          ...body,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating dashboard config:', error);
        return createCorsResponse({ error: 'Failed to update config' }, 500, req);
      }

      return createCorsResponse(config, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in dashboards function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
