// Auth Me Edge Function
// Returns current user information
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

    const admin = createSupabaseServiceClient();

    // GET /auth/me - Get current user profile
    if (req.method === 'GET') {
      // Get user profile from users table
      const { data: profile } = await admin
        .from('users')
        .select(
          `
          *,
          role:role_id (
            id,
            name,
            permissions
          )
        `,
        )
        .eq('auth_id', user.id)
        .single();

      // Get tenant info if available
      let tenant = null;
      if (tenantId) {
        const { data: tenantData } = await admin
          .from('tenants')
          .select('id, name, slug, settings')
          .eq('id', tenantId)
          .single();
        tenant = tenantData;
      }

      return createCorsResponse(
        {
          id: user.id,
          email: user.email,
          profile: profile || {
            full_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url,
          },
          role: profile?.role || null,
          permissions: profile?.role?.permissions || [],
          tenantId,
          tenant,
          metadata: {
            app_metadata: user.app_metadata,
            user_metadata: user.user_metadata,
          },
        },
        200,
        req,
      );
    }

    // PUT /auth/me - Update current user profile
    if (req.method === 'PUT') {
      const body = await req.json();

      // Update user profile
      const { data: profile, error } = await admin
        .from('users')
        .update({
          full_name: body.fullName || body.full_name,
          phone: body.phone,
          job_title: body.jobTitle || body.job_title,
          department: body.department,
          avatar_url: body.avatarUrl || body.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update profile' }, 500, req);
      }

      return createCorsResponse(profile, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in auth-me function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
