// Tasks Bulk Edge Function
// Handles bulk task operations
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

    // PATCH /tasks/bulk - Bulk update tasks
    if (req.method === 'PATCH') {
      const body = await req.json();
      const taskIds = body.taskIds || body.task_ids || [];
      const updates = body.updates || {};

      if (!taskIds.length) {
        return createCorsResponse({ error: 'No task IDs provided' }, 400, req);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status) updateData.status = updates.status;
      if (updates.priority) updateData.priority = updates.priority;
      if (updates.assigneeId || updates.assignee_id) {
        updateData.assignee_id = updates.assigneeId || updates.assignee_id;
      }
      if (updates.dueDate || updates.due_date) {
        updateData.due_date = updates.dueDate || updates.due_date;
      }

      const { data: tasks, error } = await admin
        .from('tasks')
        .update(updateData)
        .in('id', taskIds)
        .eq('tenant_id', tenantId)
        .select();

      if (error) {
        return createCorsResponse({ error: 'Failed to update tasks' }, 500, req);
      }

      return createCorsResponse(
        {
          updated: tasks?.length || 0,
          tasks: tasks || [],
        },
        200,
        req,
      );
    }

    // DELETE /tasks/bulk - Bulk delete tasks
    if (req.method === 'DELETE') {
      const body = await req.json();
      const taskIds = body.taskIds || body.task_ids || [];

      if (!taskIds.length) {
        return createCorsResponse({ error: 'No task IDs provided' }, 400, req);
      }

      const { error } = await admin
        .from('tasks')
        .delete()
        .in('id', taskIds)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete tasks' }, 500, req);
      }

      return createCorsResponse(
        {
          deleted: taskIds.length,
          message: 'Tasks deleted successfully',
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in tasks-bulk function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
