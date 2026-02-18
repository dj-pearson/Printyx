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

    // Get tenant ID from user metadata or query from database
    let tenantId = (user.app_metadata as any)?.tenant_id;

    if (!tenantId) {
      // Fallback: query tenant_id from users table
      const admin = createSupabaseServiceClient();
      const { data: userData, error: userQueryError } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userQueryError || !userData?.tenant_id) {
        console.error('No tenant ID in app_metadata or database for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      tenantId = userData.tenant_id;
    }

    const admin = createSupabaseServiceClient();

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (isStatsRequest) {
          // Return task statistics
          const myOnly = url.searchParams.get('my') === 'true';

          let query = admin.from('tasks').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
          if (myOnly) {
            query = query.eq('assigned_to', user.id);
          }

          const { data: allTasks, count: totalTasks } = await query;

          const completedTasks = allTasks?.filter((t) => t.status === 'completed').length || 0;
          const inProgressTasks = allTasks?.filter((t) => t.status === 'in_progress').length || 0;
          const now = new Date();
          const overdueTasks =
            allTasks?.filter(
              (t) => t.due_date && new Date(t.due_date) < now && t.status !== 'completed',
            ).length || 0;

          return createCorsResponse(
            {
              totalTasks: totalTasks || 0,
              completedTasks,
              inProgressTasks,
              overdueTasks,
              myTasks: myOnly
                ? totalTasks
                : allTasks?.filter((t) => t.assigned_to === user.id).length || 0,
            },
            200,
            req,
          );
        }

        if (taskId && taskId !== 'stats') {
          // Get single task
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

        // List all tasks (without joins to avoid FK errors)
        const { data: tasks, error } = await admin
          .from('tasks')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tasks:', error);
          return createCorsResponse({ error: 'Failed to fetch tasks' }, 500, req);
        }

        // Transform to match frontend expectations
        const transformedTasks = (tasks || []).map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assigned_to,
          assignedToName: null, // Will be populated by frontend if needed
          projectId: task.project_id,
          projectName: null, // Will be populated by frontend if needed
          dueDate: task.due_date,
          completionPercentage: task.completion_percentage || 0,
          tags: task.tags || [],
          createdAt: task.created_at,
          createdBy: task.created_by,
        }));

        return createCorsResponse(transformedTasks, 200, req);
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
          assigned_to: body.assignedTo || null,
          project_id: body.projectId || null,
          due_date: body.dueDate || null,
          completion_percentage: body.completionPercentage || 0,
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
        if (body.projectId !== undefined) updateData.project_id = body.projectId;
        if (body.dueDate !== undefined) updateData.due_date = body.dueDate;
        if (body.estimatedHours !== undefined) updateData.estimated_hours = body.estimatedHours;
        if (body.actualHours !== undefined) updateData.actual_hours = body.actualHours;
        if (body.completionPercentage !== undefined)
          updateData.completion_percentage = body.completionPercentage;
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
