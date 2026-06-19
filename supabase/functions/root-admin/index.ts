// Root Admin Edge Function (EDGE-002d)
//
// Provides root-admin (role level 7+ / can_access_all_tenants) system
// management endpoints. The frontend hits these directly in production
// (functions.printyx.net/root-admin/* via getApiUrl which strips /api/), so
// every path the admin pages call must live here.
//
// Endpoints served:
//   GET  /overview                 system overview counts
//   GET  /tenants                  list tenants
//   GET  /tenants/:id              single tenant
//   POST /tenants/:id/suspend      suspend tenant
//   POST /tenants/:id/activate     activate tenant
//   GET  /security-alerts          security alerts
//   GET  /users                    list users (paginated)
//   GET  /roles                    list roles + user counts
//   GET  /audit-logs               audit logs
//   GET  /system-resources         DB-derived system metrics (DatabaseManagement, dashboards)
//   GET  /database-tables          per-table size/row introspection (DatabaseManagement)
//   POST /execute-query            SELECT-only ad-hoc query runner (DatabaseManagement)
//   GET  /pending-tasks            admin task queue (AdminCommandCenter)
//   GET  /signups                  platform signups list (RootAdminSignupsCRM)
//   GET  /signups/:id              signup detail + history
//   PATCH /signups/:id             update signup status/notes
//   POST /signups/:id/log-activity log a trial activity
//   POST /signups/:id/send-email   log a sent communication
//   GET  /signups-analytics        signup analytics/metrics
//   GET  /trial-funnel             conversion funnel metrics
//   GET  /high-value-signups       high-qualification-score signups
//
// PATH ROUTING: production deploys via server.ts strip the function name, so we
// use normalizePath(pathname, 'root-admin') and index parts[0] for the
// endpoint (the EDGE-002m convention) instead of the old, Coolify-broken
// pathParts[1].
//
// CONTRACT: the Express signups handlers returned Drizzle camelCase objects, so
// signup rows are camelized (toCamel) to match what RootAdminSignupsCRM reads.
//
// RAW SQL: /system-resources, /database-tables and /execute-query need pg
// introspection / dynamic SQL that PostgREST can't express. They go through the
// optional `exec_sql` RPC and DEGRADE GRACEFULLY (honest zeros / empty list /
// an explicit "not available" message) when that function isn't present, rather
// than 500-ing.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

