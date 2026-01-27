// =====================================================================
// ENHANCED RBAC MIDDLEWARE
// Comprehensive permission checking with database-driven permissions
// =====================================================================

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  permissions,
  enhancedRoles,
  rolePermissions,
  userRoleAssignments,
  permissionOverrides,
  permissionCache,
  organizationalUnits,
  rbacAuditLog,
  type Permission,
  type EnhancedRole,
  type UserRoleAssignment,
} from '../enhanced-rbac-schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

export interface EnhancedUserContext {
  id: string;
  tenantId: string;

  // Role and organizational context
  roleId: string;
  roleCode: string;
  roleLevel: number; // 1-8
  roleTier: 'platform' | 'company' | 'regional' | 'location';
  department: string;

  // Organizational positioning
  organizationalUnitId?: string;
  territoryScope: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'own';

  // Hierarchical access
  managerId?: string;
  teamId?: string;
  locationId?: string;
  regionId?: string;

  // Computed permissions
  permissions: Set<string>;
  permissionCodes: Set<string>;
  hasAllPermissions: boolean; // Platform admin flag

  // User details
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: EnhancedUserContext;
  permissionCheckResults?: {
    checked: string[];
    granted: string[];
    denied: string[];
  };
}

interface PermissionCheckOptions {
  minLevel?: number;
  minScope?: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'own';
  requireMFA?: boolean;
  requireApproval?: boolean;
  auditLog?: boolean;
}

// =====================================================================
// PERMISSION CACHE SERVICE
// =====================================================================

class PermissionCacheService {
  private static CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private static memoryCache = new Map<string, { permissions: Set<string>; expires: number }>();

  /**
   * Get cached permissions for a user
   */
  static async getCachedPermissions(
    userId: string,
    tenantId: string,
    organizationalContext: string,
  ): Promise<Set<string> | null> {
    // Check memory cache first (L1)
    const memoryCacheKey = `${userId}:${organizationalContext}`;
    const memoryEntry = this.memoryCache.get(memoryCacheKey);

    if (memoryEntry && memoryEntry.expires > Date.now()) {
      return memoryEntry.permissions;
    }

    // Check database cache (L2)
    const dbCache = await db
      .select()
      .from(permissionCache)
      .where(
        and(
          eq(permissionCache.userId, userId),
          eq(permissionCache.organizationalContext, organizationalContext),
          eq(permissionCache.tenantId, tenantId),
          sql`${permissionCache.expiresAt} > NOW()`,
        ),
      )
      .limit(1);

    if (dbCache.length > 0) {
      const cached = dbCache[0];
      const permissionSet = new Set<string>(cached.effectivePermissions as string[]);

      // Update memory cache
      this.memoryCache.set(memoryCacheKey, {
        permissions: permissionSet,
        expires: cached.expiresAt.getTime(),
      });

      // Increment cache hits
      await db
        .update(permissionCache)
        .set({ cacheHits: sql`${permissionCache.cacheHits} + 1` })
        .where(eq(permissionCache.id, cached.id));

      return permissionSet;
    }

    return null;
  }

  /**
   * Set cached permissions for a user
   */
  static async setCachedPermissions(
    userId: string,
    tenantId: string,
    organizationalContext: string,
    permissionSet: Set<string>,
    computationTime: number,
  ): Promise<void> {
    const permissionsArray = Array.from(permissionSet);
    const permissionHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(permissionsArray))
      .digest('hex');

    const expiresAt = new Date(Date.now() + this.CACHE_TTL);

    // Store in database
    await db.insert(permissionCache).values({
      userId,
      tenantId,
      organizationalContext,
      effectivePermissions: permissionsArray,
      permissionHash,
      expiresAt,
      computationTime,
      cacheHits: 0,
    });

