// User Management Edge Function
// Handles user administration
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { sanitizeSearchTerm } from '../_shared/crm-list-query.ts';
import { buildUserProfileUpdate, USER_PROFILE_COLUMNS } from '../_shared/user-profile.ts';
import { normalizePath } from '../_shared/path.ts';

/**
 * is_active plus a lifecycle timestamp.
 *
 * COP-M01: the handler wrote status / activated_at / deactivated_at. `users` has
 * none of the three — the flag is is_active, and there is no column for either
 * stamp. They go in the metadata jsonb, which is where /user/profile already
 * keeps the fields with no column. metadata is a single column, so it is read
 * first: writing a bare object would delete the user's phone and job title.
 */
async function withLifecycleStamp(
  admin: any,
  tenantId: string,
  userId: string,
  stamp: 'activatedAt' | 'deactivatedAt',
  isActive: boolean,
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return {
    is_active: isActive,
    metadata: {
      ...((existing?.metadata ?? {}) as Record<string, unknown>),
      [stamp]: now,
      status: isActive ? 'active' : 'inactive',
    },
    updated_at: now,
  };
}

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
    const { parts } = normalizePath(url.pathname, 'user-management');
    const userId = parts[0];
    const subResource = parts[1];

    // GET /user-management - List users
    if (req.method === 'GET' && !userId) {
      const status = url.searchParams.get('status');
      const roleId = url.searchParams.get('roleId');
      const search = url.searchParams.get('search');

      let query = admin
        .from('users')
        .select(
          `
          *,
          role:role_id (
            id,
            name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        // COP-M01: `users` has no full_name and no status. The name is
        // first_name/last_name and the flag is is_active, so ordering, filtering
        // and searching all 42703'd here — this list returned an error for every
        // tenant.
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (status) query = query.eq('is_active', status === 'active');
      if (roleId) query = query.eq('role_id', roleId);
      if (search) {
        const term = sanitizeSearchTerm(search);
        if (term) {
          query = query.or(
            `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
          );
        }
      }

      const { data: users, error } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        return createCorsResponse({ error: 'Failed to fetch users' }, 500, req);
      }

      return createCorsResponse(users || [], 200, req);
    }

    // GET /user-management/:id - Get single user
    if (req.method === 'GET' && userId && !subResource) {
      const { data: userData, error } = await admin
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'User not found' }, 404, req);
      }

      return createCorsResponse(userData, 200, req);
    }

    // POST /user-management - Create user (invite)
    if (req.method === 'POST' && !userId) {
      const body = await req.json();

      // Create user in database
      // COP-M01: full_name, status, phone, job_title, department and created_by
      // are none of them columns. The invite lands as an inactive user with the
      // profile extras in metadata, which is where /user/profile already keeps
      // them.
      const profile = buildUserProfileUpdate(body, null);
      const userData = {
        tenant_id: tenantId,
        email: body.email,
        role_id: body.roleId || body.role_id,
        is_active: false,
        ...profile,
        metadata: {
          ...((profile.metadata as Record<string, unknown>) ?? {}),
          status: 'pending',
          invitedBy: user.id,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newUser, error } = await admin.from('users').insert(userData).select().single();

      if (error) {
        console.error('Error creating user:', error);
        return createCorsResponse({ error: 'Failed to create user' }, 500, req);
      }

      // In production, send invitation email
      return createCorsResponse(
        {
          user: newUser,
          message: 'User invitation created',
        },
        201,
        req,
      );
    }

    // PUT /user-management/:id - Update user
    if (req.method === 'PUT' && userId && !subResource) {
      const body = await req.json();

      // metadata is a single jsonb column, so read it before a partial update or
      // the fields this call does not mention are deleted.
      const { data: existing } = await admin
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const update: Record<string, unknown> = {
        ...buildUserProfileUpdate(body, (existing?.metadata ?? null) as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      };
      if (body.roleId || body.role_id) update.role_id = body.roleId || body.role_id;
      if (body.status !== undefined) update.is_active = body.status === 'active';

      const { data: userData, error } = await admin
        .from('users')
        .update(update)
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .select(USER_PROFILE_COLUMNS)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update user' }, 500, req);
      }

      return createCorsResponse(userData, 200, req);
    }

    // POST /user-management/:id/activate - Activate user
    if (req.method === 'POST' && userId && subResource === 'activate') {
      const { data: userData, error } = await admin
        .from('users')
        .update(await withLifecycleStamp(admin, tenantId, userId, 'activatedAt', true))
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to activate user' }, 500, req);
      }

      return createCorsResponse(userData, 200, req);
    }

    // POST /user-management/:id/deactivate - Deactivate user
    if (req.method === 'POST' && userId && subResource === 'deactivate') {
      const { data: userData, error } = await admin
        .from('users')
        .update(await withLifecycleStamp(admin, tenantId, userId, 'deactivatedAt', false))
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to deactivate user' }, 500, req);
      }

      return createCorsResponse(userData, 200, req);
    }

    // POST /user-management/:id/reset-password - Trigger password reset
    if (req.method === 'POST' && userId && subResource === 'reset-password') {
      // In production, this would trigger a password reset email
      return createCorsResponse(
        {
          success: true,
          message: 'Password reset email sent',
        },
        200,
        req,
      );
    }

    // POST /user-management/:id/resend-invite - Resend invitation
    if (req.method === 'POST' && userId && subResource === 'resend-invite') {
      // In production, this would resend the invitation email
      return createCorsResponse(
        {
          success: true,
          message: 'Invitation resent',
        },
        200,
        req,
      );
    }

    // GET /user-management/:id/permissions - Get user permissions
    if (req.method === 'GET' && userId && subResource === 'permissions') {
      const { data: userData } = await admin
        .from('users')
        .select(
          `
          role_id,
          role:role_id (
            permissions
          )
        `,
        )
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        {
          permissions: userData?.role?.permissions || [],
        },
        200,
        req,
      );
    }

    // GET /user-management/:id/activity - Get user activity
    if (req.method === 'GET' && userId && subResource === 'activity') {
      const { data: activities } = await admin
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        // audit_logs records `timestamp`, not created_at.
        .order('timestamp', { ascending: false })
        .limit(50);

      return createCorsResponse(activities || [], 200, req);
    }

    // DELETE /user-management/:id - Delete user
    if (req.method === 'DELETE' && userId) {
      const { error } = await admin
        .from('users')
        .delete()
        .eq('id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete user' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'User deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in user-management function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
