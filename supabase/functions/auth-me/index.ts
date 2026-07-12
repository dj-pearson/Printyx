// Auth Me Edge Function
// Returns current user information
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { resolveTenantId } from '../_shared/tenant.ts';

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

    // Canonical resolution (camel/snake, both metadata bags). The x-tenant-id
    // header fallback is user-supplied and tracked separately by CR-010.
    const tenantId = resolveTenantId(user) || req.headers.get('x-tenant-id');

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
        .eq('id', user.id)
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

      // Map to real `users` columns only. The table has no full_name / phone /
      // job_title / department / avatar_url columns — name maps to first/last,
      // avatar to profile_image_url, and the rest live in the `metadata` jsonb.
      // (Previously wrote phantom columns keyed on a non-existent auth_id — PA-004.)
      const { data: current } = await admin
        .from('users')
        .select('metadata')
        .eq('id', user.id)
        .single();

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      const fullName = body.fullName || body.full_name;
      if (typeof fullName === 'string' && fullName.trim()) {
        const [firstName, ...rest] = fullName.trim().split(/\s+/);
        updates.first_name = firstName;
        updates.last_name = rest.join(' ') || null;
      }
      if (body.firstName || body.first_name) updates.first_name = body.firstName || body.first_name;
      if (body.lastName || body.last_name) updates.last_name = body.lastName || body.last_name;

      const avatarUrl = body.avatarUrl || body.avatar_url;
      if (avatarUrl !== undefined) updates.profile_image_url = avatarUrl;

      const metadataPatch: Record<string, unknown> = {};
      if (body.phone !== undefined) metadataPatch.phone = body.phone;
      if (body.jobTitle !== undefined || body.job_title !== undefined)
        metadataPatch.jobTitle = body.jobTitle ?? body.job_title;
      if (body.department !== undefined) metadataPatch.department = body.department;
      if (Object.keys(metadataPatch).length > 0) {
        updates.metadata = { ...((current?.metadata as Record<string, unknown>) ?? {}), ...metadataPatch };
      }

      const { data: profile, error } = await admin
        .from('users')
        .update(updates)
        .eq('id', user.id)
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