    // Store in memory cache
    const memoryCacheKey = `${userId}:${organizationalContext}`;
    this.memoryCache.set(memoryCacheKey, {
      permissions: permissionSet,
      expires: expiresAt.getTime(),
    });
  }

  /**
   * Invalidate cache for a user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    // Clear memory cache
    for (const [key] of this.memoryCache) {
      if (key.startsWith(`${userId}:`)) {
        this.memoryCache.delete(key);
      }
    }

    // Delete from database
    await db.delete(permissionCache).where(eq(permissionCache.userId, userId));
  }

  /**
   * Cleanup expired cache entries (run periodically)
   */
  static async cleanupExpiredCache(): Promise<void> {
    // Cleanup memory cache
    const now = Date.now();
    for (const [key, value] of this.memoryCache) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Cleanup database cache
    await db.delete(permissionCache).where(sql`${permissionCache.expiresAt} <= NOW()`);
  }
}

// Run cache cleanup every 30 minutes
setInterval(() => PermissionCacheService.cleanupExpiredCache(), 30 * 60 * 1000);

// =====================================================================
// PERMISSION COMPUTATION SERVICE
// =====================================================================

class PermissionComputationService {
  /**
   * Compute all effective permissions for a user
   */
  static async computeUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<{ permissions: Set<string>; userContext: Partial<EnhancedUserContext> }> {
    const startTime = Date.now();

    // Get user's active role assignment
    const roleAssignment = await db
      .select({
        assignment: userRoleAssignments,
        role: enhancedRoles,
      })
      .from(userRoleAssignments)
      .innerJoin(enhancedRoles, eq(userRoleAssignments.roleId, enhancedRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.tenantId, tenantId),
          eq(userRoleAssignments.isActive, true),
          or(
            eq(userRoleAssignments.effectiveUntil, null),
            sql`${userRoleAssignments.effectiveUntil} > NOW()`,
          ),
        ),
      )
      .limit(1);

    // If no role assignment found in the new RBAC tables, check if user has a role string in users table
    if (roleAssignment.length === 0) {
      const [userWithRole] = await db
        .select()
        .from((await import('../db')).users)
        .where(eq((await import('../db')).users.id, userId))
        .limit(1);

      if (userWithRole && (userWithRole as any).role) {
        // User has a string role - grant permissions based on role string
        const roleString = (userWithRole as any).role;
        const roleLowerCase = roleString.toLowerCase();

        // Check if this is an admin role
        const isAdmin =
          roleLowerCase === 'admin' ||
          roleLowerCase === 'root_admin' ||
          roleLowerCase === 'platform_admin' ||
          roleLowerCase === 'company_admin' ||
          roleLowerCase === 'system_admin';

        // Grant all permissions for admin users
        const permissionSet = new Set<string>();
        if (isAdmin) {
          // Admin users get all permissions
          const allPerms = await db
            .select()
            .from(permissions)
            .where(eq(permissions.isActive, true));
          for (const perm of allPerms) {
            permissionSet.add(perm.code);
          }
        } else {
          // Non-admin users get basic permissions
          permissionSet.add('basic.view');
          permissionSet.add('own.data.view');
          permissionSet.add('own.data.edit');
        }

        // Determine role level
        let roleLevel = 1;
        if (
          roleLowerCase === 'admin' ||
          roleLowerCase === 'root_admin' ||
          roleLowerCase === 'platform_admin'
        ) {
          roleLevel = 8;
        } else if (roleLowerCase === 'company_admin' || roleLowerCase === 'director') {
          roleLevel = 7;
        } else if (roleLowerCase === 'manager' || roleLowerCase.includes('manager')) {
          roleLevel = 5;
        } else if (roleLowerCase === 'team_lead') {
          roleLevel = 3;
        } else if (roleLowerCase === 'technician' || roleLowerCase === 'sales_rep') {
          roleLevel = 2;
        }

        const userContext: Partial<EnhancedUserContext> = {
          roleId: roleString,
          roleCode: roleString.toUpperCase(),
          roleLevel,
          roleTier: roleLevel >= 8 ? 'platform' : roleLevel >= 7 ? 'company' : 'location',
          department: 'general',
          territoryScope: roleLevel >= 8 ? 'platform' : roleLevel >= 7 ? 'company' : 'own',
          hasAllPermissions: roleLevel >= 8,
        };

        const computationTime = Date.now() - startTime;
        console.log(
          `[RBAC] User ${userId} has string role '${roleString}' (level ${roleLevel}) - granting ${permissionSet.size} permissions`,
        );

        // Cache the computed permissions
        await PermissionCacheService.setCachedPermissions(
          userId,
          tenantId,
          'default',
          permissionSet,
          computationTime,
        );

        return { permissions: permissionSet, userContext };
      }

      throw new Error('No active role assignment found for user');
    }

