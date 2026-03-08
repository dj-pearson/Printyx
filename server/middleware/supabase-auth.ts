/**
 * Supabase JWT Authentication Middleware
 *
 * Validates Supabase Auth JWTs and extracts user/tenant context.
 * This replaces session-based authentication for API requests.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as jose from 'jose';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('supabase-auth');

// ─── User Role Cache (in-memory LRU) ────────────────────────────────────────
// Caches DB-fetched user role data to avoid 2 DB queries per authenticated request.
// TTL: 5 minutes. Max entries: 1000 (oldest evicted when full).

const USER_ROLE_CACHE_TTL = 300_000; // 5 minutes in ms
const USER_ROLE_CACHE_MAX = 1000;

interface UserRoleCacheEntry {
  data: {
    tenantId?: string | null;
    roleId?: string | null;
    teamId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isPlatformUser?: boolean;
    roleLevel?: number;
    roleString?: string | null;
  };
  expiresAt: number;
}

const userRoleCache = new Map<string, UserRoleCacheEntry>();

/**
 * Evict the oldest entry from the cache when it exceeds max size.
 * Map iteration order is insertion order, so the first key is the oldest.
 */
function evictOldestCacheEntry(): void {
  if (userRoleCache.size >= USER_ROLE_CACHE_MAX) {
    const oldestKey = userRoleCache.keys().next().value;
    if (oldestKey !== undefined) {
      userRoleCache.delete(oldestKey);
    }
  }
}

/**
 * Invalidate cached role data for a specific user.
 * Call this when a user's role or permissions are updated.
 */
export function invalidateUserRoleCache(userId: string): void {
  const deleted = userRoleCache.delete(userId);
  if (deleted) {
    log.debug(`[Auth Cache] Invalidated cache for user ${userId}`);
  }
}

/**
 * Clear the entire user role cache.
 * Useful for testing or bulk role changes.
 */
export function clearUserRoleCache(): void {
  const size = userRoleCache.size;
  userRoleCache.clear();
  log.debug(`[Auth Cache] Cleared entire cache (${size} entries)`);
}

// Extend Express Request to include Supabase user data
declare global {
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseUser;
    }
  }
}

export interface SupabaseUser {
  id: string;
  email: string;
  tenantId?: string;
  roleId?: string;
  roleLevel?: number;
  teamId?: string;
  accessScope?: string;
  isPlatformUser?: boolean;
  firstName?: string;
  lastName?: string;
  exp?: number;
  iat?: number;
}

interface JWTPayload {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  aud?: string;
  role?: string;
  app_metadata?: {
    tenantId?: string;
    roleId?: string;
    roleLevel?: number;
    teamId?: string;
    accessScope?: string;
    isPlatformUser?: boolean;
  };
  user_metadata?: {
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
  };
}

// Cache the JWT secret as a Uint8Array for jose
let jwtSecretKey: Uint8Array | null = null;
let jwtSecretMissing = false;

/**
 * Check if JWT secret is configured
 */
export function isJwtConfigured(): boolean {
  return !!process.env.SUPABASE_JWT_SECRET;
}

/**
 * Get the JWT secret, with graceful error handling
 * Returns null if secret is not configured (instead of throwing)
 */
function getJwtSecret(): Uint8Array | null {
  if (jwtSecretKey) {
    return jwtSecretKey;
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Log warning only once to avoid log spam
    if (!jwtSecretMissing) {
      jwtSecretMissing = true;
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        log.error(
          '[Auth] CRITICAL: SUPABASE_JWT_SECRET is not set. JWT authentication will not work!',
        );
        log.error('[Auth] Please set SUPABASE_JWT_SECRET in your environment variables.');
      } else {
        log.warn('[Auth] SUPABASE_JWT_SECRET is not set. JWT authentication is disabled.');
        log.warn('[Auth] Set SUPABASE_JWT_SECRET to enable Supabase JWT authentication.');
      }
    }
    return null;
  }

  jwtSecretKey = new TextEncoder().encode(secret);
  return jwtSecretKey;
}

/**
 * Extract JWT from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Custom error for JWT configuration issues
 */
class JwtConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtConfigurationError';
  }
}

/**
 * Verify and decode Supabase JWT
 * Throws JwtConfigurationError if JWT secret is not configured
 */
async function verifySupabaseJWT(token: string): Promise<JWTPayload> {
  const secret = getJwtSecret();

  if (!secret) {
    throw new JwtConfigurationError(
      'JWT verification failed: SUPABASE_JWT_SECRET is not configured',
    );
  }

  const { payload } = await jose.jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  return payload as unknown as JWTPayload;
}

