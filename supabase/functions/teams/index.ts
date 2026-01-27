// Teams Edge Function
// Handles team management and member assignments
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const teamId = pathParts[1];
    const subResource = pathParts[2]; // 'members'

    // GET /teams - List teams
    if (req.method === 'GET' && !teamId) {
      const search = url.searchParams.get('search');

      let query = admin
        .from('teams')
        .select('*, member_count:users(count)')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data: teams, error } = await query;

      if (error) {
        console.error('Error fetching teams:', error);
        return createCorsResponse({ error: 'Failed to fetch teams' }, 500, req);
      }

      return createCorsResponse(teams || [], 200, req);
    }

    // GET /teams/:id/members - Get team members
    if (req.method === 'GET' && teamId && subResource === 'members') {
      const { data: members, error } = await admin
        .from('users')
        .select('id, first_name, last_name, email, phone, role_id')
        .eq('team_id', teamId)
        .eq('tenant_id', tenantId)
        .order('last_name', { ascending: true });

      if (error) {
        console.error('Error fetching team members:', error);
        return createCorsResponse({ error: 'Failed to fetch team members' }, 500, req);
      }

      return createCorsResponse(members || [], 200, req);
    }

    // GET /teams/:id - Get single team
    if (req.method === 'GET' && teamId) {
      const { data: team, error } = await admin
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching team:', error);
        return createCorsResponse({ error: 'Team not found' }, 404, req);
      }

      // Get members count
      const { data: members } = await admin
        .from('users')
        .select('id')
        .eq('team_id', teamId)
        .eq('tenant_id', tenantId);

      return createCorsResponse({ ...team, memberCount: members?.length || 0 }, 200, req);
    }

    // POST /teams - Create team
    if (req.method === 'POST' && !teamId) {
      const body = await req.json();

      const teamData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: team, error } = await admin.from('teams').insert(teamData).select().single();

      if (error) {
        console.error('Error creating team:', error);
        return createCorsResponse({ error: 'Failed to create team', details: error }, 500, req);
      }

      return createCorsResponse(team, 201, req);
    }

    // PATCH /teams/:id - Update team
    if ((req.method === 'PATCH' || req.method === 'PUT') && teamId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;

      const { data: team, error } = await admin
        .from('teams')
        .update(updateData)
        .eq('id', teamId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating team:', error);
        return createCorsResponse({ error: 'Failed to update team' }, 500, req);
      }

      return createCorsResponse(team, 200, req);
    }

    // DELETE /teams/:id - Delete team
    if (req.method === 'DELETE' && teamId) {
      // Check if team has members
      const { data: members } = await admin
        .from('users')
        .select('id')
        .eq('team_id', teamId)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (members && members.length > 0) {
        return createCorsResponse(
          { error: 'Cannot delete team with members. Please reassign members first.' },
          400,
          req,
        );
      }

      const { error } = await admin
        .from('teams')
        .delete()
        .eq('id', teamId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting team:', error);
        return createCorsResponse({ error: 'Failed to delete team' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Team deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in teams function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
