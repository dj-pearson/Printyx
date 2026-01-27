// Tasks Enhanced Edge Function
// Handles enhanced task management
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

    // GET /tasks/enhanced - List enhanced tasks
    if (req.method === 'GET') {
      const status = url.searchParams.get('status');
      const assigneeId = url.searchParams.get('assigneeId');
      const projectId = url.searchParams.get('projectId');
      const priority = url.searchParams.get('priority');

      let query = admin
        .from('tasks')
        .select(
          `
          *,
          assignee:assignee_id (id, full_name, email),
          project:project_id (id, name),
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (assigneeId) query = query.eq('assignee_id', assigneeId);
      if (projectId) query = query.eq('project_id', projectId);
      if (priority) query = query.eq('priority', priority);

      const { data: tasks, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch tasks' }, 500, req);
      }

      // Group by status for board view
      const byStatus: Record<string, any[]> = {
        pending: [],
        in_progress: [],
        completed: [],
      };

      (tasks || []).forEach((task: any) => {
        const s = task.status || 'pending';
        if (!byStatus[s]) byStatus[s] = [];
        byStatus[s].push(task);
      });

      return createCorsResponse(
        {
          tasks: tasks || [],
          byStatus,
          total: tasks?.length || 0,
        },
        200,
        req,
      );
    }

    // POST /tasks/enhanced - Create enhanced task
    if (req.method === 'POST') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('tasks')
        .insert({
          tenant_id: tenantId,
          title: body.title,
          description: body.description,
          assignee_id: body.assigneeId || body.assignee_id,
          project_id: body.projectId || body.project_id,
          customer_id: body.customerId || body.customer_id,
          due_date: body.dueDate || body.due_date,
          priority: body.priority || 'medium',
          status: body.status || 'pending',
          tags: body.tags || [],
          estimated_hours: body.estimatedHours || body.estimated_hours,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in tasks-enhanced function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
