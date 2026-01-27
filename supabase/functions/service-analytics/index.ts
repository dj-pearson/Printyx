// Service Analytics Edge Function
// Provides service ticket analytics and metrics
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

    // Extract tenant ID from JWT metadata or header
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subResource = pathParts[1]; // /service-analytics/trends

    // GET /service-analytics - Get service analytics overview
    if (req.method === 'GET' && !subResource) {
      // Fetch all tickets for analytics
      const { data: tickets, error: ticketsError } = await admin
        .from('service_tickets')
        .select('id, status, priority, created_at, resolved_at, assigned_technician_id')
        .eq('tenant_id', tenantId);

      if (ticketsError) {
        console.error('Error fetching tickets for analytics:', ticketsError);
        return createCorsResponse({ error: 'Failed to fetch analytics' }, 500, req);
      }

      const allTickets = tickets || [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Calculate metrics
      const totalTickets = allTickets.length;
      const openTickets = allTickets.filter((t) =>
        ['new', 'open', 'assigned', 'en_route', 'on_site', 'in_progress'].includes(t.status),
      ).length;
      const closedTickets = allTickets.filter((t) =>
        ['completed', 'resolved', 'closed'].includes(t.status),
      ).length;

      // Calculate average resolution time (for resolved tickets)
      const resolvedTickets = allTickets.filter((t) => t.resolved_at && t.created_at);
      let avgResolutionTime = 0;
      if (resolvedTickets.length > 0) {
        const totalResolutionTime = resolvedTickets.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const resolved = new Date(t.resolved_at).getTime();
          return sum + (resolved - created);
        }, 0);
        avgResolutionTime = Math.round(
          totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60),
        ); // hours
      }

      // Tickets by priority
      const byPriority = {
        low: allTickets.filter((t) => t.priority === 'low').length,
        medium: allTickets.filter((t) => t.priority === 'medium').length,
        high: allTickets.filter((t) => t.priority === 'high').length,
        urgent: allTickets.filter((t) => t.priority === 'urgent' || t.priority === 'emergency')
          .length,
      };

      // Tickets by status
      const byStatus = {
        new: allTickets.filter((t) => t.status === 'new').length,
        assigned: allTickets.filter((t) => t.status === 'assigned').length,
        en_route: allTickets.filter((t) => t.status === 'en_route').length,
        on_site: allTickets.filter((t) => t.status === 'on_site').length,
        in_progress: allTickets.filter((t) => t.status === 'in_progress').length,
        completed: allTickets.filter((t) => t.status === 'completed').length,
        cancelled: allTickets.filter((t) => t.status === 'cancelled').length,
      };

      // Weekly trend (last 7 days)
      const weeklyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const created = allTickets.filter((t) => {
          const createdAt = new Date(t.created_at);
          return createdAt >= dayStart && createdAt < dayEnd;
        }).length;
        const resolved = allTickets.filter((t) => {
          if (!t.resolved_at) return false;
          const resolvedAt = new Date(t.resolved_at);
          return resolvedAt >= dayStart && resolvedAt < dayEnd;
        }).length;
        weeklyTrend.push({
          date: dayStart.toISOString().split('T')[0],
          created,
          resolved,
        });
      }

      // Technician performance (simplified)
      const technicianMap = new Map<string, { assigned: number; completed: number }>();
      allTickets.forEach((t) => {
        if (t.assigned_technician_id) {
          const current = technicianMap.get(t.assigned_technician_id) || {
            assigned: 0,
            completed: 0,
          };
          current.assigned++;
          if (['completed', 'resolved', 'closed'].includes(t.status)) {
            current.completed++;
          }
          technicianMap.set(t.assigned_technician_id, current);
        }
      });

      const technicians = Array.from(technicianMap.entries()).map(([id, stats]) => ({
        technicianId: id,
        assignedTickets: stats.assigned,
        completedTickets: stats.completed,
        completionRate:
          stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0,
      }));

      return createCorsResponse(
        {
          overview: {
            totalTickets,
            openTickets,
            closedTickets,
            avgResolutionTime,
            customerSatisfaction: 85, // Placeholder - would need actual CSAT data
          },
          byPriority,
          byStatus,
          trends: weeklyTrend,
          technicians,
          categories: [], // Would need category data in tickets
          lastUpdated: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // GET /service-analytics/trends - Get detailed trends
    if (req.method === 'GET' && subResource === 'trends') {
      const period = url.searchParams.get('period') || 'month';

      // Calculate date range based on period
      let daysBack = 30;
      if (period === 'week') daysBack = 7;
      else if (period === 'quarter') daysBack = 90;
      else if (period === 'year') daysBack = 365;

      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const { data: tickets, error } = await admin
        .from('service_tickets')
        .select('id, status, created_at, resolved_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching trends:', error);
        return createCorsResponse({ error: 'Failed to fetch trends' }, 500, req);
      }

      return createCorsResponse(
        {
          period,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          data: tickets || [],
          summary: {
            totalCreated: tickets?.length || 0,
            totalResolved: tickets?.filter((t) => t.resolved_at).length || 0,
          },
        },
        200,
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in service-analytics function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
