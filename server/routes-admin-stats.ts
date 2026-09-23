/**
 * Admin Stats Routes
 *
 * Provides platform-wide statistics endpoints for the admin dashboard:
 * - GET /api/admin/security/metrics - Security score, sessions, failed logins, MFA adoption
 *
 * SECURITY: All routes require authentication and platform admin authorization.
 */

import type { Express, Request, Response } from 'express';
import { db } from './db';
import { users, userSettings } from '@shared/schema';
import { securitySessions, auditLogs } from '@shared/security-schema';
import { loginAttempts } from '@shared/auth-schema';
import { eq, count, sql, gte, sum } from 'drizzle-orm';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { isPlatformAdmin } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-admin-stats');

export function registerAdminStatsRoutes(app: Express) {
  // GET /api/admin/tenant-stats deleted (round 196): its only caller,
  // TenantManagement, reads /api/root-admin/overview, which production serves.

  // GET /api/admin/user-stats moved to supabase/functions/admin (round 187):
  // /api/admin/user-stats is proxied now, so a handler here would never run.

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
