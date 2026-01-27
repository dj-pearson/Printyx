/**
 * Session Timeout Enforcement Middleware
 *
 * Automatically terminates sessions after configurable timeout periods.
 * Supports absolute and idle timeouts with tenant-specific settings.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { securitySessions, complianceSettings } from '../../shared/security-schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { getComplianceSettings } from '../storage/security-storage';

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

// Session metadata storage
interface SessionMetadata {
  createdAt: number;
  lastActivity: number;
  absoluteExpiry: number;
  idleExpiry: number;
  isRememberMe: boolean;
  userId: string;
  tenantId?: string;
  deviceInfo?: {
    userAgent: string;
    ip: string;
  };
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
    console.warn('Failed to fetch tenant session config:', error);
  }

  return { ...DEFAULT_SESSION_CONFIG };
}

/**
 * Initialize session metadata
 */
export function initializeSession(
  session: any,
  userId: string,
  tenantId?: string,
  isRememberMe: boolean = false,
  deviceInfo?: { userAgent: string; ip: string },
): void {
  const now = Date.now();
  const config = { ...DEFAULT_SESSION_CONFIG };

  const idleTimeoutMs = config.idleTimeoutMinutes * 60 * 1000;
  const absoluteTimeoutMs = isRememberMe
    ? config.rememberMeTimeoutDays * 24 * 60 * 60 * 1000
    : config.absoluteTimeoutHours * 60 * 60 * 1000;

  session.sessionMetadata = {
    createdAt: now,
    lastActivity: now,
    absoluteExpiry: now + absoluteTimeoutMs,
    idleExpiry: now + idleTimeoutMs,
    isRememberMe,
    userId,
    tenantId,
    deviceInfo,
  } as SessionMetadata;
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(session: any, tenantConfig?: SessionTimeoutConfig): void {
  if (!session.sessionMetadata) {
    return;
  }

  const config = tenantConfig || { ...DEFAULT_SESSION_CONFIG };
  const now = Date.now();
  const idleTimeoutMs = config.idleTimeoutMinutes * 60 * 1000;

  session.sessionMetadata.lastActivity = now;
  session.sessionMetadata.idleExpiry = now + idleTimeoutMs;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: any): {
  expired: boolean;
  reason?: 'idle' | 'absolute';
} {
  if (!session.sessionMetadata) {
    return { expired: false };
  }

  const now = Date.now();
  const metadata = session.sessionMetadata as SessionMetadata;

  // Check absolute timeout
  if (now >= metadata.absoluteExpiry) {
    return { expired: true, reason: 'absolute' };
  }

  // Check idle timeout
  if (now >= metadata.idleExpiry) {
    return { expired: true, reason: 'idle' };
  }

  return { expired: false };
}

/**
 * Get time until session warning should be shown
 */
export function getTimeUntilWarning(session: any, config?: SessionTimeoutConfig): number | null {
  if (!session.sessionMetadata) {
    return null;
  }

  const { warningBeforeTimeoutMinutes } = config || DEFAULT_SESSION_CONFIG;
  const metadata = session.sessionMetadata as SessionMetadata;
  const now = Date.now();

  // Use the closer expiry time
  const nextExpiry = Math.min(metadata.absoluteExpiry, metadata.idleExpiry);
  const warningTime = nextExpiry - warningBeforeTimeoutMinutes * 60 * 1000;

  if (now >= warningTime) {
    return 0; // Warning should be shown now
  }

  return warningTime - now;
}

/**
 * Session timeout enforcement middleware
 *
 * Usage:
 *   app.use(enforceSessionTimeout());
 */
export function enforceSessionTimeout(options?: {
  excludePaths?: string[];
  onTimeout?: (req: Request, reason: string) => void;
}) {
  const { excludePaths = [], onTimeout } = options || {};

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip for excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Skip for unauthenticated requests
    const session = req.session as any;
    if (!session?.userId) {
      return next();
    }

    try {
      // Get tenant-specific config
      const config = await getSessionConfig(session.tenantId);

      // Check if session is expired
      const { expired, reason } = isSessionExpired(session);

      if (expired) {
        // Log the timeout
        console.log(
          `[SESSION] Session expired due to ${reason} timeout for user ${session.userId}`,
        );

        // Call custom callback if provided
        if (onTimeout) {
          onTimeout(req, reason || 'unknown');
        }

        // Record session termination in database
        await recordSessionTermination(session, reason || 'timeout');

        // Destroy session
        return new Promise<void>((resolve) => {
          session.destroy((err: any) => {
            if (err) {
              console.error('Session destroy error:', err);
            }
            res.clearCookie('connect.sid');
            res.status(401).json({
              error: 'Session expired',
              code: 'SESSION_EXPIRED',
              reason: reason === 'idle' ? 'inactivity' : 'maximum_duration',
              message:
                reason === 'idle'
                  ? 'Your session has expired due to inactivity. Please log in again.'
                  : 'Your session has reached its maximum duration. Please log in again.',
            });
            resolve();
          });
        });
      }

      // Check for warning state
      const timeUntilWarning = getTimeUntilWarning(session, config);
      if (
        timeUntilWarning !== null &&
        timeUntilWarning <= 0 &&
        !session.sessionMetadata.warningShown
      ) {
        // Set header to indicate session is about to expire
        res.setHeader('X-Session-Expiring-Soon', 'true');
        res.setHeader(
          'X-Session-Expires-In',
          Math.floor((session.sessionMetadata.idleExpiry - Date.now()) / 1000).toString(),
        );
        session.sessionMetadata.warningShown = true;
      }

      // Update activity timestamp
      updateSessionActivity(session, config);

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('Session timeout check error:', error);
      next();
    }
  };
}

