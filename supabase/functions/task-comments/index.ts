// Task Comments Edge Function
// Handles task comments and time tracking
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
    const taskId = pathParts[1]; // tasks/:id/comments or tasks/:id/time
    const resource = pathParts[2]; // comments or time

    // POST /tasks/:id/comments - Add comment to task
    if (req.method === 'POST' && taskId && resource === 'comments') {
      const body = await req.json();

      const { data: comment, error } = await admin
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: body.content,
          created_at: new Date().toISOString(),
        })
        .select(
          `
          *,
          user:user_id (id, full_name)
        `,
        )
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add comment' }, 500, req);
      }

      return createCorsResponse(comment, 201, req);
    }

    // GET /tasks/:id/comments - Get task comments
    if (req.method === 'GET' && taskId && resource === 'comments') {
      const { data: comments, error } = await admin
        .from('task_comments')
        .select(
          `
          *,
          user:user_id (id, full_name)
        `,
        )
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch comments' }, 500, req);
      }

      return createCorsResponse(comments || [], 200, req);
    }

    // POST /tasks/:id/time - Log time on task
    if (req.method === 'POST' && taskId && resource === 'time') {
      const body = await req.json();

      const { data: timeEntry, error } = await admin
        .from('task_time_entries')
        .insert({
          task_id: taskId,
          user_id: user.id,
          hours: body.hours,
          description: body.description,
          date: body.date || new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to log time' }, 500, req);
      }

      // Update task total hours
      const { data: totalHours } = await admin
        .from('task_time_entries')
        .select('hours')
        .eq('task_id', taskId);

      const total = (totalHours || []).reduce((sum: number, t: any) => sum + (t.hours || 0), 0);

      await admin.from('tasks').update({ actual_hours: total }).eq('id', taskId);

      return createCorsResponse(timeEntry, 201, req);
    }

    // GET /tasks/:id/time - Get time entries for task
    if (req.method === 'GET' && taskId && resource === 'time') {
      const { data: entries, error } = await admin
        .from('task_time_entries')
        .select(
          `
          *,
          user:user_id (id, full_name)
        `,
        )
        .eq('task_id', taskId)
        .order('date', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch time entries' }, 500, req);
      }

      const totalHours = (entries || []).reduce((sum: number, e: any) => sum + (e.hours || 0), 0);

      return createCorsResponse(
        {
          entries: entries || [],
          totalHours,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in task-comments function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
