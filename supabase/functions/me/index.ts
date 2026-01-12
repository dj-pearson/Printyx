// Me Edge Function
// Returns current user profile + role/team from DB using service role (bypasses RLS).
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

type PermissionsObject = Record<string, boolean>;

function allModulePermissions(): PermissionsObject {
  return {
    sales: true,
    service: true,
    products: true,
    inventory: true,
    purchasing: true,
    billing: true,
    finance: true,
    reports: true,
    system: true,
  };
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
          tenantId: (user.app_metadata as any)?.tenantId,
          roleId: (user.app_metadata as any)?.roleId,
          teamId: (user.app_metadata as any)?.teamId,
          accessScope: (user.app_metadata as any)?.accessScope || 'own',
          isPlatformUser: Boolean((user.app_metadata as any)?.isPlatformUser),
          role: {
            id: (user.app_metadata as any)?.roleId || 'default',
            name: 'User',
            level: 1,
            permissions: allModulePermissions(),
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
        name: 'User',
        level: 1,
        permissions: allModulePermissions(),
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
        tenantId: profile.tenant_id ?? profile.tenantId ?? (user.app_metadata as any)?.tenantId,
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
