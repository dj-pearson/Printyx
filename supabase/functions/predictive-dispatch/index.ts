// Predictive Dispatch Edge Function
// Handles AI-powered technician dispatch optimization
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
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
    // /predictive-dispatch, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'predictive-dispatch');
    const endpoint = parts[0];

    // GET /predictive-dispatch/recommendations - Get dispatch recommendations
    if (req.method === 'GET' && endpoint === 'recommendations') {
      const ticketId = url.searchParams.get('ticketId');

      // Get available technicians.
      //
      // This asked `users` for name, skills, current_location and status. None
      // of those are columns on users (it has first_name/last_name and
      // is_active), so the query 42703'd and the recommendation list was always
      // empty. `technicians` is the table that actually holds skills,
      // current_location and is_available.
      const { data: technicians } = await admin
        .from('technicians')
        .select('id, user_id, first_name, last_name, skills, current_location')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('is_available', true);

      // Get ticket details if provided
      let ticket = null;
      if (ticketId) {
        const { data } = await admin
          .from('service_tickets')
          .select('*')
          .eq('id', ticketId)
          .eq('tenant_id', tenantId)
          .single();
        ticket = data;
      }

      // Generate recommendations (simplified scoring)
      const recommendations = (technicians || []).map((tech: any, index: number) => ({
        technicianId: tech.id,
        technicianName: [tech.first_name, tech.last_name].filter(Boolean).join(' ').trim() || null,
        score: 100 - index * 10,
        estimatedArrival: new Date(Date.now() + (30 + index * 15) * 60000).toISOString(),
        distance: 5 + index * 2,
        skillMatch: 90 - index * 5,
        workloadScore: 85 - index * 8,
        factors: {
          proximity: 'nearby',
          skillMatch: 'high',
          availability: 'available',
          workload: 'moderate',
        },
      }));

      return createCorsResponse({ ticket, recommendations }, 200, req);
    }

    // POST /predictive-dispatch/optimize - Optimize route for technician
    if (req.method === 'POST' && endpoint === 'optimize') {
      const body = await req.json();
      const { technicianId, ticketIds } = body;

      // Get ticket locations
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('id, customer_address, priority, scheduled_date')
        .eq('tenant_id', tenantId)
        .in('id', ticketIds || []);

      // Simple optimization (would use routing API in production)
      const optimizedRoute = (tickets || []).sort((a: any, b: any) => {
        if (a.priority === 'urgent') return -1;
        if (b.priority === 'urgent') return 1;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });

      return createCorsResponse(
        {
          technicianId,
          optimizedRoute: optimizedRoute.map((t: any, idx: number) => ({
            order: idx + 1,
            ticketId: t.id,
            address: t.customer_address,
            estimatedArrival: new Date(Date.now() + (30 + idx * 45) * 60000).toISOString(),
          })),
          totalDistance: optimizedRoute.length * 8,
          totalTime: optimizedRoute.length * 45,
        },
        200,
        req,
      );
    }

    // GET /predictive-dispatch/workload - Get workload analysis
    if (req.method === 'GET' && endpoint === 'workload') {
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('assigned_technician_id, status, priority')
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'en_route', 'on_site', 'in_progress']);

      // Group by technician
      const workloadMap = new Map<string, number>();
      (tickets || []).forEach((t: any) => {
        if (t.assigned_technician_id) {
          workloadMap.set(
            t.assigned_technician_id,
            (workloadMap.get(t.assigned_technician_id) || 0) + 1,
          );
        }
      });

      const workload = Array.from(workloadMap.entries()).map(([techId, count]) => ({
        technicianId: techId,
        activeTickets: count,
        capacityUsed: Math.min((count / 5) * 100, 100),
      }));

      return createCorsResponse({ workload, totalActiveTickets: tickets?.length || 0 }, 200, req);
    }

    // POST /predictive-dispatch/assign - Auto-assign ticket
    if (req.method === 'POST' && endpoint === 'assign') {
      const body = await req.json();
      const { ticketId, technicianId } = body;

      const { data: ticket, error } = await admin
        .from('service_tickets')
        // service_tickets has no assigned_at column — its timestamps are
        // scheduled_date, resolved_at, created_at and updated_at — so including
        // it made every auto-assign a 42703. updated_at moves on assignment and
        // is the closest real signal; the dedicated timestamp needs a migration.
        .update({
          assigned_technician_id: technicianId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to assign ticket' }, 500, req);
      }

      return createCorsResponse({ success: true, ticket }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in predictive-dispatch function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
