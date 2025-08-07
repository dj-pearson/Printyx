import { Router } from 'express';
import { z } from 'zod';
import { eq, and, or, desc, asc, ilike, inArray, sql } from 'drizzle-orm';
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

// Middleware to ensure user is authenticated (based on existing patterns)
const requireAuth = (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId,
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId,
    };
  }
  
  next();
};

/**
 * GET /api/rbac/status
 * Get RBAC system initialization status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if RBAC system is initialized
    const existingRoles = await db.execute(sql`
      SELECT id FROM enhanced_roles WHERE tenant_id = ${tenantId} LIMIT 1
    `);

    const initialized = existingRoles.rows.length > 0;

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
router.get('/roles', requireAuth, async (req, res) => {
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

    // Build WHERE conditions dynamically
    const whereClauses = [`tenant_id = '${tenantId}'`];
    
    if (hierarchyLevel) {
      whereClauses.push(`hierarchy_level = '${hierarchyLevel}'`);
    }
    if (department) {
      whereClauses.push(`department = '${department}'`);
    }
    if (organizationalTier) {
      whereClauses.push(`organizational_tier = '${organizationalTier}'`);
    }
    if (search) {
      whereClauses.push(`(name ILIKE '%${search}%' OR code ILIKE '%${search}%' OR description ILIKE '%${search}%')`);
    }

    // Execute query with raw SQL for better compatibility
    const rolesResult = await db.execute(sql`
      SELECT 
        r.*,
        ou.name as org_unit_name,
        ou.tier as org_unit_tier,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as permission_count
      FROM enhanced_roles r
      LEFT JOIN organizational_units ou ON r.organizational_unit_id = ou.id
      WHERE ${sql.join(whereClauses.map(clause => sql.raw(clause)), sql` AND `)}
      ORDER BY r.created_at DESC
      LIMIT ${limitNum}
      OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total 
      FROM enhanced_roles r
      WHERE ${sql.join(whereClauses.map(clause => sql.raw(clause)), sql` AND `)}
    `);
    
    const roles = rolesResult.rows;
    const totalCount = parseInt(countResult.rows[0]?.total || '0');

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

    const roleResult = await db.execute(sql`
      SELECT 
        r.*,
        ou.name as org_unit_name,
        ou.tier as org_unit_tier
      FROM enhanced_roles r
      LEFT JOIN organizational_units ou ON r.organizational_unit_id = ou.id
      WHERE r.id = ${roleId} AND r.tenant_id = ${tenantId}
      LIMIT 1
    `);
    
    const role = roleResult.rows[0];

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get role permissions using raw SQL
    const permissionsResult = await db.execute(sql`
      SELECT 
        p.*,
        rp.effect,
        rp.granted_at
      FROM role_permissions rp
      INNER JOIN system_permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ${roleId}
      ORDER BY p.module, p.resource_type, p.action
    `);

    // Get user assignments count
    const assignmentCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM user_role_assignments
      WHERE role_id = ${roleId} AND is_active = true
    `);

    res.json({
      ...role,
      permissions: permissionsResult.rows,
      assignmentCount: parseInt(assignmentCountResult.rows[0]?.count || '0')
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

    // Simple validation for role creation
    const { name, code, description, hierarchyLevel, department, permissionCodes = [] } = req.body;
    
    if (!name || !code || !hierarchyLevel || !department) {
      return res.status(400).json({ error: 'Missing required fields: name, code, hierarchyLevel, department' });
    }

    // Check if user has permission to create roles
    const canCreateRoles = await rbacService.hasPermission({
      userId,
      permissionCode: 'role.manage_permissions',
      organizationalContext: { tenantId }
    });

    if (!canCreateRoles) {
      return res.status(403).json({ error: 'Insufficient permissions to create roles' });
    }

    try {
      // Check for duplicate role code within tenant
      const existingRole = await db.execute(sql`
        SELECT id FROM enhanced_roles WHERE code = ${code} AND tenant_id = ${tenantId}
      `);
      
      if (existingRole.rows.length > 0) {
        return res.status(400).json({ error: 'Role code already exists' });
      }

      // Create new role
      const roleId = `role-${Date.now()}`;
      const companyUnitId = `company-${tenantId}`;
      
      await db.execute(sql`
        INSERT INTO enhanced_roles (
          id, tenant_id, organizational_unit_id, name, code, description, 
          hierarchy_level, department, organizational_tier
        ) VALUES (
          ${roleId}, ${tenantId}, ${companyUnitId}, ${name}, ${code}, 
          ${description || ''}, ${hierarchyLevel}, ${department}, 'COMPANY'
        )
      `);

      // Add permissions if provided
      for (const permissionCode of permissionCodes) {
        const permissionId = `perm-${permissionCode}`;
        await db.execute(sql`
          INSERT INTO role_permissions (id, role_id, permission_id, effect, granted_by)
          VALUES (${`rp-${roleId}-${permissionId}`}, ${roleId}, ${permissionId}, 'ALLOW', ${userId})
        `).catch(() => {}); // Ignore errors for non-existent permissions
      }

      // Fetch the created role
      const newRoleResult = await db.execute(sql`
        SELECT * FROM enhanced_roles WHERE id = ${roleId}
      `);

      res.status(201).json({ 
        role: newRoleResult.rows[0], 
        message: 'Role created successfully' 
      });
    } catch (error) {
      console.error('Role creation error:', error);
      res.status(500).json({ error: 'Failed to create role' });
    }
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
router.get('/permissions', requireAuth, async (req, res) => {
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

    const permissionsList = await db.execute(sql`
      SELECT * FROM system_permissions 
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY module, resource_type, action
    `);

    // Group by module for better organization
    const groupedPermissions = permissionsList.rows.reduce((acc: any, permission: any) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {});

    res.json({ 
      permissions: permissionsList.rows,
      groupedPermissions,
      totalCount: permissionsList.rows.length 
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
router.get('/organizational-units', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const unitsResult = await db.execute(sql`
      SELECT * FROM organizational_units 
      WHERE tenant_id = ${tenantId} AND is_active = true
      ORDER BY lft ASC
    `);
    const units = unitsResult.rows;

    // Build hierarchy tree
    const buildTree = (nodes: any[], parentId: string | null = null): any[] => {
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
router.post('/seed', requireAuth, async (req, res) => {
  try {
    const { dealerType = 'standard' } = req.body;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if already initialized by looking for existing roles
    const existingRoles = await db.execute(sql`
      SELECT id FROM enhanced_roles WHERE tenant_id = ${tenantId} LIMIT 1
    `);

    if (existingRoles.rows.length > 0) {
      return res.status(400).json({ error: 'RBAC system already initialized for this tenant' });
    }

    // Create basic organizational unit
    const companyUnitId = `company-${tenantId}`;
    await db.execute(sql`
      INSERT INTO organizational_units (id, tenant_id, name, code, tier, description)
      VALUES (${companyUnitId}, ${tenantId}, 'Company', 'COMPANY', 'COMPANY', 'Main company unit')
    `);

    // Create basic roles based on dealer type
    const rolesToCreate = dealerType === 'small' 
      ? [
          { id: `owner-${tenantId}`, name: 'Owner', code: 'OWNER', description: 'Business owner with full access', hierarchy_level: 'COMPANY', department: 'administration' },
          { id: `manager-${tenantId}`, name: 'Manager', code: 'MANAGER', description: 'General manager', hierarchy_level: 'LOCATION', department: 'administration' },
          { id: `sales-${tenantId}`, name: 'Sales Rep', code: 'SALES_REP', description: 'Sales representative', hierarchy_level: 'INDIVIDUAL', department: 'sales' },
          { id: `service-${tenantId}`, name: 'Service Tech', code: 'SERVICE_TECH', description: 'Service technician', hierarchy_level: 'INDIVIDUAL', department: 'service' }
        ]
      : [
          { id: `company-admin-${tenantId}`, name: 'Company Admin', code: 'COMPANY_ADMIN', description: 'Company administrator with full access', hierarchy_level: 'COMPANY', department: 'administration' },
          { id: `regional-manager-${tenantId}`, name: 'Regional Manager', code: 'REGIONAL_MANAGER', description: 'Regional operations manager', hierarchy_level: 'REGIONAL', department: 'administration' },
          { id: `location-manager-${tenantId}`, name: 'Location Manager', code: 'LOCATION_MANAGER', description: 'Location manager', hierarchy_level: 'LOCATION', department: 'administration' },
          { id: `sales-manager-${tenantId}`, name: 'Sales Manager', code: 'SALES_MANAGER', description: 'Sales team manager', hierarchy_level: 'DEPARTMENT', department: 'sales' },
          { id: `service-manager-${tenantId}`, name: 'Service Manager', code: 'SERVICE_MANAGER', description: 'Service team manager', hierarchy_level: 'DEPARTMENT', department: 'service' },
          { id: `sales-rep-${tenantId}`, name: 'Sales Representative', code: 'SALES_REP', description: 'Sales representative', hierarchy_level: 'INDIVIDUAL', department: 'sales' },
          { id: `service-tech-${tenantId}`, name: 'Service Technician', code: 'SERVICE_TECH', description: 'Service technician', hierarchy_level: 'INDIVIDUAL', department: 'service' },
          { id: `admin-assistant-${tenantId}`, name: 'Administrative Assistant', code: 'ADMIN_ASSISTANT', description: 'Administrative support', hierarchy_level: 'INDIVIDUAL', department: 'administration' }
        ];

    // Insert roles
    for (const role of rolesToCreate) {
      await db.execute(sql`
        INSERT INTO enhanced_roles (id, tenant_id, organizational_unit_id, name, code, description, hierarchy_level, department)
        VALUES (${role.id}, ${tenantId}, ${companyUnitId}, ${role.name}, ${role.code}, ${role.description}, ${role.hierarchy_level}, ${role.department})
      `);
    }

    // Assign the first role to the current user
    const firstRoleId = rolesToCreate[0].id;
    await db.execute(sql`
      INSERT INTO user_role_assignments (id, user_id, role_id, tenant_id, organizational_unit_id, assigned_by)
      VALUES (${`assignment-${userId}-${Date.now()}`}, ${userId}, ${firstRoleId}, ${tenantId}, ${companyUnitId}, ${userId})
    `);

    res.json({ 
      message: 'RBAC system initialized successfully', 
      dealerType, 
      tenantId,
      rolesCreated: rolesToCreate.length,
      userAssigned: firstRoleId
    });
  } catch (error) {
    console.error('RBAC seed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as enhancedRBACRoutes };