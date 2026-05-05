// Admin Edge Function
// Handles tenant-level admin management operations:
// - User management (list, create/invite, update, deactivate)
// - Role management (list, create, update)
// - Permission listing
// - Audit log access
// - System health metrics
// - Admin settings
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// Helper to check if user has admin permissions
async function checkAdminPermission(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  tenantId: string,
): Promise<{ allowed: boolean; user?: any; role?: any }> {
  // Get user with their role
  const { data: userData, error: userError } = await admin
    .from('users')
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      role_id,
      is_active
    `,
    )
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .single();

  if (userError || !userData) {
    return { allowed: false };
  }

  // Get role permissions
  const { data: roleData, error: roleError } = await admin
    .from('roles')
    .select('*')
    .eq('id', userData.role_id)
    .single();

  if (roleError || !roleData) {
    return { allowed: false, user: userData };
  }

  // Check if user has admin capabilities
  // Admin access if: level >= 6 (Company Admin+) OR has canManageUsers permission
  const hasAdminAccess =
    roleData.level >= 6 ||
    roleData.can_manage_users === true ||
    roleData.permissions?.['admin.users.manage'] === true;

  return { allowed: hasAdminAccess, user: userData, role: roleData };
}

// Helper to log audit events
async function logAuditEvent(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  oldValues: any,
  newValues: any,
  req: Request,
): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      resource,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      ip_address:
        req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0',
      user_agent: req.headers.get('user-agent'),
      severity: 'medium',
      category: 'data_modification',
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized', details: userError?.message }, 401, req);
    }

    // Get tenant ID from user metadata or header
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    const admin = createSupabaseServiceClient();

    // Fallback: query tenant_id from users table
    if (!tenantId) {
      const { data: userData, error: userQueryError } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userQueryError || !userData?.tenant_id) {
        console.error('No tenant ID found for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      tenantId = userData.tenant_id;
    }

    // Parse URL path and query params
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'admin');
    // Expected paths after function-name strip: /users, /users/:id, /roles, etc.
    const resource = parts[0]; // 'users', 'roles', 'permissions', 'audit-log', 'system-health', 'settings'
    const resourceId = parts[1]; // Optional ID

    // Check admin permissions (except for specific endpoints)
    const {
      allowed,
      user: currentUser,
      role: currentRole,
    } = await checkAdminPermission(admin, user.id, tenantId);

    if (!allowed) {
      return createCorsResponse(
        { error: 'Insufficient permissions. Admin access required.' },
        403,
        req,
      );
    }

    // =====================================================
    // USER MANAGEMENT ENDPOINTS
    // =====================================================

    // GET /admin/users - List all users for tenant
    if (req.method === 'GET' && resource === 'users' && !resourceId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const search = url.searchParams.get('search') || '';
      const roleId = url.searchParams.get('roleId');
      const teamId = url.searchParams.get('teamId');
      const isActive = url.searchParams.get('isActive');
      const offset = (page - 1) * limit;

      let query = admin
        .from('users')
        .select(
          `
          id,
          email,
          first_name,
          last_name,
          role_id,
          team_id,
          is_active,
          profile_image_url,
          phone,
          job_title,
          department,
          last_login_at,
          created_at,
          updated_at
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(
          `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
        );
      }
      if (roleId) {
        query = query.eq('role_id', roleId);
      }
      if (teamId) {
        query = query.eq('team_id', teamId);
      }
      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      const { data: users, error, count } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        return createCorsResponse({ error: 'Failed to fetch users' }, 500, req);
      }

      // Get roles for mapping
      const { data: roles } = await admin
        .from('roles')
        .select('id, name')
        .eq('tenant_id', tenantId);
      const rolesMap = Object.fromEntries((roles || []).map((r: any) => [r.id, r.name]));

      // Get teams for mapping
      const { data: teams } = await admin
        .from('teams')
        .select('id, name')
        .eq('tenant_id', tenantId);
      const teamsMap = Object.fromEntries((teams || []).map((t: any) => [t.id, t.name]));

      const transformedUsers = (users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        roleId: u.role_id,
        roleName: rolesMap[u.role_id] || null,
        teamId: u.team_id,
        teamName: teamsMap[u.team_id] || null,
        isActive: u.is_active,
        avatar: u.profile_image_url,
        phone: u.phone,
        jobTitle: u.job_title,
        department: u.department,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      return createCorsResponse(
        {
          data: transformedUsers,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /admin/users/:id - Get user details
    if (req.method === 'GET' && resource === 'users' && resourceId) {
      const { data: userData, error } = await admin
        .from('users')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !userData) {
        console.error('Error fetching user:', error);
        return createCorsResponse({ error: 'User not found' }, 404, req);
      }

      // Get role details
      const { data: roleData } = await admin
        .from('roles')
        .select('*')
        .eq('id', userData.role_id)
        .single();

      // Get team details
      const { data: teamData } = userData.team_id
        ? await admin.from('teams').select('*').eq('id', userData.team_id).single()
        : { data: null };

      return createCorsResponse(
        {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
          roleId: userData.role_id,
          role: roleData
            ? {
                id: roleData.id,
                name: roleData.name,
                level: roleData.level,
              }
            : null,
          teamId: userData.team_id,
          team: teamData
            ? {
                id: teamData.id,
                name: teamData.name,
              }
            : null,
          isActive: userData.is_active,
          avatar: userData.profile_image_url,
          phone: userData.phone,
          jobTitle: userData.job_title,
          department: userData.department,
          timezone: userData.timezone,
          locale: userData.locale,
          mfaEnabled: userData.mfa_enabled,
          emailVerified: userData.email_verified,
          lastLoginAt: userData.last_login_at,
          loginCount: userData.login_count,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
        },
        200,
        req,
      );
    }

    // POST /admin/users - Create/invite user
    if (req.method === 'POST' && resource === 'users') {
      const body = await req.json();

      // Validate required fields
      if (!body.email) {
        return createCorsResponse({ error: 'Email is required' }, 400, req);
      }

      // Check if email already exists in this tenant
      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('email', body.email.toLowerCase())
        .eq('tenant_id', tenantId)
        .single();

      if (existingUser) {
        return createCorsResponse({ error: 'User with this email already exists' }, 409, req);
      }

      // Create user in Supabase Auth (this sends invite email)
      const { data: authUser, error: authError } = await admin.auth.admin.inviteUserByEmail(
        body.email.toLowerCase(),
        {
          data: {
            tenant_id: tenantId,
            first_name: body.firstName,
            last_name: body.lastName,
          },
          redirectTo: body.redirectTo || `${url.origin}/auth/callback`,
        },
      );

      if (authError) {
        console.error('Error creating auth user:', authError);
        return createCorsResponse(
          { error: 'Failed to invite user', details: authError.message },
          500,
          req,
        );
      }

      // Create user record in users table
      const newUserData = {
        id: authUser.user.id,
        tenant_id: tenantId,
        email: body.email.toLowerCase(),
        first_name: body.firstName || null,
        last_name: body.lastName || null,
        role_id: body.roleId || null,
        team_id: body.teamId || null,
        phone: body.phone || null,
        job_title: body.jobTitle || null,
        department: body.department || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newUser, error: insertError } = await admin
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user record:', insertError);
        // Try to clean up auth user
        await admin.auth.admin.deleteUser(authUser.user.id);
        return createCorsResponse({ error: 'Failed to create user record' }, 500, req);
      }

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'CREATE_USER',
        'users',
        newUser.id,
        null,
        newUserData,
        req,
      );

      return createCorsResponse(
        {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          roleId: newUser.role_id,
          teamId: newUser.team_id,
          isActive: newUser.is_active,
          createdAt: newUser.created_at,
          message: 'User invited successfully. An invitation email has been sent.',
        },
        201,
        req,
      );
    }

    // PUT/PATCH /admin/users/:id - Update user
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'users' && resourceId) {
      const body = await req.json();

      // Get existing user for audit log
      const { data: existingUser, error: fetchError } = await admin
        .from('users')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingUser) {
        return createCorsResponse({ error: 'User not found' }, 404, req);
      }

      // Prevent self-demotion from admin role
      if (resourceId === user.id && body.roleId && body.roleId !== existingUser.role_id) {
        const { data: newRole } = await admin
          .from('roles')
          .select('level')
          .eq('id', body.roleId)
          .single();
        if (newRole && newRole.level < (currentRole?.level || 0)) {
          return createCorsResponse({ error: 'Cannot demote yourself to a lower role' }, 400, req);
        }
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.firstName !== undefined) updateData.first_name = body.firstName;
      if (body.lastName !== undefined) updateData.last_name = body.lastName;
      if (body.roleId !== undefined) updateData.role_id = body.roleId;
      if (body.teamId !== undefined) updateData.team_id = body.teamId;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.jobTitle !== undefined) updateData.job_title = body.jobTitle;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.timezone !== undefined) updateData.timezone = body.timezone;
      if (body.locale !== undefined) updateData.locale = body.locale;
      if (body.profileImageUrl !== undefined) updateData.profile_image_url = body.profileImageUrl;

      const { data: updatedUser, error: updateError } = await admin
        .from('users')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return createCorsResponse({ error: 'Failed to update user' }, 500, req);
      }

      // Update Supabase Auth user metadata if email changed
      if (body.email && body.email !== existingUser.email) {
        await admin.auth.admin.updateUserById(resourceId, { email: body.email });
      }

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'UPDATE_USER',
        'users',
        resourceId,
        existingUser,
        updateData,
        req,
      );

      return createCorsResponse(
        {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          roleId: updatedUser.role_id,
          teamId: updatedUser.team_id,
          isActive: updatedUser.is_active,
          updatedAt: updatedUser.updated_at,
        },
        200,
        req,
      );
    }

    // DELETE /admin/users/:id - Deactivate user (soft delete)
    if (req.method === 'DELETE' && resource === 'users' && resourceId) {
      // Prevent self-deactivation
      if (resourceId === user.id) {
        return createCorsResponse({ error: 'Cannot deactivate your own account' }, 400, req);
      }

      // Get existing user for audit log
      const { data: existingUser, error: fetchError } = await admin
        .from('users')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingUser) {
        return createCorsResponse({ error: 'User not found' }, 404, req);
      }

      // Soft delete - set is_active to false
      const { error: updateError } = await admin
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error deactivating user:', updateError);
        return createCorsResponse({ error: 'Failed to deactivate user' }, 500, req);
      }

      // Optionally disable user in Supabase Auth
      // await admin.auth.admin.updateUserById(resourceId, { ban_duration: 'none' });

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'DEACTIVATE_USER',
        'users',
        resourceId,
        { is_active: true },
        { is_active: false },
        req,
      );

      return createCorsResponse(
        { success: true, message: 'User deactivated successfully' },
        200,
        req,
      );
    }

    // =====================================================
    // ROLE MANAGEMENT ENDPOINTS
    // =====================================================

    // GET /admin/roles - List roles
    if (req.method === 'GET' && resource === 'roles' && !resourceId) {
      const { data: roles, error } = await admin
        .from('roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return createCorsResponse({ error: 'Failed to fetch roles' }, 500, req);
      }

      // Get user counts per role
      const { data: userCounts } = await admin
        .from('users')
        .select('role_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      const roleCounts = (userCounts || []).reduce((acc: Record<string, number>, u: any) => {
        acc[u.role_id] = (acc[u.role_id] || 0) + 1;
        return acc;
      }, {});

      const transformedRoles = (roles || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        level: r.level,
        permissions: r.permissions || {},
        isSystemRole: r.is_system_role,
        canAccessAllTenants: r.can_access_all_tenants,
        userCount: roleCounts[r.id] || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return createCorsResponse(transformedRoles, 200, req);
    }

    // POST /admin/roles - Create role
    if (req.method === 'POST' && resource === 'roles') {
      const body = await req.json();

      if (!body.name) {
        return createCorsResponse({ error: 'Role name is required' }, 400, req);
      }

      // Check if role name already exists
      const { data: existingRole } = await admin
        .from('roles')
        .select('id')
        .eq('name', body.name)
        .eq('tenant_id', tenantId)
        .single();

      if (existingRole) {
        return createCorsResponse({ error: 'Role with this name already exists' }, 409, req);
      }

      const roleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        level: body.level || 1,
        permissions: body.permissions || {},
        can_access_all_tenants: body.canAccessAllTenants || false,
        is_system_role: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: role, error } = await admin.from('roles').insert(roleData).select().single();

      if (error) {
        console.error('Error creating role:', error);
        return createCorsResponse(
          { error: 'Failed to create role', details: error.message },
          500,
          req,
        );
      }

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'CREATE_ROLE',
        'roles',
        role.id,
        null,
        roleData,
        req,
      );

      return createCorsResponse(
        {
          id: role.id,
          name: role.name,
          description: role.description,
          level: role.level,
          permissions: role.permissions,
          isSystemRole: role.is_system_role,
          canAccessAllTenants: role.can_access_all_tenants,
          createdAt: role.created_at,
        },
        201,
        req,
      );
    }

    // PUT/PATCH /admin/roles/:id - Update role
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'roles' && resourceId) {
      const body = await req.json();

      // Get existing role
      const { data: existingRole, error: fetchError } = await admin
        .from('roles')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingRole) {
        return createCorsResponse({ error: 'Role not found' }, 404, req);
      }

      // Prevent modifying system roles
      if (existingRole.is_system_role) {
        return createCorsResponse({ error: 'Cannot modify system roles' }, 400, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.level !== undefined) updateData.level = body.level;
      if (body.permissions !== undefined) updateData.permissions = body.permissions;
      if (body.canAccessAllTenants !== undefined)
        updateData.can_access_all_tenants = body.canAccessAllTenants;

      const { data: role, error } = await admin
        .from('roles')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating role:', error);
        return createCorsResponse({ error: 'Failed to update role' }, 500, req);
      }

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'UPDATE_ROLE',
        'roles',
        resourceId,
        existingRole,
        updateData,
        req,
      );

      return createCorsResponse(
        {
          id: role.id,
          name: role.name,
          description: role.description,
          level: role.level,
          permissions: role.permissions,
          isSystemRole: role.is_system_role,
          canAccessAllTenants: role.can_access_all_tenants,
          updatedAt: role.updated_at,
        },
        200,
        req,
      );
    }

    // =====================================================
    // PERMISSIONS ENDPOINT
    // =====================================================

    // GET /admin/permissions - List available permissions
    if (req.method === 'GET' && resource === 'permissions') {
      // Return a structured list of all available permissions
      const permissions = {
        categories: [
          {
            name: 'admin',
            label: 'Administration',
            permissions: [
              {
                key: 'admin.users.view',
                label: 'View Users',
                description: 'View user list and details',
              },
              {
                key: 'admin.users.manage',
                label: 'Manage Users',
                description: 'Create, edit, and deactivate users',
              },
              {
                key: 'admin.roles.view',
                label: 'View Roles',
                description: 'View role list and details',
              },
              {
                key: 'admin.roles.manage',
                label: 'Manage Roles',
                description: 'Create and edit roles',
              },
              {
                key: 'admin.settings.view',
                label: 'View Settings',
                description: 'View admin settings',
              },
              {
                key: 'admin.settings.manage',
                label: 'Manage Settings',
                description: 'Update admin settings',
              },
              {
                key: 'admin.audit.view',
                label: 'View Audit Logs',
                description: 'Access audit logs',
              },
            ],
          },
          {
            name: 'sales',
            label: 'Sales',
            permissions: [
              {
                key: 'sales.lead.view_own',
                label: 'View Own Leads',
                description: 'View leads assigned to you',
              },
              {
                key: 'sales.lead.view_team',
                label: 'View Team Leads',
                description: 'View team leads',
              },
              {
                key: 'sales.lead.view_all',
                label: 'View All Leads',
                description: 'View all leads in tenant',
              },
              { key: 'sales.lead.create', label: 'Create Leads', description: 'Create new leads' },
              { key: 'sales.lead.edit', label: 'Edit Leads', description: 'Edit leads' },
              { key: 'sales.lead.delete', label: 'Delete Leads', description: 'Delete leads' },
              { key: 'sales.quote.view', label: 'View Quotes', description: 'View quotes' },
              {
                key: 'sales.quote.create',
                label: 'Create Quotes',
                description: 'Create new quotes',
              },
              {
                key: 'sales.quote.approve_standard',
                label: 'Approve Standard Quotes',
                description: 'Approve standard quotes',
              },
              {
                key: 'sales.quote.approve_all',
                label: 'Approve All Quotes',
                description: 'Approve all quotes',
              },
            ],
          },
          {
            name: 'service',
            label: 'Service',
            permissions: [
              {
                key: 'service.ticket.view_own',
                label: 'View Own Tickets',
                description: 'View tickets assigned to you',
              },
              {
                key: 'service.ticket.view_team',
                label: 'View Team Tickets',
                description: 'View team tickets',
              },
              {
                key: 'service.ticket.view_all',
                label: 'View All Tickets',
                description: 'View all tickets',
              },
              {
                key: 'service.ticket.create',
                label: 'Create Tickets',
                description: 'Create new tickets',
              },
              { key: 'service.ticket.edit', label: 'Edit Tickets', description: 'Edit tickets' },
              { key: 'service.ticket.close', label: 'Close Tickets', description: 'Close tickets' },
            ],
          },
          {
            name: 'inventory',
            label: 'Inventory',
            permissions: [
              {
                key: 'inventory.view',
                label: 'View Inventory',
                description: 'View inventory items',
              },
              {
                key: 'inventory.manage',
                label: 'Manage Inventory',
                description: 'Create and edit inventory',
              },
              {
                key: 'inventory.transfer',
                label: 'Transfer Inventory',
                description: 'Transfer between locations',
              },
            ],
          },
          {
            name: 'reports',
            label: 'Reports',
            permissions: [
              { key: 'reports.view', label: 'View Reports', description: 'View reports' },
              { key: 'reports.export', label: 'Export Reports', description: 'Export report data' },
              {
                key: 'reports.create',
                label: 'Create Reports',
                description: 'Create custom reports',
              },
            ],
          },
          {
            name: 'billing',
            label: 'Billing',
            permissions: [
              { key: 'billing.invoice.view', label: 'View Invoices', description: 'View invoices' },
              {
                key: 'billing.invoice.create',
                label: 'Create Invoices',
                description: 'Create invoices',
              },
              { key: 'billing.invoice.edit', label: 'Edit Invoices', description: 'Edit invoices' },
              { key: 'billing.payment.view', label: 'View Payments', description: 'View payments' },
              {
                key: 'billing.payment.process',
                label: 'Process Payments',
                description: 'Process payments',
              },
            ],
          },
        ],
      };

      return createCorsResponse(permissions, 200, req);
    }

    // =====================================================
    // AUDIT LOG ENDPOINT
    // =====================================================

    // GET /admin/audit-log - Get audit log
    if (req.method === 'GET' && resource === 'audit-log') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const userId = url.searchParams.get('userId');
      const action = url.searchParams.get('action');
      const resourceType = url.searchParams.get('resource');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const severity = url.searchParams.get('severity');
      const offset = (page - 1) * limit;

      let query = admin
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (action) {
        query = query.ilike('action', `%${action}%`);
      }
      if (resourceType) {
        query = query.eq('resource', resourceType);
      }
      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data: logs, error, count } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return createCorsResponse({ error: 'Failed to fetch audit logs' }, 500, req);
      }

      // Get user names for the logs
      const userIds = [...new Set((logs || []).map((l: any) => l.user_id))];
      const { data: users } = userIds.length
        ? await admin.from('users').select('id, email, first_name, last_name').in('id', userIds)
        : { data: [] };
      const usersMap = Object.fromEntries(
        (users || []).map((u: any) => [
          u.id,
          `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        ]),
      );

      const transformedLogs = (logs || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: usersMap[l.user_id] || 'Unknown',
        action: l.action,
        resource: l.resource,
        resourceId: l.resource_id,
        oldValues: l.old_values,
        newValues: l.new_values,
        ipAddress: l.ip_address,
        userAgent: l.user_agent,
        severity: l.severity,
        category: l.category,
        timestamp: l.timestamp,
      }));

      return createCorsResponse(
        {
          data: transformedLogs,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // =====================================================
    // SYSTEM HEALTH ENDPOINT
    // =====================================================

    // GET /admin/system-health - Get system health metrics
    if (req.method === 'GET' && resource === 'system-health') {
      // Get various system health metrics for the tenant
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Active users (logged in last 24h)
      const { count: activeUsers } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('last_login_at', last24Hours);

      // Total users
      const { count: totalUsers } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Recent audit events
      const { count: auditEventsLast24h } = await admin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('timestamp', last24Hours);

      // Critical/high severity events last 7 days
      const { count: criticalEvents } = await admin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('severity', ['critical', 'high'])
        .gte('timestamp', last7Days);

      // Active sessions
      const { count: activeSessions } = await admin
        .from('security_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Failed login attempts last 24h
      const { data: failedLogins } = await admin
        .from('security_sessions')
        .select('failed_login_attempts')
        .eq('tenant_id', tenantId)
        .gte('created_at', last24Hours);

      const totalFailedLogins = (failedLogins || []).reduce(
        (sum: number, s: any) => sum + (s.failed_login_attempts || 0),
        0,
      );

      // Get service tickets count (open)
      const { count: openTickets } = await admin
        .from('service_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'pending', 'in_progress']);

      // Get tenant storage usage if available
      const { data: tenantData } = await admin
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      const health = {
        status: 'healthy',
        timestamp: now.toISOString(),
        metrics: {
          users: {
            total: totalUsers || 0,
            activeLastDay: activeUsers || 0,
          },
          sessions: {
            active: activeSessions || 0,
            failedLoginsLastDay: totalFailedLogins,
          },
          audit: {
            eventsLastDay: auditEventsLast24h || 0,
            criticalEventsLastWeek: criticalEvents || 0,
          },
          service: {
            openTickets: openTickets || 0,
          },
          storage: tenantData?.settings?.storageUsage || null,
        },
        alerts: [] as string[],
      };

      // Add alerts based on thresholds
      if (totalFailedLogins > 10) {
        health.alerts.push('High number of failed login attempts in the last 24 hours');
        health.status = 'warning';
      }
      if ((criticalEvents || 0) > 5) {
        health.alerts.push('Multiple critical security events in the last 7 days');
        health.status = 'warning';
      }

      return createCorsResponse(health, 200, req);
    }

    // =====================================================
    // ADMIN SETTINGS ENDPOINTS
    // =====================================================

    // GET /admin/settings - Get admin settings
    if (req.method === 'GET' && resource === 'settings') {
      // Get tenant settings
      const { data: tenant, error: tenantError } = await admin
        .from('tenants')
        .select('id, name, settings, created_at, updated_at')
        .eq('id', tenantId)
        .single();

      if (tenantError) {
        console.error('Error fetching tenant settings:', tenantError);
        return createCorsResponse({ error: 'Failed to fetch settings' }, 500, req);
      }

      // Get compliance settings
      const { data: compliance } = await admin
        .from('compliance_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      return createCorsResponse(
        {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            settings: tenant.settings || {},
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          },
          compliance: compliance
            ? {
                gdprEnabled: compliance.gdpr_enabled,
                gdprContactEmail: compliance.gdpr_contact_email,
                gdprResponseDays: compliance.gdpr_response_days,
                auditRetentionDays: compliance.audit_retention_period_days,
                sessionTimeoutMinutes: compliance.session_timeout_minutes,
                maxConcurrentSessions: compliance.max_concurrent_sessions,
                encryptSensitiveFields: compliance.encrypt_sensitive_fields,
                maskDataInLogs: compliance.mask_data_in_logs,
                notifyOnSuspiciousActivity: compliance.notify_on_suspicious_activity,
              }
            : null,
        },
        200,
        req,
      );
    }

    // PUT /admin/settings - Update admin settings
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'settings') {
      const body = await req.json();

      // Get existing settings for audit log
      const { data: existingTenant } = await admin
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      // Update tenant settings
      if (body.tenant) {
        const tenantUpdateData = {
          settings: {
            ...(existingTenant?.settings || {}),
            ...body.tenant.settings,
          },
          updated_at: new Date().toISOString(),
        };

        if (body.tenant.name) {
          (tenantUpdateData as any).name = body.tenant.name;
        }

        const { error: updateError } = await admin
          .from('tenants')
          .update(tenantUpdateData)
          .eq('id', tenantId);

        if (updateError) {
          console.error('Error updating tenant settings:', updateError);
          return createCorsResponse({ error: 'Failed to update tenant settings' }, 500, req);
        }
      }

      // Update compliance settings
      if (body.compliance) {
        const complianceData: Record<string, any> = {
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        };

        if (body.compliance.gdprEnabled !== undefined)
          complianceData.gdpr_enabled = body.compliance.gdprEnabled;
        if (body.compliance.gdprContactEmail !== undefined)
          complianceData.gdpr_contact_email = body.compliance.gdprContactEmail;
        if (body.compliance.gdprResponseDays !== undefined)
          complianceData.gdpr_response_days = body.compliance.gdprResponseDays;
        if (body.compliance.auditRetentionDays !== undefined)
          complianceData.audit_retention_period_days = body.compliance.auditRetentionDays;
        if (body.compliance.sessionTimeoutMinutes !== undefined)
          complianceData.session_timeout_minutes = body.compliance.sessionTimeoutMinutes;
        if (body.compliance.maxConcurrentSessions !== undefined)
          complianceData.max_concurrent_sessions = body.compliance.maxConcurrentSessions;
        if (body.compliance.encryptSensitiveFields !== undefined)
          complianceData.encrypt_sensitive_fields = body.compliance.encryptSensitiveFields;
        if (body.compliance.maskDataInLogs !== undefined)
          complianceData.mask_data_in_logs = body.compliance.maskDataInLogs;
        if (body.compliance.notifyOnSuspiciousActivity !== undefined)
          complianceData.notify_on_suspicious_activity = body.compliance.notifyOnSuspiciousActivity;

        const { error: complianceError } = await admin
          .from('compliance_settings')
          .upsert(complianceData, { onConflict: 'tenant_id' });

        if (complianceError) {
          console.error('Error updating compliance settings:', complianceError);
          return createCorsResponse({ error: 'Failed to update compliance settings' }, 500, req);
        }
      }

      // Log audit event
      await logAuditEvent(
        admin,
        tenantId,
        user.id,
        'UPDATE_ADMIN_SETTINGS',
        'admin_settings',
        tenantId,
        existingTenant?.settings,
        body,
        req,
      );

      return createCorsResponse(
        { success: true, message: 'Settings updated successfully' },
        200,
        req,
      );
    }

    // Method not allowed or invalid resource
    return createCorsResponse({ error: 'Invalid endpoint or method not allowed' }, 404, req);
  } catch (error) {
    console.error('Admin function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
