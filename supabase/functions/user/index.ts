// User Edge Function
// Handles current user profile and preferences
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

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1]; // /user/profile, /user/preferences, etc.

    // GET /user or /user/profile - Get current user profile
    if (req.method === 'GET' && (!endpoint || endpoint === 'profile')) {
      const { data: profile, error } = await admin
        .from('users')
        .select(
          `
          id,
          email,
          name,
          avatar_url,
          phone,
          tenant_id,
          role_id,
          department,
          job_title,
          timezone,
          locale,
          last_login_at,
          created_at,
          updated_at,
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

      if (error) {
        console.error('Error fetching user profile:', error);
        // Return basic info from JWT if DB fetch fails
        return createCorsResponse(
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0],
            tenantId: user.app_metadata?.tenantId || user.app_metadata?.tenant_id,
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          ...profile,
          tenantId: profile?.tenant_id,
          roleId: profile?.role_id,
          avatarUrl: profile?.avatar_url,
          jobTitle: profile?.job_title,
          lastLoginAt: profile?.last_login_at,
          createdAt: profile?.created_at,
          updatedAt: profile?.updated_at,
        },
        200,
        req,
      );
    }

    // GET /user/preferences - Get user preferences
    if (req.method === 'GET' && endpoint === 'preferences') {
      const { data: prefs } = await admin
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return createCorsResponse(
        prefs || {
          userId: user.id,
          theme: 'system',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
          dashboardLayout: 'default',
        },
        200,
        req,
      );
    }

    // GET /user/permissions - Get user permissions
    if (req.method === 'GET' && endpoint === 'permissions') {
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

    // GET /user/activity - Get recent user activity
    if (req.method === 'GET' && endpoint === 'activity') {
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const { data: activities } = await admin
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      return createCorsResponse(activities || [], 200, req);
    }

    // PUT /user/profile - Update user profile
    if (req.method === 'PUT' && endpoint === 'profile') {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Only allow certain fields to be updated
      if (body.name !== undefined) updateData.name = body.name;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;
      if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.jobTitle !== undefined) updateData.job_title = body.jobTitle;
      if (body.job_title !== undefined) updateData.job_title = body.job_title;
      if (body.timezone !== undefined) updateData.timezone = body.timezone;
      if (body.locale !== undefined) updateData.locale = body.locale;

      const { data: profile, error } = await admin
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return createCorsResponse({ error: 'Failed to update profile' }, 500, req);
      }

      return createCorsResponse(profile, 200, req);
    }

    // PUT /user/preferences - Update user preferences
    if (req.method === 'PUT' && endpoint === 'preferences') {
      const body = await req.json();

      const { data: existingPrefs } = await admin
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingPrefs) {
        const { data: prefs, error } = await admin
          .from('user_preferences')
          .update({
            ...body,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating preferences:', error);
          return createCorsResponse({ error: 'Failed to update preferences' }, 500, req);
        }

        return createCorsResponse(prefs, 200, req);
      } else {
        const { data: prefs, error } = await admin
          .from('user_preferences')
          .insert({
            user_id: user.id,
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating preferences:', error);
          return createCorsResponse({ error: 'Failed to create preferences' }, 500, req);
        }

        return createCorsResponse(prefs, 201, req);
      }
    }

    // POST /user/update-last-login - Update last login timestamp
    if (req.method === 'POST' && endpoint === 'update-last-login') {
      const { error } = await admin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating last login:', error);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in user function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
