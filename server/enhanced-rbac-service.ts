import { db } from './db';
import { sql, and, or, gte, lte, eq, inArray, desc } from 'drizzle-orm';
import {
  organizationalUnits,
  enhancedRoles,
  permissions,
  rolePermissions,
  userRoleAssignments,
  permissionOverrides,
  permissionCache,
  type OrganizationalUnit,
  type EnhancedRole,
  type Permission,
  type UserRoleAssignment,
  type PermissionOverride
} from './enhanced-rbac-schema';
import { createHash } from 'crypto';

interface OrganizationalContext {
  tenantId: string;
  unitId?: string;
  locationId?: string;
  regionId?: string;
}

interface EffectivePermission {
  permissionCode: string;
  module: string;
  resourceType: string;
  action: string;
  scopeLevel: string;
  effect: 'ALLOW' | 'DENY';
  source: 'role' | 'override';
  constraints?: any;
}

interface PermissionQuery {
  userId: string;
  permissionCode: string;
  organizationalContext: OrganizationalContext;
  resourceId?: string;
}

export class EnhancedRBACService {
  private cacheManager: Map<string, any> = new Map();
  private readonly CACHE_TTL_SECONDS = 1800; // 30 minutes

  /**
   * Check if a user has a specific permission in a given organizational context
   */
  async hasPermission(query: PermissionQuery): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(
      query.userId,
      query.organizationalContext
    );

    const permission = effectivePermissions.find(p => p.permissionCode === query.permissionCode);
    
    if (!permission) {
      return false;
    }

    // DENY takes precedence over ALLOW
    const denyPermission = effectivePermissions.find(
      p => p.permissionCode === query.permissionCode && p.effect === 'DENY'
    );
    
    if (denyPermission) {
      return false;
    }

    // Check additional constraints if present
    if (permission.constraints && Object.keys(permission.constraints).length > 0) {
      return await this.evaluateConstraints(query, permission.constraints);
    }

