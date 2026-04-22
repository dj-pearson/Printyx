/**
 * Auth helper for edge functions.
 *
 * Centralizes JWT verification + tenant resolution so every handler starts with:
 *
 *   const { userId, tenantId } = await requireAuth(req);
 *
 * Call order:
 *   1. Extract Bearer JWT from Authorization header
 *   2. Verify with Supabase (auth.getUser) — respects token revocation
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
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data?.user) {
    throw new AuthError(401, 'invalid_token', error?.message || 'Invalid or expired token');
  }

  const user = data.user;
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
 * Assumes platform admins have a specific role claim or are in a known role table.
 * Tune the check once you know the canonical way.
 */
export async function requirePlatformAdmin(req: Request): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  const isPlatformAdmin =
    ctx.supabaseUser.app_metadata?.isPlatformAdmin === true ||
    ctx.supabaseUser.app_metadata?.role === 'platform_admin';
  if (!isPlatformAdmin) {
    throw new AuthError(403, 'forbidden', 'Platform admin access required');
  }
  return ctx;
}
