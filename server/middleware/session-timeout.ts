/**
 * Session inventory and per-tenant session configuration.
 *
 * THE ENFORCEMENT HALF OF THIS FILE WAS DELETED BY AUDIT-034, and what it lost
 * is worth stating so nobody rebuilds it by hand. `enforceSessionTimeout`,
 * `extendSessionOnActivity`, `initializeSession`, `updateSessionActivity`,
 * `isSessionExpired` and `getTimeUntilWarning` implemented an idle and absolute
 * session timeout that COULD NOT RUN, for three independent reasons:
 *
 *   1. `isSessionExpired` returned `{ expired: false }` whenever
 *      `session.sessionMetadata` was absent, and the only thing that set it was
 *      `initializeSession`, which had no callers anywhere in the tree. Mounting
 *      the middleware was therefore a complete no-op, not a pending rollout.
 *   2. Its guard was `req.session.userId`, which the product's real login never
 *      sets. The web app authenticates through Supabase GoTrue
 *      (`supabase.auth.signInWithPassword`); `req.session.userId` is written
 *      only by POST /api/auth/login and POST /api/auth/verify-email, and in
 *      production `/api/auth` resolves to an edge-function directory that does
 *      not exist.
 *   3. express-session already caps the cookie at 24h (`cookie.maxAge` in
 *      server/routes.ts), so the absolute half was duplicated by the cookie.
 *
 *   And had it ever fired, it cleared `connect.sid` while this app names its
 *   cookie `sid`, so an expired session would have kept its cookie.
 *
 * What remains is real and reachable: server/routes-session-management.ts
 * imports getActiveSessions, terminateSession, logoutOtherSessions and
 * getSessionConfig, and serves the session inventory from `security_sessions`.
 * getSessionConfig reads compliance_settings.session_timeout_minutes, which
 * exists; nothing writes it today (the admin edge function is its only writer
 * and has no caller), so it is the shipped default in practice.
 */

import { db } from '../db';
import { securitySessions } from '../../shared/security-schema';
import { eq, and, lt, ne } from 'drizzle-orm';
import { getComplianceSettings } from '../storage/security-storage';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('session-timeout');

// Default timeout settings (in milliseconds)
export const DEFAULT_SESSION_CONFIG = {
  // Idle timeout - session expires after inactivity
  idleTimeoutMinutes: 30,
  // Absolute timeout - session expires regardless of activity
  absoluteTimeoutHours: 12,
  // Warning before timeout
  warningBeforeTimeoutMinutes: 5,
  // Maximum concurrent sessions per user
  maxConcurrentSessions: 3,
  // Force re-authentication for sensitive operations
  sensitiveOperationTimeoutMinutes: 15,
  // Remember me session timeout
  rememberMeTimeoutDays: 30,
};

interface SessionTimeoutConfig {
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
  warningBeforeTimeoutMinutes: number;
  maxConcurrentSessions: number;
  sensitiveOperationTimeoutMinutes: number;
  rememberMeTimeoutDays: number;
}

/**
 * Get session timeout configuration for a tenant
 */
export async function getSessionConfig(tenantId?: string): Promise<SessionTimeoutConfig> {
  if (!tenantId) {
    return { ...DEFAULT_SESSION_CONFIG };
  }

  try {
    const settings = await getComplianceSettings(tenantId);
    if (settings) {
      return {
        idleTimeoutMinutes:
          settings.sessionTimeoutMinutes || DEFAULT_SESSION_CONFIG.idleTimeoutMinutes,
        absoluteTimeoutHours: DEFAULT_SESSION_CONFIG.absoluteTimeoutHours,
        warningBeforeTimeoutMinutes:
          settings.sessionWarningMinutes || DEFAULT_SESSION_CONFIG.warningBeforeTimeoutMinutes,
        maxConcurrentSessions:
          settings.maxConcurrentSessions || DEFAULT_SESSION_CONFIG.maxConcurrentSessions,
        sensitiveOperationTimeoutMinutes: DEFAULT_SESSION_CONFIG.sensitiveOperationTimeoutMinutes,
        rememberMeTimeoutDays: DEFAULT_SESSION_CONFIG.rememberMeTimeoutDays,
      };
    }
  } catch (error) {
    log.warn('Failed to fetch tenant session config:', error);
  }

  return { ...DEFAULT_SESSION_CONFIG };
}

