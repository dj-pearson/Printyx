// Performance Edge Function
// Handles performance metrics and alerts
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toCamel } from '../_shared/case.ts';

/** Single call site, kept as a helper so the literal reads once. */
function nowIsoOf(): string {
  return new Date().toISOString();
}
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

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
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

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

interface DerivedAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  category: string;
  timestamp: string;
}

/**
 * The four alert families server/routes-operations-extended.ts derived in dev.
 *
 * Each is capped and independently guarded: a tenant with a huge inventory must
 * not stall the bell, and a missing relation in one family must not blank the
 * other three.
 */
// deno-lint-ignore no-explicit-any
async function deriveOperationalAlerts(admin: any, tenantId: string): Promise<DerivedAlert[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const alerts: DerivedAlert[] = [];

  // 1) Low stock. PostgREST cannot compare two columns, so the filter happens
  // here - hence the explicit cap rather than an unbounded scan.
  try {
    const { data } = await admin
      .from('inventory_items')
      .select('id, name, quantity_on_hand, reorder_point')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('reorder_point', 'is', null)
      .order('quantity_on_hand', { ascending: true })
      .limit(200);
    for (const item of (data ?? []).slice(0, 20)) {
      const onHand = Number(item.quantity_on_hand ?? 0);
      const reorderAt = Number(item.reorder_point);
      if (!Number.isFinite(reorderAt) || onHand > reorderAt) continue;
      alerts.push({
        id: `low_stock_${item.id}`,
        type: 'low_stock',
        severity: 'medium',
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is running low (${onHand} remaining, reorder at ${reorderAt})`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('low stock alerts:', err);
  }

  // 2) Dispatch delays: scheduled in the past and still open.
  try {
    const { data } = await admin
      .from('service_tickets')
      .select('id, ticket_number, title, scheduled_date, status')
      .eq('tenant_id', tenantId)
      .lt('scheduled_date', nowIso)
      .not('status', 'in', '(completed,cancelled)')
      .order('scheduled_date', { ascending: true })
      .limit(10);
    for (const ticket of data ?? []) {
      alerts.push({
        id: `dispatch_delay_${ticket.id}`,
        type: 'dispatch_delay',
        severity: 'high',
        title: `Dispatch Delay: Ticket ${ticket.ticket_number}`,
        message: `Service ticket ${ticket.ticket_number} (${ticket.title}) was scheduled for ${new Date(ticket.scheduled_date).toLocaleString()} but is still ${ticket.status}.`,
        category: 'performance',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('dispatch delay alerts:', err);
  }

  // 3) Billing: overdue, or past its due date and still pending.
  try {
    const { data } = await admin
      .from('invoices')
      .select('id, invoice_number, due_date, status, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${nowIso})`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const invoice of data ?? []) {
      const due = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString()
        : 'an unset date';
      alerts.push({
        id: `billing_anomaly_${invoice.id}`,
        type: 'billing_anomaly',
        severity: invoice.status === 'overdue' ? 'critical' : 'medium',
        title: `Billing Issue: Invoice ${invoice.invoice_number}`,
        message:
          invoice.status === 'overdue'
            ? `Invoice ${invoice.invoice_number} is overdue since ${due}.`
            : `Invoice ${invoice.invoice_number} is past due (Due: ${due}).`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('billing anomaly alerts:', err);
  }

  // 4) Contracts ending within 90 days. Days remaining is computed here; the
  // Express version used DATE_PART, which PostgREST has no equivalent for.
  try {
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from('service_contracts')
      .select('id, contract_number, end_date, monthly_base_rate')
      .eq('tenant_id', tenantId)
      .eq('contract_status', 'active')
      .gte('end_date', nowIso)
      .lte('end_date', in90Days)
      .order('end_date', { ascending: true })
      .limit(15);
    for (const contract of data ?? []) {
      const days = Math.max(
        0,
        Math.round((new Date(contract.end_date).getTime() - now.getTime()) / 86400000),
      );
      alerts.push({
        id: `contract_expiration_${contract.id}`,
        type: 'contract_expiration',
        severity: days <= 30 ? 'high' : 'medium',
        title: `Contract Expiring: ${contract.contract_number}`,
        message: `Contract ${contract.contract_number} ends in ${days} day${days === 1 ? '' : 's'} (${new Date(contract.end_date).toLocaleDateString()}).`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('contract expiration alerts:', err);
  }

  return alerts;
}
