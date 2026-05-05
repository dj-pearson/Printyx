// Role Management Edge Function
// Handles role and permission management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'role-management');
    const roleId = parts[0];
    const subResource = parts[1];

    // GET /role-management - List roles
    if (req.method === 'GET' && !roleId) {
      const { data: roles, error } = await admin
        .from('roles')
        .select('*')
        .or(`tenant_id.eq.${tenantId},is_system.eq.true`)
        .order('hierarchy_level', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return createCorsResponse({ error: 'Failed to fetch roles' }, 500, req);
      }

      // Get user counts per role
      const rolesWithCounts = await Promise.all(
        (roles || []).map(async (role: any) => {
          const { count } = await admin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('role_id', role.id);
          return { ...role, userCount: count || 0 };
        }),
      );

      return createCorsResponse(rolesWithCounts, 200, req);
    }

    // GET /role-management/permissions - Get all available permissions
    if (req.method === 'GET' && roleId === 'permissions') {
      const { data: permissions } = await admin
        .from('permissions')
        .select('*')
        .order('module', { ascending: true });

      // Group by module
      const grouped: Record<string, any[]> = {};
      (permissions || []).forEach((p: any) => {
        if (!grouped[p.module]) {
          grouped[p.module] = [];
        }
        grouped[p.module].push(p);
      });

      return createCorsResponse(
        {
          permissions: permissions || [],
          grouped,
        },
        200,
        req,
      );
    }

    // GET /role-management/:id - Get single role
    if (req.method === 'GET' && roleId && !subResource) {
      const { data: role, error } = await admin.from('roles').select('*').eq('id', roleId).single();

      if (error) {
        return createCorsResponse({ error: 'Role not found' }, 404, req);
      }

      // Get users with this role
      const { data: users } = await admin
        .from('users')
        .select('id, email, full_name')
        .eq('tenant_id', tenantId)
        .eq('role_id', roleId);

      return createCorsResponse(
        {
          ...role,
          users: users || [],
        },
        200,
        req,
      );
    }

    // POST /role-management - Create role
    if (req.method === 'POST' && !roleId) {
      const body = await req.json();

      const roleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        permissions: body.permissions || [],
        hierarchy_level: body.hierarchyLevel || body.hierarchy_level || 1,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: role, error } = await admin.from('roles').insert(roleData).select().single();

      if (error) {
        console.error('Error creating role:', error);
        return createCorsResponse({ error: 'Failed to create role' }, 500, req);
      }

      return createCorsResponse(role, 201, req);
    }

    // PUT /role-management/:id - Update role
    if (req.method === 'PUT' && roleId && !subResource) {
      // Check if system role
      const { data: existing } = await admin
        .from('roles')
        .select('is_system')
        .eq('id', roleId)
        .single();

      if (existing?.is_system) {
        return createCorsResponse({ error: 'Cannot modify system role' }, 400, req);
      }

      const body = await req.json();

      const { data: role, error } = await admin
        .from('roles')
        .update({
          name: body.name,
          description: body.description,
          permissions: body.permissions,
          hierarchy_level: body.hierarchyLevel || body.hierarchy_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update role' }, 500, req);
      }

      return createCorsResponse(role, 200, req);
    }

    // PUT /role-management/:id/permissions - Update role permissions
    if (req.method === 'PUT' && roleId && subResource === 'permissions') {
      const body = await req.json();

      // Check if system role
      const { data: existing } = await admin
        .from('roles')
        .select('is_system')
        .eq('id', roleId)
        .single();

      if (existing?.is_system) {
        return createCorsResponse({ error: 'Cannot modify system role permissions' }, 400, req);
      }

      const { data: role, error } = await admin
        .from('roles')
        .update({
          permissions: body.permissions || body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update permissions' }, 500, req);
      }

      return createCorsResponse(role, 200, req);
    }

    // POST /role-management/:id/duplicate - Duplicate role
    if (req.method === 'POST' && roleId && subResource === 'duplicate') {
      const { data: original } = await admin.from('roles').select('*').eq('id', roleId).single();

      if (!original) {
        return createCorsResponse({ error: 'Role not found' }, 404, req);
      }

      const { data: duplicate, error } = await admin
        .from('roles')
        .insert({
          tenant_id: tenantId,
          name: `${original.name} (Copy)`,
          description: original.description,
          permissions: original.permissions,
          hierarchy_level: original.hierarchy_level,
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to duplicate role' }, 500, req);
      }

      return createCorsResponse(duplicate, 201, req);
    }

    // GET /role-management/:id/users - Get users with this role
    if (req.method === 'GET' && roleId && subResource === 'users') {
      const { data: users } = await admin
        .from('users')
        .select('id, email, full_name, status')
        .eq('tenant_id', tenantId)
        .eq('role_id', roleId);

      return createCorsResponse(users || [], 200, req);
    }

    // DELETE /role-management/:id - Delete role
    if (req.method === 'DELETE' && roleId) {
      // Check if system role
      const { data: existing } = await admin
        .from('roles')
        .select('is_system')
        .eq('id', roleId)
        .single();

      if (existing?.is_system) {
        return createCorsResponse({ error: 'Cannot delete system role' }, 400, req);
      }

      // Check if role has users
      const { count: userCount } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role_id', roleId);

      if (userCount && userCount > 0) {
        return createCorsResponse({ error: 'Cannot delete role with assigned users' }, 400, req);
      }

      const { error } = await admin
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete role' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Role deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in role-management function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
