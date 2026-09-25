// Performance Edge Function
// Handles performance metrics and alerts
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toCamel } from '../_shared/case.ts';

/** Single call site, kept as a helper so the literal reads once. */
function nowIsoOf(): string {
  return new Date().toISOString();
}
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { deriveOperationalAlerts } from '../_shared/operational-alerts.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import {
  latestMetrics,
  metricValue,
  MAX_HISTORY_DAYS,
} from '../../../shared/performance-metrics.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[0]; // Will be 'alerts', 'metrics', etc.

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

    // Tenant is needed for every branch below - these were mocks before and
    // never read one.
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    switch (endpoint) {
      case 'metrics': {
        // Was a hardcoded object (responseTime 185, uptime 99.95, cpuUsage 45,
        // ...) with a comment saying a real version would read monitoring
        // tables. performance_metrics IS that table. The latest value per type
        // is returned; a type with no rows is NULL and named in `unreported`
        // (round 235). It used to be 0, which KpiSummaryBar and the
        // monitoring page rendered as 0ms response time and 0% uptime - a
        // perfect score and an outage from the same absence.
        const { data: rows, error } = await admin
          .from('performance_metrics')
          .select('metric_type, value, unit, timestamp')
          .eq('tenant_id', tenantId)
          .order('timestamp', { ascending: false })
          .limit(500);
        if (error) {
          console.error('Error fetching performance metrics:', error);
          return createCorsResponse({ error: 'Failed to fetch performance metrics' }, 500, req);
        }

        const { values, units, unreported } = latestMetrics(rows ?? []);
        return createCorsResponse(
          {
            ...values,
            units,
            unreported: unreported.map(
              (k) => `${k}: no performance_metrics row of that metric_type for this tenant`,
            ),
          },
          200,
          req,
        );
      }

      case 'history': {
        // Round 235: the monitoring page's charts were sine waves drawn
        // around the current value. This returns the stored readings in a
        // window instead, paged rather than capped, so a chart is the rows.
        // timestamp is an INSTANT column, so the bounds are instants too.
        const now = new Date();
        const toParam = url.searchParams.get('to');
        const fromParam = url.searchParams.get('from');
        const to = toParam ? new Date(toParam) : now;
        const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 7 * 86_400_000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
          return createCorsResponse(
            { error: 'from and to must be dates with from before to', code: 'INVALID_RANGE' },
            400,
            req,
          );
        }
        if (to.getTime() - from.getTime() > MAX_HISTORY_DAYS * 86_400_000) {
          return createCorsResponse(
            {
              error: `A history window can span at most ${MAX_HISTORY_DAYS} days`,
              code: 'RANGE_TOO_WIDE',
            },
            400,
            req,
          );
        }
        let rows: any[];
        try {
          rows = await fetchAllRows<any>(() =>
            admin
              .from('performance_metrics')
              .select('metric_type, value, unit, endpoint, timestamp')
              .eq('tenant_id', tenantId)
              .gte('timestamp', from.toISOString())
              .lte('timestamp', to.toISOString())
              .order('timestamp', { ascending: true }),
          );
        } catch (err) {
          console.error('Error fetching performance history:', err);
          return createCorsResponse({ error: 'Failed to fetch performance history' }, 500, req);
        }
        return createCorsResponse(
          {
            from: from.toISOString(),
            to: to.toISOString(),
            rows: rows.map((r) => ({
              metric_type: r.metric_type,
              value: metricValue(r.value),
              unit: r.unit ?? null,
              endpoint: r.endpoint ?? null,
              timestamp: r.timestamp ?? null,
            })),
          },
          200,
          req,
        );
      }

      case 'alerts': {
        // Was a single hardcoded {type: 'info', message: 'System running
        // normally'} alert. SystemAlertBell renders alerts.length as its badge,
        // so that mock put a permanent red "1" in the app chrome on every page
        // AND hid every real alert, because nothing else was ever returned.
        // system_alerts is the real table and already carries the exact fields
        // both consumers read: type, category, message, severity, resolved.
        const nowIso = new Date().toISOString();
        const { data: alerts, error } = await admin
          .from('system_alerts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('resolved', false)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching system alerts:', error);
          return createCorsResponse({ error: 'Failed to fetch alerts' }, 500, req);
        }

        // AUDIT-021: system_alerts is real and NOTHING WRITES TO IT. The only
        // insert in the tree is storage.createSystemAlert, which no caller
        // names, so this table is empty and the alert bell has been permanently
        // silent in production. Meanwhile server/routes-operations-extended.ts
        // DERIVED four alert families from live data and served them in dev
        // only, so the two environments disagreed about whether the business
        // had any problems.
        //
        // Those four derivations are ported below. They are additive: a row in
        // system_alerts still shows, so whatever eventually writes there is not
        // pre-empted. Each family is independently try/caught, because one
        // missing table must not blank the whole bell.
        const derived = await deriveOperationalAlerts(admin, tenantId);

        return createCorsResponse(
          [
            ...(alerts ?? []).map((a: any) => ({
              ...toCamel(a),
              // Both consumers read `timestamp`; the column is created_at.
              timestamp: a.created_at,
            })),
            ...derived,
          ],
          200,
          req,
        );
      }

      case 'health': {
        // PerformanceMonitoring.tsx calls this and it was never served at all -
        // not in the switch, so it fell through to the 404. Derived from the
        // same two tables rather than invented.
        const [alertRes, criticalRes, metricRes] = await Promise.all([
          admin
            .from('system_alerts')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('resolved', false),
          admin
            .from('system_alerts')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('resolved', false)
            .eq('severity', 'critical'),
          admin
            .from('performance_metrics')
            .select('timestamp')
            .eq('tenant_id', tenantId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const criticalCount = criticalRes.count ?? 0;
        const openCount = alertRes.count ?? 0;

        return createCorsResponse(
          {
            status: criticalCount > 0 ? 'critical' : openCount > 0 ? 'degraded' : 'healthy',
            openAlerts: openCount,
            criticalAlerts: criticalCount,
            lastMetricAt: metricRes.data?.timestamp ?? null,
            checkedAt: nowIsoOf(),
          },
          200,
          req,
        );
      }

      default:
        return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
    }
  } catch (error) {
    console.error('Performance function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
