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
    // Verify JWT and get current auth user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Get tenant ID from user metadata
    const tenantId = (user.app_metadata as any)?.tenantId;
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
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
        avatar_url
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
      avatar: u.avatar_url,
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
