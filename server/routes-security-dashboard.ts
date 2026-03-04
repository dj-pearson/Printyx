import { Router, type Express } from 'express';
import { db } from './db';
import { auditLogs, users } from '../shared/schema';
import { loginAttempts } from '../shared/auth-schema';
import { eq, desc, sql, and, gte, count } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-security-dashboard');
const router = Router();

/**
 * SEC-011: Security Event Monitoring Dashboard API
 * All endpoints require platform admin access (enforced at registration)
 */

/**
 * GET /api/security/overview
 * Aggregated security stats for the dashboard
 */
router.get('/overview', async (_req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Failed login attempts in last 24 hours
    const [failedLogins] = await db
      .select({ count: count() })
      .from(loginAttempts)
      .where(gte(loginAttempts.lastAttemptAt, last24h));

    // Currently locked accounts
    const lockedAccounts = await db
      .select({ count: count() })
      .from(loginAttempts)
      .where(
        sql`${loginAttempts.lockedUntil} IS NOT NULL AND (${loginAttempts.lockedUntil} > NOW() OR ${loginAttempts.lockedUntil} = '1970-01-01T00:00:00.000Z'::timestamp)`,
      );

    // Audit events in last hour
    const [recentAuditEvents] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, lastHour));

    // Security events (auth-related) in last 24h
    const securityEvents = await db
      .select({
        action: auditLogs.action,
        count: count(),
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, last24h),
          sql`${auditLogs.action} IN ('login_failure', 'account_locked', 'account_unlocked', 'permission_denied', 'admin_bypass', 'password_change', 'mfa_enable', 'mfa_disable')`,
        ),
      )
      .groupBy(auditLogs.action);

    res.json({
      overview: {
        failedLogins24h: failedLogins?.count ?? 0,
        lockedAccounts: lockedAccounts[0]?.count ?? 0,
        auditEventsLastHour: recentAuditEvents?.count ?? 0,
        securityEventBreakdown: securityEvents,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    log.error('Error fetching security overview:', error);
    res.status(500).json({ message: 'Failed to fetch security overview' });
  }
});

/**
 * GET /api/security/events
 * Paginated security events
 */
router.get('/events', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const action = req.query.action as string | undefined;
    const since = req.query.since as string | undefined;

    const conditions = [];
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }
    if (since) {
      conditions.push(gte(auditLogs.createdAt, new Date(since)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const events = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        userId: auditLogs.userId,
        tenantId: auditLogs.tenantId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    res.json({
      data: events,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    log.error('Error fetching security events:', error);
    res.status(500).json({ message: 'Failed to fetch security events' });
  }
});

/**
 * GET /api/security/failed-logins
 * Recent failed login attempts with details
 */
router.get('/failed-logins', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);

    const attempts = await db
      .select({
        id: loginAttempts.id,
        email: loginAttempts.email,
        attemptCount: loginAttempts.attemptCount,
        lastAttemptAt: loginAttempts.lastAttemptAt,
        lockedUntil: loginAttempts.lockedUntil,
        lastIpAddress: loginAttempts.lastIpAddress,
      })
      .from(loginAttempts)
      .where(sql`${loginAttempts.attemptCount} > 0`)
      .orderBy(desc(loginAttempts.lastAttemptAt))
      .limit(limit);

    const enriched = attempts.map((a) => ({
      ...a,
      isLocked: a.lockedUntil
        ? a.lockedUntil.getTime() === 0 || a.lockedUntil > new Date()
        : false,
      lockType: a.lockedUntil
        ? a.lockedUntil.getTime() === 0
          ? 'permanent'
          : a.lockedUntil > new Date()
            ? 'temporary'
            : 'expired'
        : 'none',
    }));

    res.json({ data: enriched, count: enriched.length });
  } catch (error) {
    log.error('Error fetching failed logins:', error);
    res.status(500).json({ message: 'Failed to fetch failed login data' });
  }
});

/**
 * GET /api/security/threats/active
 * Currently active threat scores (placeholder - integrates with SEC-008)
 */
router.get('/threats/active', async (_req, res) => {
  try {
    // Integration point for threat-detection-service from SEC-008
    // Returns empty for now, will be populated when threat detection service is active
    let activeThreats: Array<{ ip: string; score: number; signals: Record<string, number> }> = [];
    try {
      const { getActiveThreats } = await import('./services/threat-detection-service');
      activeThreats = getActiveThreats();
    } catch {
      // Threat detection service may not be loaded yet
    }

    res.json({ data: activeThreats, count: activeThreats.length });
  } catch (error) {
    log.error('Error fetching active threats:', error);
    res.status(500).json({ message: 'Failed to fetch active threats' });
  }
});

export function registerSecurityDashboardRoutes(app: Express) {
  // All security dashboard routes require platform admin access
  app.use('/api/security', (req, res, next) => {
    // Check for platform admin via auth helpers
    const user = (req as any).supabaseUser || (req as any).user;
    const roleLevel = user?.roleLevel || user?.role?.level || 0;
    const isPlatformAdmin =
      user?.isPlatformUser ||
      roleLevel >= 8 ||
      user?.hasAllPermissions;

    if (!isPlatformAdmin) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }
    next();
  }, router);

  log.info('Security dashboard routes registered');
}

export default router;
