/**
 * Auth helper for edge functions.
 *
 * Centralizes JWT verification + tenant resolution so every handler starts with:
 *
 *   const { userId, tenantId } = await requireAuth(req);
 *
 * Call order:
 *   1. Extract Bearer JWT from Authorization header
 *   2. Verify with Supabase (auth.getUser), through a short-TTL cache (AUDIT-005).
 *      GoTrue is still the source of truth, but revocation is now honored within
 *      AUTH_CACHE_TTL_MS (default 30s) rather than instantly — see _shared/auth-cache.ts.
 *   3. Resolve tenantId via:
 *        a. JWT app_metadata.tenantId  (canonical)
 *        b. JWT user_metadata.tenantId (legacy fallback)
 *        c. x-tenant-id header         (dev override — log a warning)
 *        d. Users table lookup by id   (self-healing fallback)
 *        e. Users table lookup by email (last resort)
 *   4. Throw AuthError on any failure — caller returns the appropriate Response
 *
 * The Supabase client is cached at module scope.
 */

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cachedGetUser, type GetUserCapable } from './auth-cache.ts';
import { ensureRoleClaims, hasRoleClaims, type ClaimsClient } from './role-claims.ts';

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string | undefined;
  jwt: string;
  supabaseUser: User;
}

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    public code: 'missing_token' | 'invalid_token' | 'no_tenant' | 'forbidden',
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

let _anonClient: SupabaseClient | null = null;
let _serviceClient: SupabaseClient | null = null;

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

function getAnonClient(): SupabaseClient {
  if (_anonClient) return _anonClient;
  const url = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY env vars required');
  }
  _anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _anonClient;
}

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required');
  }
  _serviceClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _serviceClient;
}

/**
 * Users this instance has already tried to backfill role claims for (WF-R-03).
 * Per-instance and unbounded only by the number of DISTINCT users an instance
 * serves, which is what an edge instance's lifetime bounds anyway. It exists to
 * stop a user with no role_id from paying two `users` lookups on every request.
 */
const claimBackfillAttempted = new Set<string>();

function extractJwt(req: Request): string | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveTenantId(
  req: Request,
  user: User,
  log?: (level: 'warn' | 'info', msg: string, ctx?: Record<string, unknown>) => void,
): Promise<string | null> {
  // 1. app_metadata (canonical)
  const appTenant =
    (user.app_metadata?.tenantId as string | undefined) ??
    (user.app_metadata?.tenant_id as string | undefined);
  if (appTenant) return appTenant;

  // 2. user_metadata (legacy)
  const userTenant =
    (user.user_metadata?.tenantId as string | undefined) ??
    (user.user_metadata?.tenant_id as string | undefined);
  if (userTenant) return userTenant;

  // 3. x-tenant-id header (dev override)
  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant) {
    log?.('warn', 'tenantId resolved from x-tenant-id header (dev override)', {
      userId: user.id,
    });
    return headerTenant;
  }

  // 4. DB lookup by user id (self-healing — migrates old accounts)
  try {
    const svc = getServiceClient();
    const { data: dbUser } = await svc
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle();
    if (dbUser?.tenant_id) {
      log?.('info', 'tenantId resolved from users table by id', { userId: user.id });
      return dbUser.tenant_id as string;
    }
  } catch {
    /* fall through */
  }

  // 5. DB lookup by email (last resort)
  if (user.email) {
    try {
      const svc = getServiceClient();
      const { data: emailUser } = await svc
        .from('users')
        .select('tenant_id')
        .ilike('email', user.email)
        .limit(1)
        .maybeSingle();
      if (emailUser?.tenant_id) {
        log?.('info', 'tenantId resolved from users table by email', { userId: user.id });
        return emailUser.tenant_id as string;
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

/**
 * Verify JWT and resolve tenant. Throws AuthError on any failure.
 */
export async function requireAuth(
  req: Request,
  opts?: { log?: (level: 'warn' | 'info', msg: string, ctx?: Record<string, unknown>) => void },
): Promise<AuthContext> {
  const jwt = extractJwt(req);
  if (!jwt) {
    throw new AuthError(401, 'missing_token', 'Authorization header missing or malformed');
  }

  const supabase = getAnonClient();
  // AUDIT-005: short-TTL, token-hash-keyed cache in front of the GoTrue round-trip.
  // GoTrue remains the source of truth (only cache MISSES call it, and only
  // successes are cached); staleness is bounded by AUTH_CACHE_TTL_MS. See
  // _shared/auth-cache.ts for the revocation tradeoff.
  const { data, error } = await cachedGetUser(supabase as unknown as GetUserCapable, jwt, {
    getEnv: env,
  });

  if (error || !data?.user) {
    throw new AuthError(
      401,
      'invalid_token',
      (error as { message?: string } | null)?.message || 'Invalid or expired token',
    );
  }

  const user = data.user as User;

  // WF-R-03: backfill app_metadata.roleLevel for a user whose bag predates the
  // claim. Web and OAuth sign-in go straight from the browser to GoTrue, so there
  // is no login hook to write it from - this is the only place guaranteed to run.
  // It fires at most once per user (GoTrue then answers with the claim), and the
  // attempted-set below stops a user with no role_id from retrying on every
  // request. Failures are swallowed inside ensureRoleClaims: a user who cannot be
  // enriched is left at the level they would have had anyway, never denied auth.
  if (!hasRoleClaims(user.app_metadata) && !claimBackfillAttempted.has(user.id)) {
    claimBackfillAttempted.add(user.id);
    try {
      await ensureRoleClaims(getServiceClient() as unknown as ClaimsClient, user);
    } catch {
      /* auth must not fail because a claim could not be written */
    }
  }

  const tenantId = await resolveTenantId(req, user, opts?.log);

  if (!tenantId) {
    throw new AuthError(403, 'no_tenant', 'User has no associated tenant', {
      userId: user.id,
      email: user.email,
    });
  }

  return {
    userId: user.id,
    tenantId,
    email: user.email ?? undefined,
    jwt,
    supabaseUser: user,
  };
}

/**
 * Variant for endpoints that work with or without auth (e.g. public read endpoints
 * that return richer data when the user is authenticated).
 */
export async function optionalAuth(
  req: Request,
  opts?: { log?: (level: 'warn' | 'info', msg: string, ctx?: Record<string, unknown>) => void },
): Promise<AuthContext | null> {
  try {
    return await requireAuth(req, opts);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

/**
 * Platform-admin check — for root-admin routes.
 *
 * WF-R-03 corrected the predicate. It compared `app_metadata.role` against the
 * lowercase string 'platform_admin' while the claim carries the role CODE, which
 * is uppercase — so that half of the check could never fire, and the whole thing
 * rested on an `isPlatformAdmin` flag nothing wrote. It now matches the codes
 * case-insensitively and accepts the seeded level 8, which is the same predicate
 * `_shared/rbac.ts`'s isPlatformAdmin() applies.
 */
export async function requirePlatformAdmin(req: Request): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  const appMeta = ctx.supabaseUser.app_metadata ?? {};
  const roleCode = String(appMeta.role ?? appMeta.roleCode ?? '').toUpperCase();
  const level = appMeta.roleLevel ?? appMeta.role_level;
  const isPlatformAdmin =
    appMeta.isPlatformAdmin === true ||
    roleCode === 'PLATFORM_ADMIN' ||
    roleCode === 'ROOT_ADMIN' ||
    (typeof level === 'number' && level >= 8);
  if (!isPlatformAdmin) {
    throw new AuthError(403, 'forbidden', 'Platform admin access required');
  }
  return ctx;
}
