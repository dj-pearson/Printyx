// Tasks Edge Function
// Handles CRUD operations for tasks
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const rawParts = url.pathname.split('/').filter(Boolean);
  // Normalize: strip function name from path if the relay preserved it
  const pathParts = rawParts[0] === 'tasks' ? rawParts.slice(1) : rawParts;
  const taskId = pathParts[0] || null;

  // Check for stats endpoint
  const isStatsRequest = taskId === 'stats' || url.pathname.includes('/stats');

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized', details: userError?.message }, 401, req);
    }

    // Resolve tenant ID: x-tenant-id header → app_metadata (camelCase + snake_case) → user_metadata → DB lookup
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata as any)?.tenantId ||
      (user.app_metadata as any)?.tenant_id ||
      (user.user_metadata as any)?.tenantId ||
      (user.user_metadata as any)?.tenant_id;

    if (!tenantId) {
      // Fallback: query tenant_id from users table (try by ID first, then by email)
      const adminLookup = createSupabaseServiceClient();
      const { data: userData } = await adminLookup
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();

      if (userData?.tenant_id) {
        tenantId = userData.tenant_id;
      } else if (user.email) {
        // IDs may differ between GoTrue and public.users — fall back to email lookup
        const { data: emailUser } = await adminLookup
          .from('users')
          .select('tenant_id')
          .ilike('email', user.email)
          .limit(1)
          .maybeSingle();
        tenantId = emailUser?.tenant_id;
      }

      if (!tenantId) {
        console.error('No tenant ID in app_metadata or database for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }
    }

    const admin = createSupabaseServiceClient();

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (isStatsRequest) {
          // Return task statistics — field names match iOS TaskStats model
          const myOnly = url.searchParams.get('my') === 'true';

          let query = admin.from('tasks').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
          if (myOnly) {
            query = query.eq('assigned_to', user.id);
          }

          const { data: allTasks, count: totalCount } = await query;

          const now = new Date();
          const todoCount = allTasks?.filter((t) => t.status === 'todo').length || 0;
          const inProgressCount = allTasks?.filter((t) => t.status === 'in_progress').length || 0;
          const reviewCount = allTasks?.filter((t) => t.status === 'review').length || 0;
          const completedCount = allTasks?.filter((t) => t.status === 'completed').length || 0;
          const cancelledCount = allTasks?.filter((t) => t.status === 'cancelled').length || 0;
          const overdueCount =
            allTasks?.filter(
              (t) => t.due_date && new Date(t.due_date) < now && t.status !== 'completed' && t.status !== 'cancelled',
            ).length || 0;

          return createCorsResponse(
            {
              total: totalCount || 0,
              todo: todoCount,
              in_progress: inProgressCount,
              review: reviewCount,
              completed: completedCount,
              cancelled: cancelledCount,
              overdue: overdueCount,
            },
            200,
            req,
          );
        }

        if (taskId && taskId !== 'stats') {
          // Get single task — return raw DB record (iOS decoder handles snake_case → camelCase)
          const { data: task, error } = await admin
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('tenant_id', tenantId)
            .single();

          if (error || !task) {
            return createCorsResponse({ error: 'Task not found' }, 404, req);
          }
          return createCorsResponse(task, 200, req);
        }

        // List all tasks — return plain array of raw DB records
        // The iOS decoder uses convertFromSnakeCase to map keys automatically
        const { data: tasks, error } = await admin
          .from('tasks')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tasks:', error);
          return createCorsResponse({ error: 'Failed to fetch tasks' }, 500, req);
        }

        return createCorsResponse(tasks || [], 200, req);
      }

      case 'POST': {
        const body = await req.json();

        // Validate required fields
        if (!body.title) {
          return createCorsResponse({ error: 'Task title is required' }, 400, req);
        }

        const taskData = {
          tenant_id: tenantId,
          title: body.title,
          description: body.description || null,
          status: body.status || 'todo',
          priority: body.priority || 'medium',
          assigned_to: body.assignedTo || body.assigned_to || null,
          project_id: body.projectId || body.project_id || null,
          due_date: body.dueDate || body.due_date || null,
          completion_percentage: body.completionPercentage || body.completion_percentage || 0,
          tags: body.tags || [],
          created_by: user.id,
        };

        const { data: newTask, error } = await admin
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (error) {
          console.error('Error creating task:', error);
          return createCorsResponse({ error: 'Failed to create task' }, 500, req);
        }

        return createCorsResponse(newTask, 201, req);
      }

      case 'PUT':
      case 'PATCH': {
        if (!taskId) {
          return createCorsResponse({ error: 'Task ID required' }, 400, req);
        }

        const body = await req.json();

        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        // Map camelCase to snake_case
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.assignedTo !== undefined) updateData.assigned_to = body.assignedTo;
        if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
        if (body.projectId !== undefined) updateData.project_id = body.projectId;
        if (body.project_id !== undefined) updateData.project_id = body.project_id;
        if (body.dueDate !== undefined) updateData.due_date = body.dueDate;
        if (body.due_date !== undefined) updateData.due_date = body.due_date;
        if (body.estimatedHours !== undefined) updateData.estimated_hours = body.estimatedHours;
        if (body.estimated_hours !== undefined) updateData.estimated_hours = body.estimated_hours;
        if (body.actualHours !== undefined) updateData.actual_hours = body.actualHours;
        if (body.actual_hours !== undefined) updateData.actual_hours = body.actual_hours;
        if (body.completionPercentage !== undefined)
          updateData.completion_percentage = body.completionPercentage;
        if (body.completion_percentage !== undefined)
          updateData.completion_percentage = body.completion_percentage;
        if (body.tags !== undefined) updateData.tags = body.tags;

        // Set completedAt if status is being set to completed
        if (body.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.completion_percentage = 100;
        }

        const { data: updatedTask, error } = await admin
          .from('tasks')
          .update(updateData)
          .eq('id', taskId)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          console.error('Error updating task:', error);
          return createCorsResponse({ error: 'Failed to update task' }, 500, req);
        }

        return createCorsResponse(updatedTask, 200, req);
      }

      case 'DELETE': {
        if (!taskId) {
          return createCorsResponse({ error: 'Task ID required' }, 400, req);
        }

        const { error } = await admin
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('Error deleting task:', error);
          return createCorsResponse({ error: 'Failed to delete task' }, 500, req);
        }

        return createCorsResponse({ success: true }, 200, req);
      }

      default:
        return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }
  } catch (error) {
    console.error('Tasks function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
