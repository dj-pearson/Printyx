/**
 * Auth Helpers
 * Unified authentication utilities that support both Supabase JWT and session-based auth.
 */

import { Request } from 'express';

/**
 * Get the authenticated user's ID from the request.
 * Supports multiple authentication methods in priority order:
 * 1. Supabase JWT (req.supabaseUser.id)
 * 2. User object from isAuthenticated middleware (req.user.id or req.user.claims.sub)
 * 3. Session-based auth (req.session.userId)
 *
 * @param req Express Request object
 * @returns User ID string or undefined if not authenticated
 */
export function getUserId(req: Request): string | undefined {
  const reqAny = req as any;

  // Priority 1: Supabase JWT user
  if (reqAny.supabaseUser?.id) {
    return reqAny.supabaseUser.id;
  }

  // Priority 2: User object from isAuthenticated middleware
  if (reqAny.user?.id) {
    return reqAny.user.id;
  }

  // Priority 3: User claims (from isAuthenticated middleware with Supabase)
  if (reqAny.user?.claims?.sub) {
    return reqAny.user.claims.sub;
  }

  // Priority 4: Session-based auth
  if (reqAny.session?.userId) {
    return reqAny.session.userId;
  }

  return undefined;
}

/**
 * Get the tenant ID from the request.
 * Supports multiple resolution methods in priority order:
 * 1. Already resolved tenantId (from resolveTenant middleware)
 * 2. Supabase JWT app_metadata
 * 3. User object from isAuthenticated middleware
 * 4. Session
 *
 * @param req Express Request object
 * @returns Tenant ID string or undefined
 */
export function getTenantId(req: Request): string | undefined {
  const reqAny = req as any;

  // Priority 1: Already resolved by resolveTenant middleware
  if (reqAny.tenantId) {
    return reqAny.tenantId;
  }

  // Priority 2: Supabase JWT tenant
  if (reqAny.supabaseUser?.tenantId) {
    return reqAny.supabaseUser.tenantId;
  }

  // Priority 3: User object from isAuthenticated middleware
  if (reqAny.user?.tenantId) {
    return reqAny.user.tenantId;
  }

  // Priority 4: Session
  if (reqAny.session?.tenantId) {
    return reqAny.session.tenantId;
  }

  return undefined;
}

/**
 * Check if the request is authenticated.
 *
 * @param req Express Request object
 * @returns boolean
 */
export function isAuthenticated(req: Request): boolean {
  return getUserId(req) !== undefined;
}

/**
 * Get the user's role ID from the request.
 *
 * @param req Express Request object
 * @returns Role ID string or undefined
 */
export function getRoleId(req: Request): string | undefined {
  const reqAny = req as any;

  if (reqAny.supabaseUser?.roleId) {
    return reqAny.supabaseUser.roleId;
  }

  if (reqAny.user?.roleId) {
    return reqAny.user.roleId;
  }

  return undefined;
}

/**
 * Get the user's access scope from the request.
 *
 * @param req Express Request object
 * @returns Access scope string or 'own' as default
 */
export function getAccessScope(req: Request): string {
  const reqAny = req as any;

  if (reqAny.supabaseUser?.accessScope) {
    return reqAny.supabaseUser.accessScope;
  }

  if (reqAny.user?.accessScope) {
    return reqAny.user.accessScope;
  }

  return 'own';
}

/**
 * Check if the user is a platform admin.
 * Checks multiple sources: isPlatformUser flag, role level, and role string.
 *
 * @param req Express Request object
 * @returns boolean
 */
export function isPlatformAdmin(req: Request): boolean {
  const reqAny = req as any;

  // Check explicit isPlatformUser flag
  if (reqAny.supabaseUser?.isPlatformUser) {
    return true;
  }

  if (reqAny.user?.isPlatformUser) {
    return true;
  }

  // Check role level (level 8 = platform admin)
  if (reqAny.user?.roleLevel >= 8) {
    return true;
  }

  // Check hasAllPermissions flag (from enhanced RBAC)
  if (reqAny.user?.hasAllPermissions) {
    return true;
  }

  // Check role code/name for admin patterns
  const roleCode = reqAny.user?.roleCode?.toLowerCase() || '';
  const roleName = reqAny.user?.role?.name?.toLowerCase() || '';

  const adminPatterns = ['admin', 'root', 'platform', 'system'];
  const isAdminRole = adminPatterns.some(
    (pattern) => roleCode.includes(pattern) || roleName.includes(pattern),
  );

  return isAdminRole;
}

/**
 * Get full user context from the request.
 * Returns a standardized user object regardless of auth method.
 */
export interface UserContext {
  id: string;
  email?: string;
  tenantId?: string;
  roleId?: string;
  accessScope: string;
  isPlatformUser: boolean;
}

export function getUserContext(req: Request): UserContext | null {
  const userId = getUserId(req);
  if (!userId) {
    return null;
  }

  const reqAny = req as any;

  return {
    id: userId,
    email: reqAny.supabaseUser?.email || reqAny.user?.email,
    tenantId: getTenantId(req),
    roleId: getRoleId(req),
    accessScope: getAccessScope(req),
    isPlatformUser: isPlatformAdmin(req),
  };
}
