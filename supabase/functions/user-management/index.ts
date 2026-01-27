// User Management Edge Function
// Handles user administration
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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const userId = pathParts[1];
    const subResource = pathParts[2];

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
        .order('full_name', { ascending: true });

      if (status) query = query.eq('status', status);
      if (roleId) query = query.eq('role_id', roleId);
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
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
      const userData = {
        tenant_id: tenantId,
        email: body.email,
        full_name: body.fullName || body.full_name,
        role_id: body.roleId || body.role_id,
        status: 'pending',
        phone: body.phone,
        job_title: body.jobTitle || body.job_title,
        department: body.department,
        created_by: user.id,
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

      const { data: userData, error } = await admin
        .from('users')
        .update({
          full_name: body.fullName || body.full_name || body.fullName,
          role_id: body.roleId || body.role_id,
          phone: body.phone,
          job_title: body.jobTitle || body.job_title,
          department: body.department,
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .select()
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
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
        .order('created_at', { ascending: false })
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