    const { assignment, role } = roleAssignment[0];

    // Get role's permissions
    const rolePerms = await db
      .select({
        permission: permissions,
        rolePermission: rolePermissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, role.id),
          eq(rolePermissions.effect, 'ALLOW'),
          eq(permissions.isActive, true),
        ),
      );

    // Get user-specific permission overrides
    const overrides = await db
      .select({
        permission: permissions,
        override: permissionOverrides,
      })
      .from(permissionOverrides)
      .innerJoin(permissions, eq(permissionOverrides.permissionId, permissions.id))
      .where(
        and(
          eq(permissionOverrides.userId, userId),
          eq(permissionOverrides.isActive, true),
          or(
            eq(permissionOverrides.effectiveUntil, null),
            sql`${permissionOverrides.effectiveUntil} > NOW()`,
          ),
        ),
      );

    // Combine permissions and apply overrides
    const permissionSet = new Set<string>();

    // Add role permissions
    for (const { permission, rolePermission } of rolePerms) {
      permissionSet.add(permission.code);
    }

    // Apply overrides (ALLOW adds, DENY removes)
    for (const { permission, override } of overrides) {
      if (override.effect === 'ALLOW') {
        permissionSet.add(permission.code);
      } else if (override.effect === 'DENY') {
        permissionSet.delete(permission.code);
      }
    }

    // Determine hierarchy level (convert enum to number)
    const levelMap: Record<string, number> = {
      level_1: 1,
      level_2: 2,
      level_3: 3,
      level_4: 4,
      level_5: 5,
      level_6: 6,
      level_7: 7,
      level_8: 8,
    };
    const roleLevel = levelMap[role.hierarchyLevel] || 1;

    // Determine territory scope
    const territoryScope = this.determineTerritoryScope(role, assignment);

    const userContext: Partial<EnhancedUserContext> = {
      roleId: role.id,
      roleCode: role.code,
      roleLevel,
      roleTier: role.organizationalTier,
      department: role.department,
      organizationalUnitId: assignment.organizationalUnitId || undefined,
      territoryScope,
      hasAllPermissions: roleLevel === 8, // Platform admin
    };

    const computationTime = Date.now() - startTime;

    // Cache the computed permissions
    const organizationalContext = assignment.organizationalUnitId || 'default';
    await PermissionCacheService.setCachedPermissions(
      userId,
      tenantId,
      organizationalContext,
      permissionSet,
      computationTime,
    );

    return { permissions: permissionSet, userContext };
  }

  /**
   * Determine user's territory scope based on role and assignment
   */
  private static determineTerritoryScope(
    role: EnhancedRole,
    assignment: UserRoleAssignment,
  ): EnhancedUserContext['territoryScope'] {
    // Platform-level access
    if (role.organizationalTier === 'platform') {
      return 'platform';
    }

    // Company-level access
    if (role.organizationalTier === 'company' || role.hierarchyLevel === 'level_7') {
      return 'company';
    }

    // Regional-level access
    if (role.organizationalTier === 'regional' || role.hierarchyLevel === 'level_5') {
      return 'regional';
    }

    // Location-level access
    if (role.organizationalTier === 'location' || role.hierarchyLevel === 'level_4') {
      return 'location';
    }

    // Team-level access
    if (role.hierarchyLevel === 'level_2' || role.hierarchyLevel === 'level_3') {
      return 'team';
    }

    // Individual access
    return 'own';
  }
}

// =====================================================================
// MIDDLEWARE FUNCTIONS
// =====================================================================

/**
 * Enhanced user context middleware - builds full RBAC context
 * Must be used before any permission-checking middleware
 */
