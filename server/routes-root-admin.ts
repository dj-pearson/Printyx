import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { users, roles, tenants, activityReports, auditLogs } from "../shared/schema";
import { eq, desc, sql, count, and, gte, lte } from "drizzle-orm";
// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId
    };
  } else if (!req.user.tenantId && !req.user.id) {
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId
    };
  }
  
  next();
};

const router = Router();

// Middleware to check root admin access
const requireRootAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get user with role information from database
    const userWithRole = await db
      .select({
        userId: users.id,
        roleId: users.roleId,
        roleName: roles.name,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length || !userWithRole[0].roleLevel) {
      return res.status(403).json({ message: "Root admin access required - no role assigned" });
    }

    const user = userWithRole[0];
    
    // Check if user has root admin level (7+) or can access all tenants
    if (user.roleLevel < 7 && !user.canAccessAllTenants) {
      return res.status(403).json({ message: "Root admin access required - insufficient privileges" });
    }

    // Add role info to request for later use
    req.user.roleLevel = user.roleLevel;
    req.user.canAccessAllTenants = user.canAccessAllTenants;
    
    next();
  } catch (error) {
    console.error("Root admin check error:", error);
    res.status(500).json({ message: "Internal server error during authorization" });
  }
};

// System Overview
router.get("/overview", requireAuth, requireRootAdmin, async (req, res) => {
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
      .where(gte(users.lastLogin, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // Last 7 days

    // Get critical alerts count
    const criticalAlerts = await db
      .select({ count: count() })
      .from(activityReports)
      .where(
        and(
          eq(activityReports.type, "security_alert"),
          eq(activityReports.severity, "critical"),
          eq(activityReports.resolved, false)
        )
      );

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
      systemHealth: criticalAlerts[0]?.count > 0 ? 'warning' : 'healthy'
    });
  } catch (error) {
    console.error("Error fetching system overview:", error);
    res.status(500).json({ message: "Failed to fetch system overview" });
  }
});

// Tenant Management
router.get("/tenants", requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const tenantMetrics = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        status: tenants.status,
        subscription: tenants.subscription,
        lastActivity: tenants.lastActivity,
        storageUsed: tenants.storageUsed,
        apiCalls: tenants.apiCalls,
        billingStatus: tenants.billingStatus,
        userCount: count(users.id)
      })
      .from(tenants)
      .leftJoin(users, eq(users.tenantId, tenants.id))
      .groupBy(tenants.id)
      .orderBy(desc(tenants.lastActivity));

    res.json(tenantMetrics);
  } catch (error) {
    console.error("Error fetching tenant metrics:", error);
    res.status(500).json({ message: "Failed to fetch tenant metrics" });
  }
});

// Security Alerts
router.get("/security-alerts", requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const alerts = await db
      .select({
        id: activityReports.id,
        type: activityReports.type,
        severity: activityReports.severity,
        tenantId: activityReports.tenantId,
        userId: activityReports.userId,
        description: activityReports.description,
        metadata: activityReports.metadata,
        timestamp: activityReports.createdAt,
        resolved: activityReports.resolved
      })
      .from(activityReports)
      .where(eq(activityReports.type, "security_alert"))
      .orderBy(desc(activityReports.createdAt))
      .limit(50);

    // Enrich with tenant and user names
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const tenant = alert.tenantId ? await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, alert.tenantId))
          .limit(1) : null;

        const user = alert.userId ? await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, alert.userId))
          .limit(1) : null;

        return {
          ...alert,
          tenant: tenant?.[0]?.name || "Unknown",
          userName: user?.[0]?.name || "Unknown",
          userEmail: user?.[0]?.email || "unknown@example.com"
        };
      })
    );

    res.json(enrichedAlerts);
  } catch (error) {
    console.error("Error fetching security alerts:", error);
    res.status(500).json({ message: "Failed to fetch security alerts" });
  }
});

