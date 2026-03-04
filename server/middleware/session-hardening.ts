/**
 * SEC-013: Session Security Hardening Middleware
 *
 * Provides device fingerprinting, session fingerprint validation,
 * session invalidation on role changes, and refresh token rotation
 * with replay detection.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { securitySessions } from '../../shared/security-schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('session-hardening');

// ============= TYPES =============

/** Extended request with session fingerprint tracking */
export interface SessionHardeningRequest extends Request {
  sessionFingerprintMismatch?: boolean;
  deviceFingerprint?: string;
}

/** Stored session fingerprint data */
export interface SessionFingerprintData {
  fingerprint: string;
  userAgent: string;
  acceptLanguage: string;
  createdAt: number;
}

/** Refresh token record stored in memory or persistent store */
export interface RefreshTokenRecord {
  token: string;
  familyId: string;
  userId: string;
  isUsed: boolean;
  createdAt: number;
  expiresAt: number;
}

// ============= IN-MEMORY STORES =============
// In production these would be backed by Redis or the database.

/** Map of sessionId -> SessionFingerprintData */
const sessionFingerprints = new Map<string, SessionFingerprintData>();

/** Map of token -> RefreshTokenRecord */
const refreshTokenStore = new Map<string, RefreshTokenRecord>();

/** Set of revoked token family IDs */
const revokedFamilies = new Set<string>();

/** Map of userId -> Set<sessionId> for session tracking */
const userSessions = new Map<string, Set<string>>();

// Export stores for testing
export const _stores = {
  sessionFingerprints,
  refreshTokenStore,
  revokedFamilies,
  userSessions,
};

// ============= DEVICE FINGERPRINTING =============

/**
 * Compute a device fingerprint hash from request headers.
 * Uses User-Agent and Accept-Language to create a stable identifier
 * for the device/browser making the request.
 */
