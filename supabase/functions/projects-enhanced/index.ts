// Projects Enhanced Edge Function
// Handles enhanced project management
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

    // GET /projects/enhanced - List enhanced projects
    if (req.method === 'GET') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('projects')
        .select(
          `
          *,
          customer:customer_id (id, company_name),
          manager:project_manager_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: projects, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch projects' }, 500, req);
      }

      // Get task counts for each project
      const projectsWithStats = await Promise.all(
        (projects || []).map(async (project: any) => {
          const { count: totalTasks } = await admin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);

          const { count: completedTasks } = await admin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('status', 'completed');

          return {
            ...project,
            totalTasks: totalTasks || 0,
            completedTasks: completedTasks || 0,
            progress: totalTasks ? Math.round(((completedTasks || 0) / totalTasks) * 100) : 0,
          };
        }),
      );

      return createCorsResponse(projectsWithStats, 200, req);
    }

    // POST /projects/enhanced - Create enhanced project
    if (req.method === 'POST') {
      const body = await req.json();

      const { data: project, error } = await admin
        .from('projects')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          customer_id: body.customerId || body.customer_id,
          project_manager_id: body.projectManagerId || body.project_manager_id,
          start_date: body.startDate || body.start_date,
          end_date: body.endDate || body.end_date,
          status: body.status || 'active',
          budget: body.budget,
          tags: body.tags || [],
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create project' }, 500, req);
      }

      return createCorsResponse(project, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in projects-enhanced function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
