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
        // tables. performance_metrics IS that table: metric_type, value, unit,
        // endpoint, timestamp. The latest value per type is returned, and a
        // type with no rows is reported rather than given a plausible number.
        const { data: rows } = await admin
          .from('performance_metrics')
          .select('metric_type, value, timestamp')
          .eq('tenant_id', tenantId)
          .order('timestamp', { ascending: false })
          .limit(500);

        // Ordered newest first, so the first row seen per type is the latest.
        const latest = new Map<string, number>();
        for (const row of rows ?? []) {
          const type = String((row as any).metric_type ?? '');
          if (type && !latest.has(type)) latest.set(type, Number((row as any).value) || 0);
        }

        // KpiSummaryBar reads responseTime/throughput/errorRate/uptime;
        // PerformanceMonitoring additionally reads memory/cpu/diskUsage.
        const KEYS: Array<[string, string]> = [
          ['responseTime', 'response_time'],
          ['throughput', 'throughput'],
          ['errorRate', 'error_rate'],
          ['uptime', 'uptime'],
          ['memoryUsage', 'memory_usage'],
          ['cpuUsage', 'cpu_usage'],
          ['diskUsage', 'disk_usage'],
          ['activeUsers', 'active_users'],
        ];

        const metrics: Record<string, number> = {};
        const missing: string[] = [];
        for (const [outKey, metricType] of KEYS) {
          const value = latest.get(metricType) ?? latest.get(outKey);
          if (value === undefined) {
            metrics[outKey] = 0;
            missing.push(outKey);
          } else {
            metrics[outKey] = value;
          }
        }

        return createCorsResponse(
          missing.length > 0
            ? {
                ...metrics,
                unreported: missing.map(
                  (k) => `${k}: no performance_metrics row of that metric_type for this tenant`,
                ),
              }
            : metrics,
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