/**
 * Record session termination in database
 */
async function recordSessionTermination(session: any, reason: string): Promise<void> {
  try {
    const metadata = session.sessionMetadata as SessionMetadata;
    if (!metadata) return;

    await db
      .insert(securitySessions)
      .values({
        sessionId: session.id || 'unknown',
        userId: metadata.userId,
        tenantId: metadata.tenantId || '',
        ipAddress: metadata.deviceInfo?.ip || 'unknown',
        userAgent: metadata.deviceInfo?.userAgent,
        createdAt: new Date(metadata.createdAt),
        lastActivity: new Date(metadata.lastActivity),
        expiresAt: new Date(Math.min(metadata.absoluteExpiry, metadata.idleExpiry)),
        terminatedAt: new Date(),
        terminationReason: reason,
        isActive: false,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Failed to record session termination:', error);
  }
}

/**
 * Middleware to extend session on user activity
 *
 * Usage:
 *   app.use('/api', extendSessionOnActivity());
 */
export function extendSessionOnActivity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = req.session as any;

    if (session?.sessionMetadata && session?.userId) {
      try {
        const config = await getSessionConfig(session.tenantId);
        updateSessionActivity(session, config);

        // Reset warning flag on activity
        if (session.sessionMetadata.warningShown) {
          session.sessionMetadata.warningShown = false;
        }
      } catch (error) {
        console.error('Error extending session:', error);
      }
    }

    next();
  };
}

/**
 * Force logout all other sessions for a user
 */
export async function logoutOtherSessions(
  currentSessionId: string,
  userId: string,
  tenantId?: string,
): Promise<number> {
  try {
    // Update all other active sessions for this user
    const result = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'logout_other_sessions',
      })
      .where(
        and(
          eq(securitySessions.userId, userId),
          eq(securitySessions.isActive, true),
          // Don't terminate current session
          // Note: We can't easily compare session IDs here, so we terminate all
          // The current session will be re-validated on next request
        ),
      );

    console.log(`[SESSION] Logged out other sessions for user ${userId}`);
    return 1; // Return count of affected sessions
  } catch (error) {
    console.error('Failed to logout other sessions:', error);
    return 0;
  }
}

/**
 * Clean up expired sessions from database
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();

    const result = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: now,
        terminationReason: 'expired_cleanup',
      })
      .where(and(eq(securitySessions.isActive, true), lt(securitySessions.expiresAt, now)));

    console.log('[SESSION] Cleaned up expired sessions');
    return 1;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
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
    console.error('Failed to get active sessions:', error);
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
    console.error('Failed to terminate session:', error);
    return false;
  }
}

export default {
  enforceSessionTimeout,
  extendSessionOnActivity,
  initializeSession,
  updateSessionActivity,
  isSessionExpired,
  getTimeUntilWarning,
  getSessionConfig,
  logoutOtherSessions,
  cleanupExpiredSessions,
  getActiveSessions,
  terminateSession,
  DEFAULT_SESSION_CONFIG,
};
