// Analytics Edge Function
// Handles analytics queries and metrics aggregation
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
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const metricType = pathParts[1]; // 'dashboard', 'sales', 'service', 'performance'

    const period = url.searchParams.get('period') || 'month';
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // GET /analytics/dashboard - Overall dashboard metrics
    if (req.method === 'GET' && metricType === 'dashboard') {
      const [customers, quotes, tickets, activities] = await Promise.all([
        admin
          .from('business_records')
          .select('id, created_at', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('record_type', 'customer')
          .gte('created_at', startDate.toISOString()),
        admin
          .from('quotes')
          .select('id, status, total_amount, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('service_tickets')
          .select('id, status, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('business_record_activities')
          .select('id, activity_type', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
      ]);

      const metrics = {
        customers: {
          total: customers.count || 0,
          new: customers.data?.length || 0,
        },
        quotes: {
          total: quotes.data?.length || 0,
          won: quotes.data?.filter((q) => q.status === 'accepted').length || 0,
          pending: quotes.data?.filter((q) => q.status === 'sent').length || 0,
          totalValue:
            quotes.data?.reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0,
        },
        tickets: {
          total: tickets.data?.length || 0,
          open:
            tickets.data?.filter((t) => ['open', 'assigned', 'in-progress'].includes(t.status))
              .length || 0,
          closed: tickets.data?.filter((t) => t.status === 'completed').length || 0,
        },
        activities: {
          total: activities.count || 0,
          byType: activities.data?.reduce((acc: Record<string, number>, a) => {
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

      const totalQuotes = quotes.data?.length || 0;
      const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
      const winRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;

      const revenue =
        quotes.data
          ?.filter((q) => q.status === 'accepted')
          .reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0;

      const avgDealSize = wonQuotes > 0 ? revenue / wonQuotes : 0;

      // Sales by rep
      const byRep = quotes.data?.reduce((acc: Record<string, any>, q) => {
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
      const tickets = await admin
        .from('service_tickets')
        .select('status, created_at, resolved_at, assigned_technician_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      const totalTickets = tickets.data?.length || 0;
      const resolved = tickets.data?.filter((t) => t.status === 'completed').length || 0;
      const resolutionRate = totalTickets > 0 ? (resolved / totalTickets) * 100 : 0;

      const avgResolutionTime =
        tickets.data
          ?.filter((t) => t.resolved_at)
          .reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolvedTime = new Date(t.resolved_at!).getTime();
            return sum + (resolvedTime - created);
          }, 0) / (resolved || 1);

      const avgResolutionHours = Math.round(avgResolutionTime / (1000 * 60 * 60));

      // Tickets by technician
      const byTechnician = tickets.data?.reduce((acc: Record<string, any>, t) => {
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
