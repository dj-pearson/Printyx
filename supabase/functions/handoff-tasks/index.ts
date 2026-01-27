// Handoff Tasks Edge Function
// Handles tasks associated with sales handoffs
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
    const taskId = pathParts[1];
    const action = pathParts[2];

    // GET /handoff-tasks - List handoff tasks
    if (req.method === 'GET' && !taskId) {
      const handoffId = url.searchParams.get('handoffId');
      const status = url.searchParams.get('status');
      const assigneeId = url.searchParams.get('assigneeId');

      let query = admin
        .from('handoff_tasks')
        .select(
          `
          *,
          handoff:handoff_id (id, status),
          assignee:assignee_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (handoffId) query = query.eq('handoff_id', handoffId);
      if (status) query = query.eq('status', status);
      if (assigneeId) query = query.eq('assignee_id', assigneeId);

      const { data: tasks, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch handoff tasks' }, 500, req);
      }

      return createCorsResponse(tasks || [], 200, req);
    }

    // GET /handoff-tasks/:id - Get single task
    if (req.method === 'GET' && taskId && !action) {
      const { data: task, error } = await admin
        .from('handoff_tasks')
        .select(
          `
          *,
          handoff:handoff_id (*),
          assignee:assignee_id (id, full_name, email)
        `,
        )
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Handoff task not found' }, 404, req);
      }

      return createCorsResponse(task, 200, req);
    }

    // POST /handoff-tasks - Create task
    if (req.method === 'POST' && !taskId) {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .insert({
          tenant_id: tenantId,
          handoff_id: body.handoffId || body.handoff_id,
          title: body.title,
          description: body.description,
          assignee_id: body.assigneeId || body.assignee_id,
          due_date: body.dueDate || body.due_date,
          priority: body.priority || 'medium',
          status: 'pending',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create handoff task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    // PUT /handoff-tasks/:id - Update task
    if (req.method === 'PUT' && taskId && !action) {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .update({
          title: body.title,
          description: body.description,
          assignee_id: body.assigneeId || body.assignee_id,
          due_date: body.dueDate || body.due_date,
          priority: body.priority,
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update handoff task' }, 500, req);
      }

      return createCorsResponse(task, 200, req);
    }

    // POST /handoff-tasks/:id/complete - Complete task
    if (req.method === 'POST' && taskId && action === 'complete') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          completion_notes: body.notes || body.completion_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to complete handoff task' }, 500, req);
      }

      return createCorsResponse(task, 200, req);
    }

    // DELETE /handoff-tasks/:id - Delete task
    if (req.method === 'DELETE' && taskId) {
      const { error } = await admin
        .from('handoff_tasks')
        .delete()
        .eq('id', taskId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete handoff task' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Handoff task deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in handoff-tasks function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
