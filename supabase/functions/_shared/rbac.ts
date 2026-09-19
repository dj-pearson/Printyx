/**
 * RBAC helpers for edge functions.
 *
 * The canonical data model (from shared/schema.ts):
 *   - `roles.level` — integer 1-8 (1=individual → 8=platform_admin)
 *   - `roles.permissions` — JSONB of module permission flags (format: 'module.resource.action_scope')
 *   - `roles.can*` — boolean capability flags for hierarchy-aware access
 *   - `users.roleId` — FK to `roles.id`
 *
 * JWT-side expectations (populated at login):
 *   - `app_metadata.roleLevel` (number) — mirrored from roles.level for fast level checks
 *   - `app_metadata.role` (string code) — e.g. 'SALES_REP', 'ROOT_ADMIN'
 *   - `app_metadata.permissions` (string[]) — flattened permission keys (optional — falls back to DB lookup)
 *   - `app_metadata.isPlatformAdmin` (boolean) — derived from level === 8
 *
 * Two usage patterns:
 *   1. LEVEL CHECK  — `requireRoleLevel(ctx, 4)` for "manager and above"
 *   2. PERMISSION CHECK — `requirePermission(ctx, ['sales.lead.view_team'])` for fine-grained RBAC
 *
 * Level check is cheap (JWT claim only). Permission check reads the DB on a
 * cache miss; results cached per (userId, permission) for 60s in-memory.
 *
 * Throw `RbacError` on failure; caller converts to 403 errorResponse.
 */

import type { AuthContext } from './auth.ts';

// Role level constants — mirror `roles.level`
export const ROLE_LEVEL = {
  INDIVIDUAL: 1,
  TEAM_LEAD: 2,
  SUPERVISOR: 3,
  MANAGER: 4,
  DIRECTOR: 5,
  REGIONAL_MANAGER: 6,
  COMPANY_ADMIN: 7,
  PLATFORM_ADMIN: 8,
} as const;

export type RoleLevel = (typeof ROLE_LEVEL)[keyof typeof ROLE_LEVEL];

export class RbacError extends Error {
  constructor(
    public code: 'insufficient_role' | 'missing_permission' | 'no_role_assigned',
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RbacError';
  }
}

/**
 * Extract the user's role level from the auth context.
 * Returns 1 (individual) as a safe default if no role is assigned.
 */
export function getRoleLevel(ctx: AuthContext): number {
  const appMeta = ctx.supabaseUser.app_metadata ?? {};
  const level =
    (appMeta.roleLevel as number | undefined) ?? (appMeta.role_level as number | undefined) ?? 1;
  return typeof level === 'number' ? level : 1;
}

/**
 * Extract the user's role code (e.g. 'SALES_REP'). Undefined if unset.
 */
export function getRoleCode(ctx: AuthContext): string | undefined {
  const appMeta = ctx.supabaseUser.app_metadata ?? {};
  return (appMeta.role as string | undefined) ?? (appMeta.roleCode as string | undefined);
}

/**
 * True if the user is a platform admin (level 8 or isPlatformAdmin flag).
 */
export function isPlatformAdmin(ctx: AuthContext): boolean {
  const appMeta = ctx.supabaseUser.app_metadata ?? {};
  if (appMeta.isPlatformAdmin === true) return true;
  return getRoleLevel(ctx) >= ROLE_LEVEL.PLATFORM_ADMIN;
}

/**
 * Convenience: true for manager-level and above (level 4+).
 * Matches the pattern used throughout Express route files.
 */
export function isManagerOrAbove(ctx: AuthContext): boolean {
  return getRoleLevel(ctx) >= ROLE_LEVEL.MANAGER;
}

/**
 * Convenience: true for supervisor-level and above (level 3+).
 */
export function isSupervisorOrAbove(ctx: AuthContext): boolean {
  return getRoleLevel(ctx) >= ROLE_LEVEL.SUPERVISOR;
}

/**
 * Throw RbacError if the user's role level is below `minLevel`.
 */
export function requireRoleLevel(ctx: AuthContext, minLevel: RoleLevel | number): void {
  const actual = getRoleLevel(ctx);
  if (actual < minLevel) {
    throw new RbacError(
      'insufficient_role',
      `Requires role level ${minLevel} or higher (user has ${actual})`,
      { required: minLevel, actual },
    );
  }
}

/**
 * Throw RbacError unless the user is a platform admin.
 */
export function requirePlatformAdmin(ctx: AuthContext): void {
  if (!isPlatformAdmin(ctx)) {
    throw new RbacError('insufficient_role', 'Platform admin access required', {
      required: ROLE_LEVEL.PLATFORM_ADMIN,
      actual: getRoleLevel(ctx),
    });
  }
}

// ─── Level check for the createSupabaseClient idiom (SEC-EDGE-001) ───────────