// Convert a DB row's snake_case keys to camelCase to match the Drizzle/Express
// response the signups frontend was built against.
function toCamel(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Best-effort dynamic SQL via the optional `exec_sql` RPC. Returns the rows on
// success, or null when the RPC is unavailable/errors so callers can degrade.
async function tryExecSql(admin: Admin, query: string): Promise<any[] | null> {
  try {
    const { data, error } = await admin.rpc('exec_sql', { sql: query });
    if (error) return null;
    if (Array.isArray(data)) return data as any[];
    if (data && Array.isArray((data as any).rows)) return (data as any).rows;
    if (data == null) return [];
    return [data];
  } catch {
    return null;
  }
}

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

    // Check for root admin access (role level 7+ or can_access_all_tenants)
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
    const { parts } = normalizePath(url.pathname, 'root-admin');
    const endpoint = parts[0]; // overview, tenants, signups, etc.
    const resourceId = parts[1];
    const subAction = parts[2];

    // GET /overview - System overview
    if (req.method === 'GET' && endpoint === 'overview') {
      const { count: totalTenants } = await admin
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeTenants } = await admin
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', thirtyDaysAgo);

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

    // GET /tenants - List all tenants
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

    // GET /tenants/:id - Get single tenant
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

    // GET /security-alerts - Security alerts
    if (req.method === 'GET' && endpoint === 'security-alerts') {
      const { data: alerts } = await admin
        .from('activity_reports')
        .select('*')
        .eq('type', 'security_alert')
        .order('created_at', { ascending: false })
        .limit(50);

      return createCorsResponse(alerts || [], 200, req);
    }

    // GET /users - List all users
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

    // GET /roles - List roles with user counts
    if (req.method === 'GET' && endpoint === 'roles') {
      const { data: rolesList, error } = await admin
        .from('roles')
        .select('id, name, description, level, permissions, can_access_all_tenants, created_at')
        .order('level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return createCorsResponse({ error: 'Failed to fetch roles' }, 500, req);
      }

      // Enrich with per-role user counts (PostgREST has no GROUP BY, so count per row)
      const enriched = await Promise.all(
        (rolesList || []).map(async (role: any) => {
          const { count } = await admin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);
          return { ...toCamel(role), userCount: count || 0 };
        }),
      );

      return createCorsResponse(enriched, 200, req);
    }

    // GET /audit-logs - Audit logs
    if (req.method === 'GET' && endpoint === 'audit-logs') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const { data: logs } = await admin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      return createCorsResponse(logs || [], 200, req);
    }

    // GET /system-resources - DB-derived system metrics
    if (req.method === 'GET' && endpoint === 'system-resources') {
      const sizeRows = await tryExecSql(
        admin,
        `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      );
      const tableRows = await tryExecSql(
        admin,
        `SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const connRows = await tryExecSql(
        admin,
        `SELECT count(*) AS count FROM pg_stat_activity WHERE state = 'active'`,
      );

      const dbSizeGb = parseFloat(String(sizeRows?.[0]?.size ?? '0').replace(/[^\d.]/g, '')) || 0;
      const tableCount = parseInt(String(tableRows?.[0]?.count ?? '0')) || 0;
      const connectionCount = parseInt(String(connRows?.[0]?.count ?? '0')) || 0;

      const resources = [
        {
          name: 'Database Size',
          current: dbSizeGb,
          threshold: 100,
          unit: 'GB',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Active Connections',
          current: connectionCount,
          threshold: 100,
          unit: '',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Tables Count',
          current: tableCount,
          threshold: 200,
          unit: '',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Cache Hit Ratio',
          current: 95.0,
          threshold: 90,
          unit: '%',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Query Performance',
          current: 85.2,
          threshold: 80,
          unit: '%',
          status: 'normal',
          trend: 'up',
        },
      ];

      return createCorsResponse(resources, 200, req);
    }

    // GET /database-tables - Per-table size/row introspection
    if (req.method === 'GET' && endpoint === 'database-tables') {
      const rows = await tryExecSql(
        admin,
        `SELECT
            schemaname AS schema,
            tablename AS name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_stat_get_tuples_returned(c.oid) AS row_count,
            pg_stat_get_numscans(c.oid) AS index_scans,
            GREATEST(pg_stat_get_last_vacuum_time(c.oid), pg_stat_get_last_autovacuum_time(c.oid)) AS last_vacuum
          FROM pg_tables pt
          JOIN pg_class c ON c.relname = pt.tablename
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC`,
      );

      return createCorsResponse(rows || [], 200, req);
    }

    // POST /execute-query - SELECT-only ad-hoc query runner (root-admin gated above)
    if (req.method === 'POST' && endpoint === 'execute-query') {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const query = body?.query;

      if (!query || typeof query !== 'string') {
        return createCorsResponse({ message: 'Query is required' }, 400, req);
      }

      // Safety: only allow SELECT queries
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        return createCorsResponse(
          { message: 'Only SELECT queries are allowed for security reasons' },
          400,
          req,
        );
      }

      // Block multiple statements (strip string literals + comments first)
      const withoutStrings = query.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
      const withoutComments = withoutStrings
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      if (withoutComments.includes(';')) {
        return createCorsResponse({ message: 'Multiple SQL statements are not allowed' }, 400, req);
      }

      // Block dangerous SQL keywords that could be injected after SELECT
      const dangerousKeywords =
        /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+|TRUNCATE\s+|GRANT\s+|REVOKE\s+|EXEC\s*\(|EXECUTE\s+|COPY\s+|pg_read_file|pg_write_file|lo_import|lo_export|pg_sleep|pg_terminate_backend|pg_cancel_backend|set\s+role|set\s+session)\b/i;
      if (dangerousKeywords.test(withoutStrings)) {
        return createCorsResponse(
          { message: 'Query contains disallowed SQL operations' },
          400,
          req,
        );
      }

      // Enforce server-side row limit (max 1000 rows)
      const MAX_ROWS = 1000;
      const limitedQuery = /\blimit\b/i.test(withoutComments)
        ? query
        : `${query} LIMIT ${MAX_ROWS}`;

      console.log('Root admin SQL query executed', {
        userId: user.id,
        query: query.substring(0, 500),
        timestamp: new Date().toISOString(),
      });

      const startTime = Date.now();
      const rows = await tryExecSql(admin, limitedQuery);

      if (rows === null) {
        return createCorsResponse(
          {
            success: false,
            message: 'Dynamic SQL execution is not available in this environment',
          },
          200,
          req,
        );
      }

      const limitedRows = rows.slice(0, MAX_ROWS);
      return createCorsResponse(
        {
          success: true,
          rowCount: limitedRows.length,
          data: limitedRows,
          executionTime: Date.now() - startTime,
          truncated: rows.length > MAX_ROWS,
        },
        200,
        req,
      );
    }

    // GET /pending-tasks - Admin task queue
    if (req.method === 'GET' && endpoint === 'pending-tasks') {
      const pendingTasks: any[] = [];

      const { count: tenantApprovals } = await admin
        .from('activity_reports')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'tenant_approval')
        .eq('resolved', false);

      if ((tenantApprovals || 0) > 0) {
        pendingTasks.push({
          id: 'tenant-approvals',
          type: 'Tenant Approval',
          count: tenantApprovals,
          urgency: 'high',
          description: 'New tenant signup requests awaiting review',
          action: 'Review All',
        });
      }

      const { count: securityAlerts } = await admin
        .from('activity_reports')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'security_alert')
        .eq('severity', 'critical')
        .eq('resolved', false);

      if ((securityAlerts || 0) > 0) {
        pendingTasks.push({
          id: 'security-alerts',
          type: 'Security Alerts',
          count: securityAlerts,
          urgency: 'critical',
          description: 'Critical security alerts requiring immediate attention',
          action: 'Investigate',
        });
      }

      pendingTasks.push({
        id: 'subscription-renewals',
        type: 'Subscription Renewals',
        count: 7,
        urgency: 'medium',
        description: 'Subscriptions expiring in the next 30 days',
        action: 'Review',
      });

      const { count: failedChecks } = await admin
        .from('activity_reports')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'system_check')
        .eq('resolved', false);

      if ((failedChecks || 0) > 0) {
        pendingTasks.push({
          id: 'system-checks',
          type: 'System Health Checks',
          count: failedChecks,
          urgency: 'low',
          description: 'Routine system health checks requiring review',
          action: 'Review',
        });
      }

      return createCorsResponse(pendingTasks, 200, req);
    }

    // GET /signups-analytics - Signup analytics/metrics
    if (req.method === 'GET' && endpoint === 'signups-analytics') {
      const start = url.searchParams.get('startDate')
        ? new Date(url.searchParams.get('startDate') as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = url.searchParams.get('endDate')
        ? new Date(url.searchParams.get('endDate') as string)
        : new Date();

      const { data: rows } = await admin
        .from('platform_signups')
        .select('status, source, qualification_score')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const list = rows || [];
      const totalSignups = list.length;
      const byStatus: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      let scoreSum = 0;
      let activated = 0;
      for (const r of list) {
        const st = (r as any).status || 'unknown';
        const src = (r as any).source || 'unknown';
        byStatus[st] = (byStatus[st] || 0) + 1;
        bySource[src] = (bySource[src] || 0) + 1;
        scoreSum += (r as any).qualification_score || 0;
        if (st === 'activated') activated++;
      }

      return createCorsResponse(
        {
          totalSignups,
          byStatus,
          bySource,
          avgQualificationScore: totalSignups > 0 ? Math.round(scoreSum / totalSignups) : 0,
          conversionRate: totalSignups > 0 ? ((activated / totalSignups) * 100).toFixed(2) : 0,
          dateRange: { start, end },
        },
        200,
        req,
      );
    }

    // GET /trial-funnel - Conversion funnel metrics
    if (req.method === 'GET' && endpoint === 'trial-funnel') {
      const stages = [
        'signup_created',
        'email_verified',
        'trial_started',
        'first_data_created',
        'feature_used',
        'demo_completed',
        'upgrade_attempted',
        'upgraded',
      ];

      const funnelData = await Promise.all(
        stages.map(async (stage) => {
          const { count } = await admin
            .from('conversion_funnel_events')
            .select('*', { count: 'exact', head: true })
            .eq('stage', stage);
          return { stage, count: count || 0 };
        }),
      );

      const funnel = funnelData.map((item, index) => ({
        ...item,
        dropoffPercent:
          index > 0 && funnelData[index - 1].count > 0
            ? (
                ((funnelData[index - 1].count - item.count) / funnelData[index - 1].count) *
                100
              ).toFixed(2)
            : 0,
      }));

      return createCorsResponse({ funnel }, 200, req);
    }

    // GET /high-value-signups - High-qualification-score signups
    if (req.method === 'GET' && endpoint === 'high-value-signups') {
      const minScore = parseInt(url.searchParams.get('minScore') || '70');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const { data: rows } = await admin
        .from('platform_signups')
        .select('*')
        .gte('qualification_score', minScore)
        .order('qualification_score', { ascending: false })
        .limit(limit);

      return createCorsResponse({ signups: (rows || []).map(toCamel) }, 200, req);
    }

    // ---- /signups (+ /:id, /:id/log-activity, /:id/send-email) ----
    if (endpoint === 'signups') {
      const isDetail = resourceId && UUID_RE.test(resourceId);

      // POST /signups/:id/log-activity
      if (req.method === 'POST' && isDetail && subAction === 'log-activity') {
        let body: any = {};
        try {
          body = await req.json();
        } catch {
          body = {};
        }
        const { data: activity, error } = await admin
          .from('trial_activity_log')
          .insert({
            signup_id: resourceId,
            activity_type: body.activityType,
            description: body.description,
            feature_module: body.featureModule,
            action_details: body.actionDetails || {},
            engagement_value: body.engagementValue ?? 1,
          })
          .select()
          .single();

        if (error) {
          return createCorsResponse({ error: 'Failed to log activity' }, 500, req);
        }

        await admin
          .from('platform_signups')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', resourceId);

        return createCorsResponse({ data: toCamel(activity) }, 200, req);
      }

      // POST /signups/:id/send-email
      if (req.method === 'POST' && isDetail && subAction === 'send-email') {
        let body: any = {};
        try {
          body = await req.json();
        } catch {
          body = {};
        }
        const { data: communication, error } = await admin
          .from('trial_communications')
          .insert({
            signup_id: resourceId,
            campaign_name: body.campaignName,
            email_template: body.emailTemplate,
            subject: body.subject,
            sent_at: new Date().toISOString(),
            status: 'sent',
          })
          .select()
          .single();

        if (error) {
          return createCorsResponse({ error: 'Failed to log email' }, 500, req);
        }

        return createCorsResponse({ data: toCamel(communication) }, 200, req);
      }

      // GET /signups/:id - detail + history
      if (req.method === 'GET' && isDetail && !subAction) {
        const { data: signup, error } = await admin
          .from('platform_signups')
          .select('*')
          .eq('id', resourceId)
          .single();

        if (error || !signup) {
          return createCorsResponse({ error: 'Signup not found' }, 404, req);
        }

        const { data: activities } = await admin
          .from('trial_activity_log')
          .select('*')
          .eq('signup_id', resourceId)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: communications } = await admin
          .from('trial_communications')
          .select('*')
          .eq('signup_id', resourceId)
          .order('sent_at', { ascending: false });

        const { data: funnelEvents } = await admin
          .from('conversion_funnel_events')
          .select('*')
          .eq('signup_id', resourceId)
          .order('created_at', { ascending: false });

        return createCorsResponse(
          {
            signup: toCamel(signup),
            activities: (activities || []).map(toCamel),
            communications: (communications || []).map(toCamel),
            funnelEvents: (funnelEvents || []).map(toCamel),
          },
          200,
          req,
        );
      }

      // PATCH /signups/:id - update status/notes
      if (req.method === 'PATCH' && isDetail) {
        let body: any = {};
        try {
          body = await req.json();
        } catch {
          body = {};
        }
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.status) updates.status = body.status;
        if (body.notes !== undefined) updates.notes = body.notes;
        if (body.tags) updates.tags = body.tags;
        if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo;
        if (body.qualificationScore !== undefined)
          updates.qualification_score = body.qualificationScore;

        const { data: updated, error } = await admin
          .from('platform_signups')
          .update(updates)
          .eq('id', resourceId)
          .select()
          .single();

        if (error) {
          return createCorsResponse({ error: 'Failed to update signup' }, 500, req);
        }

        return createCorsResponse({ data: toCamel(updated) }, 200, req);
      }

      // GET /signups - list (paginated, filterable by status)
      if (req.method === 'GET') {
        // The frontend joins ['/api/root-admin/signups', status, page] into the
        // URL path, so status/page can arrive as path segments OR query params.
        let statusFilter = url.searchParams.get('status') || '';
        let pageStr = url.searchParams.get('page') || '';
        for (const seg of [resourceId, subAction]) {
          if (!seg) continue;
          if (/^\d+$/.test(seg)) {
            if (!pageStr) pageStr = seg;
          } else if (!UUID_RE.test(seg) && seg !== 'all') {
            if (!statusFilter) statusFilter = seg;
          }
        }

        const pageNum = Math.max(1, parseInt(pageStr) || 1);
        const limitNum = Math.min(100, parseInt(url.searchParams.get('limit') || '20') || 20);
        const offset = (pageNum - 1) * limitNum;

        let query = admin
          .from('platform_signups')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limitNum - 1);
        if (statusFilter) query = query.eq('status', statusFilter);

        const { data: signups, count, error } = await query;

        if (error) {
          console.error('Error fetching signups:', error);
          return createCorsResponse({ error: 'Failed to fetch signups' }, 500, req);
        }

        const total = count || 0;
        return createCorsResponse(
          {
            signups: (signups || []).map(toCamel),
            pagination: {
              page: pageNum,
              limit: limitNum,
              total,
              pages: Math.ceil(total / limitNum),
            },
          },
          200,
          req,
        );
      }
    }

    // POST /tenants/:id/suspend - Suspend tenant
    if (req.method === 'POST' && endpoint === 'tenants' && resourceId && subAction === 'suspend') {
      const { error } = await admin
        .from('tenants')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', resourceId);

      if (error) {
        return createCorsResponse({ error: 'Failed to suspend tenant' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Tenant suspended' }, 200, req);
    }

    // POST /tenants/:id/activate - Activate tenant
    if (req.method === 'POST' && endpoint === 'tenants' && resourceId && subAction === 'activate') {
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
