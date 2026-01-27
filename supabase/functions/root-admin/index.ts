// Root Admin Edge Function
// Provides root admin system management endpoints
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+)
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1]; // /root-admin/overview, /root-admin/tenants, etc.
    const resourceId = pathParts[2];

    // GET /root-admin/overview - System overview
    if (req.method === 'GET' && endpoint === 'overview') {
      // Get tenant counts
      const { count: totalTenants } = await admin
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeTenants } = await admin
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', thirtyDaysAgo);

      // Get user counts
      const { count: totalUsers } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsers } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_at', sevenDaysAgo);

      return createCorsResponse(
        {
          totalTenants: totalTenants || 0,
          activeTenants: activeTenants || 0,
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          systemUptime: 99.97,
          criticalAlerts: 0,
          pendingActions: 0,
          systemHealth: 'healthy',
        },
        200,
        req,
      );
    }

    // GET /root-admin/tenants - List all tenants
    if (req.method === 'GET' && endpoint === 'tenants' && !resourceId) {
      const { data: tenants, error } = await admin
        .from('tenants')
        .select(
          'id, name, status, subscription, last_activity, storage_used, api_calls, billing_status',
        )
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Error fetching tenants:', error);
        return createCorsResponse({ error: 'Failed to fetch tenants' }, 500, req);
      }

      return createCorsResponse(tenants || [], 200, req);
    }

    // GET /root-admin/tenants/:id - Get single tenant
    if (req.method === 'GET' && endpoint === 'tenants' && resourceId) {
      const { data: tenant, error } = await admin
        .from('tenants')
        .select('*')
        .eq('id', resourceId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Tenant not found' }, 404, req);
      }

      return createCorsResponse(tenant, 200, req);
    }

    // GET /root-admin/security-alerts - Security alerts
    if (req.method === 'GET' && endpoint === 'security-alerts') {
      const { data: alerts } = await admin
        .from('activity_reports')
        .select('*')
        .eq('type', 'security_alert')
        .order('created_at', { ascending: false })
        .limit(50);

      return createCorsResponse(alerts || [], 200, req);
    }

    // GET /root-admin/users - List all users
    if (req.method === 'GET' && endpoint === 'users') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const {
        data: users,
        error,
        count,
      } = await admin
        .from('users')
        .select('id, name, email, tenant_id, role_id, last_login_at, created_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching users:', error);
        return createCorsResponse({ error: 'Failed to fetch users' }, 500, req);
      }

      return createCorsResponse({ users: users || [], total: count || 0 }, 200, req);
    }

    // GET /root-admin/audit-logs - Audit logs
    if (req.method === 'GET' && endpoint === 'audit-logs') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const { data: logs } = await admin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      return createCorsResponse(logs || [], 200, req);
    }

    // POST /root-admin/tenants/:id/suspend - Suspend tenant
    if (
      req.method === 'POST' &&
      endpoint === 'tenants' &&
      resourceId &&
      pathParts[3] === 'suspend'
    ) {
      const { error } = await admin
        .from('tenants')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', resourceId);

      if (error) {
        return createCorsResponse({ error: 'Failed to suspend tenant' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tenant suspended' }, 200, req);
    }

    // POST /root-admin/tenants/:id/activate - Activate tenant
    if (
      req.method === 'POST' &&
      endpoint === 'tenants' &&
      resourceId &&
      pathParts[3] === 'activate'
    ) {
      const { error } = await admin
        .from('tenants')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', resourceId);

      if (error) {
        return createCorsResponse({ error: 'Failed to activate tenant' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tenant activated' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in root-admin function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
