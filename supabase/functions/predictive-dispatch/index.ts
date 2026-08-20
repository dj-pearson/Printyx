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
    const serialNumber = parts[1];

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

    // ─── Dashboard endpoints (EDGE-002g) ────────────────────────────────────
    //
    // PredictiveServiceDispatchDashboard.tsx calls /dashboard,
    // /devices-at-risk, /technician-performance, /analyze/:serialNumber and
    // /analyze-all. None existed here.
    //
    // These could NOT be ported from server/routes-predictive-service-dispatch.ts
    // the way the other three EDGE-002g domains were, because that file queries
    // service_calls_enhanced (38 references), equipment_metrics (18) and
    // technician_resources_enhanced (3) — three tables that appear in NO Drizzle
    // schema and are created by NO migration. The Express endpoints therefore
    // fail at runtime too; porting them faithfully would have reproduced that.
    //
    // So these are rebuilt from tables that exist: equipment_failure_predictions
    // (the real prediction store), equipment, device_metrics, technicians and
    // service_calls. Several fields the page's interfaces declare have no source
    // ANYWHERE, and those are named in `unbacked` rather than filled with
    // plausible numbers — a fabricated costSavings on a dashboard is worse than
    // an absent one. Where a zero would actively mislead, the key is omitted
    // instead: the page colours fuserLife red when it is below 20, so sending 0
    // would alarm on every device.

    // GET /predictive-dispatch/devices-at-risk
    if (req.method === 'GET' && endpoint === 'devices-at-risk') {
      const { data: predictions } = await admin
        .from('equipment_failure_predictions')
        .select('machine_id, predicted_window_start, signals, confidence, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('predicted_window_start', { ascending: true })
        .limit(50);

      const machineIds = [...new Set((predictions ?? []).map((p: any) => p.machine_id))].filter(
        Boolean,
      );

      const equipmentById = new Map<string, any>();
      const metricsByDevice = new Map<string, any>();
      if (machineIds.length > 0) {
        const [equipmentRes, metricsRes] = await Promise.all([
          admin
            .from('equipment')
            .select('id, serial_number, model_number, location_description')
            .eq('tenant_id', tenantId)
            .in('id', machineIds),
          admin
            .from('device_metrics')
            .select('device_id, toner_levels, total_impressions, collection_timestamp')
            .eq('tenant_id', tenantId)
            .in('device_id', machineIds)
            .order('collection_timestamp', { ascending: false }),
        ]);
        for (const e of equipmentRes.data ?? []) equipmentById.set(e.id as string, e);
        // Ordered newest first, so the first row seen per device is its latest.
        for (const m of metricsRes.data ?? []) {
          if (!metricsByDevice.has(m.device_id as string)) {
            metricsByDevice.set(m.device_id as string, m);
          }
        }
      }

      const devicesAtRisk = (predictions ?? []).map((p: any) => {
        const eq = equipmentById.get(p.machine_id) ?? {};
        const metric = metricsByDevice.get(p.machine_id) ?? {};
        // toner_levels is a jsonb map of per-cartridge levels; the page wants a
        // single number, so take the lowest cartridge — the one that runs out
        // first is the one that matters.
        const tonerValues = Object.values(
          (metric.toner_levels ?? {}) as Record<string, unknown>,
        ).filter((v): v is number => typeof v === 'number');
        return {
          equipmentId: p.machine_id,
          serialNumber: eq.serial_number ?? null,
          model: eq.model_number ?? null,
          location: eq.location_description ?? null,
          scheduledMaintenance: p.predicted_window_start,
          priority: (p.confidence ?? 0) >= 0.8 ? 'high' : 'medium',
          predictedIssue: p.signals ?? null,
          lastCheck: metric.collection_timestamp ?? null,
          totalPageCount: metric.total_impressions ?? null,
          ...(tonerValues.length > 0 ? { tonerLevel: Math.min(...tonerValues) } : {}),
          // fuserLife and drumLife are deliberately absent: device_metrics
          // carries toner_levels and paper_levels only, and 0 would read as
          // "critically low" on a page that reds anything under 20.
        };
      });

      return createCorsResponse(
        {
          devicesAtRisk,
          count: devicesAtRisk.length,
          unbacked: ['fuserLife', 'drumLife'],
        },
        200,
        req,
      );
    }

    // GET /predictive-dispatch/technician-performance
    if (req.method === 'GET' && endpoint === 'technician-performance') {
      const [techRes, ticketRes, callRes] = await Promise.all([
        admin
          .from('technicians')
          .select('id, first_name, last_name, skills, certifications, current_location')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        admin
          .from('service_tickets')
          .select('assigned_technician_id')
          .eq('tenant_id', tenantId)
          .in('status', ['assigned', 'en_route', 'on_site', 'in_progress']),
        admin
          .from('service_calls')
          .select('assigned_technician_id, call_status')
          .eq('tenant_id', tenantId),
      ]);

      const openByTech = new Map<string, number>();
      for (const t of ticketRes.data ?? []) {
        const id = (t as any).assigned_technician_id;
        if (id) openByTech.set(id, (openByTech.get(id) ?? 0) + 1);
      }

      const callTotals = new Map<string, { total: number; completed: number }>();
      for (const c of callRes.data ?? []) {
        const id = (c as any).assigned_technician_id;
        if (!id) continue;
        const entry = callTotals.get(id) ?? { total: 0, completed: 0 };
        entry.total++;
        if (String((c as any).call_status ?? '').toLowerCase() === 'completed') entry.completed++;
        callTotals.set(id, entry);
      }

      const technicians = (techRes.data ?? []).map((t: any) => {
        const calls = callTotals.get(t.id) ?? { total: 0, completed: 0 };
        return {
          technicianId: t.id,
          name: [t.first_name, t.last_name].filter(Boolean).join(' ').trim() || null,
          skills: t.skills ?? [],
          certifications: t.certifications ?? [],
          currentWorkload: openByTech.get(t.id) ?? 0,
          completionRate: calls.total > 0 ? (calls.completed / calls.total) * 100 : 0,
          location: t.current_location ?? null,
          // maxWorkload, utilizationPercent, avgResponseTime and territories are
          // omitted rather than guessed - see `unbacked` below.
        };
      });

      return createCorsResponse(
        {
          technicians,
          count: technicians.length,
          unbacked: [
            'maxWorkload: technicians has no capacity column (rep_capacity.max_active_leads counts LEADS, not tickets)',
            'utilizationPercent: derived from maxWorkload, so unavailable for the same reason',
            'avgResponseTime: no table records time-to-first-response on a service call',
            'territories: technicians has no territory column',
          ],
        },
        200,
        req,
      );
    }

    // GET /predictive-dispatch/dashboard
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const countOf = async (
        client: typeof admin,
        table: string,
        apply: (q: any) => any,
      ): Promise<number> => {
        const { count } = await apply(
          client.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const [devicesMonitored, devicesAtRisk, totalPredictiveDispatches, recentMetrics, upcoming] =
        await Promise.all([
          countOf(admin, 'equipment', (q) => q),
          countOf(admin, 'equipment_failure_predictions', (q) => q.eq('status', 'pending')),
          // A prediction that produced a ticket is a dispatch it caused.
          countOf(admin, 'equipment_failure_predictions', (q) =>
            q.not('service_ticket_id', 'is', null),
          ),
          admin
            .from('device_metrics')
            .select('device_id')
            .eq('tenant_id', tenantId)
            .gte('collection_timestamp', dayAgo),
          admin
            .from('equipment_failure_predictions')
            .select(
              'id, machine_id, predicted_window_start, confidence, signals, service_ticket_id',
            )
            .eq('tenant_id', tenantId)
            .eq('status', 'pending')
            .order('predicted_window_start', { ascending: true })
            .limit(10),
        ]);

      const devicesCheckedLast24h = new Set(
        (recentMetrics.data ?? []).map((m: any) => m.device_id).filter(Boolean),
      ).size;

      return createCorsResponse(
        {
          overview: {
            totalPredictiveDispatches,
            devicesMonitored,
            devicesAtRisk,
            devicesCheckedLast24h,
            period: '30 days',
          },
          upcomingMaintenance: (upcoming.data ?? []).map((p: any) => ({
            id: p.id,
            equipmentId: p.machine_id,
            scheduledDate: p.predicted_window_start,
            priority: (p.confidence ?? 0) >= 0.8 ? 'high' : 'medium',
            technicianId: null,
            predictedIssue: p.signals ?? null,
            // estimatedDuration has no source; predictions carry a window, not
            // an expected job length.
          })),
          unbacked: [
            'downtimePreventedHours, costSavings, uptimeImprovement, partsAutoOrdered: no table ' +
              'records prevented downtime, savings, uptime deltas or parts auto-ordered against ' +
              'a prediction',
            'upcomingMaintenance[].technicianId / estimatedDuration: a prediction is not assigned ' +
              'to a technician and carries no expected duration',
          ],
        },
        200,
        req,
      );
    }

    // POST /predictive-dispatch/analyze/:serialNumber and /analyze-all
    //
    // Not ported. Unlike the analyze-all endpoints in the other three domains,
    // these cannot be ported at all as written: the Express implementations read
    // and write equipment_metrics and service_calls_enhanced, which no schema
    // or migration creates. Predicting failure from real data would mean
    // building it over device_metrics and equipment_failure_predictions from
    // scratch, which is a new feature, not a port.
    if (
      req.method === 'POST' &&
      (endpoint === 'analyze-all' || (endpoint === 'analyze' && serialNumber))
    ) {
      return createCorsResponse(
        {
          error: 'Predictive analysis is not available on the edge function',
          code: 'PREDICTIVE_ANALYSIS_NEEDS_SCHEMA',
          details:
            'server/routes-predictive-service-dispatch.ts drives this from equipment_metrics and ' +
            'service_calls_enhanced, neither of which exists in any Drizzle schema or migration, ' +
            'so the Express endpoints fail too. The read endpoints (/dashboard, ' +
            '/devices-at-risk, /technician-performance) are served from ' +
            'equipment_failure_predictions, device_metrics, equipment, technicians and ' +
            'service_calls.',
        },
        501,
        req,
      );
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
