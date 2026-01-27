// Roles Edge Function
// Handles role and permission management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const roleId = pathParts[1];

    // GET /roles - List roles
    if (req.method === 'GET' && !roleId) {
      const { data: roles, error } = await admin
        .from('roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return createCorsResponse({ error: 'Failed to fetch roles' }, 500, req);
      }

      return createCorsResponse(roles || [], 200, req);
    }

    // GET /roles/:id - Get single role
    if (req.method === 'GET' && roleId) {
      const { data: role, error } = await admin
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching role:', error);
        return createCorsResponse({ error: 'Role not found' }, 404, req);
      }

      // Get user count with this role
      const { data: users } = await admin
        .from('users')
        .select('id')
        .eq('role_id', roleId)
        .eq('tenant_id', tenantId);

      return createCorsResponse({ ...role, userCount: users?.length || 0 }, 200, req);
    }

    // POST /roles - Create role
    if (req.method === 'POST') {
      const body = await req.json();

      const roleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        level: body.level || 1,
        permissions: body.permissions || {},
        can_access_all_tenants: body.canAccessAllTenants || body.can_access_all_tenants || false,
        is_system_role: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: role, error } = await admin.from('roles').insert(roleData).select().single();

      if (error) {
        console.error('Error creating role:', error);
        return createCorsResponse({ error: 'Failed to create role', details: error }, 500, req);
      }

      return createCorsResponse(role, 201, req);
    }

    // PATCH /roles/:id - Update role
    if ((req.method === 'PATCH' || req.method === 'PUT') && roleId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.level !== undefined) updateData.level = body.level;
      if (body.permissions) updateData.permissions = body.permissions;
      if (body.canAccessAllTenants !== undefined || body.can_access_all_tenants !== undefined) {
        updateData.can_access_all_tenants =
          body.canAccessAllTenants !== undefined
            ? body.canAccessAllTenants
            : body.can_access_all_tenants;
      }

      const { data: role, error } = await admin
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .eq('is_system_role', false) // Prevent updating system roles
        .select()
        .single();

      if (error) {
        console.error('Error updating role:', error);
        return createCorsResponse({ error: 'Failed to update role' }, 500, req);
      }

      return createCorsResponse(role, 200, req);
    }

    // DELETE /roles/:id - Delete role
    if (req.method === 'DELETE' && roleId) {
      // Check if role has users
      const { data: users } = await admin
        .from('users')
        .select('id')
        .eq('role_id', roleId)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (users && users.length > 0) {
        return createCorsResponse(
          { error: 'Cannot delete role with assigned users. Please reassign users first.' },
          400,
          req,
        );
      }

      // Prevent deleting system roles
      const { data: role } = await admin
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .single();

      if (role?.is_system_role) {
        return createCorsResponse({ error: 'Cannot delete system roles' }, 400, req);
      }

      const { error } = await admin
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting role:', error);
        return createCorsResponse({ error: 'Failed to delete role' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Role deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in roles function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
