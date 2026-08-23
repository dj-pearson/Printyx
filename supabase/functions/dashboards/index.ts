// Dashboards Edge Function
// Provides dashboard data and configurations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toNumber } from '../_shared/quote-math.ts';
import {
  conversionRate,
  toActivityView,
  toLeadView,
  toStaleDealView,
  toWonDealView,
  todayWindows,
  type BusinessRecordRow,
} from '../_shared/today-dashboard-view.ts';

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

    // GET /dashboards/today - the "My Day" page (client/src/pages/TodayDashboard.tsx).
    //
    // PROD-008: this used to return {activitiesCount, newTickets, newDeals,
    // newDealValue}. The page reads {overdue, today, upcoming, hotLeads,
    // pipelineAlerts, recentWins, stats} and destructures with `= []` defaults,
    // so production rendered an empty dashboard with zero stats and no error,
    // while dev ran an entirely different Express handler on an unproxied
    // prefix. Ported to the contract the page actually reads.
    //
    // Every read below is bounded by a limit or answered by a server-side count,
    // so nothing here can be silently truncated by db-max-rows. The two stats
    // that would need a SUM are returned as null - see TodayStats.
    if (req.method === 'GET' && dashboardType === 'today') {
      const now = new Date();
      const w = todayWindows(now);
      const STALE_AFTER_DAYS = 7;
      const staleCutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();

      const activityCols =
        'id, subject, activity_type, scheduled_date, due_date, completed_date, description, business_record_id';

      const [
        { data: overdueRows },
        { data: todayRows },
        { data: upcomingRows },
        { data: leadRows },
        { data: staleRows },
        { data: wonRows },
      ] = await Promise.all([
        admin
          .from('business_record_activities')
          .select(activityCols)
          .eq('tenant_id', tenantId)
          .is('completed_date', null)
          .or(
            `due_date.lte.${w.startOfDay.toISOString()},scheduled_date.lte.${w.yesterday.toISOString()}`,
          )
          .order('due_date', { ascending: true })
          .limit(10),
        admin
          .from('business_record_activities')
          .select(activityCols)
          .eq('tenant_id', tenantId)
          .is('completed_date', null)
          .gte('scheduled_date', w.startOfDay.toISOString())
          .lte('scheduled_date', w.endOfDay.toISOString())
          .order('scheduled_date', { ascending: true })
          .limit(20),
        admin
          .from('business_record_activities')
          .select(activityCols)
          .eq('tenant_id', tenantId)
          .is('completed_date', null)
          .gte('scheduled_date', w.upcomingFrom.toISOString())
          .lte('scheduled_date', w.upcomingTo.toISOString())
          .order('scheduled_date', { ascending: true })
          .limit(10),
        admin
          .from('lead_score_calculations')
          .select('id, lead_id, total_score, lead_grade, lead_tier')
          .eq('tenant_id', tenantId)
          .gte('total_score', 70)
          .order('total_score', { ascending: false })
          .limit(10),
        // COALESCE(updated_at, created_at) < cutoff, expressed as PostgREST can:
        // updated_at is nullable, so the null case falls back to created_at.
        admin
          .from('deals')
          .select('id, title, company_name, amount, probability, stage_id, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .or(`updated_at.lt.${staleCutoff},and(updated_at.is.null,created_at.lt.${staleCutoff})`)
          .order('updated_at', { ascending: true, nullsFirst: true })
          .limit(5),
        admin
          .from('deals')
          .select('id, title, company_name, amount, probability, stage_id, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('actual_close_date', w.weekStart.toISOString())
          .lte('actual_close_date', w.weekEnd.toISOString())
          .order('actual_close_date', { ascending: false })
          .limit(5),
      ]);

      const activities = [...(overdueRows ?? []), ...(todayRows ?? []), ...(upcomingRows ?? [])];
      const recordIds = [
        ...new Set(
          [
            ...activities.map((a: Record<string, unknown>) => a.business_record_id),
            ...(leadRows ?? []).map((l: Record<string, unknown>) => l.lead_id),
          ].filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];
      const stageIds = [
        ...new Set(
          (staleRows ?? [])
            .map((d: Record<string, unknown>) => d.stage_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];

      const [{ data: recordRows }, { data: stageRows }, leadCount, customerCount, doneToday] =
        await Promise.all([
          recordIds.length
            ? admin
                .from('business_records')
                .select(
                  'id, company_name, primary_contact_name, estimated_deal_value, status, last_contact_date',
                )
                .eq('tenant_id', tenantId)
                .in('id', recordIds)
            : Promise.resolve({ data: [] as BusinessRecordRow[] }),
          stageIds.length
            ? admin
                .from('pipeline_stages')
                .select('id, name, display_name')
                .eq('tenant_id', tenantId)
                .in('id', stageIds)
            : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
          admin
            .from('business_records')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('record_type', 'lead'),
          admin
            .from('business_records')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('record_type', 'customer'),
          admin
            .from('business_record_activities')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .not('completed_date', 'is', null)
            .gte('completed_date', w.startOfDay.toISOString()),
        ]);

      const companyNames = new Map<string, string | null>(
        ((recordRows ?? []) as BusinessRecordRow[]).map((r) => [
          String(r.id),
          (r.company_name as string | null) ?? null,
        ]),
      );
      const recordsById = new Map<string, BusinessRecordRow>(
        ((recordRows ?? []) as BusinessRecordRow[]).map((r) => [String(r.id), r]),
      );
      const stageNames = new Map<string, string>(
        ((stageRows ?? []) as Array<Record<string, unknown>>).map((st) => [
          String(st.id),
          String(st.display_name || st.name || ''),
        ]),
      );

      return createCorsResponse(
        {
          overdue: (overdueRows ?? []).map((a) => toActivityView(a, companyNames)),
          today: (todayRows ?? []).map((a) => toActivityView(a, companyNames)),
          upcoming: (upcomingRows ?? []).map((a) => toActivityView(a, companyNames)),
          hotLeads: (leadRows ?? []).map((l) => toLeadView(l, recordsById)),
          pipelineAlerts: (staleRows ?? []).map((d) => toStaleDealView(d, stageNames, now)),
          recentWins: (wonRows ?? []).map(toWonDealView),
          stats: {
            pipelineValue: null,
            quotaAttainment: null,
            conversionRate: conversionRate(leadCount.count ?? 0, customerCount.count ?? 0),
            tasksCompleted: doneToday.count ?? 0,
          },
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
