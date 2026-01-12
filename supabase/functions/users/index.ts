// Users Edge Function
// Lists users for task assignment and team management
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized', details: userError?.message }, 401, req);
    }

    // Get tenant ID from user metadata or query from database
    let tenantId = (user.app_metadata as any)?.tenantId;

    if (!tenantId) {
      // Fallback: query tenant_id from users table
      const admin = createSupabaseServiceClient();
      const { data: userData, error: userQueryError } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userQueryError || !userData?.tenant_id) {
        console.error('No tenant ID in app_metadata or database for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      tenantId = userData.tenant_id;
    }

    const admin = createSupabaseServiceClient();

    // Fetch users for this tenant
    const { data: users, error } = await admin
      .from('users')
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        role_id,
        team_id,
        is_active,
        profile_image_url
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching users:', error);
      return createCorsResponse({ error: 'Failed to fetch users' }, 500, req);
    }

    // Transform to match frontend expectations
    const transformedUsers = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      roleId: u.role_id,
      teamId: u.team_id,
      avatar: u.profile_image_url,
      isActive: u.is_active,
    }));

    return createCorsResponse(transformedUsers, 200, req);
  } catch (error) {
    console.error('Users function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
