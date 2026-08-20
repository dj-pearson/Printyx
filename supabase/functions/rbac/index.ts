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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /rbac, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'rbac');
    const endpoint = parts[0];
    const resourceId = parts[1];

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
    // ─── RBAC status and org units (EDGE-002h) ──────────────────────────────

    // GET /rbac/status
    //
    // RoleManagement.tsx gates the whole page on this: initialized false shows
    // a setup prompt, true shows the role manager.
    if (req.method === 'GET' && endpoint === 'status') {
      const { count: roleCount } = await admin
        .from('enhanced_roles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if ((roleCount ?? 0) === 0) {
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

      const { count: unitCount } = await admin
        .from('organizational_units')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          initialized: true,
          stats: {
            totalRoles: roleCount ?? 0,
            organizationalUnits: unitCount ?? 0,
          },
          recommendation: 'RBAC system is active and ready for management',
        },
        200,
        req,
      );
    }

    // GET /rbac/organizational-units
    //
    // Express returns { units, hierarchy, totalCount } but its hierarchy is
    // ALWAYS EMPTY: it builds the tree by filtering on node.parentUnitId, while
    // the raw `SELECT *` behind it returns snake_case, so parentUnitId is
    // undefined on every row and nothing ever matches a parent. The column is
    // parent_unit_id. Built here off the real key, so the tree is populated.
    if (req.method === 'GET' && endpoint === 'organizational-units') {
      const { data: units, error } = await admin
        .from('organizational_units')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        // lft is the nested-set left bound, so this is the tree's own order.
        .order('lft', { ascending: true });

      if (error) {
        console.error('Organizational units fetch error:', error);
        return createCorsResponse({ error: 'Internal server error' }, 500, req);
      }

      const rows = units ?? [];
      const buildTree = (parentId: string | null): any[] =>
        rows
          .filter((node: any) => (node.parent_unit_id ?? null) === parentId)
          .map((node: any) => ({ ...node, children: buildTree(node.id) }));

      return createCorsResponse(
        { units: rows, hierarchy: buildTree(null), totalCount: rows.length },
        200,
        req,
      );
    }

    // POST /rbac/seed - NOT PORTED YET.
    //
    // Express seeds an organizational unit plus a full role set that varies by
    // dealerType - roughly 160 lines of literal role definitions with hierarchy
    // levels and departments. It is mechanical to port but it decides what
    // permissions a tenant's roles carry, so a transcription slip would hand
    // someone the wrong access. It gets its own pass rather than a rushed one,
    // and it is a one-time initialisation that dev can still run through
    // Express in the meantime.
    if (req.method === 'POST' && endpoint === 'seed') {
      return createCorsResponse(
        {
          error: 'RBAC seeding is not available on the edge function yet',
          code: 'RBAC_SEED_NOT_PORTED',
          details:
            'server/routes-enhanced-rbac.ts POST /seed creates the default organizational unit ' +
            'and the per-dealerType role set. Porting it verbatim matters more than porting it ' +
            'quickly, because the seeded roles define tenant permissions.',
        },
        501,
        req,
      );
    }

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
