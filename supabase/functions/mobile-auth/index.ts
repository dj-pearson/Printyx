/**
 * Mobile Authentication Edge Function
 *
 * Provides JWT-based authentication for the iOS app, bypassing
 * the Kong gateway (which may return 503 "no available server").
 *
 * Authenticates directly against the `users` table via PostgREST
 * and mints Supabase-compatible JWTs using the shared JWT secret.
 *
 * Endpoints:
 *   POST /mobile-auth/login   - Authenticate with email/password
 *   POST /mobile-auth/refresh - Refresh an expired access token
 */

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { SignJWT, jwtVerify } from 'https://deno.land/x/jose@v5.2.2/index.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

// ── Constants ────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = 3600; // 1 hour
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 3600; // 30 days
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const ATTEMPT_WINDOW_MINUTES = 15;

// ── Helpers ──────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get('SUPABASE_JWT_SECRET');
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

async function mintTokens(user: Record<string, any>, roleLevel?: number) {
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
      tenantId: user.tenant_id,
      roleId: user.role_id,
      roleLevel: roleLevel ?? null,
      teamId: user.team_id,
      isPlatformUser: user.is_platform_user ?? false,
    },
    user_metadata: {
      firstName: user.first_name,
      lastName: user.last_name,
    },
  };

  const refreshPayload: Record<string, unknown> = {
    sub: user.id,
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
    type: 'refresh',
  };

  const accessToken = await new SignJWT(accessPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);

  const refreshToken = await new SignJWT(refreshPayload)
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

function buildUserResponse(user: Record<string, any>, roleLevel?: number) {
  return {
    id: user.id,
    email: user.email,
    phone: null,
    app_metadata: {
      tenantId: user.tenant_id,
      roleId: user.role_id,
      roleLevel: roleLevel ?? null,
      teamId: user.team_id,
      isPlatformUser: user.is_platform_user ?? false,
    },
    user_metadata: {
      firstName: user.first_name,
      lastName: user.last_name,
    },
    created_at: user.created_at,
  };
}

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Path structure: /mobile-auth/login or /mobile-auth/refresh
  const action = pathParts[1]; // "login" or "refresh"

  // Only POST is allowed
  if (req.method !== 'POST') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const admin = createSupabaseServiceClient();

  try {
    // ── LOGIN ──────────────────────────────────────────────────────

    if (action === 'login') {
      const body = await req.json();
      const email = body.email?.trim()?.toLowerCase();
      const password = body.password;

      if (!email || !password) {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'Email and password are required' },
          400,
          req,
        );
      }

      // Check account lockout
      const { data: lockRecord } = await admin
        .from('login_attempts')
        .select('*')
        .eq('email', email)
        .limit(1)
        .maybeSingle();

      if (lockRecord?.locked_until) {
        const lockedUntil = new Date(lockRecord.locked_until);
        if (lockedUntil > new Date()) {
          const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
          return createCorsResponse(
            { error: 'account_locked', error_description: `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).` },
            429,
            req,
          );
        }
      }

      // Look up user by email
      const { data: user, error: userError } = await admin
        .from('users')
        .select('id, email, first_name, last_name, tenant_id, role_id, team_id, is_platform_user, is_active, password_hash, created_at')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();

      if (userError) {
        console.error('User lookup error:', userError);
        return createCorsResponse(
          { error: 'server_error', error_description: 'Internal server error' },
          500,
          req,
        );
      }

      if (!user || !user.password_hash) {
        // Record failed attempt
        await recordFailedAttempt(admin, email);
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Invalid login credentials' },
          400,
          req,
        );
      }

      if (user.is_active === false) {
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Account is deactivated' },
          400,
          req,
        );
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        await recordFailedAttempt(admin, email);
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Invalid login credentials' },
          400,
          req,
        );
      }

      // Clear failed attempts
      if (lockRecord) {
        await admin
          .from('login_attempts')
          .update({ attempt_count: 0, locked_until: null, updated_at: new Date().toISOString() })
          .eq('email', email);
      }

      // Get role level
      let roleLevel: number | undefined;
      if (user.role_id) {
        const { data: role } = await admin
          .from('roles')
          .select('level')
          .eq('id', user.role_id)
          .limit(1)
          .maybeSingle();
        if (role) {
          roleLevel = role.level;
        }
      }

      // Update last login
      await admin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      // Mint tokens
      const tokens = await mintTokens(user, roleLevel);

      console.log(`[Mobile Auth] Login successful: ${email}`);

      return createCorsResponse(
        { ...tokens, user: buildUserResponse(user, roleLevel) },
        200,
        req,
      );
    }

    // ── REFRESH ────────────────────────────────────────────────────

    if (action === 'refresh') {
      const body = await req.json();
      const refreshTokenStr = body.refresh_token;

      if (!refreshTokenStr) {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'refresh_token is required' },
          400,
          req,
        );
      }

      // Verify refresh token
      const secret = getJwtSecret();
      let payload;
      try {
        const result = await jwtVerify(refreshTokenStr, secret, { algorithms: ['HS256'] });
        payload = result.payload;
      } catch {
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
          401,
          req,
        );
      }

      if (payload.type !== 'refresh' || !payload.sub) {
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Invalid refresh token' },
          401,
          req,
        );
      }

      // Get current user data
      const { data: user, error: userError } = await admin
        .from('users')
        .select('id, email, first_name, last_name, tenant_id, role_id, team_id, is_platform_user, is_active, created_at')
        .eq('id', payload.sub as string)
        .limit(1)
        .maybeSingle();

      if (userError || !user) {
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'User not found' },
          401,
          req,
        );
      }

      if (user.is_active === false) {
        return createCorsResponse(
          { error: 'invalid_grant', error_description: 'Account is deactivated' },
          401,
          req,
        );
      }

      // Get role level
      let roleLevel: number | undefined;
      if (user.role_id) {
        const { data: role } = await admin
          .from('roles')
          .select('level')
          .eq('id', user.role_id)
          .limit(1)
          .maybeSingle();
        if (role) {
          roleLevel = role.level;
        }
      }

      // Mint new tokens
      const tokens = await mintTokens(user, roleLevel);

      return createCorsResponse(
        { ...tokens, user: buildUserResponse(user, roleLevel) },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('Mobile auth error:', error);
    return createCorsResponse(
      { error: 'server_error', error_description: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ── Account Lockout Helper ───────────────────────────────────────────

async function recordFailedAttempt(admin: ReturnType<typeof createSupabaseServiceClient>, email: string) {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    const { data: existing } = await admin
      .from('login_attempts')
      .select('*')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await admin.from('login_attempts').insert({
        email,
        attempt_count: 1,
        last_attempt_at: now.toISOString(),
      });
      return;
    }

    const lastAttempt = new Date(existing.last_attempt_at);
    const newCount = lastAttempt < windowStart ? 1 : existing.attempt_count + 1;
    const lockedUntil = newCount >= MAX_LOGIN_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
      : null;

    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      console.log(`[SECURITY] Mobile account locked: ${email}`);
    }

    await admin
      .from('login_attempts')
      .update({
        attempt_count: newCount,
        last_attempt_at: now.toISOString(),
        locked_until: lockedUntil,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id);
  } catch (err) {
    console.error('Failed to record login attempt:', err);
  }
}
