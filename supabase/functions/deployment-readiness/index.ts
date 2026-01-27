// Deployment Readiness Edge Function
// Handles deployment readiness checks
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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

    // GET /deployment-readiness - Check deployment readiness
    if (req.method === 'GET') {
      // Check various system components
      const checks = [];

      // Check database connection
      try {
        const { data: dbCheck } = await admin.from('tenants').select('id').limit(1);
        checks.push({ name: 'Database', status: 'ok', message: 'Connected' });
      } catch {
        checks.push({ name: 'Database', status: 'error', message: 'Connection failed' });
      }

      // Check tenant configuration
      const { data: tenant } = await admin.from('tenants').select('*').eq('id', tenantId).single();

      if (tenant) {
        checks.push({ name: 'Tenant Config', status: 'ok', message: 'Configured' });
      } else {
        checks.push({ name: 'Tenant Config', status: 'warning', message: 'Tenant not found' });
      }

      // Check integrations
      const { data: integrations } = await admin
        .from('integrations')
        .select('id, name, status')
        .eq('tenant_id', tenantId);

      const activeIntegrations =
        integrations?.filter((i: any) => i.status === 'active').length || 0;
      checks.push({
        name: 'Integrations',
        status: activeIntegrations > 0 ? 'ok' : 'info',
        message: `${activeIntegrations} active integrations`,
      });

      // Check user setup
      const { count: userCount } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      checks.push({
        name: 'Users',
        status: (userCount || 0) > 0 ? 'ok' : 'warning',
        message: `${userCount || 0} users configured`,
      });

      const allOk = checks.every((c) => c.status === 'ok' || c.status === 'info');

      return createCorsResponse(
        {
          ready: allOk,
          checks,
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
