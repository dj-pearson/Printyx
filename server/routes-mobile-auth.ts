/**
 * Mobile Authentication Routes
 *
 * Provides JWT-based authentication for the iOS app, bypassing
 * the Supabase Kong gateway which may return 503 errors.
 *
 * Endpoints:
 *   POST /mobile-auth/login   - Authenticate and return JWT tokens
 *   POST /mobile-auth/refresh - Refresh an expired access token
 *
 * These endpoints mint Supabase-compatible JWTs using the same
 * SUPABASE_JWT_SECRET, so tokens work seamlessly with existing
 * auth middleware (authenticateSupabaseJWT, protectedRoute, etc.).
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as jose from 'jose';
import { z } from 'zod';
import { storage } from './storage';
import { db } from './db';
import { users, roles } from '@shared/schema';
import { loginAttempts } from '../shared/auth-schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('mobile-auth');
const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// ── Rate Limiting ────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// ── Account Lockout ──────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const ATTEMPT_WINDOW_MINUTES = 15;

async function isAccountLocked(
  email: string,
): Promise<{ locked: boolean; remainingMinutes?: number }> {
  const normalizedEmail = email.toLowerCase().trim();

  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, normalizedEmail))
    .limit(1);

  if (!attempt || !attempt.lockedUntil) {
    return { locked: false };
  }

  if (attempt.lockedUntil > new Date()) {
    const remainingMs = attempt.lockedUntil.getTime() - Date.now();
    return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }

  return { locked: false };
}

async function recordFailedAttempt(
  email: string,
  ip: string,
): Promise<{ locked: boolean; attemptsRemaining: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

  const [existing] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, normalizedEmail))
    .limit(1);

  if (!existing) {
    await db.insert(loginAttempts).values({
      email: normalizedEmail,
      attemptCount: 1,
      lastAttemptAt: now,
      lastIpAddress: ip,
    });
    return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - 1 };
  }

  const newCount = existing.lastAttemptAt < windowStart ? 1 : existing.attemptCount + 1;
  let lockedUntil: Date | null = null;

  if (newCount >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    log.info(`[SECURITY] Mobile account locked: ${normalizedEmail}`);
  }

  await db
    .update(loginAttempts)
    .set({
      attemptCount: newCount,
      lastAttemptAt: now,
      lastIpAddress: ip,
      lockedUntil,
      updatedAt: now,
    })
    .where(eq(loginAttempts.id, existing.id));

  return {
    locked: lockedUntil !== null,
    attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - newCount),
  };
}

async function clearAttempts(email: string): Promise<void> {
  await db
    .update(loginAttempts)
    .set({ attemptCount: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(loginAttempts.email, email.toLowerCase().trim()));
}

// ── JWT Helpers ──────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = 3600; // 1 hour
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 3600; // 30 days

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

interface UserWithRole {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tenantId: string | null;
  roleId: string | null;
  teamId: string | null;
  isPlatformUser: boolean | null;
  roleLevel?: number;
  createdAt: Date | null;
}

async function getUserWithRoleLevel(userId: string): Promise<UserWithRole | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  let roleLevel: number | undefined;
  if (user.roleId) {
    const [role] = await db
      .select({ level: roles.level })
      .from(roles)
      .where(eq(roles.id, user.roleId))
      .limit(1);
    if (role) {
      roleLevel = role.level;
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    tenantId: user.tenantId,
    roleId: user.roleId,
    teamId: user.teamId,
    isPlatformUser: user.isPlatformUser,
    roleLevel,
    createdAt: user.createdAt,
  };
}

async function mintTokens(user: UserWithRole) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const accessPayload: Record<string, unknown> = {
    sub: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
    app_metadata: {
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleLevel: user.roleLevel,
      teamId: user.teamId,
      isPlatformUser: user.isPlatformUser ?? false,
    },
    user_metadata: {
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };

  const refreshPayload: Record<string, unknown> = {
    sub: user.id,
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
    type: 'refresh',
  };

  const accessToken = await new jose.SignJWT(accessPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);

  const refreshToken = await new jose.SignJWT(refreshPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    expires_at: now + ACCESS_TOKEN_EXPIRY,
    refresh_token: refreshToken,
  };
}

function buildUserResponse(user: UserWithRole) {
  return {
    id: user.id,
    email: user.email,
    phone: null,
    app_metadata: {
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleLevel: user.roleLevel,
      teamId: user.teamId,
      isPlatformUser: user.isPlatformUser ?? false,
    },
    user_metadata: {
      firstName: user.firstName,
      lastName: user.lastName,
    },
    created_at: user.createdAt?.toISOString() ?? null,
  };
}

// ── Routes ───────────────────────────────────────────────────────────

/**
 * POST /mobile-auth/login
 *
 * Authenticates user with email/password and returns Supabase-compatible
 * JWT tokens. Response format matches GoTrue's /auth/v1/token response
 * so the iOS app can use it as a drop-in replacement.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Check account lockout
    const lockStatus = await isAccountLocked(email);
    if (lockStatus.locked) {
      log.info(`[SECURITY] Blocked mobile login for locked account: ${email}`);
      return res.status(429).json({
        message: `Account is temporarily locked. Please try again in ${lockStatus.remainingMinutes} minute(s).`,
      });
    }

    // Authenticate against database
    const authenticatedUser = await storage.authenticateUser(email, password);
    if (!authenticatedUser) {
      const result = await recordFailedAttempt(email, ip);
      if (result.locked) {
        return res.status(429).json({
          message: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
        });
      }
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      });
    }

    await clearAttempts(email);

    // Get full user with role info
    const user = await getUserWithRoleLevel(authenticatedUser.id);
    if (!user) {
      return res.status(500).json({ message: 'Failed to load user data' });
    }

    // Mint tokens
    const tokens = await mintTokens(user);

    log.info(`[Mobile Auth] Login successful: ${email}`);

    res.json({
      ...tokens,
      user: buildUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid email or password format',
      });
    }
    log.error('Mobile login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /mobile-auth/refresh
 *
 * Refreshes an access token using a refresh token.
 * Returns the same response format as /login.
 */
router.post('/refresh', refreshLimiter, async (req: Request, res: Response) => {
  try {
    const { refresh_token } = refreshSchema.parse(req.body);
    const secret = getJwtSecret();

    // Verify refresh token
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(refresh_token, secret, {
        algorithms: ['HS256'],
      });
      payload = result.payload;
    } catch {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired refresh token',
      });
    }

    // Must be a refresh token
    if (payload.type !== 'refresh' || !payload.sub) {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      });
    }

    // Get current user data
    const user = await getUserWithRoleLevel(payload.sub);
    if (!user) {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'User not found',
      });
    }

    // Mint new tokens
    const tokens = await mintTokens(user);

    res.json({
      ...tokens,
      user: buildUserResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      });
    }
    log.error('Mobile token refresh error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export { router as mobileAuthRoutes };
