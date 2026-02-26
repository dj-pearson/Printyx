/**
 * Admin Stats Routes
 *
 * Provides platform-wide statistics endpoints for the admin dashboard:
 * - GET /api/admin/tenant-stats - Tenant counts, user totals, revenue, conversion
 * - GET /api/admin/user-stats - User breakdown (active, suspended, admin)
 * - GET /api/admin/security/metrics - Security score, sessions, failed logins, MFA adoption
 *
 * SECURITY: All routes require authentication and platform admin authorization.
 */

import type { Express, Request, Response } from 'express';
import { db } from './db';
import { users, tenants, userSettings, tenantSubscriptions } from '@shared/schema';
import { securitySessions, auditLogs } from '@shared/security-schema';
import { loginAttempts } from '@shared/auth-schema';
import { eq, count, and, sql, gte, sum } from 'drizzle-orm';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { isPlatformAdmin } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-admin-stats');

export function registerAdminStatsRoutes(app: Express) {
  // ──────────────────────────────────────────────────────────────────────
  // GET /api/admin/tenant-stats
  // Returns aggregate tenant, user, revenue, and conversion stats
  // ──────────────────────────────────────────────────────────────────────
  app.get('/api/admin/tenant-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      // Total tenants
      const [totalTenantsResult] = await db.select({ count: count() }).from(tenants);
      const totalTenants = totalTenantsResult?.count ?? 0;

      // Tenants created this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [newTenantsResult] = await db
        .select({ count: count() })
        .from(tenants)
        .where(gte(tenants.createdAt, startOfMonth));
      const newTenantsThisMonth = newTenantsResult?.count ?? 0;

      // Total users (across all tenants)
      const [totalUsersResult] = await db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult?.count ?? 0;

      // Active users
      const [activeUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));
      const activeUsers = activeUsersResult?.count ?? 0;

      // Users created this month
      const [newUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, startOfMonth));
      const newUsersThisMonth = newUsersResult?.count ?? 0;

      // Total revenue from active subscriptions
      const [revenueResult] = await db
        .select({ total: sum(tenantSubscriptions.amount) })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.status, 'active'));
      const totalRevenue = parseFloat(revenueResult?.total ?? '0');

      // Previous month revenue for growth comparison
      const startOfLastMonth = new Date(startOfMonth);
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
      const endOfLastMonth = new Date(startOfMonth);
      endOfLastMonth.setMilliseconds(-1);

      const [lastMonthRevenueResult] = await db
        .select({ total: sum(tenantSubscriptions.amount) })
        .from(tenantSubscriptions)
        .where(
          and(
            eq(tenantSubscriptions.status, 'active'),
            gte(tenantSubscriptions.createdAt, startOfLastMonth),
          ),
        );
      const lastMonthRevenue = parseFloat(lastMonthRevenueResult?.total ?? '0');
      const revenueGrowthPct =
        lastMonthRevenue > 0
          ? (((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
          : '0.0';

      // Conversion rate: leads that became customers (closed_won / total leads)
      const [totalLeadsResult] = await db.execute(
        sql`SELECT COUNT(*) as count FROM business_records WHERE record_type = 'lead'`,
      );
      const totalLeads = Number((totalLeadsResult as any)?.count ?? 0);

      const [convertedLeadsResult] = await db.execute(
        sql`SELECT COUNT(*) as count FROM business_records WHERE record_type = 'customer' OR status = 'closed_won'`,
      );
      const convertedLeads = Number((convertedLeadsResult as any)?.count ?? 0);

      const conversionRate =
        totalLeads + convertedLeads > 0
          ? ((convertedLeads / (totalLeads + convertedLeads)) * 100).toFixed(0)
          : '0';

      // Format revenue as currency string
      const formattedRevenue = `$${totalRevenue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;

      res.json({
        totalTenants,
        tenantGrowth: `+${newTenantsThisMonth} this month`,
        activeUsers,
        userGrowth: `+${newUsersThisMonth} this month`,
        totalRevenue: formattedRevenue,
        revenueGrowth: `+${revenueGrowthPct}% vs last month`,
        conversionRate: `${conversionRate}%`,
        conversionTrend: `+0% vs last month`, // Placeholder until historical tracking is implemented
      });
    } catch (error) {
      log.error('Failed to fetch tenant stats:', error);
      res.status(500).json({ message: 'Failed to fetch tenant stats' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /api/admin/user-stats
  // Returns detailed user breakdown stats
  // ──────────────────────────────────────────────────────────────────────
  app.get('/api/admin/user-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      // Total users
      const [totalResult] = await db.select({ count: count() }).from(users);
      const totalUsers = totalResult?.count ?? 0;

      // Users created this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [newUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, startOfMonth));
      const newUsersThisMonth = newUsersResult?.count ?? 0;

      // Active users (isActive = true)
      const [activeResult] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));
      const activeUsers = activeResult?.count ?? 0;

      // Suspended users (isActive = false)
      const [suspendedResult] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, false));
      const suspendedUsers = suspendedResult?.count ?? 0;

      // Admin users (role contains 'admin' or isPlatformUser = true)
      const [adminResult] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`(${users.role} ILIKE '%admin%' OR ${users.isPlatformUser} = true)`);
      const adminUsers = adminResult?.count ?? 0;

      // Calculate rates
      const activeRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0.0';
      const suspendedRate =
        totalUsers > 0 ? ((suspendedUsers / totalUsers) * 100).toFixed(1) : '0.0';
      const adminPercentage = totalUsers > 0 ? ((adminUsers / totalUsers) * 100).toFixed(1) : '0.0';

      res.json({
        totalUsers,
        userGrowth: `+${newUsersThisMonth} this month`,
        activeUsers,
        activeRate: `${activeRate}% active`,
        suspendedUsers,
        suspendedRate: `${suspendedRate}% of total`,
        adminUsers,
        adminPercentage: `${adminPercentage}% of total`,
      });
    } catch (error) {
      log.error('Failed to fetch user stats:', error);
      res.status(500).json({ message: 'Failed to fetch user stats' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /api/admin/security/metrics
  // Returns security posture metrics
  // ──────────────────────────────────────────────────────────────────────
  app.get('/api/admin/security/metrics', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      // Active sessions count
      let activeSessions = 0;
      try {
        const [sessionsResult] = await db
          .select({ count: count() })
          .from(securitySessions)
          .where(eq(securitySessions.isActive, true));
        activeSessions = sessionsResult?.count ?? 0;
      } catch {
        // Table may not exist yet; default to 0
        log.warn('security_sessions table not available, defaulting activeSessions to 0');
      }

      // Failed login attempts in the last 24 hours
      let failedLogins = 0;
      try {
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const [failedResult] = await db
          .select({ total: sum(loginAttempts.attemptCount) })
          .from(loginAttempts)
          .where(gte(loginAttempts.lastAttemptAt, oneDayAgo));
        failedLogins = Number(failedResult?.total ?? 0);
      } catch {
        // Table may not exist yet; default to 0
        log.warn('login_attempts table not available, defaulting failedLogins to 0');
      }

      // MFA adoption rate: users with 2FA enabled / total users
      let mfaAdoptionPct = '0';
      try {
        const [totalUsersResult] = await db.select({ count: count() }).from(users);
        const totalUsers = totalUsersResult?.count ?? 0;

        const [mfaUsersResult] = await db
          .select({ count: count() })
          .from(userSettings)
          .where(eq(userSettings.twoFactorEnabled, true));
        const mfaUsers = mfaUsersResult?.count ?? 0;

        mfaAdoptionPct = totalUsers > 0 ? ((mfaUsers / totalUsers) * 100).toFixed(0) : '0';
      } catch {
        log.warn('user_settings table not available for MFA stats, defaulting to 0');
      }

      // Last audit log timestamp
      let lastAudit = 'N/A';
      try {
        const [latestAudit] = await db
          .select({ timestamp: auditLogs.timestamp })
          .from(auditLogs)
          .orderBy(sql`${auditLogs.timestamp} DESC`)
          .limit(1);
        if (latestAudit?.timestamp) {
          lastAudit = latestAudit.timestamp.toISOString().split('T')[0];
        }
      } catch {
        log.warn('audit_logs table not available, defaulting lastAudit to N/A');
      }

      // Compute a simple security score (0-100):
      //   - Base: 50
      //   - +20 if MFA adoption > 50%
      //   - +10 if MFA adoption > 25%
      //   - +15 if failed logins < 10 in 24h
      //   - +5  if failed logins < 50 in 24h
      //   - +10 if audit logging is active (lastAudit != N/A)
      let securityScore = 50;
      const mfaPct = parseInt(mfaAdoptionPct, 10);
      if (mfaPct > 50) {
        securityScore += 20;
      } else if (mfaPct > 25) {
        securityScore += 10;
      }
      if (failedLogins < 10) {
        securityScore += 15;
      } else if (failedLogins < 50) {
        securityScore += 5;
      }
      if (lastAudit !== 'N/A') {
        securityScore += 10;
      }
      // Cap at 100
      securityScore = Math.min(securityScore, 100);

      // Determine threat level from score
      let threatLevel: string;
      if (securityScore >= 80) {
        threatLevel = 'Low';
      } else if (securityScore >= 60) {
        threatLevel = 'Medium';
      } else {
        threatLevel = 'High';
      }

      res.json({
        securityScore,
        threatLevel,
        activeSessions,
        failedLogins,
        mfaAdoption: `${mfaAdoptionPct}%`,
        lastAudit,
      });
    } catch (error) {
      log.error('Failed to fetch security metrics:', error);
      res.status(500).json({ message: 'Failed to fetch security metrics' });
    }
  });

  log.info('Admin stats routes registered');
}