    return permission.effect === 'ALLOW';
  }

  /**
   * Get all effective permissions for a user in an organizational context
   */
  async getEffectivePermissions(
    userId: string, 
    orgContext: OrganizationalContext
  ): Promise<EffectivePermission[]> {
    const cacheKey = this.generateCacheKey(userId, orgContext);
    
    // Check L1 cache
    if (this.cacheManager.has(cacheKey)) {
      const cached = this.cacheManager.get(cacheKey);
      if (cached.expiresAt > Date.now()) {
        await this.updateCacheHits(cacheKey);
        return cached.permissions;
      }
    }

    // Check L2 cache (database)
    const dbCached = await this.getFromPermissionCache(cacheKey);
    if (dbCached) {
      this.cacheManager.set(cacheKey, {
        permissions: dbCached.effectivePermissions,
        expiresAt: dbCached.expiresAt.getTime()
      });
      return dbCached.effectivePermissions as EffectivePermission[];
    }

    // Compute permissions from scratch
    const computeStart = Date.now();
    const permissions = await this.computeEffectivePermissions(userId, orgContext);
    const computeTime = Date.now() - computeStart;

    // Cache the results
    await this.cachePermissions(cacheKey, permissions, computeTime, orgContext.tenantId);
    
    return permissions;
  }

  /**
   * Compute effective permissions using hierarchical role resolution
   */
  private async computeEffectivePermissions(
    userId: string,
    orgContext: OrganizationalContext
  ): Promise<EffectivePermission[]> {
    const permissionsMap = new Map<string, EffectivePermission>();

    // Get user's role assignments with organizational hierarchy
    const roleAssignments = await this.getUserRoleAssignments(userId, orgContext);

    // Process each role assignment and inherited roles
    for (const assignment of roleAssignments) {
      const rolePermissions = await this.getRolePermissionsWithInheritance(
        assignment.roleId,
        orgContext
      );

      // Add permissions to map (DENY overrides ALLOW)
      for (const permission of rolePermissions) {
        const key = permission.permissionCode;
        const existing = permissionsMap.get(key);

        if (!existing || permission.effect === 'DENY') {
          permissionsMap.set(key, permission);
        }
      }
    }

    // Apply permission overrides
    const overrides = await this.getActivePermissionOverrides(userId, orgContext);
    for (const override of overrides) {
      const permission = await this.getPermissionByCode(override.permissionId);
      if (permission) {
        permissionsMap.set(permission.code, {
          permissionCode: permission.code,
          module: permission.module,
          resourceType: permission.resourceType,
          action: permission.action,
          scopeLevel: permission.scopeLevel,
          effect: override.effect as 'ALLOW' | 'DENY',
          source: 'override'
        });
      }
    }

    return Array.from(permissionsMap.values());
  }

  /**
   * Get user role assignments with organizational context filtering
   */
  private async getUserRoleAssignments(
    userId: string,
    orgContext: OrganizationalContext
  ): Promise<UserRoleAssignment[]> {
    const now = new Date();

    return await db.select().from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.tenantId, orgContext.tenantId),
          eq(userRoleAssignments.isActive, true),
          lte(userRoleAssignments.effectiveFrom, now),
          or(
            eq(userRoleAssignments.effectiveUntil, null),
            gte(userRoleAssignments.effectiveUntil, now)
          ),
          orgContext.unitId ? eq(userRoleAssignments.organizationalUnitId, orgContext.unitId) : undefined
        )
      );
  }

  /**
   * Get role permissions including inherited permissions from parent roles
   */
  private async getRolePermissionsWithInheritance(
    roleId: string,
    orgContext: OrganizationalContext
  ): Promise<EffectivePermission[]> {
    // Get the role and its hierarchy using nested set model
    const roleHierarchy = await db
      .select({
        role: enhancedRoles,
        permission: permissions,
        rolePermission: rolePermissions
      })
      .from(enhancedRoles)
      .innerJoin(
        enhancedRoles as any, // Parent roles
        and(
          gte((enhancedRoles as any).lft, enhancedRoles.lft),
          lte((enhancedRoles as any).rght, enhancedRoles.rght),
          eq((enhancedRoles as any).tenantId, orgContext.tenantId)
        )
      )
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, (enhancedRoles as any).id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(enhancedRoles.id, roleId))
      .orderBy(enhancedRoles.depth, desc(rolePermissions.effect)); // DENY takes precedence

    return roleHierarchy.map(row => ({
      permissionCode: row.permission.code,
      module: row.permission.module,
      resourceType: row.permission.resourceType,
      action: row.permission.action,
      scopeLevel: row.permission.scopeLevel,
      effect: row.rolePermission.effect as 'ALLOW' | 'DENY',
      source: 'role' as const,
      constraints: row.rolePermission.conditions
    }));
  }

  /**
   * Get active permission overrides for a user
   */
  private async getActivePermissionOverrides(
    userId: string,
    orgContext: OrganizationalContext
  ): Promise<PermissionOverride[]> {
    const now = new Date();

    return await db.select().from(permissionOverrides)
      .where(
        and(
          eq(permissionOverrides.userId, userId),
          eq(permissionOverrides.tenantId, orgContext.tenantId),
          eq(permissionOverrides.isActive, true),
          lte(permissionOverrides.effectiveFrom, now),
          or(
            eq(permissionOverrides.effectiveUntil, null),
            gte(permissionOverrides.effectiveUntil, now)
          )
        )
      );
  }

  /**
   * Create a new role with permissions
   */
  async createRole(
    roleData: {
      name: string;
      code: string;
      description?: string;
      hierarchyLevel: string;
      organizationalTier: string;
      department: string;
      tenantId: string;
      organizationalUnitId?: string;
      parentRoleId?: string;
    },
    permissionCodes: string[],
    createdBy: string
  ): Promise<EnhancedRole> {
    // Calculate position in nested set
    const position = await this.calculateNestedSetPosition(roleData.parentRoleId);

    const [role] = await db.insert(enhancedRoles).values({
      ...roleData,
      lft: position.lft,
      rght: position.rght,
      depth: position.depth,
      createdBy
    }).returning();

    // Add permissions
    if (permissionCodes.length > 0) {
      await this.assignPermissionsToRole(role.id, permissionCodes);
    }

    // Invalidate cache
    await this.invalidateCache(roleData.tenantId);

    return role;
  }

  /**
   * Customize a role's permissions (for Company Admins)
   */
  async customizeRolePermissions(
    roleId: string,
    permissionChanges: Array<{
      permissionCode: string;
      effect: 'ALLOW' | 'DENY';
      reason: string;
    }>,
    customizedBy: string
  ): Promise<void> {
    const role = await db.select().from(enhancedRoles)
      .where(eq(enhancedRoles.id, roleId))
      .limit(1);

    if (!role[0] || !role[0].isCustomizable) {
      throw new Error('Role is not customizable');
    }

    // Apply permission changes
    for (const change of permissionChanges) {
      const permission = await this.getPermissionByCode(change.permissionCode);
      if (!permission) continue;

      // Remove existing permission
      await db.delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, roleId),
            eq(rolePermissions.permissionId, permission.id)
          )
        );

      // Add new permission with customization tracking
      await db.insert(rolePermissions).values({
        roleId,
        permissionId: permission.id,
        effect: change.effect,
        isCustomized: true,
        customizedBy,
        customizedAt: new Date(),
        customizationReason: change.reason
      });
    }

    // Invalidate cache
    await this.invalidateCache(role[0].tenantId);
  }

  /**
   * Create a permission override for exceptional access
   */
  async createPermissionOverride(
    overrideData: {
      userId: string;
      permissionCode: string;
      effect: 'ALLOW' | 'DENY';
      overrideReason: string;
      businessJustification: string;
      effectiveFrom: Date;
      effectiveUntil?: Date;
      tenantId: string;
      organizationalUnitId?: string;
    },
    requestedBy: string,
    approvedBy?: string
  ): Promise<PermissionOverride> {
    const permission = await this.getPermissionByCode(overrideData.permissionCode);
    if (!permission) {
      throw new Error('Permission not found');
    }

    const [override] = await db.insert(permissionOverrides).values({
      ...overrideData,
      permissionId: permission.id,
      requestedBy,
      approvedBy,
      approvalDate: approvedBy ? new Date() : undefined,
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    }).returning();

    // Invalidate cache
    await this.invalidateCache(overrideData.tenantId);

    return override;
  }

  /**
   * Evaluate additional permission constraints
   */
  private async evaluateConstraints(query: PermissionQuery, constraints: any): Promise<boolean> {
    // Time-based constraints
    if (constraints.timeRestrictions) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      if (constraints.timeRestrictions.allowedHours) {
        const [startHour, endHour] = constraints.timeRestrictions.allowedHours;
        if (currentHour < startHour || currentHour > endHour) {
          return false;
        }
      }

      if (constraints.timeRestrictions.allowedDays) {
        if (!constraints.timeRestrictions.allowedDays.includes(currentDay)) {
          return false;
        }
      }
    }

    // Location-based constraints
    if (constraints.locationRestrictions && query.organizationalContext.locationId) {
      const allowedLocations = constraints.locationRestrictions.allowedLocations || [];
      if (allowedLocations.length > 0 && 
          !allowedLocations.includes(query.organizationalContext.locationId)) {
        return false;
      }
    }

    // Resource-specific constraints
    if (constraints.resourceConstraints && query.resourceId) {
      // Implement resource-specific logic here
      // This could include ownership checks, approval status, etc.
    }

    return true;
  }

  // Cache management methods
  private generateCacheKey(userId: string, orgContext: OrganizationalContext): string {
    const contextStr = `${orgContext.tenantId}:${orgContext.unitId || ''}:${orgContext.locationId || ''}:${orgContext.regionId || ''}`;
    return createHash('sha256').update(`${userId}:${contextStr}`).digest('hex');
  }

  private async getFromPermissionCache(cacheKey: string): Promise<any> {
    const [cached] = await db.select().from(permissionCache)
      .where(
        and(
          eq(permissionCache.permissionHash, cacheKey),
          gte(permissionCache.expiresAt, new Date())
        )
      )
      .limit(1);

    return cached;
  }

  private async cachePermissions(
    cacheKey: string,
    permissions: EffectivePermission[],
    computeTime: number,
    tenantId: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.CACHE_TTL_SECONDS * 1000);

    // Store in L1 cache
    this.cacheManager.set(cacheKey, {
      permissions,
      expiresAt: expiresAt.getTime()
    });

    // Store in L2 cache (database)
    await db.insert(permissionCache).values({
      userId: permissions[0]?.permissionCode || '', // This should be improved
      organizationalContext: cacheKey,
      effectivePermissions: permissions,
      permissionHash: cacheKey,
      computedAt: new Date(),
      expiresAt,
      computationTime: computeTime,
      tenantId
    }).onConflictDoUpdate({
      target: permissionCache.permissionHash,
      set: {
        effectivePermissions: permissions,
        computedAt: new Date(),
        expiresAt,
        computationTime: computeTime,
        cacheHits: sql`${permissionCache.cacheHits} + 1`
      }
    });
  }

  private async updateCacheHits(cacheKey: string): Promise<void> {
    await db.update(permissionCache)
      .set({ cacheHits: sql`${permissionCache.cacheHits} + 1` })
      .where(eq(permissionCache.permissionHash, cacheKey));
  }

  private async invalidateCache(tenantId: string): Promise<void> {
    // Clear L1 cache
    this.cacheManager.clear();

    // Clear L2 cache for tenant
    await db.delete(permissionCache)
      .where(eq(permissionCache.tenantId, tenantId));
  }

  // Helper methods
  private async getPermissionByCode(code: string): Promise<Permission | null> {
    const [permission] = await db.select().from(permissions)
      .where(eq(permissions.code, code))
      .limit(1);
    
    return permission || null;
  }

  private async calculateNestedSetPosition(parentRoleId?: string): Promise<{lft: number, rght: number, depth: number}> {
    if (!parentRoleId) {
      // Root level
      const [maxRight] = await db.select({ maxRght: sql<number>`COALESCE(MAX(rght), 0)` })
        .from(enhancedRoles);
      
      return {
        lft: (maxRight.maxRght || 0) + 1,
        rght: (maxRight.maxRght || 0) + 2,
        depth: 0
      };
    }

    // Find parent and calculate position
    const [parent] = await db.select().from(enhancedRoles)
      .where(eq(enhancedRoles.id, parentRoleId))
      .limit(1);

    if (!parent) {
      throw new Error('Parent role not found');
    }

    // Make space in nested set
    await db.update(enhancedRoles)
      .set({ rght: sql`${enhancedRoles.rght} + 2` })
      .where(gte(enhancedRoles.rght, parent.rght));

    await db.update(enhancedRoles)
      .set({ lft: sql`${enhancedRoles.lft} + 2` })
      .where(gte(enhancedRoles.lft, parent.rght));

    return {
      lft: parent.rght,
      rght: parent.rght + 1,
      depth: parent.depth + 1
    };
  }

  private async assignPermissionsToRole(roleId: string, permissionCodes: string[]): Promise<void> {
    const permissionsList = await db.select().from(permissions)
      .where(inArray(permissions.code, permissionCodes));

    const rolePermissionData = permissionsList.map(permission => ({
      roleId,
      permissionId: permission.id,
      effect: 'ALLOW' as const
    }));

    await db.insert(rolePermissions).values(rolePermissionData);
  }
}

export const rbacService = new EnhancedRBACService();