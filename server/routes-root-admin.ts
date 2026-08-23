import { Router } from 'express';
import { z } from 'zod';
import { db } from './db';
import { validateReadOnlyQuery, MAX_ROWS } from './lib/sql-console-guard';
import { users, roles, tenants, auditLogs } from '../shared/schema';
import { rbacAuditLog } from './enhanced-rbac-schema';
import { eq, desc, sql, count, and, gte, lte, like, inArray } from 'drizzle-orm';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { logAdminAction } from './services/audit-log-service';
const log = createModuleLogger('routes-root-admin');

const router = Router();

/** How far back the security views look. audit_logs is append-only and unbounded. */
const SECURITY_WINDOW_DAYS = 30;
const SECURITY_WINDOW = () => new Date(Date.now() - SECURITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

/**
 * The dashboard renders an alert `type` from a fixed vocabulary. audit_logs stores
 * a category and an action instead, so map one onto the other rather than inventing
 * a column.
 */
function alertType(
  category: string | null,
  action: string | null,
): 'failed_login' | 'unauthorized_access' | 'security_breach' | 'suspicious_activity' {
  if (category === 'authentication') {
    return action?.includes('failure') ? 'failed_login' : 'suspicious_activity';
  }
  if (category === 'authorization') return 'unauthorized_access';
  if (category === 'data_modification') return 'security_breach';
  return 'suspicious_activity';
}

/**
 * AUDIT-007: batch-load user display fields for a page of rows.
 *
 * Several handlers here enriched their results with a Promise.all that ran ONE
 * query PER ROW to fetch a user's name/email — up to 100 round-trips to decorate a
 * 100-row page. One inArray over the distinct ids replaces all of them.
 *
 * Returns a Map; a missing id simply has no entry, so callers keep their existing
 * `|| 'System'` / `|| 'Unknown'` fallbacks and behaviour is unchanged.
 */
async function loadUsersByIds(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map<string, { name: string | null; email: string | null }>();
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(
    rows.map((r) => [
      r.id,
      { name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null, email: r.email },
    ]),
  );
}

// Middleware to check root admin access (exported for reuse)
export const requireRootAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get user with role information from database
    const userWithRole = await db
      .select({
        userId: users.id,
        roleId: users.roleId,
        roleName: roles.name,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length || !userWithRole[0].roleLevel) {
      return res.status(403).json({ message: 'Root admin access required - no role assigned' });
    }

    const user = userWithRole[0];

    // Check if user has root admin level (7+) or can access all tenants
    if ((user.roleLevel ?? 0) < 7 && !user.canAccessAllTenants) {
      return res.status(403).json({
        message: 'Root admin access required - insufficient privileges',
      });
    }

    // Add role info to request for later use
    req.user.roleLevel = user.roleLevel;
    req.user.canAccessAllTenants = user.canAccessAllTenants;

    next();
  } catch (error) {
    log.error('Root admin check error:', error);
    res.status(500).json({ message: 'Internal server error during authorization' });
  }
};

// System Overview
router.get('/overview', requireRootAdmin, async (req, res) => {
  try {
    // Get total tenants
    const totalTenants = await db.select({ count: count() }).from(tenants);

    // Get active tenants (those with recent activity)
    const activeTenants = await db
      .select({ count: count() })
      .from(tenants)
      .where(gte(tenants.lastActivity, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))); // Last 30 days

    // Get total users
    const totalUsers = await db.select({ count: count() }).from(users);

    // Get active users (logged in recently)
    const activeUsers = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.lastLoginAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // Last 7 days

    // Critical alerts. This used to count activity_reports rows with
    // type='security_alert' / severity / resolved — activity_reports is the SALES
    // metrics table (calls, emails, meetings, win rates) and has none of those
    // columns, so the query raised and the whole endpoint 500'd. audit_logs is the
    // security trail: it carries severity and category and is what
    // services/audit-log-service.ts writes to.
    const criticalAlerts = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(eq(auditLogs.severity, 'critical'), gte(auditLogs.timestamp, SECURITY_WINDOW())));

    // Calculate system uptime (mock for now - would come from monitoring service)
    const systemUptime = 99.97;

    res.json({
      totalTenants: totalTenants[0]?.count || 0,
      activeTenants: activeTenants[0]?.count || 0,
      totalUsers: totalUsers[0]?.count || 0,
      activeUsers: activeUsers[0]?.count || 0,
      systemUptime,
      criticalAlerts: criticalAlerts[0]?.count || 0,
      pendingActions: 0, // Would be calculated based on open tickets/tasks
      systemHealth: criticalAlerts[0]?.count > 0 ? 'warning' : 'healthy',
    });
  } catch (error) {
    log.error('Error fetching system overview:', error);
    res.status(500).json({ message: 'Failed to fetch system overview' });
  }
});