/**
 * Revoke every OTHER active session for a user, and report how many.
 *
 * Two defects fixed by AUDIT-034 while retiring the rest of this file, both in
 * the one endpoint somebody reaches for after losing a laptop
 * (POST /api/sessions/revoke-all):
 *
 *   - It did not exclude the current session. `currentSessionId` was accepted
 *     and dropped under a comment claiming session ids could not easily be
 *     compared - `security_sessions.session_id` is a varchar holding exactly
 *     the value express hands you as `req.sessionID`. So "log out my other
 *     sessions" logged the caller out too.
 *   - It returned the literal `1` under a comment reading "Return count of
 *     affected sessions", and the route reports that straight back as
 *     `revokedCount`. One stolen session and nine read the same, and so did
 *     zero. A count nobody measured is worse here than none, because the number
 *     is the only confirmation the user gets that anything happened.
 *
 * `tenantId` was accepted and dropped as well. It narrows the write now; it was
 * never a cross-tenant leak, because the write is scoped to one user and a user
 * belongs to one tenant, but an accepted-and-ignored scope argument reads as a
 * filter that is there.
 */
export async function logoutOtherSessions(
  currentSessionId: string,
  userId: string,
  tenantId?: string,
): Promise<number> {
  try {
    const filters = [eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)];
    // An empty session id must not become `sessionId <> ''`, which would match
    // every row and revoke the caller's own session along with the rest.
    if (currentSessionId) filters.push(ne(securitySessions.sessionId, currentSessionId));
    if (tenantId) filters.push(eq(securitySessions.tenantId, tenantId));

    const revoked = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'logout_other_sessions',
      })
      .where(and(...filters))
      .returning({ id: securitySessions.id });

    log.info(`[SESSION] Revoked ${revoked.length} other session(s) for user ${userId}`);
    return revoked.length;
  } catch (error) {
    log.error('Failed to logout other sessions:', error);
    return 0;
  }
}

/**
 * Clean up expired sessions from database
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();

    // Same fabricated count as logoutOtherSessions had: this returned 1
    // whether it closed a thousand sessions or none.
    const closed = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: now,
        terminationReason: 'expired_cleanup',
      })
      .where(and(eq(securitySessions.isActive, true), lt(securitySessions.expiresAt, now)))
      .returning({ id: securitySessions.id });

    log.info(`[SESSION] Cleaned up ${closed.length} expired session(s)`);
    return closed.length;
  } catch (error) {
    log.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<
  Array<{
    id: string;
    deviceInfo: string;
    ipAddress: string;
    lastActivity: Date;
    createdAt: Date;
    isCurrent: boolean;
  }>
> {
  try {
    const sessions = await db
      .select()
      .from(securitySessions)
      .where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)));

    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.userAgent || 'Unknown device',
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: false, // Will be set by the caller based on current session ID
    }));
  } catch (error) {
    log.error('Failed to get active sessions:', error);
    return [];
  }
}

/**
 * Terminate a specific session
 */
export async function terminateSession(
  sessionId: string,
  userId: string,
  terminatedBy?: string,
): Promise<boolean> {
  try {
    await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'user_terminated',
        terminatedBy,
      })
      .where(and(eq(securitySessions.id, sessionId), eq(securitySessions.userId, userId)));

    return true;
  } catch (error) {
    log.error('Failed to terminate session:', error);
    return false;
  }
}

export default {
  getSessionConfig,
  logoutOtherSessions,
  cleanupExpiredSessions,
  getActiveSessions,
  terminateSession,
  DEFAULT_SESSION_CONFIG,
};
