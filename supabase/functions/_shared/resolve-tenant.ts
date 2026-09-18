// Tenant resolution for the edge tree (CR-010, SEC-TENANT-003).
//
// app_metadata is set server-side through the admin API and is trustworthy.
// user_metadata is editable by the holder of the session via the client SDK
// (supabase.auth.updateUser), and the x-tenant-id header is fully
// attacker-controlled - client/src/lib/authed-download.ts and its siblings read
// it straight out of localStorage, so it is a devtools edit away from naming any
// tenant at all. Edge functions use the SERVICE ROLE, which bypasses RLS, so a
// tenant taken from either of those turns every .eq('tenant_id', tenantId) in
// the function from an isolation boundary into a filter of the caller's
// choosing.
//
// CR-010 ruled on this and shipped tenantFromJwt. One function out of 161
// adopted it; the other 160 kept a five-line `||` chain ending in the header.
// The chain held anyway for anyone whose JWT carries a tenantId, because the
// earlier terms win - which is exactly why nobody noticed. SEC-TENANT-003 is
// about who reaches production WITHOUT one: a freshly provisioned user before
// their first assignment, a platform admin, a service or cron caller, an
// account whose app_metadata was written by a path that never set it.
//
// THE ORDER BELOW IS THE WHOLE POINT. The authoritative answer for a user with
// no claim is the `users` row, which the caller cannot write. Resolving the
// header BEFORE that lookup - which is what _shared/auth.ts did - means a user
// the database could have placed correctly is instead placed wherever they
// asked to be.
//
// This module stays dependency-free on purpose: the Supabase client is passed
// in structurally rather than imported, so the same code runs in Deno and under
// the Node test harness without pulling an esm.sh URL into vitest.

// deno-lint-ignore no-explicit-any
type AuthUser =
  | { id?: string; email?: string | null; app_metadata?: Record<string, any> }
  | null
  | undefined;

// The shape of the PostgREST builder chain this module uses. Structural, so any
// supabase-js client satisfies it and a test double can too.
export interface TenantLookupClient {
  from(table: string): {
    // deno-lint-ignore no-explicit-any
    select(cols: string): any;
  };
}

/**
 * Return the tenant id from the verified JWT's app_metadata, or null. Callers
 * using the service client should 400/403 when this is null rather than falling
 * back to any user-controlled source.
 */
export function tenantFromJwt(user: AuthUser): string | null {
  const meta = user?.app_metadata;
  if (!meta) return null;
  const id = meta.tenantId ?? meta.tenant_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Whether the caller may address a tenant other than their own.
 *
 * Read from the claims WF-R-03 writes: the explicit isPlatformAdmin flag, the
 * role level (8 is PLATFORM_ADMIN in _shared/rbac.ts), or the role code. The
 * code is compared case-insensitively because the claim carries the uppercase
 * role CODE while two gates were written against a lowercase string and could
 * therefore never fire - the same defect WF-R-03 found in requirePlatformAdmin.
 */
export function isPlatformAdminClaim(user: AuthUser): boolean {
  const meta = user?.app_metadata;
  if (!meta) return false;
  if (meta.isPlatformAdmin === true) return true;
  const level = Number(meta.roleLevel);
  if (Number.isFinite(level) && level >= 8) return true;
  const code = typeof meta.role === 'string' ? meta.role.toLowerCase() : '';
  return code === 'platform_admin';
}

async function tenantFromUsersTable(
  admin: TenantLookupClient | undefined,
  user: AuthUser,
): Promise<string | null> {
  if (!admin || !user) return null;

  if (user.id) {
    try {
      const { data } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      if (data?.tenant_id) return data.tenant_id as string;
    } catch {
      // A lookup that throws is not a reason to accept a header instead.
    }
  }

  // Last resort for an account whose auth id and users id diverged. ilike, not
  // eq, because email casing is not normalised on either side.
  if (user.email) {
    try {
      const { data } = await admin
        .from('users')
        .select('tenant_id')
        .ilike('email', user.email)
        .limit(1)
        .maybeSingle();
      if (data?.tenant_id) return data.tenant_id as string;
    } catch {
      /* fall through */
    }
  }

  return null;
}

/**
 * Resolve the tenant a request acts on. Returns null when there is none, which
 * the caller answers with 400.
 *
 *   1. app_metadata on the verified JWT. Written server-side, never by the user.
 *   2. The caller's `users` row, by id then by email. Authoritative and not
 *      caller-controlled; this is what a user with no claim yet resolves to.
 *   3. x-tenant-id, ONLY for a platform admin, and only for a tenant that
 *      exists. This is the tenant switcher, not a fallback.
 *
 * A header from anyone else is IGNORED rather than refused. The web client
 * attaches it from localStorage on every request, so a stale value is ordinary
 * and 403ing on a mismatch would lock out users who have done nothing wrong;
 * ignoring it is equally safe and breaks nobody. A function that genuinely
 * needs to refuse a mismatch (supabase/functions/admin does) can compare
 * tenantFromJwt against the header itself.
 */
export async function resolveTenantId(
  req: Request,
  user: AuthUser,
  admin?: TenantLookupClient,
): Promise<string | null> {
  const headerTenant = req.headers.get('x-tenant-id') || null;

  if (isPlatformAdminClaim(user) && headerTenant) {
    if (!admin) return tenantFromJwt(user) ?? (await tenantFromUsersTable(admin, user));
    try {
      const { data } = await admin
        .from('tenants')
        .select('id')
        .eq('id', headerTenant)
        .limit(1)
        .maybeSingle();
      if (data?.id) return data.id as string;
    } catch {
      /* fall through to the caller's own tenant */
    }
  }

  const jwtTenant = tenantFromJwt(user);
  if (jwtTenant) return jwtTenant;

  return await tenantFromUsersTable(admin, user);
}