// Tenant Management
router.get('/tenants', requireRootAdmin, async (req, res) => {
  try {
    const tenantMetrics = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        isActive: tenants.isActive,
        subscription: tenants.subscription,
        lastActivity: tenants.lastActivity,
        storageUsed: tenants.storageUsed,
        apiCalls: tenants.apiCalls,
        billingStatus: tenants.billingStatus,
        userCount: count(users.id),
      })
      .from(tenants)
      .leftJoin(users, eq(users.tenantId, tenants.id))
      .groupBy(tenants.id)
      .orderBy(desc(tenants.lastActivity));

    // `tenants` has is_active, not a status string. The dashboard reads
    // 'active' | 'suspended' | 'trial', so keep that key and derive it.
    res.json(
      tenantMetrics.map(({ isActive, ...tenant }) => ({
        ...tenant,
        status: isActive === false ? 'suspended' : 'active',
      })),
    );
  } catch (error) {
    log.error('Error fetching tenant metrics:', error);
    res.status(500).json({ message: 'Failed to fetch tenant metrics' });
  }
});

// Security Alerts
router.get(
  '/security-alerts',

  requireRootAdmin,
  async (req, res) => {
    try {
      // Same wrong-table bug as /overview: this read activity_reports, the SALES
      // metrics table, for type/severity/description/metadata/resolved columns it
      // does not have. audit_logs is where audit-log-service.ts records
      // authentication, authorization and destructive actions, with a severity and
      // a category on each row.
      const alerts = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          category: auditLogs.category,
          severity: auditLogs.severity,
          resource: auditLogs.resource,
          resourceId: auditLogs.resourceId,
          ipAddress: auditLogs.ipAddress,
          tenantId: auditLogs.tenantId,
          userId: auditLogs.userId,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .where(
          and(
            inArray(auditLogs.severity, ['high', 'critical']),
            gte(auditLogs.timestamp, SECURITY_WINDOW()),
          ),
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(50);

      // AUDIT-007: was TWO queries PER ALERT (tenant + user) — up to 100 round-trips
      // for a 50-row page. Two batched lookups over the distinct ids instead.
      const alertUsers = await loadUsersByIds(alerts.map((a) => a.userId));
      const alertTenantIds = [
        ...new Set(alerts.map((a) => a.tenantId).filter((id): id is string => !!id)),
      ];
      const tenantRows = alertTenantIds.length
        ? await db
            .select({ id: tenants.id, name: tenants.name })
            .from(tenants)
            .where(inArray(tenants.id, alertTenantIds))
        : [];
      const tenantsById = new Map(tenantRows.map((t) => [t.id, t.name]));

      const enrichedAlerts = alerts.map((alert) => {
        const user = alert.userId ? alertUsers.get(alert.userId) : undefined;
        return {
          ...alert,
          type: alertType(alert.category, alert.action),
          // audit_logs records what happened; it has no resolution workflow, so
          // there is nothing here that could report anything but 'open'.
          status: 'open' as const,
          message: alert.resourceId
            ? `${alert.action} on ${alert.resource} (${alert.resourceId})`
            : `${alert.action} on ${alert.resource}`,
          tenant: (alert.tenantId ? tenantsById.get(alert.tenantId) : null) || 'Unknown',
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'unknown@example.com',
        };
      });

      res.json(enrichedAlerts);
    } catch (error) {
      log.error('Error fetching security alerts:', error);
      res.status(500).json({ message: 'Failed to fetch security alerts' });
    }
  },
);

// System Resources
router.get(
  '/system-resources',

  requireRootAdmin,
  async (req, res) => {
    try {
      // In a real implementation, these would come from system monitoring
      // For now, calculate some metrics from database
      const dbSize = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

      const tableCount = await db.execute(sql`
      SELECT count(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

      const connectionCount = await db.execute(sql`
      SELECT count(*) as count FROM pg_stat_activity 
      WHERE state = 'active'
    `);

      // Create system resource metrics in proper format for dashboard
      const resources = [
        {
          name: 'Database Size',
          current: parseFloat(
            String((dbSize.rows[0] as { size?: string } | undefined)?.size ?? '').replace(
              /[^\d.]/g,
              '',
            ) || '0',
          ),
          threshold: 100,
          unit: 'GB',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Active Connections',
          current: parseInt(
            String((connectionCount.rows[0] as { count?: string } | undefined)?.count ?? '0'),
          ),
          threshold: 100,
          unit: '',
          status: 'normal',
          trend: 'stable',
        },
        {
          name: 'Tables Count',
          current: parseInt(
            String((tableCount.rows[0] as { count?: string } | undefined)?.count ?? '0'),
          ),
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

      res.json(resources);
    } catch (error) {
      log.error('Error fetching system resources:', error);
      res.status(500).json({ message: 'Failed to fetch system resources' });
    }
  },
);

// User Management
router.get('/users', requireRootAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;

    let query = db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        roleId: users.roleId,
        tenantId: users.tenantId,
        isActive: users.isActive,
        lastLogin: users.lastLoginAt,
        createdAt: users.createdAt,
        // AUDIT-007: the joins below were ALREADY here — the query just never
        // selected from them, so the old code re-fetched each user's role and tenant
        // one row at a time (2 queries PER USER, up to 200 round-trips for the 100-row
        // page) to get data this join already had in hand.
        roleName: roles.name,
        roleLevel: roles.level,
        tenantName: tenants.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .$dynamic();

    // Apply filters
    const conditions = [];
    if (role && role !== 'all') {
      conditions.push(eq(roles.name, role as string));
    }
    // `users` has is_active, not a status string, and first_name/last_name rather
    // than a single name column — so ?status=active and ?search= both raised.
    if (status && status !== 'all') {
      conditions.push(eq(users.isActive, status === 'active'));
    }
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        sql`(${users.firstName} ILIKE ${term} OR ${users.lastName} ILIKE ${term} OR ${users.email} ILIKE ${term})`,
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const userList = await query.orderBy(desc(users.lastLoginAt)).limit(100);

    // AUDIT-007: pure mapping now — no I/O. Fallbacks match the old
    // `role?.[0]?.name || 'No Role'` behaviour for users with no role/tenant (the
    // joins are LEFT joins, so those columns come back null).
    const enrichedUsers = userList.map((user) => ({
      ...user,
      // Kept so callers still get `name` and `status`, which is what they read;
      // the columns behind them are first_name/last_name and is_active.
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      status: user.isActive === false ? 'inactive' : 'active',
      role: user.roleName || 'No Role',
      roleLevel: user.roleLevel || 1,
      tenant: user.tenantName || 'No Tenant',
      department: 'General', // Would be added to schema
      location: 'Main Office', // Would be added to schema
    }));

    res.json(enrichedUsers);
  } catch (error) {
    log.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Role Management
router.get('/roles', requireRootAdmin, async (req, res) => {
  try {
    const rolesList = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        level: roles.level,
        permissions: roles.permissions,
        canAccessAllTenants: roles.canAccessAllTenants,
        createdAt: roles.createdAt,
        userCount: count(users.id),
      })
      .from(roles)
      .leftJoin(users, eq(users.roleId, roles.id))
      .groupBy(roles.id)
      .orderBy(desc(roles.level));

    res.json(rolesList);
  } catch (error) {
    log.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
});

// Audit Logs
router.get('/audit-logs', requireRootAdmin, async (req, res) => {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        // The columns are resource/resource_id; the dashboard reads
        // tableName/recordId, so alias rather than rename its contract.
        tableName: auditLogs.resource,
        recordId: auditLogs.resourceId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);

    // Enrich with user information
    // AUDIT-007: was one user query PER LOG ROW; now a single batched lookup.
    const logUsers = await loadUsersByIds(logs.map((l) => l.userId));
    const enrichedLogs = logs.map((log) => {
      const user = log.userId ? logUsers.get(log.userId) : undefined;
      return {
        ...log,
        userName: user?.name || 'System',
        userEmail: user?.email || 'system@printyx.com',
      };
    });

    res.json(enrichedLogs);
  } catch (error) {
    log.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

// Database Tables Information
router.get(
  '/database-tables',

  requireRootAdmin,
  async (req, res) => {
    try {
      const tablesInfo = await db.execute(sql`
      SELECT 
        schemaname as schema,
        tablename as name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_stat_get_tuples_returned(c.oid) as row_count,
        pg_stat_get_numscans(c.oid) as index_scans,
        GREATEST(pg_stat_get_last_vacuum_time(c.oid), pg_stat_get_last_autovacuum_time(c.oid)) as last_vacuum
      FROM pg_tables pt
      JOIN pg_class c ON c.relname = pt.tablename
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

      res.json(tablesInfo.rows);
    } catch (error) {
      log.error('Error fetching database tables:', error);
      res.status(500).json({ message: 'Failed to fetch database tables' });
    }
  },
);

// Execute SQL Query (with safety restrictions)
router.post(
  '/execute-query',

  requireRootAdmin,
  async (req, res) => {
    const userId = getUserId(req);
    const tenantId = getTenantId(req) || 'platform';
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    // CR-007 / AUDIT-003 — this endpoint runs operator-supplied SQL with the app's DB
    // role, so it bypasses tenant/RLS isolation and any SELECT can read across
    // tenants. It is gated to root-admins only.
    //
    // AUDIT-003: write capability is now removed BY THE ENGINE, not by text matching.
    // The statement executes inside a `SET TRANSACTION READ ONLY` transaction, so
    // Postgres itself rejects any INSERT/UPDATE/DELETE/DDL with SQLSTATE 25006 —
    // including anything that slips past the static guard. That is the real boundary.
    // validateReadOnlyQuery (server/lib/sql-console-guard.ts) remains as
    // defence-in-depth and for early, readable errors; it replaces the old
    // `.replace(/'[^']*'/g,'')` literal stripping, which did not understand ''
    // escapes, E'' strings or $$ dollar-quoting and so disagreed with Postgres about
    // what was code vs data.
    //
    // RESIDUAL: reads still span tenants, and the app role is still the connection
    // owner. TODO(prod): point this at a dedicated low-privilege role / read replica
    // (a connection-level grant) so read scope is constrained too — that needs an ops
    // change (a separate DATABASE_URL), not a code change.
    try {
      const { query } = req.body;

      // AUDIT-003: single static gate (SELECT-only, single-statement, denylist,
      // row cap) with a real Postgres-compatible lexer behind it.
      const guard = validateReadOnlyQuery(query);
      if (!guard.ok) {
        log.warn('Blocked SQL console query', {
          userId,
          clientIp,
          reason: guard.reason,
          queryPrefix: typeof query === 'string' ? query.substring(0, 50) : '(non-string)',
        });
        return res.status(400).json({ message: guard.reason });
      }
      const limitedQuery = guard.limitedQuery!;

      // CR-007: persist every executed statement to the audit trail (user +
      // tenant), not just the app log. Best-effort — a logging failure must not
      // silently drop the audit record, so we await it before executing.
      log.info('Root admin SQL query executed', {
        userId,
        clientIp,
        query: query.substring(0, 500),
        timestamp: new Date().toISOString(),
      });
      if (userId) {
        await logAdminAction('sql_console.execute', 'database', 'query', userId, tenantId, req, {
          query: query.substring(0, 500),
          clientIp,
        });
      }

      // AUDIT-003: run inside a READ ONLY transaction. This — not the regex — is what
      // makes a write impossible: Postgres raises 25006 ("cannot execute X in a
      // read-only transaction") for any INSERT/UPDATE/DELETE/DDL, even one smuggled
      // past the static guard via dollar-quoting or escaped quotes. SET LOCAL scopes
      // both settings to this transaction, so the pooled connection is not affected
      // once it returns to the pool.
      const startTime = Date.now();
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET TRANSACTION READ ONLY'));
        await tx.execute(sql.raw('SET LOCAL statement_timeout = 10000'));
        return await tx.execute(sql.raw(limitedQuery));
      });

      // Enforce row limit on results even if user-provided LIMIT was higher
      const limitedRows = result.rows.slice(0, MAX_ROWS);

      res.json({
        success: true,
        rowCount: limitedRows.length,
        data: limitedRows,
        executionTime: Date.now() - startTime,
        truncated: result.rows.length > MAX_ROWS,
      });
    } catch (error) {
      log.error('Error executing query:', { error, userId, clientIp });
      res.status(500).json({
        success: false,
        message: 'Failed to execute query',
      });
    }
  },
);

