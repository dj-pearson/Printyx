/**
 * ERP / system-integration dashboard edge function (PROD-014 / PROD-014a).
 *
 * WHY, and it is not the usual reason: /api/erp-integration had no edge
 * function, so pages/ERPIntegration.tsx 404'd in production where getApiUrl()
 * rewrites /api/x -> functions.printyx.net/x with no Express fallback. But the
 * handler it would have been ported from was 670 lines of literals - "SAP
 * Business One", 18 integrations, a 98.7% sync success rate, a 99.94% uptime,
 * and data-quality scores for accuracy, completeness, consistency and
 * timeliness - none of it read from anything. It existed TWICE: the live copy in
 * routes-sample-data.ts and an unregistered duplicate in
 * routes-erp-integration.ts. Both are deleted.
 *
 * Porting that would have shipped invented integration health to production,
 * which PROD-011 already ruled is the wrong fix for a mock handler. This
 * function returns only what `system_integrations` and `integration_metrics`
 * support, and names what it cannot answer in `unbacked`.
 *
 * ROUTES (under /erp-integration):
 *   GET /dashboard   integration counts + 30-day API aggregates + per-system rows
 *
 * WHY ITS OWN PREFIX RATHER THAN FOLDING INTO `integrations` (PROD-014a AC3):
 * they read DIFFERENT TABLES. The integrations fn serves the integration hub
 * from platform_integrations / integration_sync_logs / integration_webhooks -
 * the platform's own connector catalogue. This one reads system_integrations
 * and integration_metrics, the per-tenant registry of connected business
 * systems and their API traffic. Same word, different domains: folding them
 * would put two unrelated row sets behind one /dashboard and force every caller
 * to know which half it wanted. The overlap the AC warns about is in the naming,
 * not in the data.
 *
 * integration_api_logs and integration_setup_logs are deliberately NOT read.
 * The former is per-call debug detail that integration_metrics already
 * aggregates, and pulling it for a dashboard would fetch an unbounded row set;
 * the latter is onboarding history, which is a different question.
 *
 * All aggregation lives in _shared/erp-integration-dashboard.ts so it is unit
 * testable without a database - PostgREST has no GROUP BY, SUM or AVG, so the
 * arithmetic is ours either way. See server/tests/unit/erp-integration-dashboard.test.ts.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { getRoleLevel } from '../_shared/rbac.ts';
import {
  WINDOW_DAYS,
  buildErpDashboard,
  type MetricRow,
  type SystemRow,
} from '../_shared/erp-integration-dashboard.ts';

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
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    // SEC: this reports every connected system's credentials status, traffic and
    // error counts, so it is not a surface every tenant member should read.
    // Level 5 mirrors the gate the frontend already applies to /erp-integration
    // in navigation-permissions.ts, so this locks nobody out who could reach the
    // page - it closes the gap where the edge function trusted authentication
    // alone. A LEVEL check, not a permission code: per SEC-EDGE-002 the codes
    // the Express gates name are not the codes any seeder creates, so a copied
    // permission gate would deny everyone below platform admin.
    const roleLevel = getRoleLevel({
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      supabaseUser: user,
    });
    if (roleLevel < 5) {
      return createCorsResponse(
        { message: 'Requires role level 5 or higher', code: 'INSUFFICIENT_ROLE' },
        403,
        req,
      );
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent - the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'erp-integration');
    const method = req.method.toUpperCase();

    if (method === 'GET' && parts[0] === 'dashboard') {
      const { data: systemRows, error: systemsError } = await admin
        .from('system_integrations')
        .select('id, name, provider, type, status, last_sync, error_message, created_at')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (systemsError) {
        return createCorsResponse(
          { message: 'Failed to load integrations', details: systemsError.message },
          500,
          req,
        );
      }

      const systems = (systemRows ?? []) as SystemRow[];
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

      // Skipped entirely when the tenant has no integrations: PostgREST would
      // otherwise be handed `integration_id=in.()`, which is a syntax error
      // rather than an empty set.
      let metricRows: MetricRow[] = [];
      if (systems.length > 0) {
        const { data, error: metricsError } = await admin
          .from('integration_metrics')
          .select(
            'integration_id, total_api_calls, successful_calls, failed_calls, avg_latency_ms, records_synced, data_volume_bytes, errors_by_type, period_end',
          )
          .eq('tenant_id', tenantId)
          .in(
            'integration_id',
            systems.map((s) => String(s.id)),
          )
          .gte('period_end', since);

        if (metricsError) {
          return createCorsResponse(
            { message: 'Failed to load integration metrics', details: metricsError.message },
            500,
            req,
          );
        }
        metricRows = (data ?? []) as MetricRow[];
      }

      return createCorsResponse(buildErpDashboard(systems, metricRows), 200, req);
    }

    return createCorsResponse({ message: 'Not found', path: url.pathname }, 404, req);
  } catch (error) {
    console.error('erp-integration error:', error);
    return createCorsResponse({ message: 'Internal server error' }, 500, req);
  }
}
