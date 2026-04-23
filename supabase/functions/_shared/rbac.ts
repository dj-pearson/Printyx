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

// ─── Permission check with DB-backed fallback ────────────────────────────────

type CacheEntry = { permissions: Set<string>; expiresAt: number };
const permissionCache = new Map<string, CacheEntry>();
const PERMISSION_CACHE_TTL_MS = 60 * 1000;

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
 * Test-seam: clear the in-memory cache.
 */
export function _clearPermissionCache(): void {
  permissionCache.clear();
}
