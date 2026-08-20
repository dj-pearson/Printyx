// Users Team Edge Function
// Handles team member listing
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toUserProfile, USER_PROFILE_COLUMNS, type UserRow } from '../_shared/user-profile.ts';

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

    // GET /users/team - Get team members
    if (req.method === 'GET') {
      // COP-M01: full_name, job_title, department and status are not columns on
      // `users`. The real shape is first_name/last_name, is_active, and a
      // metadata jsonb for the rest — so this select 42703'd and the endpoint
      // answered 500 for every tenant.
      const { data: users, error } = await admin
        .from('users')
        .select(
          `
          ${USER_PROFILE_COLUMNS},
          role:role_id (id, name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching team members:', error);
        return createCorsResponse(
          { error: 'Failed to fetch team members', details: error.message },
          500,
          req,
        );
      }

      // Keep the row as-is and add the composed fields, so a caller reading
      // first_name still works and one reading fullName now gets a value.
      return createCorsResponse(
        (users ?? []).map((u: any) => ({ ...u, ...toUserProfile(u as UserRow) })),
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in users-team function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
