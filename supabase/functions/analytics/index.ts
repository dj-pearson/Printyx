// Analytics Edge Function
// Handles analytics queries and metrics aggregation
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import { startOfUtcDay } from '../_shared/date-months.ts';
import {
  monthToDateRevenue,
  previousUtcMonthStart,
  summariseCloseRate,
  summariseTicketTurnaround,
} from '../../../shared/mobile-dashboard.ts';
import { isOpenStatus } from '../_shared/service-ticket-vocabulary.ts';

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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /analytics, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'analytics');
    const metricType = parts[0]; // 'dashboard', 'sales', 'service', 'performance'

    // QUERYKEY-002: AdvancedAnalyticsDashboard's selector offers last-7-days,
    // last-30-days, last-90-days, last-12-months and ytd - a different
    // vocabulary from the week|month|quarter|year this switch understood. An
    // unmatched value fell through leaving startDate at NOW, so the window was
    // zero-length and every count came back empty. That was invisible while the
    // value was a path segment (the request 404'd before it got here); fixing
    // the transport is what would have exposed it. Both vocabularies are
    // accepted and anything unrecognised falls back to one month rather than to
    // an empty window.
    const period = url.searchParams.get('period') || 'month';
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
      case 'last-7-days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'quarter':
      case 'last-90-days':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
      case 'last-12-months':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ytd':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
      case 'last-30-days':
      default:
        startDate.setDate(now.getDate() - 30);
        break;
    }

    // GET /analytics/dashboard - Overall dashboard metrics
    if (req.method === 'GET' && metricType === 'dashboard') {
      const [customers, quotes, tickets, activities] = await Promise.all([
        admin
          .from('business_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('record_type', 'customer')
          .gte('created_at', startDate.toISOString()),
        fetchAllRows<any>(() =>
          admin
            .from('quotes')
            .select('id, status, total_amount, created_at')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate.toISOString()),
        ),
        fetchAllRows<any>(() =>
          admin
            .from('service_tickets')
            .select('id, status, created_at')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate.toISOString()),
        ),
        fetchAllRows<any>(() =>
          admin
            .from('business_record_activities')
            .select('id, activity_type')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate.toISOString()),
        ),
      ]);

      const metrics = {
        customers: {
          total: customers.count || 0,
          new: customers.count || 0,
        },
        quotes: {
          total: quotes?.length || 0,
          won: quotes?.filter((q) => q.status === 'accepted').length || 0,
          pending: quotes?.filter((q) => q.status === 'sent').length || 0,
          totalValue: quotes?.reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0,
        },
        tickets: {
          total: tickets?.length || 0,
          open: tickets?.filter((t) => isOpenStatus(t.status)).length || 0,
          closed: tickets?.filter((t) => t.status === 'completed').length || 0,
        },
        activities: {
          total: activities.length,
          byType: activities.reduce((acc: Record<string, number>, a) => {
            acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
            return acc;
          }, {}),
        },
      };

      return createCorsResponse({ period, metrics }, 200, req);
    }

    // GET /analytics/sales - Sales-specific metrics
    if (req.method === 'GET' && metricType === 'sales') {
      const quotes = await admin
        .from('quotes')
        .select('status, total_amount, created_at, accepted_date, created_by')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      const totalQuotes = quotes?.length || 0;
      const wonQuotes = quotes?.filter((q) => q.status === 'accepted').length || 0;
      const winRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;

      const revenue =
        quotes.data
          ?.filter((q) => q.status === 'accepted')
          .reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0;

      const avgDealSize = wonQuotes > 0 ? revenue / wonQuotes : 0;

      // Sales by rep
      const byRep = quotes?.reduce((acc: Record<string, any>, q) => {
        const repId = q.created_by || 'unknown';
        if (!acc[repId]) acc[repId] = { quotes: 0, won: 0, revenue: 0 };
        acc[repId].quotes++;
        if (q.status === 'accepted') {
          acc[repId].won++;
          acc[repId].revenue += parseFloat(q.total_amount || '0');
        }
        return acc;
      }, {});

      return createCorsResponse(
        {
          period,
          metrics: {
            totalQuotes,
            wonQuotes,
            winRate: Math.round(winRate),
            revenue,
            avgDealSize: Math.round(avgDealSize),
            byRep,
          },
        },
        200,
        req,
      );
    }

    // GET /analytics/service - Service-specific metrics
    if (req.method === 'GET' && metricType === 'service') {
      const tickets = await fetchAllRows<any>(() =>
        admin
          .from('service_tickets')
          .select('status, created_at, resolved_at, assigned_technician_id')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
      );

      const totalTickets = tickets?.length || 0;
      const resolved = tickets?.filter((t) => t.status === 'completed').length || 0;
      const resolutionRate = totalTickets > 0 ? (resolved / totalTickets) * 100 : 0;

      const avgResolutionTime =
        tickets
          ?.filter((t) => t.resolved_at)
          .reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolvedTime = new Date(t.resolved_at!).getTime();
            return sum + (resolvedTime - created);
          }, 0) / (resolved || 1);

      const avgResolutionHours = Math.round(avgResolutionTime / (1000 * 60 * 60));

      // Tickets by technician
      const byTechnician = tickets?.reduce((acc: Record<string, any>, t) => {
        const techId = t.assigned_technician_id || 'unassigned';
        if (!acc[techId]) acc[techId] = { total: 0, resolved: 0 };
        acc[techId].total++;
        if (t.status === 'completed') acc[techId].resolved++;
        return acc;
      }, {});

      return createCorsResponse(
        {
          period,
          metrics: {
            totalTickets,
            resolved,
            resolutionRate: Math.round(resolutionRate),
            avgResolutionHours,
            byTechnician,
          },
        },
        200,
        req,
      );
    }

    // GET /analytics/performance - Team performance metrics
    if (req.method === 'GET' && metricType === 'performance') {
      const [tasks, activities, users] = await Promise.all([
        admin
          .from('tasks')
          .select('status, assigned_to, completed_at, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('business_record_activities')
          .select('created_by, activity_type')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin.from('users').select('id, first_name, last_name').eq('tenant_id', tenantId),
      ]);

      const totalTasks = tasks.data?.length || 0;
      const completedTasks = tasks.data?.filter((t) => t.status === 'completed').length || 0;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const userPerformance = users.data?.map((u) => {
        const userTasks = tasks.data?.filter((t) => t.assigned_to === u.id) || [];
        const userActivities = activities.data?.filter((a) => a.created_by === u.id) || [];

        return {
          userId: u.id,
          name: `${u.first_name} ${u.last_name}`,
          tasksTotal: userTasks.length,
          tasksCompleted: userTasks.filter((t) => t.status === 'completed').length,
          activitiesCount: userActivities.length,
        };
      });

      return createCorsResponse(
        {
          period,
          metrics: {
            totalTasks,
            completedTasks,
            completionRate: Math.round(completionRate),
            userPerformance,
          },
        },
        200,
        req,
      );
    }

    // GET /analytics/performance-metrics - the React Native reports screen's KPIs
    //
    // PROD-008. The screen reads revenueMtd, closeRate and avgTicketTime, and
    // this function answered `{ error: 'Invalid analytics type' }` at 400 for
    // the whole path - `performance` is a different branch with a different
    // shape (tasks and per-user counts), so neither the name nor the keys
    // matched. All three cards showed "--" on every open.
    //
    // SCOPED to the caller's tier: a rep's close rate is theirs, a manager's is
    // their team's. Revenue and ticket turnaround are TENANT-WIDE and say so in
    // `unbacked` - invoices carry no owner this endpoint could scope on
    // (`sales_rep` is free text) and a service ticket's technician is not the
    // person reading a sales KPI, so narrowing either would produce a number
    // that is true of nothing.
    if (req.method === 'GET' && metricType === 'performance-metrics') {
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });

      const unbacked: string[] = [];

      // ONE window for both KPIs, snapped to a day boundary. `startDate` carries
      // the current time of day, so an unsnapped bound moves the edge of the
      // window on every request - two reps opening the screen an hour apart get
      // different denominators - and `deals.actual_close_date` is a calendar
      // date stored at midnight, which an afternoon bound excludes outright.
      const windowStart = startOfUtcDay(startDate);

      // Revenue spans two months so the home screen and this screen agree on
      // the figure; only the current month is returned here.
      const [invoices, deals, tickets] = await Promise.all([
        fetchAllRows<any>(() =>
          admin
            .from('invoices')
            .select('amount_paid, paid_date')
            .eq('tenant_id', tenantId)
            // `paid_date` is a CALENDAR DATE stored at midnight (DATE-LOCAL-002),
            // so the bound is snapped to a day boundary rather than carrying a
            // time of day - which would drop or admit a whole day of invoices.
            .gte('paid_date', startOfUtcDay(previousUtcMonthStart(now)).toISOString()),
        ).catch(() => null),
        fetchAllRows<any>(() => {
          const q = admin
            .from('deals')
            .select('status, actual_close_date, owner_id, created_by_id')
            .eq('tenant_id', tenantId)
            .gte('actual_close_date', windowStart.toISOString());
          return applyUserScope(q, ['owner_id', 'created_by_id'], scope);
        }).catch(() => null),
        fetchAllRows<any>(() =>
          admin
            .from('service_tickets')
            .select('created_at, resolved_at')
            .eq('tenant_id', tenantId)
            .gte('resolved_at', windowStart.toISOString()),
        ).catch(() => null),
      ]);

      // A section that could not be READ answers null. A zero here would say
      // the tenant collected nothing, closed nothing and fixed nothing.
      const revenue = invoices
        ? monthToDateRevenue(
            invoices.map((r: any) => ({ amountPaid: r.amount_paid, paidDate: r.paid_date })),
            now,
          )
        : null;
      if (!invoices) unbacked.push('revenueMtd could not be read');
      else unbacked.push('revenueMtd is tenant-wide: invoices carry no owner to scope on');

      const close = deals
        ? summariseCloseRate(
            deals.map((r: any) => ({ status: r.status, actualCloseDate: r.actual_close_date })),
            windowStart,
            now,
          )
        : null;
      if (!deals) unbacked.push('closeRate could not be read');

      const turnaround = tickets
        ? summariseTicketTurnaround(
            tickets.map((r: any) => ({ createdAt: r.created_at, resolvedAt: r.resolved_at })),
            windowStart,
            now,
          )
        : null;
      if (!tickets) unbacked.push('avgTicketTime could not be read');
      else
        unbacked.push('avgTicketTime is tenant-wide: it measures the service desk, not the caller');

      return createCorsResponse(
        {
          period,
          scopeTier: scope.tier,
          revenueMtd: revenue ? revenue.revenueMtd : null,
          // The revenue total is a FLOOR when an invoice settled this month
          // carries no amount (COP-B05).
          revenueIsFloor: revenue ? revenue.uncostedPaidCount > 0 : null,
          closeRate: close && close.closeRate !== null ? Math.round(close.closeRate) : null,
          dealsWon: close ? close.wonCount : null,
          dealsLost: close ? close.lostCount : null,
          avgTicketTime:
            turnaround && turnaround.avgTicketHours !== null
              ? Math.round(turnaround.avgTicketHours * 10) / 10
              : null,
          ticketsResolved: turnaround ? turnaround.resolvedCount : null,
          unbacked,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Invalid analytics type' }, 400, req);
  } catch (error) {
    console.error('Error in analytics function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
