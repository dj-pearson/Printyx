// Deployment Readiness Edge Function
//
// Serves the DeploymentReadiness admin page, which calls two flat sub-paths:
//   GET /deployment/readiness → ReadinessCheck[]   (per-check launch status)
//   GET /deployment/metrics   → DeploymentMetrics   (rolled-up readiness score)
//
// EDGE-005f: the frontend prefix is /api/deployment/*, but this function dir is
// `deployment-readiness`. Production resolves it via a server.ts route override
// (`deployment` → `deployment-readiness`); dev forwards /api/deployment/* through
// the edge-function proxy. After the server.ts strip the handler sees /readiness
// or /metrics. The legacy root GET (`{ ready, checks }`) is kept for any caller
// that still hits the bare function path.
//
// Every check is something this request actually looked at; the rules are in
// shared/deployment-readiness.ts. The page used to fall back to eighteen typed-in
// checks and a hardcoded 78% whenever this answered anything but 200.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';

import {
  countCheck,
  deriveReadinessMetrics,
  type ReadinessCheck,
} from '../../../shared/deployment-readiness.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // SEC-EDGE-001. Platform launch status, not tenant data. It has no nav entry to mirror, so the level matches the other root-admin surfaces.
    try {
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        7,
      );
    } catch (err) {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Requires role level 7 or higher',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    }

    const { parts } = normalizePath(new URL(req.url).pathname, 'deployment-readiness');
    const sub = parts[0]; // 'readiness' | 'metrics' | undefined (root)

    if (req.method !== 'GET') {
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    const checks = await buildChecks(admin, tenantId);

    // GET /deployment/readiness — the per-check board
    if (sub === 'readiness') {
      return createCorsResponse(checks, 200, req);
    }

    // GET /deployment/metrics — rolled-up readiness score
    if (sub === 'metrics') {
      return createCorsResponse(deriveReadinessMetrics(checks), 200, req);
    }

    // Legacy bare-function root: simple ready/checks summary (backward compat).
    const allOk = checks.every((c) => c.status === 'complete');
    return createCorsResponse(
      {
        ready: allOk,
        checks: checks.map((c) => ({ name: c.name, status: c.status, message: c.details || '' })),
        metrics: deriveReadinessMetrics(checks),
        timestamp: new Date().toISOString(),
      },
      200,
      req,
    );
  } catch (error) {
    console.error('Unexpected error in deployment-readiness function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// Build the readiness board from what this request actually looked at. See
// shared/deployment-readiness.ts for why the static "always complete" platform
// rows and the launch-date estimate are gone.
async function buildChecks(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<ReadinessCheck[]> {
  const now = new Date().toISOString();
  const checks: ReadinessCheck[] = [];

  // --- Infrastructure: database connectivity ---
  let dbError: string | undefined;
  try {
    const { error } = await admin.from('tenants').select('id').limit(1);
    if (error) dbError = error.message;
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'unreachable';
  }
  checks.push({
    id: 'db-connectivity',
    category: 'Infrastructure',
    name: 'Database Connectivity',
    description: 'Primary Postgres database is reachable and responding to queries',
    status: dbError ? 'incomplete' : 'complete',
    priority: 'high',
    lastChecked: now,
    details: dbError ? `Connection failed: ${dbError}` : 'Connected',
  });

  // --- Infrastructure: tenant configuration ---
  const tenantRead = await admin.from('tenants').select('id').eq('id', tenantId).maybeSingle();
  checks.push(
    countCheck({
      id: 'tenant-config',
      category: 'Infrastructure',
      name: 'Tenant Configuration',
      description: 'This tenant exists and is provisioned in the platform',
      priority: 'high',
      count: tenantRead.error ? null : tenantRead.data ? 1 : 0,
      noun: 'tenant record',
      emptyStatus: 'warning',
      now,
      error: tenantRead.error?.message,
    }),
  );

  // --- Setup: users ---
  const usersRead = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  checks.push(
    countCheck({
      id: 'users-configured',
      category: 'Setup',
      name: 'User Accounts',
      description: 'At least one user account is configured for this tenant',
      priority: 'medium',
      count: usersRead.error ? null : (usersRead.count ?? 0),
      noun: 'user',
      emptyStatus: 'warning',
      now,
      error: usersRead.error?.message,
    }),
  );

  // --- Integrations ---
  // system_integrations is the table integrations are stored in. This used to
  // read `integrations`, which exists in no schema, and discarded the error,
  // so every tenant was permanently "0 active integrations".
  const integrationsRead = await admin
    .from('system_integrations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  checks.push(
    countCheck({
      id: 'integrations',
      category: 'Integrations',
      name: 'Third-Party Integrations',
      description: 'External integrations (ERP, accounting, calendar) are connected',
      priority: 'low',
      count: integrationsRead.error ? null : (integrationsRead.count ?? 0),
      noun: 'active integration',
      emptyStatus: 'in-progress',
      now,
      error: integrationsRead.error?.message,
    }),
  );

  return checks;
}
