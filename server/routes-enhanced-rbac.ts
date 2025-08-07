import { Router } from 'express';
import { z } from 'zod';
import { eq, and, or, desc, asc, ilike, inArray } from 'drizzle-orm';
import { db } from './db';
import { rbacService } from './enhanced-rbac-service';
import { rbacSeeder } from './enhanced-rbac-seeder';
import {
  organizationalUnits,
  enhancedRoles,
  permissions,
  rolePermissions,
  userRoleAssignments,
  permissionOverrides,
  insertEnhancedRoleSchema,
  insertUserRoleAssignmentSchema,
  insertPermissionOverrideSchema,
  type EnhancedRole,
  type Permission,
  type UserRoleAssignment,
  type OrganizationalUnit
} from './enhanced-rbac-schema';
import { users } from '../shared/schema';

const router = Router();

/**
 * GET /api/rbac/status
 * Get RBAC system initialization status
 */
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if RBAC system is initialized
    const existingRoles = await db.select()
      .from(enhancedRoles)
      .where(eq(enhancedRoles.tenantId, tenantId))
      .limit(1);

    const initialized = existingRoles.length > 0;

    if (!initialized) {
      return res.json({
        initialized: false,
        recommendation: 'Initialize RBAC system to enable advanced role management',
        actions: [
          'Define organizational structure',
          'Set up role hierarchy',
          'Configure permissions',
          'Assign initial roles'
        ]
      });
    }

    // Get system statistics
    const [roleCount] = await db.select({ 
      count: sql<number>`count(*)::int` 
    }).from(enhancedRoles).where(eq(enhancedRoles.tenantId, tenantId));

    const [unitCount] = await db.select({ 
      count: sql<number>`count(*)::int` 
    }).from(organizationalUnits).where(eq(organizationalUnits.tenantId, tenantId));

    res.json({
      initialized: true,
      stats: {
        totalRoles: roleCount?.count || 0,
        organizationalUnits: unitCount?.count || 0
      },
      recommendation: 'RBAC system is active and ready for management'
    });
  } catch (error) {
    console.error('RBAC status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validation schemas
const permissionCheckSchema = z.object({
  permissionCode: z.string(),
  organizationalContext: z.object({
    tenantId: z.string(),
    unitId: z.string().optional(),
    locationId: z.string().optional(),
    regionId: z.string().optional()
  }),
  resourceId: z.string().optional()
});

const roleCustomizationSchema = z.object({
  roleId: z.string(),
  permissionChanges: z.array(z.object({
    permissionCode: z.string(),
    effect: z.enum(['ALLOW', 'DENY']),
    reason: z.string()
  }))
});

const permissionOverrideRequestSchema = z.object({
  userId: z.string(),
  permissionCode: z.string(),
  effect: z.enum(['ALLOW', 'DENY']),
  overrideReason: z.string(),
  businessJustification: z.string(),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().optional(),
  organizationalUnitId: z.string().optional()
});

/**
 * GET /api/rbac/permissions/check
 * Check if current user has a specific permission
 */
router.get('/permissions/check', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validation = permissionCheckSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request parameters', details: validation.error });
    }

    const { permissionCode, organizationalContext, resourceId } = validation.data;

    const hasPermission = await rbacService.hasPermission({
      userId,
      permissionCode,
      organizationalContext,
      resourceId
    });

    res.json({ hasPermission, permissionCode, userId });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/permissions/effective
 * Get all effective permissions for current user
 */
router.get('/permissions/effective', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const orgContext = {
      tenantId,
      unitId: req.query.unitId as string,
      locationId: req.query.locationId as string,
      regionId: req.query.regionId as string
    };

    const effectivePermissions = await rbacService.getEffectivePermissions(userId, orgContext);
    
    res.json({ 
      userId, 
      organizationalContext: orgContext,
      permissions: effectivePermissions,
      count: effectivePermissions.length 
    });
  } catch (error) {
    console.error('Effective permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/roles
 * Get all roles for current tenant with optional filtering
 */
router.get('/roles', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      hierarchyLevel, 
      department, 
      organizationalTier, 
      search,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select({
      role: enhancedRoles,
      organizationalUnit: organizationalUnits,
      permissionCount: db.$count(rolePermissions, eq(rolePermissions.roleId, enhancedRoles.id))
    })
    .from(enhancedRoles)
    .leftJoin(organizationalUnits, eq(enhancedRoles.organizationalUnitId, organizationalUnits.id))
    .where(eq(enhancedRoles.tenantId, tenantId));

    // Apply filters
    const conditions = [eq(enhancedRoles.tenantId, tenantId)];
    
    if (hierarchyLevel) {
      conditions.push(eq(enhancedRoles.hierarchyLevel, hierarchyLevel as any));
    }
    if (department) {
      conditions.push(eq(enhancedRoles.department, department as string));
    }
    if (organizationalTier) {
      conditions.push(eq(enhancedRoles.organizationalTier, organizationalTier as any));
    }
    if (search) {
      conditions.push(
        or(
          ilike(enhancedRoles.name, `%${search}%`),
          ilike(enhancedRoles.code, `%${search}%`),
          ilike(enhancedRoles.description, `%${search}%`)
        )
      );
    }

    const roles = await query
      .where(and(...conditions))
      .orderBy(asc(enhancedRoles.lft))
      .limit(limitNum)
      .offset(offset);

    const totalCount = await db.$count(enhancedRoles, and(...conditions));

    res.json({
      roles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Roles fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/roles/:id
 * Get specific role with permissions
 */
router.get('/roles/:id', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const roleId = req.params.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [role] = await db.select({
      role: enhancedRoles,
      organizationalUnit: organizationalUnits
    })
    .from(enhancedRoles)
    .leftJoin(organizationalUnits, eq(enhancedRoles.organizationalUnitId, organizationalUnits.id))
    .where(and(
      eq(enhancedRoles.id, roleId),
      eq(enhancedRoles.tenantId, tenantId)
    ))
    .limit(1);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get role permissions
    const rolePermissionsList = await db.select({
      permission: permissions,
      rolePermission: rolePermissions
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId))
    .orderBy(asc(permissions.module), asc(permissions.resourceType), asc(permissions.action));

    // Get user assignments count
    const assignmentCount = await db.$count(
      userRoleAssignments, 
      and(
        eq(userRoleAssignments.roleId, roleId),
        eq(userRoleAssignments.isActive, true)
      )
    );

    res.json({
      ...role,
      permissions: rolePermissionsList,
      assignmentCount
    });
  } catch (error) {
    console.error('Role fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rbac/roles
 * Create new role
 */
router.post('/roles', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validation = insertEnhancedRoleSchema.extend({
      permissionCodes: z.array(z.string()).optional()
    }).safeParse({ ...req.body, tenantId });

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid role data', details: validation.error });
    }

    const { permissionCodes = [], ...roleData } = validation.data;

    // Check if user has permission to create roles
    const canCreateRoles = await rbacService.hasPermission({
      userId,
      permissionCode: 'role.manage_permissions',
      organizationalContext: { tenantId }
    });

    if (!canCreateRoles) {
      return res.status(403).json({ error: 'Insufficient permissions to create roles' });
    }

    const newRole = await rbacService.createRole(roleData, permissionCodes, userId);

    res.status(201).json({ role: newRole, message: 'Role created successfully' });
  } catch (error) {
    console.error('Role creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rbac/roles/:id/customize
 * Customize role permissions (Company Admin feature)
 */
router.put('/roles/:id/customize', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const roleId = req.params.id;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validation = roleCustomizationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid customization data', details: validation.error });
    }

    const { permissionChanges } = validation.data;

    // Check if user has permission to customize roles
    const canCustomizeRoles = await rbacService.hasPermission({
      userId,
      permissionCode: 'role.manage_permissions',
      organizationalContext: { tenantId }
    });

    if (!canCustomizeRoles) {
      return res.status(403).json({ error: 'Insufficient permissions to customize roles' });
    }

    await rbacService.customizeRolePermissions(roleId, permissionChanges, userId);

    res.json({ message: 'Role permissions customized successfully', roleId, changes: permissionChanges.length });
  } catch (error) {
    console.error('Role customization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/permissions
 * Get all available permissions with filtering
 */
router.get('/permissions', async (req, res) => {
  try {
    const { module, resourceType, scopeLevel, search } = req.query;

    const conditions = [];
    
    if (module) conditions.push(eq(permissions.module, module as string));
    if (resourceType) conditions.push(eq(permissions.resourceType, resourceType as string));
    if (scopeLevel) conditions.push(eq(permissions.scopeLevel, scopeLevel as string));
    if (search) {
      conditions.push(
        or(
          ilike(permissions.name, `%${search}%`),
          ilike(permissions.code, `%${search}%`),
          ilike(permissions.description, `%${search}%`)
        )
      );
    }

    const permissionsList = await db.select()
      .from(permissions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(permissions.module), asc(permissions.resourceType), asc(permissions.action));

    // Group by module for better organization
    const groupedPermissions = permissionsList.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {} as Record<string, typeof permissionsList>);

    res.json({ 
      permissions: permissionsList,
      groupedPermissions,
      totalCount: permissionsList.length 
    });
  } catch (error) {
    console.error('Permissions fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/users/:userId/roles
 * Get user's role assignments
 */
router.get('/users/:userId/roles', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const targetUserId = req.params.userId;

    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const assignments = await db.select({
      assignment: userRoleAssignments,
      role: enhancedRoles,
      organizationalUnit: organizationalUnits
    })
    .from(userRoleAssignments)
    .innerJoin(enhancedRoles, eq(userRoleAssignments.roleId, enhancedRoles.id))
    .leftJoin(organizationalUnits, eq(userRoleAssignments.organizationalUnitId, organizationalUnits.id))
    .where(and(
      eq(userRoleAssignments.userId, targetUserId),
      eq(userRoleAssignments.tenantId, tenantId),
      eq(userRoleAssignments.isActive, true)
    ))
    .orderBy(desc(enhancedRoles.hierarchyLevel));

    res.json({ assignments, userId: targetUserId });
  } catch (error) {
    console.error('User roles fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rbac/users/:userId/roles
 * Assign role to user
 */
router.post('/users/:userId/roles', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const targetUserId = req.params.userId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validation = insertUserRoleAssignmentSchema.safeParse({
      ...req.body,
      userId: targetUserId,
      tenantId,
      assignedBy: userId
    });

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid assignment data', details: validation.error });
    }

    // Check if user has permission to assign roles
    const canAssignRoles = await rbacService.hasPermission({
      userId,
      permissionCode: 'user.create_location', // or appropriate permission based on scope
      organizationalContext: { tenantId }
    });

    if (!canAssignRoles) {
      return res.status(403).json({ error: 'Insufficient permissions to assign roles' });
    }

    const [assignment] = await db.insert(userRoleAssignments)
      .values(validation.data)
      .returning();

    res.status(201).json({ assignment, message: 'Role assigned successfully' });
  } catch (error) {
    console.error('Role assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rbac/permission-overrides
 * Create permission override request
 */
router.post('/permission-overrides', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validation = permissionOverrideRequestSchema.safeParse({
      ...req.body,
      tenantId
    });

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid override request', details: validation.error });
    }

    const overrideData = {
      ...validation.data,
      effectiveFrom: new Date(validation.data.effectiveFrom),
      effectiveUntil: validation.data.effectiveUntil ? new Date(validation.data.effectiveUntil) : undefined,
      tenantId
    };

    const override = await rbacService.createPermissionOverride(overrideData, userId);

    res.status(201).json({ override, message: 'Permission override request created' });
  } catch (error) {
    console.error('Permission override error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/rbac/organizational-units
 * Get organizational units hierarchy
 */
router.get('/organizational-units', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const units = await db.select()
      .from(organizationalUnits)
      .where(and(
        eq(organizationalUnits.tenantId, tenantId),
        eq(organizationalUnits.isActive, true)
      ))
      .orderBy(asc(organizationalUnits.lft));

    // Build hierarchy tree
    const buildTree = (nodes: typeof units, parentId: string | null = null): any[] => {
      return nodes
        .filter(node => node.parentUnitId === parentId)
        .map(node => ({
          ...node,
          children: buildTree(nodes, node.id)
        }));
    };

    const hierarchy = buildTree(units);

    res.json({ units, hierarchy, totalCount: units.length });
  } catch (error) {
    console.error('Organizational units fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rbac/seed
 * Initialize RBAC system with default roles and permissions
 */
router.post('/seed', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { dealerType = 'standard' } = req.body;

    // Check if user has admin permissions
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'root_admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only administrators can seed RBAC system' });
    }

    // Check if already seeded
    const existingRoles = await db.select().from(enhancedRoles)
      .where(eq(enhancedRoles.tenantId, tenantId))
      .limit(1);

    if (existingRoles.length > 0) {
      return res.status(400).json({ error: 'RBAC system already initialized for this tenant' });
    }

    if (dealerType === 'small') {
      await rbacSeeder.seedSmallDealerRoles(tenantId, 'company-unit-id', userId);
    } else {
      await rbacSeeder.seedEnhancedRBAC(tenantId, userId);
    }

    res.json({ 
      message: 'RBAC system initialized successfully', 
      tenantId, 
      dealerType 
    });
  } catch (error) {
    console.error('RBAC seeding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as enhancedRBACRoutes };