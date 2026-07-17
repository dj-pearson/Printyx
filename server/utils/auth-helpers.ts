/**
 * Auth Helpers
 * Unified authentication utilities that support both Supabase JWT and session-based auth.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Adapt a handler that declares a NARROWED request type (AuthenticatedRequest,
 * TenantRequest, ImportRequest, ...) into a plain Express RequestHandler.
 *
 * WHY THIS EXISTS (QUALITY-002). Writing the narrowed type directly on the handler:
 *
 *   app.get('/x', mw, async (req: AuthenticatedRequest, res) => { ... })
 *                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * does not typecheck. Express's RequestHandler accepts a plain `Request`, and under
 * `strictFunctionTypes` a function that demands a NARROWER parameter is not
 * assignable to one that must accept any Request — the middleware chain is not
 * obliged to have attached `user`/`tenantId` by the time the handler runs. tsc
 * reports it as an unhelpful "TS2769: No overload matches this call" on the route
 * registration, which is the single largest error cluster in the server tree.
 *
 * The narrowing is a real claim about runtime state (the auth middleware DID run),
 * it just isn't one the type system can see. So assert it ONCE, here, at the Express
 * boundary — the same idiom the RBAC middleware factories and chainMiddleware in
 * middleware/rbac-route-helper.ts already use — instead of scattering `as any` or
 * `(req as AuthenticatedRequest)` casts through every handler body.
 *
 * The request type is inferred from the handler's own annotation, so callers pass no
 * explicit generic:
 *
 *   app.get('/x', mw, authed(async (req: AuthenticatedRequest, res) => { ... }))
 *
 * NOTE this is an assertion, not a check: it does not verify the middleware ran. It
 * moves an existing unchecked assumption to one auditable place; it does not create
 * one. Handlers must still resolve identity via getUserId/getTenantId, which return
 * undefined rather than fabricating a value.
 */
export function authed<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return handler as unknown as RequestHandler;
}

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
 *
 * SECURITY: Uses explicit checks only to prevent false positives.
 * Pattern matching (e.g., 'admin' substring) is avoided because it could
 * match non-admin roles like 'administrator_assistant' or 'system_monitor'.
 *
 * Detection priority:
 * 1. isPlatformUser flag from JWT/user object (most reliable)
 * 2. roleLevel >= 8 (explicit level check from RBAC system)
 * 3. hasAllPermissions flag (from enhanced RBAC middleware)
 * 4. Exact role code match (not substring) for known admin roles
 *
 * @param req Express Request object
 * @returns boolean
 */
export function isPlatformAdmin(req: Request): boolean {
  const reqAny = req as any;

  // Priority 1: Check explicit isPlatformUser flag from JWT
  if (reqAny.supabaseUser?.isPlatformUser === true) {
    return true;
  }

  // Priority 2: Check isPlatformUser flag from user object (set by middleware)
  if (reqAny.user?.isPlatformUser === true) {
    return true;
  }

  // Priority 3: Check role level (level 8 = platform admin in RBAC hierarchy)
  const roleLevel = reqAny.user?.roleLevel;
  if (typeof roleLevel === 'number' && roleLevel >= 8) {
    return true;
  }

  // Priority 4: Check hasAllPermissions flag (from enhanced RBAC middleware)
  if (reqAny.user?.hasAllPermissions === true) {
    return true;
  }

  // Priority 5: Check for exact role code matches (not substring matching)
  // This prevents false positives like 'administrator_assistant' matching 'admin'
  const roleCode = (reqAny.user?.roleCode || '').toLowerCase();
  const roleName = (reqAny.user?.role?.name || '').toLowerCase();
  // Handle role as either string or object with name property
  const role = reqAny.user?.role;
  const roleString = (typeof role === 'string' ? role : '').toLowerCase();

  // Only exact matches for known platform admin role codes
  const exactAdminRoles = [
    'admin',
    'root_admin',
    'platform_admin',
    'system_admin',
    'super_admin',
    'company_admin', // Company-level admin
  ];

  if (
    exactAdminRoles.includes(roleCode) ||
    exactAdminRoles.includes(roleName) ||
    exactAdminRoles.includes(roleString)
  ) {
    return true;
  }

  return false;
}

/**
 * Get the user's role level from the request.
 * Role levels follow the 8-level hierarchy:
 * 8 = Platform Admin, 7 = Company Admin, 6 = Director, etc.
 *
 * @param req Express Request object
 * @returns Role level number or undefined
 */
export function getRoleLevel(req: Request): number | undefined {
  const reqAny = req as any;

  if (typeof reqAny.user?.roleLevel === 'number') {
    return reqAny.user.roleLevel;
  }

  if (typeof reqAny.supabaseUser?.roleLevel === 'number') {
    return reqAny.supabaseUser.roleLevel;
  }

  return undefined;
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