/**
 * Transform JWT payload to SupabaseUser object
 */
function transformPayloadToUser(payload: JWTPayload): SupabaseUser {
  const appMetadata = payload.app_metadata || {};
  const userMetadata = payload.user_metadata || {};

  return {
    id: payload.sub,
    email: payload.email || '',
    tenantId: appMetadata.tenantId,
    roleId: appMetadata.roleId,
    roleLevel: appMetadata.roleLevel,
    teamId: appMetadata.teamId,
    accessScope: appMetadata.accessScope || 'own',
    isPlatformUser: appMetadata.isPlatformUser || false,
    firstName: userMetadata.firstName || userMetadata.firstName,
    lastName: userMetadata.lastName || userMetadata.lastName,
    exp: payload.exp,
    iat: payload.iat,
  };
}

/**
 * Middleware to authenticate requests using Supabase JWT
 *
 * Sets req.supabaseUser if valid JWT is present.
 * Does NOT reject requests without JWT - use requireSupabaseAuth for that.
 */
export const authenticateSupabaseJWT: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token present - continue without user context
      return next();
    }

    const payload = await verifySupabaseJWT(token);
    const supabaseUser = transformPayloadToUser(payload);

    // Fetch user role data — check in-memory cache first to avoid DB lookups
    const now = Date.now();
    const cached = userRoleCache.get(supabaseUser.id);

    if (cached && cached.expiresAt > now) {
      // Cache hit — apply cached role data to supabaseUser
      log.debug(`[Auth Cache] HIT for user ${supabaseUser.id}`);
      const c = cached.data;
      supabaseUser.tenantId = c.tenantId || supabaseUser.tenantId;
      supabaseUser.roleId = c.roleId || supabaseUser.roleId;
      supabaseUser.teamId = c.teamId || supabaseUser.teamId;
      supabaseUser.firstName = c.firstName || supabaseUser.firstName;
      supabaseUser.lastName = c.lastName || supabaseUser.lastName;
      if (c.isPlatformUser !== undefined) {
        supabaseUser.isPlatformUser = c.isPlatformUser;
      }
      if (c.roleLevel !== undefined) {
        supabaseUser.roleLevel = c.roleLevel;
      }
      if (c.roleString) {
        log.info(
          `[Auth] User ${supabaseUser.email} has role '${c.roleString}', isPlatformUser: ${supabaseUser.isPlatformUser} (cached)`,
        );
      }
    } else {
      // Cache miss or expired — perform DB lookups
      if (cached) {
        // Expired entry — clean it up
        userRoleCache.delete(supabaseUser.id);
      }
      log.debug(`[Auth Cache] MISS for user ${supabaseUser.id}`);

      try {
        const { db } = await import('../db');
        const { users, roles } = await import('../../shared/schema');
        const { eq } = await import('drizzle-orm');

        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.id, supabaseUser.id))
          .limit(1);

        if (userRecord) {
          // Build the cache entry as we process
          const cacheData: UserRoleCacheEntry['data'] = {
            tenantId: userRecord.tenantId,
            roleId: userRecord.roleId,
            teamId: userRecord.teamId,
            firstName: userRecord.firstName,
            lastName: userRecord.lastName,
            isPlatformUser: undefined,
            roleLevel: undefined,
            roleString: null,
          };

          // Check for string role column (legacy)
          const roleString = (userRecord as any).role;

          if (roleString) {
            const roleLowerCase = roleString.toLowerCase();

            // Detect if user is platform admin based on role string
            const isPlatformAdmin =
              roleLowerCase === 'admin' ||
              roleLowerCase === 'root_admin' ||
              roleLowerCase === 'platform_admin' ||
              roleLowerCase === 'company_admin' ||
              roleLowerCase === 'system_admin';

            // Override isPlatformUser based on role
            supabaseUser.isPlatformUser = isPlatformAdmin || userRecord.isPlatformUser || false;
            cacheData.isPlatformUser = supabaseUser.isPlatformUser;
            cacheData.roleString = roleString;

            log.info(
              `[Auth] User ${supabaseUser.email} has role '${roleString}', isPlatformUser: ${supabaseUser.isPlatformUser}`,
            );
          }

          // Update other fields from database
          supabaseUser.tenantId = userRecord.tenantId || supabaseUser.tenantId;
          supabaseUser.roleId = userRecord.roleId || supabaseUser.roleId;
          supabaseUser.teamId = userRecord.teamId || supabaseUser.teamId;
          supabaseUser.firstName = userRecord.firstName || supabaseUser.firstName;
          supabaseUser.lastName = userRecord.lastName || supabaseUser.lastName;

          // Fetch role level if user has a roleId
          if (userRecord.roleId) {
            try {
              const [roleRecord] = await db
                .select({ level: roles.level })
                .from(roles)
                .where(eq(roles.id, userRecord.roleId))
                .limit(1);

              if (roleRecord) {
                supabaseUser.roleLevel = roleRecord.level;
                cacheData.roleLevel = roleRecord.level;
                // Also update isPlatformUser based on role level (8 = platform admin)
                if (roleRecord.level >= 8) {
                  supabaseUser.isPlatformUser = true;
                  cacheData.isPlatformUser = true;
                }
              }
            } catch (roleError) {
              log.warn('[Auth] Could not fetch role level:', roleError);
            }
          }

          // Store in cache (evict oldest if at capacity)
          evictOldestCacheEntry();
          userRoleCache.set(supabaseUser.id, {
            data: cacheData,
            expiresAt: now + USER_ROLE_CACHE_TTL,
          });
          log.debug(
            `[Auth Cache] Stored cache for user ${supabaseUser.id} (cache size: ${userRoleCache.size})`,
          );
        }
      } catch (dbError) {
        log.warn('[Auth] Could not fetch user from database:', dbError);
        // Continue with JWT data only
      }
    }

    req.supabaseUser = supabaseUser;

    // Also set tenantId on request for backward compatibility
    if (req.supabaseUser.tenantId) {
      (req as any).tenantId = req.supabaseUser.tenantId;
    }

    next();
  } catch (error) {
    // Log but don't reject - let requireSupabaseAuth handle rejection
    if (error instanceof JwtConfigurationError) {
      // JWT not configured - log once and continue without auth
      // This allows the server to start without JWT configured in dev mode
      log.debug('JWT verification skipped: secret not configured');
    } else if (error instanceof jose.errors.JWTExpired) {
      log.warn('[Auth] Supabase JWT expired');
    } else if (error instanceof jose.errors.JWTInvalid) {
      log.warn('[Auth] Invalid Supabase JWT:', (error as Error).message);
    } else {
      log.error('[Auth] JWT verification error:', error);
    }

    // Clear any partial user data
    req.supabaseUser = undefined;
    next();
  }
};

