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
import { toCamel } from '../_shared/case.ts';
import { buildRoleClaims, claimsPatch, syncRoleClaims } from '../_shared/role-claims.ts';

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

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant (cross-tenant IDOR guard).
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || (headerTenantId as string);

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
    // ORG STRUCTURE (WF-R-08)
    //
    // WF-R-04 through WF-R-07 scope every list on users.manager_id,
    // users.team_id, users.primary_location_id and users.region_id, and NOTHING
    // WROTE ANY OF THEM - the invite below set role_id and team_id and stopped, and
    // the one file that ever assigned a manager (server/auth-setup.ts) is an
    // orphan. So location and region scope degraded to team for every user in
    // every tenant. These endpoints are what fills the tree.
    //
    // They live in `admin` rather than in the `locations` function because that
    // one has no caller, no proxy entry and no gate of its own, while this
    // function is already reachable, already proxied per-path and already behind
    // checkAdminPermission above. `teams` was not an option at all: that edge
    // function is about PROJECT teams (tasks, projects, time_entries) and shares
    // only the word - the AUDIT-031 collision shape.
    // =====================================================

    /** Only columns the table has; an unknown key is a PGRST204, not a no-op. */
    const pick = (body: Record<string, unknown>, map: Record<string, string>) => {
      const row: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(map)) {
        const camel = body[key];
        const snake = body[column];
        const value = camel !== undefined ? camel : snake;
        if (value !== undefined) row[column] = value === '' ? null : value;
      }
      return row;
    };

    const LOCATION_COLUMNS = {
      name: 'name',
      code: 'code',
      address: 'address',
      city: 'city',
      state: 'state',
      zipCode: 'zip_code',
      phone: 'phone',
      email: 'email',
      locationType: 'location_type',
      isHeadquarters: 'is_headquarters',
      regionId: 'region_id',
      locationManagerId: 'location_manager_id',
      isActive: 'is_active',
    };

    const REGION_COLUMNS = {
      name: 'name',
      code: 'code',
      description: 'description',
      regionalManagerId: 'regional_manager_id',
      states: 'states',
      isActive: 'is_active',
    };

    const TEAM_COLUMNS = {
      name: 'name',
      department: 'department',
      locationId: 'location_id',
      managerId: 'manager_id',
      parentTeamId: 'parent_team_id',
      isActive: 'is_active',
    };

    const ORG_TABLES: Record<string, { table: string; columns: Record<string, string> }> = {
      locations: { table: 'locations', columns: LOCATION_COLUMNS },
      regions: { table: 'regions', columns: REGION_COLUMNS },
      teams: { table: 'teams', columns: TEAM_COLUMNS },
    };

    const org = ORG_TABLES[resource];
    if (org) {
      const { table, columns } = org;

      if (req.method === 'GET' && !resourceId) {
        const { data, error } = await admin
          .from(table)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('name', { ascending: true });
        if (error) {
          console.error(`Error listing ${table}:`, error.message);
          return createCorsResponse({ error: `Failed to fetch ${table}` }, 500, req);
        }
        return createCorsResponse(toCamel(data ?? []), 200, req);
      }

      if (req.method === 'POST' && !resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = pick(body, columns);
        if (!row.name) {
          return createCorsResponse({ error: 'name is required' }, 400, req);
        }
        const { data, error } = await admin
          .from(table)
          .insert({ ...row, tenant_id: tenantId })
          .select()
          .single();
        if (error) {
          console.error(`Error creating ${table} row:`, error.message);
          return createCorsResponse({ error: `Failed to create ${table} row` }, 500, req);
        }
        await logAuditEvent(
          admin,
          tenantId,
          user.id,
          `CREATE_${table.toUpperCase()}`,
          table,
          data.id,
          null,
          row,
          req,
        );
        return createCorsResponse(toCamel(data), 201, req);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = pick(body, columns);
        if (Object.keys(row).length === 0) {
          return createCorsResponse({ error: 'No recognised fields to update' }, 400, req);
        }
        const { data, error } = await admin
          .from(table)
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) {
          console.error(`Error updating ${table} row:`, error.message);
          return createCorsResponse({ error: `Failed to update ${table} row` }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Not found' }, 404, req);
        await logAuditEvent(
          admin,
          tenantId,
          user.id,
          `UPDATE_${table.toUpperCase()}`,
          table,
          resourceId,
          null,
          row,
          req,
        );
        return createCorsResponse(toCamel(data), 200, req);
      }

      if (req.method === 'DELETE' && resourceId) {
        // Soft-retire rather than delete. users.primary_location_id,
        // users.region_id and users.team_id carry no FK constraint, so a hard
        // delete would leave every user pointing at an id that resolves to
        // nothing and scope them to an empty set without saying why.
        const { data, error } = await admin
          .from(table)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) {
          console.error(`Error retiring ${table} row:`, error.message);
          return createCorsResponse({ error: `Failed to retire ${table} row` }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Not found' }, 404, req);
        await logAuditEvent(
          admin,
          tenantId,
          user.id,
          `RETIRE_${table.toUpperCase()}`,
          table,
          resourceId,
          null,
          { is_active: false },
          req,
        );
        return createCorsResponse({ success: true, id: resourceId }, 200, req);
      }
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
          metadata,
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
      // `roles` is a GLOBAL catalogue: it has no tenant_id column, so filtering
      // by one 42703'd and left every user in the list with a blank role name.
      const { data: roles } = await admin.from('roles').select('id, name');
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

      // Create user record in users table.
      //
      // AUDIT-037: phone, job_title and department used to be in this payload
      // and `users` has none of them, so every invitation 42703'd - the auth
      // user was created, the row insert failed, and the cleanup path below
      // deleted the auth user again. Inviting a colleague has never worked.
      // They live on user_settings, which is the same correction COP-M01 made
      // to the user and users-team functions, and they are written below once
      // the row exists.
      // WF-R-08: the org placement. Every scope from WF-R-04 onward reads these
      // four columns and this invite set only two of them, so a new user arrived
      // with no manager, no location and no region - which is why location and
      // region scope degraded to team for everybody.
      const newUserData = {
        id: authUser.user.id,
        tenant_id: tenantId,
        email: body.email.toLowerCase(),
        first_name: body.firstName || null,
        last_name: body.lastName || null,
        role_id: body.roleId || null,
        team_id: body.teamId || null,
        manager_id: body.managerId || body.manager_id || null,
        primary_location_id: body.primaryLocationId || body.primary_location_id || null,
        region_id: body.regionId || body.region_id || null,
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

      // WF-R-03: the invite above puts everything in user_metadata, so an invited
      // user reaches the gates with an EMPTY app_metadata - no tenantId and, more
      // damagingly, no roleLevel, which _shared/rbac.ts reads as level 1. Write
      // both now that the role is known. Not fatal if it fails: requireAuth's
      // backfill will do it on the user's first request instead.
      {
        const inviteClaims = await buildRoleClaims(admin, newUser.role_id);
        const { error: claimError } = await admin.auth.admin.updateUserById(authUser.user.id, {
          app_metadata: {
            tenantId,
            ...(inviteClaims ? claimsPatch(inviteClaims) : {}),
          },
        });
        if (claimError) {
          console.error('Error writing role claims for invited user:', claimError.message);
        }
      }

      // The profile fields `users` does not carry. user_settings.tenant_id is
      // NOT NULL, so it goes in the row. A failure here does not undo the
      // invitation - the account exists and works; only the optional profile is
      // missing - so it is logged rather than raised.
      const profileFields = {
        phone: body.phone ?? null,
        job_title: body.jobTitle ?? null,
        department: body.department ?? null,
      };
      if (Object.values(profileFields).some((v) => v !== null)) {
        const { error: settingsError } = await admin.from('user_settings').upsert(
          {
            tenant_id: tenantId,
            user_id: newUser.id,
            ...profileFields,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (settingsError) {
          console.error('Error storing invited user profile fields:', settingsError.message);
        }
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
        { ...newUserData, ...profileFields },
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
      if (body.teamId !== undefined) updateData.team_id = body.teamId || null;
      // WF-R-08. An empty string is how a select clears a placement, and writing
      // '' into these would scope the user to a location id that matches nothing
      // rather than to no location at all.
      if (body.managerId !== undefined) updateData.manager_id = body.managerId || null;
      if (body.primaryLocationId !== undefined) {
        updateData.primary_location_id = body.primaryLocationId || null;
      }
      if (body.regionId !== undefined) updateData.region_id = body.regionId || null;
      if (body.profileImageUrl !== undefined) updateData.profile_image_url = body.profileImageUrl;

      // AUDIT-037: phone, job_title, department, timezone and locale were in
      // this payload and none is a column on `users`, so ANY edit that touched
      // one 42703'd and the whole update was lost - including the role change
      // in the same request. They belong to user_settings, where `locale` is
      // called `language`.
      const settingsUpdate: Record<string, unknown> = {};
      if (body.phone !== undefined) settingsUpdate.phone = body.phone;
      if (body.jobTitle !== undefined) settingsUpdate.job_title = body.jobTitle;
      if (body.department !== undefined) settingsUpdate.department = body.department;
      if (body.timezone !== undefined) settingsUpdate.timezone = body.timezone;
      if (body.locale !== undefined) settingsUpdate.language = body.locale;

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

      if (Object.keys(settingsUpdate).length > 0) {
        const { error: settingsError } = await admin.from('user_settings').upsert(
          {
            tenant_id: tenantId,
            user_id: resourceId,
            ...settingsUpdate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (settingsError) {
          console.error('Error updating user profile fields:', settingsError.message);
          return createCorsResponse({ error: 'Failed to update user profile' }, 500, req);
        }
      }

      // Update Supabase Auth user metadata if email changed
      if (body.email && body.email !== existingUser.email) {
        await admin.auth.admin.updateUserById(resourceId, { email: body.email });
      }

      // WF-R-03: a role change has to reach app_metadata or the gates keep
      // enforcing the old level. The gates re-read the user from GoTrue on every
      // request, so this takes effect on the user's NEXT request without a new
      // sign-in - bounded by the AUDIT-005 auth cache TTL. What it does not do is
      // revoke the access token already in their hands: a consumer that decodes
      // the JWT payload directly keeps seeing the old level until it refreshes.
      if (body.roleId !== undefined && body.roleId !== existingUser.role_id) {
        const synced = await syncRoleClaims(admin, resourceId, updatedUser.role_id);
        if (!synced) {
          console.error('Role claims not written for user', resourceId, 'role', body.roleId);
        }
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
      // No tenant filter: `roles` has no tenant_id column (see the user-list
      // lookup above). Filtering by one made this endpoint 500 outright.
      const { data: roles, error } = await admin
        .from('roles')
        .select('*')
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
        // `roles` has created_at but no updated_at.
        updatedAt: null,
      }));

      return createCorsResponse(transformedRoles, 200, req);
    }

    // POST /admin/roles - Create role
    // PUT/PATCH /admin/roles/:id - Update role
    //
    // Both refuse rather than write. `roles` is a GLOBAL table — no tenant_id
    // column — so it is not merely that the old code named columns that do not
    // exist (tenant_id and updated_at on the insert, tenant_id on both update
    // filters, all of them 42703). Repairing those names would turn a tenant
    // admin's role edit into a mutation of the roles every OTHER tenant's users
    // hold, which is precisely what the tenant-isolation rule forbids.
    //
    // `enhanced_roles` is the tenant-scoped role table, but users.role_id points
    // at `roles` and the auth check at the top of this file resolves against it,
    // so moving this CRUD there is a migration, not a rename.
    if (
      (req.method === 'POST' && resource === 'roles') ||
      ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'roles' && resourceId)
    ) {
      return createCorsResponse(
        {
          error: 'Role authoring is not available on this endpoint',
          code: 'ROLES_TABLE_IS_GLOBAL',
          details:
            'The `roles` table has no tenant_id column, so a write here would change roles ' +
            'for every tenant. Tenant-scoped roles belong in `enhanced_roles`, which ' +
            'users.role_id does not yet reference.',
        },
        501,
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
      // The column is storage_used; there is no `settings` column on tenants
      // (the free-form one is `metadata`), so this query returned nothing and
      // the storage metric below was always null.
      const { data: tenantData } = await admin
        .from('tenants')
        .select('storage_used')
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
          storage: tenantData?.storage_used ?? null,
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
      // The tenant's free-form config bag is `metadata`; there is no `settings`
      // column, so both this GET and the PUT below 42703'd outright. The
      // response key stays `settings` so the admin page's contract is unchanged.
      const { data: tenant, error: tenantError } = await admin
        .from('tenants')
        .select('id, name, metadata, created_at, updated_at')
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
            settings: tenant.metadata || {},
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
        .select('metadata')
        .eq('id', tenantId)
        .single();

      // Update tenant settings
      if (body.tenant) {
        const tenantUpdateData = {
          metadata: {
            ...(existingTenant?.metadata || {}),
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
