/**
 * User Profile Routes
 * Provides API endpoints for fetching user profile and role information
 */

import { Express } from 'express';
import { db } from './db';
import { users, roles } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateSupabaseJWT, requireSupabaseAuth } from './middleware/supabase-auth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-user-profile');

export function registerUserProfileRoutes(app: Express) {
  /**
   * GET /api/auth/me
   * Get current user's profile with role information
   * This endpoint bypasses Supabase RLS policies
   */
  app.get('/api/auth/me', authenticateSupabaseJWT, requireSupabaseAuth, async (req, res) => {
    try {
      const userId = req.supabaseUser?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      // Fetch user from database
      const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!userRecord) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Fetch role data if role_id exists
      let roleData = null;
      if (userRecord.roleId) {
        const [role] = await db
          .select()
          .from(roles)
          .where(eq(roles.id, userRecord.roleId))
          .limit(1);

        if (role) {
          roleData = {
            id: role.id,
            name: role.name,
            code: role.code,
            level: role.level,
            permissions: role.permissions,
            canAccessAllTenants: role.canAccessAllTenants,
          };
        }
      }

      // If no role from roles table, check string role column
      if (!roleData && (userRecord as any).role) {
        const roleString = (userRecord as any).role;
        const roleLowerCase = roleString.toLowerCase();

        // Determine if this is an admin role
        const isAdmin =
          roleLowerCase === 'admin' ||
          roleLowerCase === 'root_admin' ||
          roleLowerCase === 'platform_admin' ||
          roleLowerCase === 'company_admin' ||
          roleLowerCase === 'system_admin';

        // Determine role level
        let level = 1;
        if (
          roleLowerCase === 'admin' ||
          roleLowerCase === 'root_admin' ||
          roleLowerCase === 'platform_admin'
        ) {
          level = 8;
        } else if (roleLowerCase === 'company_admin' || roleLowerCase === 'director') {
          level = 7;
        } else if (
          roleLowerCase === 'manager' ||
          roleLowerCase === 'sales_manager' ||
          roleLowerCase === 'service_manager'
        ) {
          level = 5;
        } else if (roleLowerCase === 'team_lead') {
          level = 3;
        } else if (roleLowerCase === 'technician' || roleLowerCase === 'sales_rep') {
          level = 2;
        }

        roleData = {
          id: roleString,
          name: roleString,
          code: roleString.toUpperCase(),
          level: level,
          permissions: {
            sales: true,
            service: true,
            products: true,
            inventory: true,
            billing: isAdmin,
            reports: true,
            admin: isAdmin,
            users: isAdmin,
            settings: isAdmin,
            purchasing: true,
            finance: isAdmin,
            system: isAdmin,
          },
          canAccessAllTenants: isAdmin,
        };

        log.info(`[API] User ${userRecord.email} has role '${roleString}' (level ${level})`);
      }

      // Determine isPlatformUser
      const isPlatformUser =
        userRecord.isPlatformUser ||
        (roleData && roleData.level >= 8) ||
        (userRecord as any).role?.toLowerCase().includes('admin') ||
        (userRecord as any).role?.toLowerCase().includes('root') ||
        (userRecord as any).role?.toLowerCase().includes('platform');

      // Build response
      const response = {
        id: userRecord.id,
        email: userRecord.email || '',
        first_name: userRecord.firstName,
        last_name: userRecord.lastName,
        tenant_id: userRecord.tenantId,
        role: (userRecord as any).role, // String role column
        role_id: userRecord.roleId,
        team_id: userRecord.teamId,
        profile_image_url: userRecord.profileImageUrl,
        roleData: roleData, // Parsed role information
        createdAt: userRecord.createdAt,
        lastLoginAt: userRecord.lastLoginAt,
      };

      log.info(
        `[API] User profile fetched: ${userRecord.email}, role: ${(userRecord as any).role}, isPlatformUser: ${isPlatformUser}`,
      );

      return res.json(response);
    } catch (error) {
      log.error('[API] Error fetching user profile:', error);
      return res.status(500).json({
        error: 'Failed to fetch user profile',
        code: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/auth/permissions
   * Get current user's effective permissions
   */
  app.get(
    '/api/auth/permissions',
    authenticateSupabaseJWT,
    requireSupabaseAuth,
    async (req, res) => {
      try {
        const userId = req.supabaseUser?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Import and use the enhanced RBAC service
        const { getUserEffectivePermissions } = await import(
          './middleware/enhanced-rbac-middleware'
        );
        const tenantId = req.supabaseUser?.tenantId || (req as any).tenantId;

        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant context required' });
        }

        const permissions = await getUserEffectivePermissions(userId, tenantId);

        return res.json({
          userId,
          tenantId,
          permissions,
          count: permissions.length,
        });
      } catch (error) {
        log.error('[API] Error fetching permissions:', error);
        return res.status(500).json({
          error: 'Failed to fetch permissions',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  log.info('✅ User profile routes registered');
}
