// Service Analytics Edge Function
// Provides service ticket analytics and metrics
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { summariseServiceTickets } from '../../../shared/service-analytics-summary.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /service-analytics, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'service-analytics');
    const subResource = parts[0]; // /service-analytics/trends

    // GET /service-analytics - Get service analytics overview
    if (req.method === 'GET' && !subResource) {
      // Fetch all tickets for analytics
      let allTickets: any[];
      try {
        allTickets = await fetchAllRows<any>(() =>
          admin
            .from('service_tickets')
            .select('id, status, priority, created_at, resolved_at, assigned_technician_id')
            .eq('tenant_id', tenantId),
        );
      } catch (ticketsError) {
        console.error('Error fetching tickets for analytics:', ticketsError);
        return createCorsResponse({ error: 'Failed to fetch analytics' }, 500, req);
      }

      const summary = summariseServiceTickets(allTickets);

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      // Weekly trend (last 7 UTC days)
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

      // Resolve names. Without this the technician table is a list of uuids,
      // which is not a report anybody can act on. `users` has first_name and
      // last_name, NOT name or full_name.
      const technicianIds = summary.technicians.map((t) => t.technicianId);
      const nameById = new Map<string, string>();
      if (technicianIds.length > 0) {
        const { data: userRows, error: userRowsError } = await admin
          .from('users')
          .select('id, first_name, last_name')
          .eq('tenant_id', tenantId)
          .in('id', technicianIds);
        // A failed name lookup leaves names null rather than failing the
        // report: the counts are still true, the labels are what is missing.
        if (userRowsError) console.error('Error resolving technician names:', userRowsError);
        for (const u of userRows ?? []) {
          const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
          if (full) nameById.set(u.id, full);
        }
      }

      const technicians = summary.technicians.map((t) => ({
        ...t,
        technicianName: nameById.get(t.technicianId) ?? null,
      }));

      return createCorsResponse(
        {
          overview: {
            ...summary.overview,
            // Was a hardcoded 85. Nothing in this tenant's data measures
            // satisfaction - there is no CSAT column on service_tickets and no
            // survey joined here - and a made-up 85% on a service dashboard
            // reads as a measurement. Null, and named in `unbacked` below.
            customerSatisfaction: null,
          },
          byPriority: summary.byPriority,
          byStatus: summary.byStatus,
          trends: weeklyTrend,
          technicians,
          lastUpdated: new Date().toISOString(),
          // What this endpoint cannot answer, said plainly rather than zeroed.
          unbacked: [
            'customerSatisfaction - service_tickets carries no CSAT score and no survey is joined here',
            'ticket categories - service_tickets has no category column',
            'first-call resolution, utilisation and revenue per technician - none has a source table',
          ],
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

      // This used to return the raw ticket rows and length them. Two problems
      // at once: PostgREST caps the response at 1000 rows without erroring, so
      // a busy quarter reported "1000 created" forever, and a trend chart does
      // not need the tickets - it needs the series. Page for the series, and
      // count with HEAD, which transfers no rows at all.
      let tickets: Array<{ created_at: string; resolved_at: string | null }>;
      try {
        tickets = await fetchAllRows<{ created_at: string; resolved_at: string | null }>(() =>
          admin
            .from('service_tickets')
            .select('created_at, resolved_at')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate.toISOString()),
        );
      } catch (error) {
        console.error('Error fetching trends:', error);
        return createCorsResponse({ error: 'Failed to fetch trends' }, 500, req);
      }

      const dayKey = (iso: string) => new Date(iso).toISOString().split('T')[0];
      const series = new Map<string, { created: number; resolved: number }>();
      for (let i = daysBack - 1; i >= 0; i--) {
        series.set(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()), {
          created: 0,
          resolved: 0,
        });
      }
      let totalResolved = 0;
      for (const t of tickets) {
        const created = series.get(dayKey(t.created_at));
        if (created) created.created++;
        if (t.resolved_at) {
          totalResolved++;
          const resolved = series.get(dayKey(t.resolved_at));
          if (resolved) resolved.resolved++;
        }
      }

      return createCorsResponse(
        {
          period,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          series: Array.from(series.entries()).map(([date, counts]) => ({ date, ...counts })),
          summary: {
            totalCreated: tickets.length,
            totalResolved,
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
