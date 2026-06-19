// RBAC Edge Function
// Handles role-based access control operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Coolify-safe: server.ts strips the 'rbac' prefix, so route off parts[0].
    const { parts } = normalizePath(url.pathname, 'rbac');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // GET /rbac/status - RBAC system initialization status
    if (req.method === 'GET' && endpoint === 'status') {
      if (!tenantId) {
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      // Check if the enhanced RBAC system has any roles for this tenant.
      const { data: existing, error: existErr } = await admin
        .from('enhanced_roles')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (existErr) {
        // Degrade: table missing/unreachable -> report uninitialized.
        return createCorsResponse(
          {
            initialized: false,
            degraded: true,
            recommendation: 'Initialize RBAC system to enable advanced role management',
            actions: [
              'Define organizational structure',
              'Set up role hierarchy',
              'Configure permissions',
              'Assign initial roles',
            ],
          },
          200,
          req,
        );
      }

      if (!existing || existing.length === 0) {
        return createCorsResponse(
          {
            initialized: false,
            recommendation: 'Initialize RBAC system to enable advanced role management',
            actions: [
              'Define organizational structure',
              'Set up role hierarchy',
              'Configure permissions',
              'Assign initial roles',
            ],
          },
          200,
          req,
        );
      }

      const { count: roleCount } = await admin
        .from('enhanced_roles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { count: unitCount } = await admin
        .from('organizational_units')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          initialized: true,
          stats: {
            totalRoles: roleCount || 0,
            organizationalUnits: unitCount || 0,
          },
          recommendation: 'RBAC system is active and ready for management',
        },
        200,
        req,
      );
    }

    // GET /rbac/organizational-units - Org units hierarchy
    if (req.method === 'GET' && endpoint === 'organizational-units') {
      if (!tenantId) {
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      const { data: units, error } = await admin
        .from('organizational_units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('lft', { ascending: true });

      if (error) {
        return createCorsResponse(
          { units: [], hierarchy: [], totalCount: 0, degraded: true },
          200,
          req,
        );
      }

      const rows = (units as any[]) || [];

      // Build hierarchy tree (parent_unit_id -> children).
      const buildTree = (nodes: any[], parentId: string | null = null): any[] =>
        nodes
          .filter((node) => (node.parent_unit_id ?? null) === parentId)
          .map((node) => ({ ...node, children: buildTree(nodes, node.id) }));

      const hierarchy = buildTree(rows);

      return createCorsResponse({ units: rows, hierarchy, totalCount: rows.length }, 200, req);
    }

    // POST /rbac/seed - Initialize enhanced RBAC with default roles + org unit
    if (req.method === 'POST' && endpoint === 'seed') {
      if (!tenantId) {
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      const body = await req.json().catch(() => ({}));
      const dealerType = body?.dealerType || 'standard';

      // Already initialized?
      const { data: existing, error: existErr } = await admin
        .from('enhanced_roles')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (existErr) {
        return createCorsResponse(
          { error: 'Failed to verify RBAC state', degraded: true },
          503,
          req,
        );
      }

      if (existing && existing.length > 0) {
        return createCorsResponse(
          { error: 'RBAC system already initialized for this tenant' },
          400,
          req,
        );
      }

      const companyUnitId = `company-${tenantId}`;
      const nowIso = new Date().toISOString();

      // Create the root company organizational unit. enhanced_roles requires a
      // valid org unit reference + nested-set columns (lft/rght/depth NOT NULL).
      const { error: unitErr } = await admin.from('organizational_units').insert({
        id: companyUnitId,
        tenant_id: tenantId,
        name: 'Company',
        code: 'COMPANY',
        unit_type: 'COMPANY',
        description: 'Main company unit',
        lft: 1,
        rght: 2,
        depth: 0,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (unitErr) {
        return createCorsResponse(
          {
            error: 'Failed to create organizational unit',
            degraded: true,
            details: unitErr.message,
          },
          503,
          req,
        );
      }

      const rolesToCreate =
        dealerType === 'small'
          ? [
              {
                id: `owner-${tenantId}`,
                name: 'Owner',
                code: 'OWNER',
                description: 'Business owner with full access',
                hierarchy_level: 'COMPANY',
                tier: 'COMPANY',
                department: 'administration',
              },
              {
                id: `manager-${tenantId}`,
                name: 'Manager',
                code: 'MANAGER',
                description: 'General manager',
                hierarchy_level: 'LOCATION',
                tier: 'LOCATION',
                department: 'administration',
              },
              {
                id: `sales-${tenantId}`,
                name: 'Sales Rep',
                code: 'SALES_REP',
                description: 'Sales representative',
                hierarchy_level: 'INDIVIDUAL',
                tier: 'INDIVIDUAL',
                department: 'sales',
              },
              {
                id: `service-${tenantId}`,
                name: 'Service Tech',
                code: 'SERVICE_TECH',
                description: 'Service technician',
                hierarchy_level: 'INDIVIDUAL',
                tier: 'INDIVIDUAL',
                department: 'service',
              },
            ]
          : [
              {
                id: `company-admin-${tenantId}`,
                name: 'Company Admin',
                code: 'COMPANY_ADMIN',
                description: 'Company administrator with full access',
                hierarchy_level: 'COMPANY',
                tier: 'COMPANY',
                department: 'administration',
              },
              {
                id: `regional-manager-${tenantId}`,
                name: 'Regional Manager',
                code: 'REGIONAL_MANAGER',
                description: 'Regional operations manager',
                hierarchy_level: 'REGIONAL',
                tier: 'REGIONAL',
                department: 'administration',
              },
              {
                id: `location-manager-${tenantId}`,
                name: 'Location Manager',
                code: 'LOCATION_MANAGER',
                description: 'Location manager',
                hierarchy_level: 'LOCATION',
                tier: 'LOCATION',
                department: 'administration',
              },
              {
                id: `sales-manager-${tenantId}`,
                name: 'Sales Manager',
                code: 'SALES_MANAGER',
                description: 'Sales team manager',
                hierarchy_level: 'DEPARTMENT',
                tier: 'DEPARTMENT',
                department: 'sales',
              },
              {
                id: `service-manager-${tenantId}`,
                name: 'Service Manager',
                code: 'SERVICE_MANAGER',
                description: 'Service team manager',
                hierarchy_level: 'DEPARTMENT',
                tier: 'DEPARTMENT',
                department: 'service',
              },
              {
                id: `sales-rep-${tenantId}`,
                name: 'Sales Representative',
                code: 'SALES_REP',
                description: 'Sales representative',
                hierarchy_level: 'INDIVIDUAL',
                tier: 'INDIVIDUAL',
                department: 'sales',
              },
              {
                id: `service-tech-${tenantId}`,
                name: 'Service Technician',
                code: 'SERVICE_TECH',
                description: 'Service technician',
                hierarchy_level: 'INDIVIDUAL',
                tier: 'INDIVIDUAL',
                department: 'service',
              },
              {
                id: `admin-assistant-${tenantId}`,
                name: 'Administrative Assistant',
                code: 'ADMIN_ASSISTANT',
                description: 'Administrative support',
                hierarchy_level: 'INDIVIDUAL',
                tier: 'INDIVIDUAL',
                department: 'administration',
              },
            ];

      const roleRows = rolesToCreate.map((role, idx) => ({
        id: role.id,
        tenant_id: tenantId,
        organizational_unit_id: companyUnitId,
        name: role.name,
        code: role.code,
        description: role.description,
        hierarchy_level: role.hierarchy_level,
        organizational_tier: role.tier,
        department: role.department,
        lft: 2 * (idx + 1) + 1,
        rght: 2 * (idx + 1) + 2,
        depth: 1,
        created_by: user.id,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: rolesErr } = await admin.from('enhanced_roles').insert(roleRows);

      if (rolesErr) {
        return createCorsResponse(
          { error: 'Failed to create roles', degraded: true, details: rolesErr.message },
          503,
          req,
        );
      }

      // Assign the first (highest) role to the initiating user.
      const firstRoleId = rolesToCreate[0].id;
      await admin
        .from('user_role_assignments')
        .insert({
          id: `assignment-${user.id}-${Date.now()}`,
          user_id: user.id,
          role_id: firstRoleId,
          tenant_id: tenantId,
          organizational_unit_id: companyUnitId,
          assigned_by: user.id,
          is_active: true,
          created_at: nowIso,
        })
        .then(
          () => {},
          () => {},
        );

      return createCorsResponse(
        {
          message: 'RBAC system initialized successfully',
          dealerType,
          tenantId,
          rolesCreated: rolesToCreate.length,
          userAssigned: firstRoleId,
        },
        200,
        req,
      );
    }

    // GET /rbac/roles/:id - Get single role (named-id before bare list)
    if (req.method === 'GET' && endpoint === 'roles' && resourceId) {
      const { data: role, error } = await admin
        .from('roles')
        .select('*')
        .eq('id', resourceId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Role not found' }, 404, req);
      }

      return createCorsResponse(role, 200, req);
    }

    // GET /rbac/roles - List all roles
    if (req.method === 'GET' && endpoint === 'roles') {
      const { data: roles, error } = await admin
        .from('roles')
        .select('*')
        .order('level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return createCorsResponse({ error: 'Failed to fetch roles' }, 500, req);
      }

      return createCorsResponse(roles || [], 200, req);
    }

    // GET /rbac/permissions - List all permissions
    if (req.method === 'GET' && endpoint === 'permissions') {
      const { data: permissions, error } = await admin
        .from('permissions')
        .select('*')
        .order('module', { ascending: true });

      if (error) {
        console.error('Error fetching permissions:', error);
        return createCorsResponse({ error: 'Failed to fetch permissions' }, 500, req);
      }

      return createCorsResponse(permissions || [], 200, req);
    }

    // GET /rbac/user-permissions - Get current user's permissions
    if (req.method === 'GET' && endpoint === 'user-permissions') {
      const { data: userRole } = await admin
        .from('users')
        .select(
          `
          role_id,
          roles (
            id,
            name,
            level,
            permissions
          )
        `,
        )
        .eq('id', user.id)
        .single();

      const permissions = (userRole?.roles as any)?.permissions || [];
      const roleLevel = (userRole?.roles as any)?.level || 1;
      const roleName = (userRole?.roles as any)?.name || 'Guest';

      return createCorsResponse(
        {
          userId: user.id,
          roleId: userRole?.role_id,
          roleName,
          roleLevel,
          permissions,
        },
        200,
        req,
      );
    }

    // POST /rbac/check-permission - Check if user has permission
    if (req.method === 'POST' && endpoint === 'check-permission') {
      const body = await req.json();
      const { permission, userId: targetUserId } = body;

      const checkUserId = targetUserId || user.id;

      const { data: userRole } = await admin
        .from('users')
        .select('roles!inner(permissions, level)')
        .eq('id', checkUserId)
        .single();

      const permissions = (userRole?.roles as any)?.permissions || [];
      const hasPermission = permissions.includes(permission) || permissions.includes('*');

      return createCorsResponse({ hasPermission, permission }, 200, req);
    }

    // GET /rbac/audit-logs - Get RBAC audit logs
    if (req.method === 'GET' && endpoint === 'audit-logs') {
      const limit = parseInt(url.searchParams.get('limit') || '100');

      const { data: logs } = await admin
        .from('rbac_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return createCorsResponse(logs || [], 200, req);
    }

    // POST /rbac/assign-role - Assign role to user (admin only)
    if (req.method === 'POST' && endpoint === 'assign-role') {
      // Check if current user has admin permissions
      const { data: currentUserRole } = await admin
        .from('users')
        .select('roles!inner(level)')
        .eq('id', user.id)
        .single();

      const currentLevel = (currentUserRole?.roles as any)?.level || 0;
      if (currentLevel < 5) {
        return createCorsResponse({ error: 'Insufficient permissions' }, 403, req);
      }

      const body = await req.json();
      const { userId: targetUserId, roleId } = body;

      // Check target role level
      const { data: targetRole } = await admin
        .from('roles')
        .select('level')
        .eq('id', roleId)
        .single();

      if ((targetRole?.level || 0) >= currentLevel) {
        return createCorsResponse({ error: 'Cannot assign role at or above your level' }, 403, req);
      }

      const { error } = await admin
        .from('users')
        .update({ role_id: roleId, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (error) {
        return createCorsResponse({ error: 'Failed to assign role' }, 500, req);
      }

      // Log the assignment
      await admin.from('rbac_audit_log').insert({
        tenant_id: tenantId,
        user_id: user.id,
        action: 'role_assigned',
        target_user_id: targetUserId,
        new_role_id: roleId,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse({ success: true, message: 'Role assigned' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in rbac function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