/**
 * Assert a minimum role level for a function that holds a Supabase `user`
 * rather than an AuthContext.
 *
 * WHY THIS EXISTS. 175 edge functions authenticate with
 * `createSupabaseClient(req)` + `auth.getUser(jwt)` and never build an
 * AuthContext, so `requireRoleLevel(ctx, n)` does not fit them without
 * restructuring the handler. This is the same check against the same claim,
 * taking what those functions already have.
 *
 * WHY IT READS THE DATABASE. `getRoleLevel` answers 1 when
 * `app_metadata.roleLevel` is absent, which is correct for a claim check and
 * WRONG as an authorisation decision: WF-R-03 writes that claim at every point
 * that assigns a role plus a backfill on the next authenticated request, so a
 * token minted before then carries no level. Gating on the claim alone would
 * lock a company admin out of their own product catalogue until they signed in
 * again, on deploy day, with a 403 that says their role is too low. So an
 * ABSENT claim falls through to `users.role_id -> roles.level`, which is
 * authoritative. A PRESENT claim is trusted: it is signed, and re-reading it
 * would cost a query per request for nothing.
 *
 * Cached per user for the same 60s as the permission cache. A role change takes
 * effect within a minute, which is the same guarantee the permission path
 * already makes.
 */
/** Shared by the level check, the permission check and the AuthContext path. */
const PERMISSION_CACHE_TTL_MS = 60 * 1000;
const levelCache = new Map<string, { level: number; expiresAt: number }>();
type CacheEntry = { permissions: Set<string>; expiresAt: number };
const permissionCache = new Map<string, CacheEntry>();

/** The level in the token, or null when the claim is absent. */
export function roleLevelClaim(user: { app_metadata?: Record<string, unknown> }): number | null {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return ROLE_LEVEL.PLATFORM_ADMIN;
  const level = (meta.roleLevel ?? meta.role_level) as unknown;
  return typeof level === 'number' ? level : null;
}

/**
 * The user's role level: the claim when it is there, otherwise the database.
 * Answers 1 only when the user has no role row at all, which is a user who
 * genuinely has no privileges rather than one whose token is stale.
 */
export async function resolveRoleLevel(
  // deno-lint-ignore no-explicit-any
  admin: any,
  user: { id: string; app_metadata?: Record<string, unknown> },
): Promise<number> {
  const claim = roleLevelClaim(user);
  if (claim !== null) return claim;

  const cached = levelCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) return cached.level;

  let level = 1;
  try {
    const { data } = await admin
      .from('users')
      .select('role:roles(level)')
      .eq('id', user.id)
      .maybeSingle();
    const found = data?.role?.level;
    if (typeof found === 'number') level = found;
  } catch (err) {
    // A failed lookup must not open the gate. Level 1 denies anything above it,
    // which is the same answer an unprivileged user gets.
    console.error('Role level lookup failed:', String(err));
  }
  levelCache.set(user.id, { level, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
  return level;
}

/**
 * 403 body for a denied level check, or null when the user is allowed.
 *
 * Returns rather than throws, because these handlers answer with
 * `createCorsResponse(body, status, req)` and have no RbacError catch. The
 * message names the level required and the level held, so a denial is
 * diagnosable without server logs - a 403 that says only "forbidden" sends the
 * user to support.
 */
export async function denyBelowLevel(
  // deno-lint-ignore no-explicit-any
  admin: any,
  user: { id: string; app_metadata?: Record<string, unknown> },
  minLevel: RoleLevel | number,
): Promise<{ error: string; code: string; required: number; actual: number } | null> {
  const actual = await resolveRoleLevel(admin, user);
  if (actual >= minLevel) return null;
  return {
    error: `This action requires role level ${minLevel} or higher.`,
    code: 'INSUFFICIENT_ROLE',
    required: Number(minLevel),
    actual,
  };
}

/**
 * 403 body for a denied PERMISSION check, or null when the user is allowed.
 *
 * The sibling of denyBelowLevel, and it exists for the same reason: the 175
 * functions on the createSupabaseClient idiom hold a `user`, not an
 * AuthContext, and `requirePermission` additionally needs a lookup registered
 * with setPermissionLookup - which no edge function does, so it would deny
 * everyone whose token predates WF-R-03's permissions claim. This reads
 * `roles.permissions` directly on a claim miss, which is the query that
 * function's own documentation shows.
 *
 * Use this rather than a level check when the capability is what matters and
 * the seeder has a code for it. Use denyBelowLevel when it does not - per
 * SEC-EDGE-002 a gate naming an unseeded code denies every role below platform
 * admin, and that mistake is what this whole pair of stories is about.
 */
export async function denyWithoutPermission(
  // deno-lint-ignore no-explicit-any
  admin: any,
  user: { id: string; app_metadata?: Record<string, unknown> },
  permissions: string | string[],
): Promise<{ error: string; code: string; required: string[] } | null> {
  const needed = Array.isArray(permissions) ? permissions : [permissions];
  if (roleLevelClaim(user) === ROLE_LEVEL.PLATFORM_ADMIN) return null;

  let held: Set<string>;
  const claimed = user.app_metadata?.permissions;
  if (Array.isArray(claimed) && claimed.length > 0) {
    held = new Set(claimed as string[]);
  } else {
    const cached = permissionCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      held = cached.permissions;
    } else {
      held = new Set<string>();
      try {
        const { data } = await admin
          .from('users')
          .select('role:roles(permissions)')
          .eq('id', user.id)
          .maybeSingle();
        for (const code of flattenPermissions(data?.role?.permissions)) held.add(code);
      } catch (err) {
        // Fail closed. An empty set denies, which is what an unprivileged user
        // gets - a failed lookup must never open the gate.
        console.error('Permission lookup failed:', String(err));
      }
      permissionCache.set(user.id, {
        permissions: held,
        expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
      });
    }
  }

  for (const code of needed) {
    if (held.has(code)) return null;
    if (code.endsWith('.*')) {
      const prefix = code.slice(0, -1);
      for (const h of held) if (h.startsWith(prefix)) return null;
    }
  }
  return {
    error: `This action requires the ${needed.join(' or ')} permission.`,
    code: 'MISSING_PERMISSION',
    required: needed,
  };
}

