// Tasks Stats Edge Function
// Handles task statistics
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

    // GET /tasks/stats - Get task statistics
    if (req.method === 'GET') {
      const { data: tasks } = await admin
        .from('tasks')
        .select('status, priority, due_date, assignee_id')
        .eq('tenant_id', tenantId);

      const total = tasks?.length || 0;
      const today = new Date().toISOString().split('T')[0];

      // By status
      const byStatus: Record<string, number> = {};
      (tasks || []).forEach((t: any) => {
        const status = t.status || 'pending';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      // By priority
      const byPriority: Record<string, number> = {};
      (tasks || []).forEach((t: any) => {
        const priority = t.priority || 'medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });

      // Overdue
      const overdue = (tasks || []).filter(
        (t: any) => t.due_date && t.due_date < today && t.status !== 'completed',
      ).length;

      // Due today
      const dueToday = (tasks || []).filter(
        (t: any) => t.due_date && t.due_date === today && t.status !== 'completed',
      ).length;

      // Unassigned
      const unassigned = (tasks || []).filter((t: any) => !t.assignee_id).length;

      return createCorsResponse(
        {
          total,
          byStatus,
          byPriority,
          overdue,
          dueToday,
          unassigned,
          completed: byStatus['completed'] || 0,
          pending: byStatus['pending'] || 0,
          inProgress: byStatus['in_progress'] || 0,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in tasks-stats function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
