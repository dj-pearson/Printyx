/**
 * Admin Seed Routes
 * API endpoints to trigger demo data seeding from the web UI
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('admin-seed-routes');

import { users, roles } from '@shared/schema';
import { getUserId, getTenantId } from '../utils/auth-helpers';
import { demoDataExists, seedDemoData } from '../seeds/demo-data';

const router = Router();

/**
 * Middleware to require admin access (level 5+ or canAccessAllTenants)
 * Uses database lookup to verify role, similar to requireRootAdmin
 */
const requireSeedAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user with role information from database
    const userWithRole = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        roleName: roles.name,
        roleCode: roles.code,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length) {
      return res.status(403).json({ error: 'User not found' });
    }

    const user = userWithRole[0];

    // Check if user has admin level (5+) or can access all tenants
    // Level 5 = Company Admin, System Admin
    // Level 6 = Platform Support
    // Level 7 = Root Admin
    const roleLevel = user.roleLevel || 0;
    const canAccess = roleLevel >= 5 || user.canAccessAllTenants;

    if (!canAccess) {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You need Company Admin level (5) or higher to seed demo data',
        currentLevel: roleLevel,
      });
    }

    // Add user info to request for later use
    (req as any).seedUser = {
      id: user.userId,
      email: user.email,
      tenantId: user.tenantId || getTenantId(req),
      roleLevel: roleLevel,
      roleName: user.roleName,
      roleCode: user.roleCode,
      canAccessAllTenants: user.canAccessAllTenants,
    };

    next();
  } catch (error: any) {
    log.error('[Seed] Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * GET /api/admin/seed/status
 * Check if demo data exists for the current tenant
 */
router.get('/status', requireSeedAdmin, async (req: Request, res: Response) => {
  try {
    const seedUser = (req as any).seedUser;

    if (!seedUser?.tenantId) {
      return res.status(400).json({ error: 'No tenant context - user must belong to a tenant' });
    }

    const hasData = await demoDataExists(seedUser.tenantId);

    res.json({
      tenantId: seedUser.tenantId,
      userId: seedUser.id,
      userEmail: seedUser.email,
      roleLevel: seedUser.roleLevel,
      roleName: seedUser.roleName,
      hasDemoData: hasData,
      message: hasData
        ? 'Demo data already exists for this tenant'
        : 'No demo data found - ready to seed',
    });
  } catch (error: any) {
    log.error('[Seed] Error checking seed status:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

/**
 * POST /api/admin/seed/demo
 * Seed demo data for the current tenant
 */
router.post('/demo', requireSeedAdmin, async (req: Request, res: Response) => {
  try {
    const seedUser = (req as any).seedUser;

    if (!seedUser?.id || !seedUser?.tenantId) {
      return res.status(400).json({ error: 'No tenant context - user must belong to a tenant' });
    }

    const DEMO_TENANT_ID = seedUser.tenantId;
    const DEMO_USER_ID = seedUser.id;
    const force = req.body.force === true;

    log.info(`[Seed] Starting demo data seeding for tenant: ${DEMO_TENANT_ID}`);
    log.info(
      `[Seed] User: ${seedUser.email} (${DEMO_USER_ID}) - Role: ${seedUser.roleName} (Level ${seedUser.roleLevel})`,
    );

    if ((await demoDataExists(DEMO_TENANT_ID)) && !force) {
      return res.status(400).json({
        error: 'Demo data already exists',
        message: 'Use force: true to re-seed',
        hasDemoData: true,
      });
    }

    const results = await seedDemoData({ tenantId: DEMO_TENANT_ID, userId: DEMO_USER_ID });

    log.info('[Seed] ✅ Demo data seeding completed!');

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      tenantId: DEMO_TENANT_ID,
      userId: DEMO_USER_ID,
      results,
    });
  } catch (error: any) {
    log.error('[Seed] ❌ Error seeding demo data:', error);
    res.status(500).json({
      error: 'Failed to seed demo data',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/seed/roles
 * List all available roles (no auth required - for bootstrapping)
 */
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        code: roles.code,
        level: roles.level,
        department: roles.department,
        roleType: roles.roleType,
        canAccessAllTenants: roles.canAccessAllTenants,
        canManageUsers: roles.canManageUsers,
        description: roles.description,
      })
      .from(roles)
      .orderBy(roles.level);

    res.json({
      roles: allRoles,
      adminRoles: allRoles.filter((r) => (r.level || 0) >= 5),
      message: 'Use POST /api/admin/seed/assign-role to assign a role',
    });
  } catch (error: any) {
    log.error('[Seed] Error listing roles:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

/**
 * GET /api/admin/seed/my-role
 * Check the current user's role assignment
 */
router.get('/my-role', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userWithRole = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        legacyRole: users.role,
        roleName: roles.name,
        roleCode: roles.code,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole.length) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const user = userWithRole[0];
    const hasAdminRole = (user.roleLevel || 0) >= 5 || user.canAccessAllTenants;

    res.json({
      ...user,
      hasAdminRole,
      canSeedData: hasAdminRole,
      message: hasAdminRole
        ? 'You have admin access and can seed demo data'
        : 'You need an admin role (level 5+) to seed demo data. Use POST /api/admin/seed/assign-role to assign yourself a role.',
    });
  } catch (error: any) {
    log.error('[Seed] Error checking user role:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

/**
 * POST /api/admin/seed/assign-role
 * Assign a role to a user
 *
 * Bootstrap mode: If you have no role yet, you can assign yourself an admin role
 * Admin mode: If you're already an admin (level 5+), you can assign roles to anyone
 */
router.post('/assign-role', async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roleId, targetUserId } = req.body;

    if (!roleId) {
      return res.status(400).json({
        error: 'roleId is required',
        hint: 'Use GET /api/admin/seed/roles to see available roles',
      });
    }

    // Get the role being assigned
    const [targetRole] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!targetRole) {
      return res.status(404).json({
        error: 'Role not found',
        roleId,
        hint: 'Use GET /api/admin/seed/roles to see available roles',
      });
    }

    // Get current user's role
    const [currentUser] = await db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
        roleId: users.roleId,
        roleLevel: roles.level,
        canAccessAllTenants: roles.canAccessAllTenants,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, currentUserId))
      .limit(1);

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found in database' });
    }

    const currentRoleLevel = currentUser.roleLevel || 0;
    const isCurrentAdmin = currentRoleLevel >= 5 || currentUser.canAccessAllTenants;
    const userIdToUpdate = targetUserId || currentUserId;
    const isSelfAssignment = userIdToUpdate === currentUserId;

    // Authorization logic
    if (!isCurrentAdmin) {
      // Bootstrap mode: Allow self-assignment if user has no role
      if (!isSelfAssignment) {
        return res.status(403).json({
          error: 'You need admin access to assign roles to other users',
          currentLevel: currentRoleLevel,
        });
      }

      // Allow self-assignment for bootstrapping (first admin scenario)
      log.info(`[Seed] Bootstrap mode: User ${currentUserId} assigning themselves role ${roleId}`);
    } else {
      // Admin can assign roles, but warn if assigning higher level
      const targetRoleLevel = targetRole.level || 0;
      if (targetRoleLevel > currentRoleLevel && !currentUser.canAccessAllTenants) {
        log.warn(
          `[Seed] Warning: User ${currentUserId} (level ${currentRoleLevel}) assigning higher role (level ${targetRoleLevel})`,
        );
      }
    }

    // Perform the role assignment
    await db.update(users).set({ roleId: roleId }).where(eq(users.id, userIdToUpdate));

    // Get updated user info
    const [updatedUser] = await db
      .select({
        userId: users.id,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        roleLevel: roles.level,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userIdToUpdate))
      .limit(1);

    log.info(
      `[Seed] Role assigned: User ${userIdToUpdate} now has role ${roleId} (${targetRole.name})`,
    );

    res.json({
      success: true,
      message: `Role "${targetRole.name}" assigned successfully`,
      user: updatedUser,
      canNowSeedData: (targetRole.level || 0) >= 5 || targetRole.canAccessAllTenants,
      nextStep:
        (targetRole.level || 0) >= 5
          ? 'You can now use POST /api/admin/seed/demo to seed demo data'
          : 'You need a higher role level to seed demo data',
    });
  } catch (error: any) {
    log.error('[Seed] Error assigning role:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

export default router;