// =====================================================================
// RBAC AUDIT LOGS - Security monitoring for admin bypass actions
// =====================================================================

/**
 * GET /rbac-audit-logs - Get RBAC audit logs with filtering
 * Supports filtering by event type, user, date range, and route
 */
router.get('/rbac-audit-logs', requireRootAdmin, async (req, res) => {
  try {
    const {
      eventType,
      userId,
      startDate,
      endDate,
      route,
      limit: limitParam = '100',
      offset: offsetParam = '0',
    } = req.query;

    const conditions: any[] = [];

    // Filter by event type(s)
    if (eventType) {
      const types = (eventType as string).split(',');
      conditions.push(inArray(rbacAuditLog.eventType, types));
    }

    // Filter by user ID
    if (userId) {
      conditions.push(eq(rbacAuditLog.userId, userId as string));
    }

    // Filter by date range
    if (startDate) {
      conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
    }

    // Filter by route (partial match)
    if (route) {
      conditions.push(like(rbacAuditLog.route, `%${route}%`));
    }

    const limitNum = Math.min(parseInt(limitParam as string, 10) || 100, 1000);
    const offsetNum = parseInt(offsetParam as string, 10) || 0;

    // Get logs with conditions
    const logs = await db
      .select()
      .from(rbacAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rbacAuditLog.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(rbacAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Enrich with user information
    // AUDIT-007: was one user query PER LOG ROW; now a single batched lookup.
    const logUsers = await loadUsersByIds(logs.map((l) => l.userId));
    const enrichedLogs = logs.map((log) => {
      const user = log.userId ? logUsers.get(log.userId) : undefined;
      return {
        ...log,
        userName: user?.name || 'System',
        userEmail: user?.email || 'system@printyx.com',
      };
    });

    res.json({
      data: enrichedLogs,
      total: countResult?.count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    log.error('Error fetching RBAC audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch RBAC audit logs' });
  }
});

/**
 * GET /rbac-audit-logs/stats - Get RBAC audit log statistics
 * Returns counts by event type for security monitoring dashboards
 */
router.get('/rbac-audit-logs/stats', requireRootAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const conditions: any[] = [];

    if (startDate) {
      conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
    }

    // Get counts by event type
    const eventTypeCounts = await db
      .select({
        eventType: rbacAuditLog.eventType,
        count: count(),
      })
      .from(rbacAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(rbacAuditLog.eventType)
      .orderBy(desc(count()));

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(rbacAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get admin bypass count specifically (for security alerting)
    const [adminBypassCount] = await db
      .select({ count: count() })
      .from(rbacAuditLog)
      .where(
        conditions.length > 0
          ? and(eq(rbacAuditLog.eventType, 'ADMIN_BYPASS'), ...conditions)
          : eq(rbacAuditLog.eventType, 'ADMIN_BYPASS'),
      );

    // Get recent admin bypass activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [recentAdminBypassCount] = await db
      .select({ count: count() })
      .from(rbacAuditLog)
      .where(
        and(eq(rbacAuditLog.eventType, 'ADMIN_BYPASS'), gte(rbacAuditLog.createdAt, yesterday)),
      );

    res.json({
      total: totalResult?.count || 0,
      byEventType: eventTypeCounts,
      adminBypass: {
        total: adminBypassCount?.count || 0,
        last24Hours: recentAdminBypassCount?.count || 0,
      },
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    log.error('Error fetching RBAC audit stats:', error);
    res.status(500).json({ message: 'Failed to fetch RBAC audit stats' });
  }
});

/**
 * GET /rbac-audit-logs/admin-bypass - Get only admin bypass events
 * Specialized endpoint for security monitoring of admin actions
 */
router.get('/rbac-audit-logs/admin-bypass', requireRootAdmin, async (req, res) => {
  try {
    const { userId, startDate, endDate, limit: limitParam = '50' } = req.query;

    const conditions: any[] = [eq(rbacAuditLog.eventType, 'ADMIN_BYPASS')];

    if (userId) {
      conditions.push(eq(rbacAuditLog.userId, userId as string));
    }
    if (startDate) {
      conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
    }

    const limitNum = Math.min(parseInt(limitParam as string, 10) || 50, 500);

    const logs = await db
      .select()
      .from(rbacAuditLog)
      .where(and(...conditions))
      .orderBy(desc(rbacAuditLog.createdAt))
      .limit(limitNum);

    // Enrich with user information
    // AUDIT-007: was one user query PER LOG ROW; now a single batched lookup.
    const logUsers = await loadUsersByIds(logs.map((l) => l.userId));
    const enrichedLogs = logs.map((log) => {
      const user = log.userId ? logUsers.get(log.userId) : undefined;
      return {
        ...log,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'unknown',
      };
    });

    res.json({
      data: enrichedLogs,
      count: enrichedLogs.length,
    });
  } catch (error) {
    log.error('Error fetching admin bypass logs:', error);
    res.status(500).json({ message: 'Failed to fetch admin bypass logs' });
  }
});

// ============================================================================
// SECURITY: LOCKED ACCOUNTS MANAGEMENT
// ============================================================================

import { loginAttempts } from '../shared/auth-schema';

/**
 * GET /root-admin/security/locked-accounts
 * List all currently locked accounts
 */
router.get('/security/locked-accounts', async (_req, res) => {
  try {
    const now = new Date();
    const locked = await db
      .select({
        id: loginAttempts.id,
        email: loginAttempts.email,
        attemptCount: loginAttempts.attemptCount,
        lastAttemptAt: loginAttempts.lastAttemptAt,
        lockedUntil: loginAttempts.lockedUntil,
        lastIpAddress: loginAttempts.lastIpAddress,
      })
      .from(loginAttempts)
      .where(
        sql`${loginAttempts.lockedUntil} IS NOT NULL AND (${loginAttempts.lockedUntil} > ${now} OR ${loginAttempts.lockedUntil} = '1970-01-01T00:00:00.000Z'::timestamp)`,
      );

    const enriched = locked.map((account) => ({
      ...account,
      requiresAdminUnlock: account.lockedUntil && account.lockedUntil.getTime() === 0,
      lockedType:
        account.lockedUntil && account.lockedUntil.getTime() === 0 ? 'permanent' : 'temporary',
    }));

    res.json({ data: enriched, count: enriched.length });
  } catch (error) {
    log.error('Error fetching locked accounts:', error);
    res.status(500).json({ message: 'Failed to fetch locked accounts' });
  }
});

/**
 * POST /root-admin/security/unlock-account
 * Unlock a locked account
 */
router.post('/security/unlock-account', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, normalizedEmail))
      .limit(1);

    if (!attempt) {
      return res.status(404).json({ message: 'No login attempt record found for this email' });
    }

    await db
      .update(loginAttempts)
      .set({
        attemptCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(loginAttempts.email, normalizedEmail));

    log.info(`[SECURITY] account_unlocked: email=${normalizedEmail} by admin`);

    res.json({ message: `Account ${normalizedEmail} has been unlocked` });
  } catch (error) {
    log.error('Error unlocking account:', error);
    res.status(500).json({ message: 'Failed to unlock account' });
  }
});

export default router;
