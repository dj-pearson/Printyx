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
// The page ships static mock fallbacks, so a 404 was non-fatal — but it meant the
// readiness board never reflected real tenant state. These handlers derive the
// checks from live tenant signals (DB connectivity, tenant config, integrations,
// users) and return the exact ReadinessCheck[] / DeploymentMetrics shapes the page
// types, so the board renders real data instead of placeholder rows.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { assessPublicApiBaseUrl } from '../_shared/platform-base-url.ts';

type CheckStatus = 'complete' | 'incomplete' | 'warning' | 'in-progress';
type Priority = 'high' | 'medium' | 'low';

interface ReadinessCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: CheckStatus;
  priority: Priority;
  lastChecked: string;
  details?: string;
}

interface DeploymentMetrics {
  overallReadiness: number;
  criticalIssues: number;
  completedChecks: number;
  totalChecks: number;
  estimatedLaunchDate: string;
}

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
      return createCorsResponse(deriveMetrics(checks), 200, req);
    }

    // Legacy bare-function root: simple ready/checks summary (backward compat).
    const allOk = checks.every((c) => c.status === 'complete');
    return createCorsResponse(
      {
        ready: allOk,
        checks: checks.map((c) => ({ name: c.name, status: c.status, message: c.details || '' })),
        metrics: deriveMetrics(checks),
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

// Build the readiness board from live tenant signals plus a baseline of
// platform-level infrastructure/security checks. Dynamic checks reflect what the
// tenant has actually configured; static checks document the launch baseline.
async function buildChecks(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<ReadinessCheck[]> {
  const now = new Date().toISOString();
  const checks: ReadinessCheck[] = [];

  // --- Infrastructure: database connectivity ---
  let dbOk = true;
  try {
    const { error } = await admin.from('tenants').select('id').limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }
  checks.push({
    id: 'db-connectivity',
    category: 'Infrastructure',
    name: 'Database Connectivity',
    description: 'Primary Postgres database is reachable and responding to queries',
    status: dbOk ? 'complete' : 'incomplete',
    priority: 'high',
    lastChecked: now,
    details: dbOk ? 'Connected' : 'Connection failed',
  });

  // --- Infrastructure: tenant configuration ---
  let tenantConfigured = false;
  try {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .maybeSingle();
    tenantConfigured = !!tenant;
  } catch {
    tenantConfigured = false;
  }
  checks.push({
    id: 'tenant-config',
    category: 'Infrastructure',
    name: 'Tenant Configuration',
    description: 'This tenant exists and is provisioned in the platform',
    status: tenantConfigured ? 'complete' : 'warning',
    priority: 'high',
    lastChecked: now,
    details: tenantConfigured ? 'Provisioned' : 'Tenant record not found',
  });

  // --- Setup: users ---
  let userCount = 0;
  try {
    const { count } = await admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    userCount = count || 0;
  } catch {
    userCount = 0;
  }
  checks.push({
    id: 'users-configured',
    category: 'Setup',
    name: 'User Accounts',
    description: 'At least one user account is configured for this tenant',
    status: userCount > 0 ? 'complete' : 'warning',
    priority: 'medium',
    lastChecked: now,
    details: `${userCount} user${userCount === 1 ? '' : 's'} configured`,
  });

  // --- Integrations ---
  let activeIntegrations = 0;
  try {
    const { data } = await admin
      .from('integrations')
      .select('id, status')
      .eq('tenant_id', tenantId);
    activeIntegrations = (data || []).filter((i: any) => i.status === 'active').length;
  } catch {
    activeIntegrations = 0;
  }
  checks.push({
    id: 'integrations',
    category: 'Integrations',
    name: 'Third-Party Integrations',
    description: 'External integrations (ERP, accounting, calendar) are connected',
    status: activeIntegrations > 0 ? 'complete' : 'in-progress',
    priority: 'low',
    lastChecked: now,
    details: `${activeIntegrations} active integration${activeIntegrations === 1 ? '' : 's'}`,
  });

  // --- Baseline platform checks (true for every tenant on this platform) ---
  checks.push(
    {
      id: 'ssl',
      category: 'Security',
      name: 'TLS / SSL Encryption',
      description: 'All traffic is served over HTTPS with valid certificates',
      status: 'complete',
      priority: 'high',
      lastChecked: now,
      details: 'Enforced platform-wide',
    },
    {
      id: 'rbac',
      category: 'Security',
      name: 'Role-Based Access Control',
      description: 'Multi-tenant isolation and RBAC permissions are enforced',
      status: 'complete',
      priority: 'high',
      lastChecked: now,
      details: '8-level role hierarchy active',
    },
    {
      id: 'backups',
      category: 'Infrastructure',
      name: 'Automated Backups',
      description: 'Daily database backups with retention are scheduled',
      status: 'complete',
      priority: 'high',
      lastChecked: now,
      details: 'Daily 02:00 UTC, 7d/4w/12m retention',
    },
  );

  // EDGE-015: monitoring-client installers + agent-ingest URLs must point at the
  // Express/app host (PUBLIC_API_BASE_URL), not the edge host. Surface a missing
  // env as a warning so on-prem installs don't silently ship a dead-host URL.
  const baseUrlCheck = assessPublicApiBaseUrl(Deno.env.get('PUBLIC_API_BASE_URL'));
  checks.push({
    id: 'public-api-base-url',
    category: 'Infrastructure',
    name: 'Public API Base URL',
    description: 'PUBLIC_API_BASE_URL points monitoring-client installers/agents at the app host',
    status: baseUrlCheck.status,
    priority: 'high',
    lastChecked: now,
    details: baseUrlCheck.details,
  });

  return checks;
}

function deriveMetrics(checks: ReadinessCheck[]): DeploymentMetrics {
  const totalChecks = checks.length;
  const completedChecks = checks.filter((c) => c.status === 'complete').length;
  const criticalIssues = checks.filter(
    (c) => c.priority === 'high' && c.status !== 'complete',
  ).length;
  const overallReadiness = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  // Estimate launch date: ready now if no critical issues, otherwise add a small
  // buffer scaled by the number of incomplete checks.
  const incomplete = totalChecks - completedChecks;
  const launch = new Date();
  launch.setDate(launch.getDate() + (criticalIssues > 0 ? 7 + incomplete * 2 : incomplete));

  return {
    overallReadiness,
    criticalIssues,
    completedChecks,
    totalChecks,
    estimatedLaunchDate: launch.toISOString(),
  };
}
