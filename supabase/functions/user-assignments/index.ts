// User Assignments Edge Function
// Handles user lead/deal assignments
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

    // GET /user-assignments/:userId - Get assignments for user
    if (req.method === 'GET' && userId) {
      // Get assigned leads
      const { data: leads } = await admin
        .from('leads')
        .select('id, company_name, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('assigned_to_id', userId)
        .order('created_at', { ascending: false });

      // Get assigned deals
      const { data: deals } = await admin
        .from('deals')
        .select('id, name, value, stage, created_at')
        .eq('tenant_id', tenantId)
        .eq('assigned_to_id', userId)
        .order('created_at', { ascending: false });

      // Get assigned tasks
      const { data: tasks } = await admin
        .from('tasks')
        .select('id, title, status, due_date, priority')
        .eq('tenant_id', tenantId)
        .eq('assignee_id', userId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      // Get assignment history
      const { data: history } = await admin
        .from('lead_assignment_history')
        .select(
          `
          *,
          lead:lead_id (id, company_name)
        `,
        )
        .eq('assigned_to_id', userId)
        .eq('tenant_id', tenantId)
        .order('assigned_at', { ascending: false })
        .limit(50);

      return createCorsResponse(
        {
          userId,
          leads: leads || [],
          leadCount: leads?.length || 0,
          deals: deals || [],
          dealCount: deals?.length || 0,
          tasks: tasks || [],
          taskCount: tasks?.length || 0,
          recentHistory: history || [],
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in user-assignments function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