// ─── Permission check with DB-backed fallback ────────────────────────────────

interface PermissionLookup {
  /**
   * Fetch the flat permission list for a user from the DB. Called on cache miss.
   * Implementation depends on the specific RBAC schema — wire up at use site.
   *
   * Default implementation reads `roles.permissions` JSONB and flattens to
   * 'module.resource.action' strings.
   */
  (userId: string): Promise<string[]>;
}

let _lookup: PermissionLookup | null = null;

/**
 * Register the permission lookup function at startup. Only needs to be called
 * once per edge function instance.
 *
 * Example:
 *   setPermissionLookup(async (userId) => {
 *     const { data } = await db
 *       .from('users')
 *       .select('role:roles(permissions)')
 *       .eq('id', userId)
 *       .maybeSingle();
 *     return flattenPermissions(data?.role?.permissions);
 *   });
 */
export function setPermissionLookup(fn: PermissionLookup): void {
  _lookup = fn;
}

/**
 * Flatten `roles.permissions` JSONB (e.g. { sales: { lead: ['view_own', 'view_team'] } })
 * into `['sales.lead.view_own', 'sales.lead.view_team']`.
 */
export function flattenPermissions(obj: unknown): string[] {
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

async function loadPermissions(ctx: AuthContext): Promise<Set<string>> {
  const cached = permissionCache.get(ctx.userId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  // 1. JWT claim — preferred, avoids DB hit
  const jwtPerms = ctx.supabaseUser.app_metadata?.permissions;
  if (Array.isArray(jwtPerms) && jwtPerms.length > 0) {
    const set = new Set(jwtPerms as string[]);
    permissionCache.set(ctx.userId, {
      permissions: set,
      expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
    });
    return set;
  }

  // 2. DB fallback
  if (_lookup) {
    const perms = await _lookup(ctx.userId);
    const set = new Set(perms);
    permissionCache.set(ctx.userId, {
      permissions: set,
      expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
    });
    return set;
  }

  return new Set();
}

/**
 * True if the user has ANY of the given permissions.
 */
export async function hasPermission(
  ctx: AuthContext,
  permissions: string | string[],
): Promise<boolean> {
  const needed = Array.isArray(permissions) ? permissions : [permissions];
  const userPerms = await loadPermissions(ctx);

  // Platform admin bypasses permission checks
  if (isPlatformAdmin(ctx)) return true;

  for (const p of needed) {
    if (userPerms.has(p)) return true;
    // Wildcard: 'sales.lead.*' matches 'sales.lead.view_own'
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -1); // 'sales.lead.'
      for (const up of userPerms) {
        if (up.startsWith(prefix)) return true;
      }
    }
  }
  return false;
}

/**
 * Throw RbacError unless the user has at least one of the given permissions.
 */
export async function requirePermission(
  ctx: AuthContext,
  permissions: string | string[],
): Promise<void> {
  const ok = await hasPermission(ctx, permissions);
  if (!ok) {
    const needed = Array.isArray(permissions) ? permissions : [permissions];
    throw new RbacError(
      'missing_permission',
      `Missing required permission: ${needed.join(' OR ')}`,
      { required: needed },
    );
  }
}

/**
 * Test-seam: clear the in-memory caches. Clears the LEVEL cache too - a test
 * that resets one and not the other reads a stale answer from the other.
 */
export function _clearPermissionCache(): void {
  permissionCache.clear();
  levelCache.clear();
}