/**
 * Middleware to require valid Supabase authentication
 *
 * Must be used AFTER authenticateSupabaseJWT middleware.
 * Rejects requests without valid Supabase user.
 */
export const requireSupabaseAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.supabaseUser) {
    res.status(401).json({
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  // Check if token is expired
  if (req.supabaseUser.exp && Date.now() >= req.supabaseUser.exp * 1000) {
    res.status(401).json({
      message: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  next();
};

/**
 * Middleware to require valid tenant context
 *
 * Must be used AFTER authenticateSupabaseJWT middleware.
 * Rejects requests without tenant ID.
 */
export const requireTenantContext: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const tenantId = req.supabaseUser?.tenantId || (req as any).tenantId;

  if (!tenantId) {
    res.status(403).json({
      message: 'Tenant context required',
      code: 'NO_TENANT',
    });
    return;
  }

  // Ensure tenantId is set on request
  (req as any).tenantId = tenantId;
  next();
};

/**
 * Middleware to require platform admin access
 */
export const requirePlatformAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.supabaseUser?.isPlatformUser) {
    res.status(403).json({
      message: 'Platform admin access required',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
};

/**
 * Combined middleware for typical protected routes
 * Authenticates JWT, requires auth, and requires tenant context
 */
export const protectedRoute: RequestHandler[] = [
  authenticateSupabaseJWT,
  requireSupabaseAuth,
  requireTenantContext,
];

/**
 * Combined middleware for platform admin routes
 */
export const platformAdminRoute: RequestHandler[] = [
  authenticateSupabaseJWT,
  requireSupabaseAuth,
  requirePlatformAdmin,
];

/**
 * Helper to check if request has valid Supabase auth
 */
export function isSupabaseAuthenticated(req: Request): boolean {
  return !!req.supabaseUser && (!req.supabaseUser.exp || Date.now() < req.supabaseUser.exp * 1000);
}

/**
 * Helper to get user ID from request (supports both Supabase and legacy)
 */
export function getUserId(req: Request): string | undefined {
  return req.supabaseUser?.id || (req as any).session?.userId || (req as any).user?.id;
}

/**
 * Helper to get tenant ID from request (supports both Supabase and legacy)
 */
export function getTenantId(req: Request): string | undefined {
  return req.supabaseUser?.tenantId || (req as any).tenantId || (req as any).session?.tenantId;
}
