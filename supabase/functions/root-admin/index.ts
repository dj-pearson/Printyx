// Root Admin Edge Function
// Provides root admin system management endpoints
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { USER_NAME_COLUMNS } from '../_shared/user-profile.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

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

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+)
    // AUDIT-005: this users->roles gate ran on EVERY request to this fn, a second
    // serialized hop after auth.getUser. Cached by user id for ROLE_CACHE_TTL_MS
    // (default 30s) — a role change takes effect within that window.
    const { data: userWithRole } = await cachedRoleLookup(user.id, () =>
      admin
        .from('users')
        .select('role_id, roles!inner(level, can_access_all_tenants)')
        .eq('id', user.id)
        .single(),
    );

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /root-admin, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'root-admin');
    const endpoint = parts[0]; // /root-admin/overview, /root-admin/tenants, etc.
    const resourceId = parts[1];

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
      // COP-M01: `tenants` has no status column — the flag is is_active. This
      // select 42703'd, so the tenant list came back as an error for every root
      // admin. `status` is still returned, derived, because the console reads it.
      const { data: tenants, error } = await admin
        .from('tenants')
        .select(
          'id, name, is_active, subscription, last_activity, storage_used, api_calls, billing_status',
        )
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Error fetching tenants:', error);
        return createCorsResponse(
          { error: 'Failed to fetch tenants', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(
        (tenants ?? []).map((t: any) => ({
          ...t,
          status: t.is_active === false ? 'suspended' : 'active',
        })),
        200,
        req,
      );
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
    //
    // This used to query `activity_reports`, which is the sales-activity rollup
    // (total_calls, total_emails, meetings_scheduled). It has no `type` column
    // and nothing security-related, so the filter 42703'd and the dashboard's
    // alert panel was permanently empty — reading as "no security events",
    // which is the worst possible way for this particular panel to fail.
    //
    // audit_logs is the real event store: severity low|medium|high|critical,
    // category authentication|authorization|data_access|data_modification|
    // system|security, stamped with `timestamp` (not created_at).
    if (req.method === 'GET' && endpoint === 'security-alerts') {
      const { data: alerts } = await admin
        .from('audit_logs')
        .select(
          'id, action, resource, severity, category, tenant_id, user_id, timestamp, additional_context',
        )
        .in('category', ['security', 'authentication', 'authorization'])
        .order('timestamp', { ascending: false })
        .limit(50);

      const rows = alerts ?? [];
      const tenantIds = [...new Set(rows.map((a: any) => a.tenant_id).filter(Boolean))];
      const tenantNames = new Map<string, string>();
      if (tenantIds.length > 0) {
        const { data: tenantRows } = await admin
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds as string[]);
        for (const t of tenantRows ?? []) tenantNames.set(t.id as string, t.name as string);
      }

      // RootAdminDashboard renders alert.type.replace(...), so type is always a
      // string. It is derived from the category rather than stored.
      const typeForCategory: Record<string, string> = {
        security: 'security_breach',
        authentication: 'failed_login',
        authorization: 'unauthorized_access',
      };

      return createCorsResponse(
        rows.map((a: any) => ({
          id: a.id,
          type: typeForCategory[a.category as string] ?? 'suspicious_activity',
          severity: a.severity,
          tenant: tenantNames.get(a.tenant_id as string) ?? (a.tenant_id as string) ?? 'unknown',
          message: [a.action, a.resource].filter(Boolean).join(' on ') || 'Security event',
          timestamp: a.timestamp,
          // audit_logs is an append-only event log with no triage state; every
          // row is an observation, so nothing here is "resolved".
          status: 'open',
        })),
        200,
        req,
      );
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
        .select(`${USER_NAME_COLUMNS}, email, tenant_id, role_id, last_login_at, created_at`, {
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
        // audit_logs records `timestamp`, not created_at.
        .order('timestamp', { ascending: false })
        .limit(limit);

      return createCorsResponse(logs || [], 200, req);
    }

    // POST /root-admin/tenants/:id/suspend - Suspend tenant
    if (req.method === 'POST' && endpoint === 'tenants' && resourceId && parts[2] === 'suspend') {
      const { error } = await admin
        .from('tenants')
        // is_active, not status: writing `status` here silently updated nothing,
        // so suspending a tenant reported success and left it running.
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', resourceId);

      if (error) {
        return createCorsResponse({ error: 'Failed to suspend tenant' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tenant suspended' }, 200, req);
    }

    // POST /root-admin/tenants/:id/activate - Activate tenant
    if (req.method === 'POST' && endpoint === 'tenants' && resourceId && parts[2] === 'activate') {
      const { error } = await admin
        .from('tenants')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', resourceId);

      if (error) {
        return createCorsResponse({ error: 'Failed to activate tenant' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tenant activated' }, 200, req);
    }

    // Method/endpoint not found
    // ─── Signup CRM (EDGE-002d) ─────────────────────────────────────────────
    //
    // RootAdminSignupsCRM.tsx calls /signups, /signups-analytics,
    // /trial-funnel and /high-value-signups; AdminCommandCenter.tsx calls
    // /pending-tasks. None existed here. Ported from
    // server/routes-signup-crm.ts against platform_signups.
    //
    // Rows go through toCamel: the page reads companyName, firstName,
    // qualificationScore and lastActivityAt, because Express returns Drizzle's
    // camelCase while PostgREST returns snake_case.

    // GET /root-admin/signups
    if (req.method === 'GET' && endpoint === 'signups') {
      const status = url.searchParams.get('status');
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20),
      );
      const offset = (page - 1) * limit;
      const order = url.searchParams.get('order') === 'asc';

      // Only sort by a column that exists — sortBy arrives from the query
      // string, and an unknown name would be a 42703 rather than a bad request.
      const SORTABLE = new Set([
        'created_at',
        'updated_at',
        'company_name',
        'qualification_score',
        'status',
        'last_activity_at',
      ]);
      const requested = url.searchParams.get('sortBy') || 'createdAt';
      const requestedColumn = requested.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      const sortColumn = SORTABLE.has(requestedColumn) ? requestedColumn : 'created_at';

      let query = admin
        .from('platform_signups')
        .select('*', { count: 'exact' })
        .order(sortColumn, { ascending: order })
        .range(offset, offset + limit - 1);
      if (status) query = query.eq('status', status);

      const { data: signups, error, count } = await query;

      if (error) {
        console.error('Error fetching signups:', error);
        return createCorsResponse({ message: 'Failed to fetch signups' }, 500, req);
      }

      const total = count ?? 0;
      return createCorsResponse(
        {
          data: toCamel(signups ?? []),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
        200,
        req,
      );
    }

    // GET /root-admin/pending-tasks
    //
    // Express builds this from activity_reports filtered on type, resolved and
    // severity. activity_reports is the SALES rollup (total_calls, total_emails,
    // meetings_scheduled) and has none of those three columns, so the Express
    // version 42703s - the same defect this function's /security-alerts had
    // before it was rebuilt on audit_logs. Rebuilt from sources that exist:
    // unconverted signups, and unacknowledged critical security events.
    if (req.method === 'GET' && endpoint === 'pending-tasks') {
      const [signupRes, securityRes] = await Promise.all([
        admin
          .from('platform_signups')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'new', 'trial']),
        admin
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('category', 'security')
          .eq('severity', 'critical'),
      ]);

      const pendingTasks: Array<Record<string, unknown>> = [];

      if ((signupRes.count ?? 0) > 0) {
        pendingTasks.push({
          id: 'signup-review',
          type: 'Signup Review',
          count: signupRes.count,
          urgency: 'high',
          description: 'Signups awaiting review or still in trial',
          action: 'Review All',
        });
      }

      if ((securityRes.count ?? 0) > 0) {
        pendingTasks.push({
          id: 'security-alerts',
          type: 'Security Alert',
          count: securityRes.count,
          urgency: 'critical',
          description: 'Critical security events recorded in the audit log',
          action: 'Investigate',
        });
      }

      return createCorsResponse(pendingTasks, 200, req);
    }

    // ─── Not portable to an edge function ───────────────────────────────────
    //
    // These three do not read tenant tables — they introspect POSTGRES ITSELF:
    // pg_database_size, pg_stat_activity, information_schema.tables, pg_tables
    // joined to pg_class, and in the last case an operator-supplied statement.
    // PostgREST exposes one schema of tables; none of that is reachable through
    // it. Porting them would mean adding database functions, and for
    // /execute-query specifically that means a function that runs arbitrary
    // operator SQL — strictly worse than where it is now.
    //
    // Express's /execute-query is already hardened in a way an edge port could
    // not reproduce: the statement runs inside SET TRANSACTION READ ONLY, so
    // Postgres itself rejects writes with SQLSTATE 25006. That transaction is
    // the real boundary (validateReadOnlyQuery is defence in depth), and it is
    // not expressible through the PostgREST client. EDGE-002d's own acceptance
    // criterion allows removing this feature rather than porting it.
    //
    // So these stay on Express, and say so instead of 404ing.
    if (
      endpoint === 'system-resources' ||
      endpoint === 'database-tables' ||
      endpoint === 'execute-query'
    ) {
      return createCorsResponse(
        {
          error: 'This endpoint cannot be served from an edge function',
          code: 'REQUIRES_DIRECT_SQL',
          details:
            `/root-admin/${endpoint} introspects Postgres (catalog views, or an operator-supplied ` +
            'statement) rather than reading tenant tables, and PostgREST cannot reach either. ' +
            'It remains on the Express host. /execute-query additionally depends on a SET ' +
            'TRANSACTION READ ONLY boundary that the PostgREST client cannot express.',
        },
        501,
        req,
      );
    }

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
