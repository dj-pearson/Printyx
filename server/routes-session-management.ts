/**
 * US-041: Session Management Routes
 *
 * Provides endpoints for viewing, revoking, and managing user sessions
 * with concurrent session control. Enforces a maximum number of concurrent
 * sessions per user, evicting the oldest when the limit is exceeded.
 */

import type { Express, Request, Response } from 'express';
import { createModuleLogger } from './lib/logger';
import { requireAuth } from './replitAuth';
import { getUserId, getTenantId, isPlatformAdmin } from './utils/auth-helpers';
import {
  getActiveSessions,
  terminateSession,
  logoutOtherSessions,
  getSessionConfig,
} from './middleware/session-timeout';
import { db } from './db';
import { securitySessions } from '../shared/security-schema';
import { and, eq, asc } from 'drizzle-orm';

const log = createModuleLogger('session-management');

/**
 * Maximum number of concurrent sessions allowed per user.
 * When exceeded during session retrieval, the oldest sessions
 * beyond this limit are automatically marked for eviction.
 */
export const MAX_CONCURRENT_SESSIONS = 5;

/**
 * Evict the oldest sessions when a user exceeds the concurrent session limit.
 * Returns the IDs of sessions that were terminated.
 */
async function evictExcessSessions(userId: string, maxSessions: number): Promise<string[]> {
  try {
    // Fetch all active sessions ordered by creation time (oldest first)
    const activeSessions = await db
      .select({ id: securitySessions.id, createdAt: securitySessions.createdAt })
      .from(securitySessions)
      .where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)))
      .orderBy(asc(securitySessions.createdAt));

    if (activeSessions.length <= maxSessions) {
      return [];
    }

    // Determine how many sessions to evict (oldest ones beyond the limit)
    const sessionsToEvict = activeSessions.slice(0, activeSessions.length - maxSessions);
    const evictedIds: string[] = [];

    for (const session of sessionsToEvict) {
      await db
        .update(securitySessions)
        .set({
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: 'max_sessions_exceeded',
        })
        .where(eq(securitySessions.id, session.id));

      evictedIds.push(session.id);
    }

    if (evictedIds.length > 0) {
      log.info(
        `[SESSION] Evicted ${evictedIds.length} oldest session(s) for user ${userId} (limit: ${maxSessions})`,
      );
    }

    return evictedIds;
  } catch (error) {
    log.error('Failed to evict excess sessions:', error);
    return [];
  }
}

export function registerSessionManagementRoutes(app: Express) {
  // ──────────────────────────────────────────────────────────────────────
  // GET /api/sessions - List active sessions for the current user
  // ──────────────────────────────────────────────────────────────────────
  app.get('/api/sessions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const tenantId = getTenantId(req);

      // Resolve the effective max concurrent sessions limit.
      // Tenant-specific config may override the global default.
      const tenantConfig = await getSessionConfig(tenantId);
      const maxSessions = Math.min(
        tenantConfig.maxConcurrentSessions || MAX_CONCURRENT_SESSIONS,
        MAX_CONCURRENT_SESSIONS,
      );

      // Evict oldest sessions if the user exceeds the limit
      const evictedIds = await evictExcessSessions(userId, maxSessions);

      // Fetch remaining active sessions
      const sessions = await getActiveSessions(userId);

      // Mark the current session so the client knows which one it is
      const currentSessionId = (req as any).sessionID;
      const enrichedSessions = sessions.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId,
      }));

      return res.json({
        sessions: enrichedSessions,
        maxConcurrentSessions: maxSessions,
        evictedSessionIds: evictedIds,
      });
    } catch (error) {
      log.error('Failed to list sessions', { error });
      return res.status(500).json({ message: 'Failed to retrieve sessions' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE /api/sessions/:id - Revoke a specific session
  // ──────────────────────────────────────────────────────────────────────
  app.delete('/api/sessions/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const sessionId = req.params.id;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      // Prevent users from terminating their own current session via this endpoint
      const currentSessionId = (req as any).sessionID;
      if (sessionId === currentSessionId) {
        return res.status(400).json({
          message: 'Cannot revoke your current session. Use the logout endpoint instead.',
        });
      }

      const success = await terminateSession(sessionId, userId, userId);

      if (success) {
        log.info(`[SESSION] User ${userId} revoked session ${sessionId}`);
        return res.json({ message: 'Session revoked successfully' });
      }

      return res.status(404).json({ message: 'Session not found or already terminated' });
    } catch (error) {
      log.error('Failed to revoke session', { error });
      return res.status(500).json({ message: 'Failed to revoke session' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /api/sessions/revoke-all - Revoke all sessions except current
  // ──────────────────────────────────────────────────────────────────────
  app.post('/api/sessions/revoke-all', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const tenantId = getTenantId(req);
      const currentSessionId = (req as any).sessionID || '';

      const revokedCount = await logoutOtherSessions(currentSessionId, userId, tenantId);

      log.info(`[SESSION] User ${userId} revoked all other sessions (count: ${revokedCount})`);
      return res.json({
        message: 'All other sessions have been revoked',
        revokedCount,
      });
    } catch (error) {
      log.error('Failed to revoke all sessions', { error });
      return res.status(500).json({ message: 'Failed to revoke sessions' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /api/admin/sessions/:userId - Admin: view sessions for any user
  // ──────────────────────────────────────────────────────────────────────
  app.get('/api/admin/sessions/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const requesterId = getUserId(req);
      if (!requesterId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Only platform admins may view another user's sessions
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      const targetUserId = req.params.userId;
      if (!targetUserId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const sessions = await getActiveSessions(targetUserId);

      log.info(
        `[SESSION] Admin ${requesterId} viewed sessions for user ${targetUserId} (${sessions.length} active)`,
      );

      return res.json({
        userId: targetUserId,
        sessions,
        totalActive: sessions.length,
      });
    } catch (error) {
      log.error('Failed to retrieve admin sessions', { error });
      return res.status(500).json({ message: 'Failed to retrieve sessions' });
    }
  });

  log.info('Session management routes registered');
}

export default registerSessionManagementRoutes;