export const enhanceUserContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Skip if already enhanced
    if (req.user?.permissions) {
      return next();
    }

    // Get user ID from existing auth (session or JWT)
    const userId = req.session?.userId || req.user?.id;
    const tenantId = req.session?.tenantId || req.user?.tenantId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    // Try to get cached permissions
    const organizationalContext = 'default'; // Could be enhanced to include specific org unit
    const cachedPermissions = await PermissionCacheService.getCachedPermissions(
      userId,
      tenantId,
      organizationalContext,
    );

    let permissions: Set<string>;
    let userContext: Partial<EnhancedUserContext>;

    if (cachedPermissions) {
      // Use cached permissions
      permissions = cachedPermissions;

      // Need to fetch minimal user context for cached case
      const roleAssignment = await db
        .select({
          assignment: userRoleAssignments,
          role: enhancedRoles,
        })
        .from(userRoleAssignments)
        .innerJoin(enhancedRoles, eq(userRoleAssignments.roleId, enhancedRoles.id))
        .where(
          and(
            eq(userRoleAssignments.userId, userId),
            eq(userRoleAssignments.tenantId, tenantId),
            eq(userRoleAssignments.isActive, true),
          ),
        )
        .limit(1);

      if (roleAssignment.length === 0) {
        res.status(403).json({ error: 'No active role assignment found' });
        return;
      }

      const { assignment, role } = roleAssignment[0];
      const levelMap: Record<string, number> = {
        level_1: 1,
        level_2: 2,
        level_3: 3,
        level_4: 4,
        level_5: 5,
        level_6: 6,
        level_7: 7,
        level_8: 8,
      };

      userContext = {
        roleId: role.id,
        roleCode: role.code,
        roleLevel: levelMap[role.hierarchyLevel] || 1,
        roleTier: role.organizationalTier,
        department: role.department,
        organizationalUnitId: assignment.organizationalUnitId || undefined,
        hasAllPermissions: levelMap[role.hierarchyLevel] === 8,
      };
    } else {
      // Compute permissions
      try {
        const computed = await PermissionComputationService.computeUserPermissions(
          userId,
          tenantId,
        );
        permissions = computed.permissions;
        userContext = computed.userContext;
      } catch (permError) {
        // If permission computation fails, create a basic context for the user
        console.warn('Permission computation failed, using basic context:', permError);
        permissions = new Set(['basic.view']);
        userContext = {
          roleId: 'basic_user',
          roleCode: 'basic_user',
          roleLevel: 1,
          roleTier: 'location',
          department: 'general',
          hasAllPermissions: false,
        };
      }
    }

    // Build enhanced user context
    const enhancedUser: EnhancedUserContext = {
      id: userId,
      tenantId,
      permissions,
      permissionCodes: permissions,
      ...userContext,
    } as EnhancedUserContext;

    // Attach to request
    req.user = enhancedUser;
    next();
  } catch (error) {
    console.error('Enhanced RBAC context error:', error);
    res.status(500).json({ error: 'Failed to build user context' });
  }
};

/**
 * Require specific permission(s) - user needs ANY of the permissions
 */
export const requirePermission = (
  permission: string | string[],
  options: PermissionCheckOptions = {},
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    // Platform admins bypass all permission checks - LOG THIS FOR AUDIT
    if (req.user.hasAllPermissions) {
      logAdminBypass(req, 'PERMISSION', requiredPermissions);
      return next();
    }

    const userPermissions = req.user.permissions;

    // Check if user has ANY of the required permissions
    const hasPermission = requiredPermissions.some((perm) => userPermissions.has(perm));

    if (!hasPermission) {
      // Log failed permission check
      if (options.auditLog !== false) {
        logFailedPermissionCheck(req, requiredPermissions, 'requirePermission');
      }

      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        message: `Access denied. Required permission: ${requiredPermissions.join(' OR ')}`,
      });
      return;
    }

    // Additional option checks
    if (options.minLevel && req.user.roleLevel < options.minLevel) {
      res.status(403).json({
        error: 'Insufficient role level',
        requiredLevel: options.minLevel,
        userLevel: req.user.roleLevel,
      });
      return;
    }

    if (options.minScope) {
      const scopeHierarchy = ['own', 'team', 'location', 'regional', 'company', 'platform'];
      const userScopeIndex = scopeHierarchy.indexOf(req.user.territoryScope);
      const requiredScopeIndex = scopeHierarchy.indexOf(options.minScope);

      if (userScopeIndex < requiredScopeIndex) {
        res.status(403).json({
          error: 'Insufficient organizational scope',
          requiredScope: options.minScope,
          userScope: req.user.territoryScope,
        });
        return;
      }
    }

    next();
  };
};

