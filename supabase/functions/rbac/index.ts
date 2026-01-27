// RBAC Edge Function
// Handles role-based access control operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

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

    // GET /rbac/roles/:id - Get single role
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
