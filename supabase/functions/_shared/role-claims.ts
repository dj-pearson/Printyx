/**
 * Role claims in `app_metadata` (WF-R-03).
 *
 * WHY THIS EXISTS. `_shared/rbac.ts` gates on `app_metadata.roleLevel` and
 * DEFAULTS TO 1 when it is absent, so a claim nobody writes means every user is
 * an individual contributor on every gated edge function - a real platform admin
 * included. Before this module, signup wrote `tenantId`, `roleId`, `accessScope`
 * and `isPlatformUser` and stopped there; `mobile-auth` computed the level and put
 * it in the JSON RESPONSE only; and the two `updateUserById` calls in the tree
 * never touched `app_metadata` at all.
 *
 * WHERE THE CLAIM IS READ FROM, which decides where it has to be written. The
 * gates do NOT decode the JWT: `requireAuth` calls GoTrue's `auth.getUser(jwt)`,
 * which answers with the CURRENT `auth.users.raw_app_meta_data`. So a claim
 * written now takes effect on the next request - bounded by the AUDIT-005 auth
 * cache TTL, not by the token's expiry - and re-assigning a role does not need the
 * user to sign in again. The corollary is the reason for `ensureRoleClaims`: web
 * and OAuth sign-in run entirely between the browser and GoTrue with no server
 * hook to attach, so the write has to happen either where the role is SET or on
 * the next authenticated request.
 *
 * PERMISSIONS ARE ALWAYS WRITTEN, EVEN EMPTY. `loadPermissions` treats a non-empty
 * array as authoritative and anything else as "ask the database", so `[]` is the
 * correct representation of a role whose `roles.permissions` has not been authored
 * yet (migration 0072 seeds `'{}'` on purpose - see docs/rbac-decision.md). Always
 * writing the key also means a stale non-empty list cannot outlive a role change.
 */

/** The subset of the Supabase client this module uses. */
export interface ClaimsClient {
  from(table: string): any;
  auth: { admin: { updateUserById(id: string, attrs: Record<string, unknown>): Promise<any> } };
}

/** A GoTrue user, as much of it as this module reads. */
export interface ClaimsUser {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
}

export interface RoleClaims {
  roleId: string;
  roleLevel: number;
  /** The role CODE, e.g. 'COMPANY_ADMIN'. */
  role: string | null;
  permissions: string[];
  isPlatformAdmin: boolean;
}

/**
 * Flatten `roles.permissions` JSONB into `module.resource.action` strings.
 *
 * Duplicated from `_shared/rbac.ts` rather than imported: that module pulls in the
 * `AuthContext` type and a permission cache this one has no use for, and the two
 * are locked together by server/tests/unit/role-claims.test.ts.
 */
export function flattenRolePermissions(obj: unknown): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const out: string[] = [];

  function walk(node: unknown, prefix: string[]): void {
    if (Array.isArray(node)) {
      for (const v of node) {
        if (typeof v === 'string') out.push([...prefix, v].join('.'));
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (value === true) {
          out.push([...prefix, key].join('.'));
        } else {
          walk(value, [...prefix, key]);
        }
      }
    }
  }

  walk(obj, []);
  return out;
}

/**
 * Build the claims for one role id. Returns null when the row is absent, which is
 * a real state - `users.role_id` is nullable and a role can be deleted out from
 * under a user - and the caller must not invent a level for it.
 */
export async function buildRoleClaims(
  admin: ClaimsClient,
  roleId: string | null | undefined,
): Promise<RoleClaims | null> {
  if (!roleId) return null;

  const { data, error } = await admin
    .from('roles')
    .select('id, code, level, permissions, can_access_all_tenants')
    .eq('id', roleId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const level = typeof data.level === 'number' ? data.level : null;
  if (level === null) return null;

  return {
    roleId: data.id,
    roleLevel: level,
    role: typeof data.code === 'string' ? data.code : null,
    permissions: flattenRolePermissions(data.permissions),
    // Two independent ways to be a platform admin, and the flag is the one the
    // `roles` row states outright: `can_access_all_tenants` is what
    // supabase/functions/admin/ already reads to decide cross-tenant access.
    isPlatformAdmin: level >= 8 || data.can_access_all_tenants === true,
  };
}

/** The `app_metadata` keys this module owns. Everything else on the bag is left alone. */
export function claimsPatch(claims: RoleClaims): Record<string, unknown> {
  return {
    roleId: claims.roleId,
    roleLevel: claims.roleLevel,
    role: claims.role,
    permissions: claims.permissions,
    isPlatformAdmin: claims.isPlatformAdmin,
  };
}

/**
 * True when the bag already carries a usable level, so a request need not do any
 * of the work below.
 */
export function hasRoleClaims(appMetadata: Record<string, unknown> | null | undefined): boolean {
  const bag = appMetadata ?? {};
  const level = bag.roleLevel ?? bag.role_level;
  return typeof level === 'number' && Number.isFinite(level);
}

/**
 * Resolve the role id for a user from the claim bag, falling back to the `users`
 * row by id and then by email - the same ladder `_shared/auth.ts` uses for the
 * tenant, and for the same reason: users created outside signup have an empty bag.
 */
export async function resolveRoleId(admin: ClaimsClient, user: ClaimsUser): Promise<string | null> {
  const bag = user.app_metadata ?? {};
  const fromClaim = (bag.roleId as string | undefined) ?? (bag.role_id as string | undefined);
  if (fromClaim) return fromClaim;

  const { data: byId } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle();
  if (byId?.role_id) return byId.role_id as string;

  if (user.email) {
    const { data: byEmail } = await admin
      .from('users')
      .select('role_id')
      .ilike('email', user.email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.role_id) return byEmail.role_id as string;
  }

  return null;
}

/**
 * Persist the claims for `roleId` onto the auth user and return them.
 *
 * `updateUserById` merges `app_metadata` at the top level, so the keys this module
 * does not own - `tenantId`, `accessScope`, `isPlatformUser` - survive untouched.
 *
 * LIMITATION, stated because it is not obvious: an access token already in a
 * client's hands is NOT revoked by this. It does not matter for the level gates,
 * which re-read the user from GoTrue on every request, but a consumer that decodes
 * the JWT payload itself would keep seeing the old level until the token refreshes.
 */
export async function syncRoleClaims(
  admin: ClaimsClient,
  userId: string,
  roleId: string | null | undefined,
): Promise<RoleClaims | null> {
  const claims = await buildRoleClaims(admin, roleId);
  if (!claims) return null;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: claimsPatch(claims),
  });
  if (error) return null;

  return claims;
}

/**
 * Self-healing backfill for a user whose bag predates this module.
 *
 * Web and OAuth sign-in never reach a server we control, so there is no login hook
 * to write the claim from; this runs on the next authenticated request instead.
 * It mutates `user.app_metadata` IN PLACE so the request that triggered it is
 * already gated correctly rather than being denied once and working afterwards.
 *
 * Returns true when it wrote something. Never throws: a failure here must leave
 * the user authenticated at the level they would have had anyway.
 */
export async function ensureRoleClaims(admin: ClaimsClient, user: ClaimsUser): Promise<boolean> {
  try {
    if (hasRoleClaims(user.app_metadata)) return false;

    const roleId = await resolveRoleId(admin, user);
    if (!roleId) return false;

    const claims = await syncRoleClaims(admin, user.id, roleId);
    if (!claims) return false;

    user.app_metadata = { ...(user.app_metadata ?? {}), ...claimsPatch(claims) };
    return true;
  } catch {
    return false;
  }
}