/**
 * Require ALL specified permissions
 */
export const requireAllPermissions = (
  requiredPermissions: string[],
  options: PermissionCheckOptions = {},
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins bypass all permission checks - LOG THIS FOR AUDIT
    if (req.user.hasAllPermissions) {
      logAdminBypass(req, 'ALL_PERMISSIONS', requiredPermissions);
      return next();
    }

    const userPermissions = req.user.permissions;
    const missingPermissions = requiredPermissions.filter((perm) => !userPermissions.has(perm));

    if (missingPermissions.length > 0) {
      // Log failed permission check
      if (options.auditLog !== false) {
        logFailedPermissionCheck(req, requiredPermissions, 'requireAllPermissions');
      }

      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        missing: missingPermissions,
        message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * Require ANY of the specified permissions
 */
export const requireAnyPermission = (
  requiredPermissions: string[],
  options: PermissionCheckOptions = {},
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins bypass all permission checks - LOG THIS FOR AUDIT
    if (req.user.hasAllPermissions) {
      logAdminBypass(req, 'ANY_PERMISSION', requiredPermissions);
      return next();
    }

    const userPermissions = req.user.permissions;
    const hasAny = requiredPermissions.some((perm) => userPermissions.has(perm));

    if (!hasAny) {
      // Log failed permission check
      if (options.auditLog !== false) {
        logFailedPermissionCheck(req, requiredPermissions, 'requireAnyPermission');
      }

      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        message: `Access denied. Requires at least one of: ${requiredPermissions.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * Require minimum role level
 */
export const requireLevel = (
  minLevel: number,
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.roleLevel < minLevel) {
      res.status(403).json({
        error: 'Insufficient role level',
        requiredLevel: minLevel,
        userLevel: req.user.roleLevel,
        message: `Access denied. Requires level ${minLevel} or higher.`,
      });
      return;
    }

    next();
  };
};

/**
 * Require minimum organizational scope
 */
export const requireScope = (
  minScope: 'own' | 'team' | 'location' | 'regional' | 'company' | 'platform',
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const scopeHierarchy = ['own', 'team', 'location', 'regional', 'company', 'platform'];
    const userScopeIndex = scopeHierarchy.indexOf(req.user.territoryScope);
    const requiredScopeIndex = scopeHierarchy.indexOf(minScope);

    if (userScopeIndex < requiredScopeIndex) {
      res.status(403).json({
        error: 'Insufficient organizational scope',
        requiredScope: minScope,
        userScope: req.user.territoryScope,
        message: `Access denied. Requires ${minScope} scope or higher.`,
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has a specific permission (for use in route logic)
 */
export const hasPermission = (req: AuthenticatedRequest, permission: string): boolean => {
  if (!req.user) return false;
  if (req.user.hasAllPermissions) return true;
  return req.user.permissions.has(permission);
};

/**
 * Check if user has ALL specified permissions (for use in route logic)
 */
export const hasAllPermissions = (
  req: AuthenticatedRequest,
  requiredPermissions: string[],
): boolean => {
  if (!req.user) return false;
  if (req.user.hasAllPermissions) return true;
  return requiredPermissions.every((perm) => req.user!.permissions.has(perm));
};

/**
 * Check if user has ANY of the specified permissions (for use in route logic)
 */
export const hasAnyPermission = (
  req: AuthenticatedRequest,
  requiredPermissions: string[],
): boolean => {
  if (!req.user) return false;
  if (req.user.hasAllPermissions) return true;
  return requiredPermissions.some((perm) => req.user!.permissions.has(perm));
};

// =====================================================================
// MFA ENFORCEMENT MIDDLEWARE
// =====================================================================

/**
 * Require MFA verification for sensitive operations
 * Checks if the user has verified MFA within the session
 */
export const requireMFA = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user has MFA enabled and verified in current session
  const mfaVerified = req.session?.mfaVerified === true;
  const mfaVerifiedAt = req.session?.mfaVerifiedAt;

  // MFA verification expires after 30 minutes of inactivity
  const MFA_TIMEOUT = 30 * 60 * 1000;
  const mfaExpired = mfaVerifiedAt && Date.now() - mfaVerifiedAt > MFA_TIMEOUT;

  if (!mfaVerified || mfaExpired) {
    // Log MFA requirement
    logRBACEvent(req, 'MFA_REQUIRED', {
      action: req.method,
      resource: req.path,
      mfaVerified,
      mfaExpired,
    });

    res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
      message: 'This action requires multi-factor authentication verification.',
      redirectTo: '/auth/mfa/verify',
    });
    return;
  }

  next();
};

/**
 * Middleware factory for permissions that require MFA
 */
export const requirePermissionWithMFA = (
  permission: string | string[],
  options: PermissionCheckOptions = {},
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // First check permission
    const permissionCheck = requirePermission(permission, { ...options, auditLog: false });
    permissionCheck(req, res, (err?: any) => {
      if (err || res.headersSent) return;

      // Then check MFA
      requireMFA(req, res, next);
    });
  };
};

// =====================================================================
// APPROVAL WORKFLOW MIDDLEWARE
// =====================================================================

/**
 * Check if an action requires approval and whether it's been approved
 */
export const checkApprovalRequired = async (
  permissionCode: string,
  userId: string,
  tenantId: string,
  resourceId?: string,
): Promise<{ required: boolean; approved: boolean; pendingApprovalId?: string }> => {
  // Get permission definition to check if approval is required
  const [permission] = await db
    .select()
    .from(permissions)
    .where(eq(permissions.code, permissionCode))
    .limit(1);

  if (!permission || !permission.requiresApproval) {
    return { required: false, approved: true };
  }

  // Check for pending or approved override
  const [override] = await db
    .select()
    .from(permissionOverrides)
    .where(
      and(
        eq(permissionOverrides.userId, userId),
        eq(permissionOverrides.permissionId, permission.id),
        eq(permissionOverrides.isActive, true),
        sql`${permissionOverrides.effectiveUntil} > NOW() OR ${permissionOverrides.effectiveUntil} IS NULL`,
      ),
    )
    .limit(1);

  if (override) {
    if (override.approvalStatus === 'APPROVED') {
      return { required: true, approved: true };
    } else if (override.approvalStatus === 'PENDING') {
      return { required: true, approved: false, pendingApprovalId: override.id };
    }
  }

  return { required: true, approved: false };
};

/**
 * Middleware that checks for approval on sensitive operations
 */
export const requireApproval = (
  permissionCode: string,
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins bypass approval requirements - LOG THIS FOR AUDIT
    if (req.user.hasAllPermissions) {
      logAdminBypass(req, 'APPROVAL', [permissionCode], {
        resourceId: req.params.id || req.body?.resourceId,
      });
      return next();
    }

    const resourceId = req.params.id || req.body?.resourceId;

    try {
      const approvalStatus = await checkApprovalRequired(
        permissionCode,
        req.user.id,
        req.user.tenantId,
        resourceId,
      );

      if (approvalStatus.required && !approvalStatus.approved) {
        logRBACEvent(req, 'APPROVAL_REQUIRED', {
          permissionCode,
          resourceId,
          pendingApprovalId: approvalStatus.pendingApprovalId,
        });

        res.status(403).json({
          error: 'Approval required',
          code: 'APPROVAL_REQUIRED',
          message: 'This action requires approval from a supervisor.',
          permissionCode,
          pendingApprovalId: approvalStatus.pendingApprovalId,
          requestApprovalEndpoint: '/api/rbac/request-approval',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Approval check error:', error);
      res.status(500).json({ error: 'Failed to check approval status' });
    }
  };
};

// =====================================================================
// AUDIT LOGGING SERVICE
// =====================================================================

interface RBACLogEntry {
  timestamp: string;
  eventType: string;
  userId?: string;
  tenantId?: string;
  roleCode?: string;
  roleLevel?: number;
  details: Record<string, any>;
  route: string;
  method: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * Log admin bypass events for audit trail
 * CRITICAL: All permission bypasses by platform admins must be logged
 */
async function logAdminBypass(
  req: AuthenticatedRequest,
  bypassType: 'PERMISSION' | 'ALL_PERMISSIONS' | 'ANY_PERMISSION' | 'APPROVAL' | 'LEVEL' | 'SCOPE',
  requiredPermissions: string[] | null,
  additionalDetails: Record<string, any> = {},
): Promise<void> {
  const details: Record<string, any> = {
    bypassType,
    requiredPermissions,
    userRoleLevel: req.user?.roleLevel,
    userRoleCode: req.user?.roleCode,
    hasAllPermissions: req.user?.hasAllPermissions,
    requestBody: req.body ? Object.keys(req.body) : [], // Log keys only, not values (security)
    requestParams: req.params,
    requestQuery: req.query,
    ...additionalDetails,
  };

  await logRBACEvent(req, 'ADMIN_BYPASS', details);
}

/**
 * Log RBAC events for audit purposes
 * Writes to both console and database for compliance
 */
async function logRBACEvent(
  req: AuthenticatedRequest,
  eventType: string,
  details: Record<string, any>,
): Promise<void> {
  const logEntry: RBACLogEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
    roleCode: req.user?.roleCode,
    roleLevel: req.user?.roleLevel,
    details,
    route: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    sessionId: req.session?.id,
    requestId: (req as any).requestId,
  };

  // Log to console for immediate visibility
  // ADMIN_BYPASS events are logged at 'warn' level for security monitoring
  const logLevel = [
    'PERMISSION_DENIED',
    'MFA_REQUIRED',
    'APPROVAL_REQUIRED',
    'ADMIN_BYPASS',
  ].includes(eventType)
    ? 'warn'
    : 'info';
  console[logLevel](`[RBAC] ${eventType}:`, JSON.stringify(logEntry, null, 2));

  // Write to database asynchronously (fire and forget for performance)
  try {
    await db
      .insert(rbacAuditLog)
      .values({
        eventType,
        userId: req.user?.id || null,
        tenantId: req.user?.tenantId || null,
        roleCode: req.user?.roleCode || null,
        roleLevel: req.user?.roleLevel || null,
        details,
        route: req.path,
        method: req.method,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        sessionId: req.session?.id || null,
        requestId: (req as any).requestId || null,
      })
      .catch((err) => {
        // Table might not exist yet - silently fail
        if (!err.message?.includes('does not exist')) {
          console.error('[RBAC] Audit log write error:', err);
        }
      });
  } catch (error) {
    // Non-critical - don't fail the request
    console.error('[RBAC] Audit log error:', error);
  }
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

/**
 * Log failed permission checks for audit purposes
 */
function logFailedPermissionCheck(
  req: AuthenticatedRequest,
  requiredPermissions: string[],
  checkType: string,
): void {
  logRBACEvent(req, 'PERMISSION_DENIED', {
    checkType,
    requiredPermissions,
    userPermissions: req.user?.permissions ? Array.from(req.user.permissions) : [],
  });
}

/**
 * Invalidate permissions cache for a user (call after role changes)
 */
export async function invalidateUserPermissionCache(userId: string): Promise<void> {
  await PermissionCacheService.invalidateUserCache(userId);
}

/**
 * Get user's effective permissions (for debugging/admin UI)
 */
export async function getUserEffectivePermissions(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const { permissions } = await PermissionComputationService.computeUserPermissions(
    userId,
    tenantId,
  );
  return Array.from(permissions);
}