// System Resources
router.get("/system-resources", requireAuth, requireRootAdmin, async (req, res) => {
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
        name: "Database Size", 
        current: parseFloat(dbSize.rows[0]?.size?.replace(/[^\d.]/g, '') || "0"), 
        threshold: 100, 
        unit: "GB", 
        status: "normal", 
        trend: "stable" 
      },
      { 
        name: "Active Connections", 
        current: parseInt(connectionCount.rows[0]?.count || "0"), 
        threshold: 100, 
        unit: "", 
        status: "normal", 
        trend: "stable" 
      },
      { 
        name: "Tables Count", 
        current: parseInt(tableCount.rows[0]?.count || "0"), 
        threshold: 200, 
        unit: "", 
        status: "normal", 
        trend: "stable" 
      },
      { 
        name: "Cache Hit Ratio", 
        current: 95.0, 
        threshold: 90, 
        unit: "%", 
        status: "normal", 
        trend: "stable" 
      },
      { 
        name: "Query Performance", 
        current: 85.2, 
        threshold: 80, 
        unit: "%", 
        status: "normal", 
        trend: "up" 
      }
    ];

    res.json(resources);
  } catch (error) {
    console.error("Error fetching system resources:", error);
    res.status(500).json({ message: "Failed to fetch system resources" });
  }
});

// User Management
router.get("/users", requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;

    let query = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        roleId: users.roleId,
        tenantId: users.tenantId,
        status: users.status,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(tenants, eq(users.tenantId, tenants.id));

    // Apply filters
    const conditions = [];
    if (role && role !== "all") {
      conditions.push(eq(roles.name, role as string));
    }
    if (status && status !== "all") {
      conditions.push(eq(users.status, status as string));
    }
    if (search) {
      conditions.push(
        sql`(${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`})`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const userList = await query
      .orderBy(desc(users.lastLogin))
      .limit(100);

    // Enrich with role and tenant information
    const enrichedUsers = await Promise.all(
      userList.map(async (user) => {
        const role = user.roleId ? await db
          .select({ name: roles.name, level: roles.level })
          .from(roles)
          .where(eq(roles.id, user.roleId))
          .limit(1) : null;

        const tenant = user.tenantId ? await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, user.tenantId))
          .limit(1) : null;

        return {
          ...user,
          role: role?.[0]?.name || "No Role",
          roleLevel: role?.[0]?.level || 1,
          tenant: tenant?.[0]?.name || "No Tenant",
          department: "General", // Would be added to schema
          location: "Main Office" // Would be added to schema
        };
      })
    );

    res.json(enrichedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Role Management
router.get("/roles", requireAuth, requireRootAdmin, async (req, res) => {
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
        userCount: count(users.id)
      })
      .from(roles)
      .leftJoin(users, eq(users.roleId, roles.id))
      .groupBy(roles.id)
      .orderBy(desc(roles.level));

    res.json(rolesList);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Failed to fetch roles" });
  }
});

// Audit Logs
router.get("/audit-logs", requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        timestamp: auditLogs.timestamp
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);

    // Enrich with user information
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const user = log.userId ? await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, log.userId))
          .limit(1) : null;

        return {
          ...log,
          userName: user?.[0]?.name || "System",
          userEmail: user?.[0]?.email || "system@printyx.com"
        };
      })
    );

    res.json(enrichedLogs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

// Database Tables Information
router.get("/database-tables", requireAuth, requireRootAdmin, async (req, res) => {
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
    console.error("Error fetching database tables:", error);
    res.status(500).json({ message: "Failed to fetch database tables" });
  }
});

// Execute SQL Query (with safety restrictions)
router.post("/execute-query", requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: "Query is required" });
    }

    // Safety check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      return res.status(400).json({ 
        message: "Only SELECT queries are allowed for security reasons" 
      });
    }

    // Limit results to prevent memory issues
    const limitedQuery = query.includes('limit') ? query : `${query} LIMIT 1000`;

    const result = await db.execute(sql.raw(limitedQuery));
    
    res.json({
      success: true,
      rowCount: result.rows.length,
      data: result.rows,
      executionTime: Date.now() // Would be actual execution time
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Failed to execute query" 
    });
  }
});

export default router;