// Deployment Readiness Edge Function (extended in EDGE-005f)
//
// Serves the DeploymentReadiness page (client/src/pages/DeploymentReadiness.tsx),
// which calls two sub-paths the dispatcher previously didn't have:
//   GET /readiness  → ReadinessCheck[]   (data-driven launch checklist)
//   GET /metrics    → DeploymentMetrics  (rollup of the checklist)
// The legacy root GET (returns { ready, checks, timestamp }) is preserved.
//
// Routing note (EDGE-005f): the page used to call /api/deployment/* which, in
// prod, getApiUrl maps to functions.printyx.net/deployment/* — a dir that does
// not exist (the dir is `deployment-readiness`), so it 404'd. The page now calls
// /api/deployment-readiness/{readiness,metrics} so the first path segment matches
// this function's dir name.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

// Page-facing check shape (matches DeploymentReadiness.tsx ReadinessCheck).
interface ReadinessCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: 'complete' | 'incomplete' | 'warning' | 'in-progress';
  priority: 'high' | 'medium' | 'low';
  lastChecked: string;
  details?: string;
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
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'deployment-readiness');
    const sub = parts[0];

    if (req.method === 'GET' && sub === 'readiness') {
      const checks = await buildReadinessChecks(admin, tenantId);
      return createCorsResponse(checks, 200, req);
    }

    if (req.method === 'GET' && sub === 'metrics') {
      const checks = await buildReadinessChecks(admin, tenantId);
      return createCorsResponse(buildMetrics(checks), 200, req);
    }

    // Legacy root GET — preserve the original { ready, checks } payload.
    if (req.method === 'GET' && !sub) {
      const checks = await buildReadinessChecks(admin, tenantId);
      const ready = checks.every((c) => c.status === 'complete');
      return createCorsResponse(
        {
          ready,
          checks: checks.map((c) => ({ name: c.name, status: c.status, message: c.description })),
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in deployment-readiness function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// Build the readiness checklist from REAL tenant signals. Each check reflects an
// observable condition rather than a hard-coded "complete", so the page shows the
// actual state of a tenant's onboarding.
async function buildReadinessChecks(admin: Admin, tenantId: string): Promise<ReadinessCheck[]> {
  const now = new Date().toISOString();
  const checks: ReadinessCheck[] = [];

  // 1. Database connectivity.
  let dbOk = true;
  try {
    const { error } = await admin.from('tenants').select('id').limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }
  checks.push({
    id: 'database-connection',
    category: 'Infrastructure',
    name: 'Database Connection',
    description: 'Application can reach the production database.',
    status: dbOk ? 'complete' : 'incomplete',
    priority: 'high',
    lastChecked: now,
    details: dbOk ? 'Connected' : 'Connection failed',
  });

  // 2. Tenant configuration.
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();
  checks.push({
    id: 'tenant-configuration',
    category: 'Infrastructure',
    name: 'Tenant Configuration',
    description: 'Tenant record is provisioned and configured.',
    status: tenant ? 'complete' : 'warning',
    priority: 'high',
    lastChecked: now,
    details: tenant ? `Tenant "${tenant.name ?? tenant.id}" configured` : 'Tenant not found',
  });

  // 3. User accounts.
  const { count: userCount } = await admin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  const users = userCount ?? 0;
  checks.push({
    id: 'user-accounts',
    category: 'Security',
    name: 'User Accounts',
    description: 'At least one user account exists for the tenant.',
    status: users > 0 ? 'complete' : 'warning',
    priority: 'high',
    lastChecked: now,
    details: `${users} user${users === 1 ? '' : 's'} configured`,
  });

  // 4. Integrations.
  const { data: integrations } = await admin
    .from('integrations')
    .select('id, status')
    .eq('tenant_id', tenantId);
  const activeIntegrations = (integrations ?? []).filter(
    (i: { status?: string }) => i.status === 'active' || i.status === 'connected',
  ).length;
  checks.push({
    id: 'integrations',
    category: 'Integration',
    name: 'External Integrations',
    description: 'Third-party integrations are connected.',
    status: activeIntegrations > 0 ? 'complete' : 'in-progress',
    priority: 'medium',
    lastChecked: now,
    details: `${activeIntegrations} active integration${activeIntegrations === 1 ? '' : 's'}`,
  });

  // 5. Business data seeded.
  const { count: recordCount } = await admin
    .from('business_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  const records = recordCount ?? 0;
  checks.push({
    id: 'business-data',
    category: 'Data',
    name: 'Business Records',
    description: 'Tenant has leads/customers loaded.',
    status: records > 0 ? 'complete' : 'in-progress',
    priority: 'medium',
    lastChecked: now,
    details: `${records} business record${records === 1 ? '' : 's'}`,
  });

  return checks;
}

function buildMetrics(checks: ReadinessCheck[]) {
  const totalChecks = checks.length;
  const completedChecks = checks.filter((c) => c.status === 'complete').length;
  const criticalIssues = checks.filter(
    (c) => c.priority === 'high' && c.status === 'incomplete',
  ).length;
  const overallReadiness = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  return {
    overallReadiness,
    criticalIssues,
    completedChecks,
    totalChecks,
    estimatedLaunchDate: overallReadiness >= 100 ? 'Ready' : 'Pending remaining checks',
  };
}
