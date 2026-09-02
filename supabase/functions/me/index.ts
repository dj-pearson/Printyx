// Me Edge Function
// Returns current user profile + role/team from DB using service role (bypasses RLS).
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { resolveTenantId } from '../_shared/tenant.ts';

type PermissionsObject = Record<string, boolean>;

const MODULES = [
  'sales',
  'service',
  'products',
  'inventory',
  'purchasing',
  'billing',
  'finance',
  'reports',
  'system',
] as const;

function allModulePermissions(): PermissionsObject {
  return Object.fromEntries(MODULES.map((m) => [m, true]));
}

/**
 * What a user with NO resolvable role gets (WF-R-09).
 *
 * This used to be allModulePermissions(), so an account whose role_id was unset -
 * or whose roles row had been deleted - received every module at level 1, which is
 * the L1 tier of sales, service, finance and reports. A missing role was the most
 * permissive state the system had. It now matches defaultRolePermissions() in
 * client/src/hooks/useSupabaseAuth.ts, which has always been all-false: the two
 * disagreed, and the server was the one failing open.
 *
 * Every module false expands to an empty permission set in
 * navigation-permissions.ts, so the sidebar shows only its alwaysVisible sections
 * - dashboard, tasks, knowledge base, settings - which is the right amount of
 * product for somebody an administrator has not placed yet.
 */
function defaultRolePermissions(): PermissionsObject {
  return Object.fromEntries(MODULES.map((m) => [m, false]));
}

function normalizePermissions(input: unknown): PermissionsObject {
  if (!input) return {};

  if (Array.isArray(input)) {
    if (input.includes('*')) return allModulePermissions();
    const obj: PermissionsObject = {};
    for (const item of input) {
      if (typeof item === 'string') obj[item] = true;
    }
    return obj;
  }

  if (typeof input === 'object') {
    // Best-effort: if it's already a JSON permissions object, coerce booleans.
    const out: PermissionsObject = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = Boolean(v);
    }
    return out;
  }

  return {};
}

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Verify JWT and get current auth user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

    // Fetch user profile from public.users
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // If the app DB user profile doesn't exist yet, return auth metadata only
      return createCorsResponse(
        {
          id: user.id,
          email: user.email,
          firstName:
            (user.user_metadata as any)?.firstName || (user.user_metadata as any)?.first_name,
          lastName: (user.user_metadata as any)?.lastName || (user.user_metadata as any)?.last_name,
          tenantId: resolveTenantId(user),
          roleId: (user.app_metadata as any)?.roleId,
          teamId: (user.app_metadata as any)?.teamId,
          accessScope: (user.app_metadata as any)?.accessScope || 'own',
          isPlatformUser: Boolean((user.app_metadata as any)?.isPlatformUser),
          role: {
            id: (user.app_metadata as any)?.roleId || 'default',
            code: null,
            name: 'User',
            level: 1,
            permissions: defaultRolePermissions(),
            canAccessAllTenants: Boolean((user.app_metadata as any)?.isPlatformUser),
          },
        },
        200,
        req,
      );
    }

    // Fetch role + team (best-effort)
    const roleId = profile.role_id ?? profile.roleId ?? (user.app_metadata as any)?.roleId;
    const teamId = profile.team_id ?? profile.teamId ?? (user.app_metadata as any)?.teamId;

    let role: any = null;
    if (roleId) {
      const { data: roleData } = await admin.from('roles').select('*').eq('id', roleId).single();
      if (roleData) {
        role = {
          id: roleData.id,
          // WF-R-09: the CODE, which nothing here returned. It is what
          // dashboard-widget-registry.ts keys a layout on and what the sidebar
          // reads, so both were falling back to their DEFAULT layout for every
          // user regardless of role.
          code: roleData.code ?? null,
          name: roleData.name,
          level: roleData.level ?? 1,
          permissions: normalizePermissions(roleData.permissions),
          canAccessAllTenants: Boolean(
            roleData.can_access_all_tenants ?? roleData.canAccessAllTenants,
          ),
        };
      }
    }

    if (!role) {
      role = {
        id: roleId || 'default',
        code: null,
        name: 'User',
        level: 1,
        permissions: defaultRolePermissions(),
        canAccessAllTenants: Boolean(profile.is_platform_user ?? profile.isPlatformUser),
      };
    }

    let team: any = null;
    if (teamId) {
      const { data: teamData } = await admin
        .from('teams')
        .select('id, name')
        .eq('id', teamId)
        .single();
      if (teamData) {
        team = { id: teamData.id, name: teamData.name };
      }
    }

    return createCorsResponse(
      {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name ?? profile.firstName,
        lastName: profile.last_name ?? profile.lastName,
        tenantId: profile.tenant_id ?? profile.tenantId ?? resolveTenantId(user),
        roleId: profile.role_id ?? profile.roleId ?? (user.app_metadata as any)?.roleId,
        teamId: profile.team_id ?? profile.teamId ?? (user.app_metadata as any)?.teamId,
        accessScope:
          profile.access_scope ??
          profile.accessScope ??
          (user.app_metadata as any)?.accessScope ??
          'own',
        isPlatformUser: Boolean(
          profile.is_platform_user ??
            profile.isPlatformUser ??
            (user.app_metadata as any)?.isPlatformUser,
        ),
        role,
        team,
      },
      200,
      req,
    );
  } catch (error) {
    console.error('me function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
