// Professional Services Edge Function
// Handles professional services project management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // Server strips function name, so /professional-services/:id becomes /:id
    const projectId = pathParts[0];
    const subResource = pathParts[1];

    // GET /professional-services - List projects
    if (req.method === 'GET' && !projectId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      // QUOTE-011: opt-in pagination. professional_services_projects is an ad-hoc
      // table with no fixed schema, so search + pagination are applied in-memory
      // (volume is low) rather than via a risky PostgREST .or() on unknown columns.
      const pageParam = url.searchParams.get('page');
      const paginate = pageParam !== null;

      // Check if table exists by attempting query
      const { data: projects, error } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table may not exist yet - return empty array gracefully
        console.error('Error fetching professional services:', error);
        return paginate
          ? createCorsResponse({ data: [], pagination: { page: 1, limit: 50, total: 0 } }, 200, req)
          : createCorsResponse([], 200, req);
      }

      let result = projects || [];
      if (status) result = result.filter((p: any) => p.status === status);
      if (customerId) result = result.filter((p: any) => p.customer_id === customerId);
      if (search) {
        result = result.filter((p: any) =>
          Object.values(p).some((v) => typeof v === 'string' && v.toLowerCase().includes(search)),
        );
      }

      if (paginate) {
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.min(
          Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50),
          200,
        );
        const total = result.length;
        const from = (page - 1) * limit;
        return createCorsResponse(
          { data: result.slice(from, from + limit), pagination: { page, limit, total } },
          200,
          req,
        );
      }

      return createCorsResponse(result, 200, req);
    }

    // GET /professional-services/active - Get active projects
    if (req.method === 'GET' && projectId === 'active') {
      const { data: projects } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['planning', 'in_progress', 'on_hold'])
        .order('start_date', { ascending: true });

      return createCorsResponse(projects || [], 200, req);
    }

    // GET /professional-services/:id - Get single project
    if (req.method === 'GET' && projectId && !subResource) {
      const { data: project, error } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Project not found' }, 404, req);
      }

      // Get project tasks
      const { data: tasks } = await admin
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

      // Get time entries
      const { data: timeEntries } = await admin
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('entry_date', { ascending: false });

      return createCorsResponse(
        { ...project, tasks: tasks || [], timeEntries: timeEntries || [] },
        200,
        req,
      );
    }

    // POST /professional-services - Create project
    if (req.method === 'POST' && !projectId) {
      const body = await req.json();

      const projectData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        project_name: body.projectName || body.project_name,
        project_type: body.projectType || body.project_type || 'implementation',
        description: body.description,
        status: body.status || 'planning',
        start_date: body.startDate || body.start_date,
        target_end_date: body.targetEndDate || body.target_end_date,
        budget_hours: body.budgetHours || body.budget_hours,
        budget_amount: body.budgetAmount || body.budget_amount,
        hourly_rate: body.hourlyRate || body.hourly_rate,
        project_manager_id: body.projectManagerId || body.project_manager_id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: project, error } = await admin
        .from('professional_services_projects')
        .insert(projectData)
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        return createCorsResponse({ error: 'Failed to create project' }, 500, req);
      }

      return createCorsResponse(project, 201, req);
    }

    // PUT /professional-services/:id - Update project
    if (req.method === 'PUT' && projectId && !subResource) {
      const body = await req.json();

      const { data: project, error } = await admin
        .from('professional_services_projects')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update project' }, 500, req);
      }

      return createCorsResponse(project, 200, req);
    }

    // POST /professional-services/:id/tasks - Add task
    if (req.method === 'POST' && projectId && subResource === 'tasks') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('project_tasks')
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          task_name: body.taskName || body.task_name,
          description: body.description,
          assigned_to: body.assignedTo || body.assigned_to,
          status: body.status || 'pending',
          estimated_hours: body.estimatedHours || body.estimated_hours,
          due_date: body.dueDate || body.due_date,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    // POST /professional-services/:id/time - Log time
    if (req.method === 'POST' && projectId && subResource === 'time') {
      const body = await req.json();

      const { data: timeEntry, error } = await admin
        .from('time_entries')
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          task_id: body.taskId || body.task_id,
          user_id: user.id,
          hours: body.hours,
          description: body.description,
          entry_date: body.entryDate || body.entry_date || new Date().toISOString(),
          billable: body.billable !== false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to log time' }, 500, req);
      }

      return createCorsResponse(timeEntry, 201, req);
    }

    // DELETE /professional-services/:id - Delete project
    if (req.method === 'DELETE' && projectId) {
      const { error } = await admin
        .from('professional_services_projects')
        .delete()
        .eq('id', projectId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete project' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Project deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in professional-services function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