export function deviceFingerprint(req: Request): string {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';

  const data = `${userAgent}|${acceptLanguage}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============= SESSION FINGERPRINT MIDDLEWARE =============

/**
 * Middleware that stores a device fingerprint with the session and
 * flags requests where the fingerprint changes mid-session.
 *
 * On first request for a session, stores the fingerprint.
 * On subsequent requests, compares and flags mismatches.
 */
export function sessionFingerprintMiddleware(
  req: SessionHardeningRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const fingerprint = deviceFingerprint(req);
    req.deviceFingerprint = fingerprint;
    req.sessionFingerprintMismatch = false;

    // Get session identifier from various sources
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return next();
    }

    const stored = sessionFingerprints.get(sessionId);

    if (!stored) {
      // First request for this session - store fingerprint
      sessionFingerprints.set(sessionId, {
        fingerprint,
        userAgent: req.headers['user-agent'] || '',
        acceptLanguage: req.headers['accept-language'] || '',
        createdAt: Date.now(),
      });

      log.debug('Session fingerprint stored', {
        sessionId: sessionId.substring(0, 8) + '...',
      });
    } else if (stored.fingerprint !== fingerprint) {
      // Fingerprint mismatch detected
      req.sessionFingerprintMismatch = true;

      log.warn('Session fingerprint mismatch detected', {
        sessionId: sessionId.substring(0, 8) + '...',
        originalUserAgent: stored.userAgent.substring(0, 50),
        currentUserAgent: (req.headers['user-agent'] || '').substring(0, 50),
      });
    }
  } catch (error) {
    log.error('Error in session fingerprint middleware', { error });
  }

  next();
}

/**
 * Extract a session identifier from the request.
 * Checks multiple sources in priority order.
 */
function getSessionId(req: Request): string | null {
  // Check for session ID in various locations
  if (req.headers['x-session-id']) {
    return req.headers['x-session-id'] as string;
  }

  // Check express-session
  if ((req as any).sessionID) {
    return (req as any).sessionID;
  }

  // Check for Supabase access token as session proxy
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Use first 32 chars of token as session identifier
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
  }

  return null;
}

// ============= SESSION INVALIDATION ON ROLE CHANGE =============

/**
 * Invalidate all active sessions for a user when their role changes.
 * This forces re-authentication so the user gets fresh tokens
 * with updated role claims.
 *
 * Should be called from role update endpoints.
 */
export async function invalidateSessionsOnRoleChange(userId: string): Promise<number> {
  log.info('Invalidating sessions due to role change', { userId });

  let invalidatedCount = 0;

  try {
    // Invalidate sessions in database
    const result = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'role_change',
      })
      .where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)));

    // Count from result if available
    invalidatedCount = (result as any)?.rowCount ?? 0;

    // Also clean up in-memory session fingerprints for this user
    const sessions = userSessions.get(userId);
    if (sessions) {
      for (const sessionId of sessions) {
        sessionFingerprints.delete(sessionId);
      }
      userSessions.delete(userId);
    }

    log.info('Sessions invalidated for role change', {
      userId,
      invalidatedCount,
    });
  } catch (error) {
    log.error('Failed to invalidate sessions on role change', {
      userId,
      error,
    });
    throw error;
  }

  return invalidatedCount;
}

/**
 * Track a session for a user (called when sessions are created).
 */
export function trackUserSession(userId: string, sessionId: string): void {
  let sessions = userSessions.get(userId);
  if (!sessions) {
    sessions = new Set();
    userSessions.set(userId, sessions);
  }
  sessions.add(sessionId);
}

// ============= REFRESH TOKEN ROTATION =============

/** Default token expiry: 7 days */
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a new refresh token as part of a rotation.
 * The old token is marked as used. If the old token was already used
 * (replay attack), the entire token family is revoked.
 *
 * @param oldToken - The current refresh token being rotated
 * @returns New token string, or null if the family was revoked
 */
export function rotateRefreshToken(oldToken: string): string | null {
  const oldRecord = refreshTokenStore.get(oldToken);

  if (!oldRecord) {
    log.warn('Attempted rotation of unknown token');
    return null;
  }

  // Check if the token family has been revoked
  if (revokedFamilies.has(oldRecord.familyId)) {
    log.warn('Attempted use of token from revoked family', {
      familyId: oldRecord.familyId,
      userId: oldRecord.userId,
    });
    return null;
  }

  // Detect replay: if the old token was already used, revoke entire family
  if (oldRecord.isUsed) {
    log.warn('Refresh token replay detected - revoking token family', {
      familyId: oldRecord.familyId,
      userId: oldRecord.userId,
    });

    revokedFamilies.add(oldRecord.familyId);

    // Revoke all tokens in this family
    for (const [token, record] of refreshTokenStore.entries()) {
      if (record.familyId === oldRecord.familyId) {
        refreshTokenStore.delete(token);
      }
    }

    return null;
  }

  // Mark old token as used
  oldRecord.isUsed = true;

  // Generate new token
  const newToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const newRecord: RefreshTokenRecord = {
    token: newToken,
    familyId: oldRecord.familyId,
    userId: oldRecord.userId,
    isUsed: false,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  refreshTokenStore.set(newToken, newRecord);

  log.debug('Refresh token rotated', {
    familyId: oldRecord.familyId,
    userId: oldRecord.userId,
  });

  return newToken;
}

/**
 * Create an initial refresh token for a new session (starts a token family).
 */
export function createRefreshToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const familyId = crypto.randomUUID();
  const now = Date.now();

  const record: RefreshTokenRecord = {
    token,
    familyId,
    userId,
    isUsed: false,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  refreshTokenStore.set(token, record);

  log.debug('New refresh token family created', {
    familyId,
    userId,
  });

  return token;
}

/**
 * Check if a refresh token is valid (exists, not expired, family not revoked).
 */
export function isRefreshTokenValid(token: string): boolean {
  const record = refreshTokenStore.get(token);
  if (!record) return false;
  if (revokedFamilies.has(record.familyId)) return false;
  if (record.isUsed) return false;
  if (Date.now() > record.expiresAt) return false;
  return true;
}

/**
 * Get session metadata including device info for a session.
 */
export function getSessionMetadata(sessionId: string): SessionFingerprintData | undefined {
  return sessionFingerprints.get(sessionId);
}
