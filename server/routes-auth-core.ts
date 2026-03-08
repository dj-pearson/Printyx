/**
 * Auth Core Routes
 *
 * Consolidates all authentication and session-related routes:
 * - Login / logout / signup
 * - Password reset (forgot, verify-reset-token, reset)
 * - Email verification (verify-email, resend-verification)
 * - Current user (/api/me, /api/auth/user)
 *
 * Auth sub-routes under /api/auth/* are handled by auth-routes.ts (login, logout,
 * signup, password reset, email verification, session user).
 */

import type { Express } from 'express';
import { authRoutes } from './auth-routes';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('auth-core');
import { storage } from './storage';
import { getUserId } from './utils/auth-helpers';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import {
  enhancedRoles,
  rolePermissions,
  permissions,
  userRoleAssignments,
} from './enhanced-rbac-schema';

/**
 * Resolve granular permissions for a user from the enhanced RBAC system.
 * Looks up the user's active role assignment, then fetches all permission
 * codes granted to that role. Falls back gracefully if the enhanced RBAC
 * tables don't exist or have no data.
 */
async function resolveEnhancedPermissions(
  userId: string,
  tenantId: string | null | undefined,
): Promise<string[] | null> {
  try {
    // Step 1: Find the user's active role assignment
    let roleId: string | null = null;
    let roleCode: string | null = null;
    let hierarchyLevel: string | null = null;
    let orgTier: string | null = null;
    let department: string | null = null;

    if (tenantId) {
      // Look for active role assignment in the enhanced system
      const assignments = await db
        .select({
          roleId: userRoleAssignments.roleId,
        })
        .from(userRoleAssignments)
        .where(and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.isActive, true)))
        .limit(1);

      if (assignments.length > 0) {
        roleId = assignments[0].roleId;
      }
    }

    // Step 2: If no assignment found, try to match by role code from the legacy roles table
    // (the user.roleId -> roles.id -> roles.code -> enhanced_roles.code path)
    if (!roleId) {
      return null; // No enhanced role assignment, frontend will use legacy expansion
    }

    // Step 3: Get role metadata
    const roleData = await db
      .select({
        code: enhancedRoles.code,
        hierarchyLevel: enhancedRoles.hierarchyLevel,
        organizationalTier: enhancedRoles.organizationalTier,
        department: enhancedRoles.department,
      })
      .from(enhancedRoles)
      .where(eq(enhancedRoles.id, roleId))
      .limit(1);

    if (roleData.length > 0) {
      roleCode = roleData[0].code;
      hierarchyLevel = roleData[0].hierarchyLevel;
      orgTier = roleData[0].organizationalTier;
      department = roleData[0].department || null;
    }

    // Step 4: Get all permission codes for this role
    const permCodes = await db
      .select({
        code: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.effect, 'ALLOW')));

    return permCodes.map((p) => p.code);
  } catch (error) {
    // Enhanced RBAC tables may not exist yet - graceful fallback
    log.warn(
      { err: (error as Error).message },
      'Enhanced RBAC permission resolution failed (tables may not exist)',
    );
    return null;
  }
}

export function registerAuthCoreRoutes(app: Express) {
  // Mount all /api/auth/* routes (login, logout, signup, password reset, email verification, user)
  app.use('/api/auth', authRoutes);

  // Current user endpoint (Supabase JWT / session-aware)
  // Intended for the frontend to hydrate profile/role/team from the server DB
  // to avoid relying on PostgREST access to internal tables (which may be RLS-protected).
  app.get('/api/me', async (req: any, res, next) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUserWithRole(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const tenantId = user.tenantId || (user as any).tenant_id;

      // Try to resolve enhanced RBAC permissions
      const enhancedPermissionCodes = await resolveEnhancedPermissions(userId, tenantId);

      // Build role object with enhanced permissions if available
      const role = (user as any).role || undefined;
      const enhancedRole = role
        ? {
            ...role,
            // Attach granular permission codes if resolved from enhanced RBAC
            ...(enhancedPermissionCodes ? { enhancedPermissions: enhancedPermissionCodes } : {}),
          }
        : undefined;

      return res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: tenantId,
        roleId: user.roleId,
        teamId: user.teamId,
        accessScope: (user as any).accessScope || undefined,
        isPlatformUser: (user as any).isPlatformUser || (user as any).is_platform_user || false,
        role: enhancedRole,
        team: (user as any).team || undefined,
      });
    } catch (error) {
      next(error);
    }
  });
}
