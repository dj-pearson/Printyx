// Tasks Edge Function
// Handles CRUD operations for tasks
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const taskId =
    pathParts[pathParts.length - 1] !== 'tasks' ? pathParts[pathParts.length - 1] : null;

  // Check for stats endpoint
  const isStatsRequest = url.pathname.includes('/stats');

  try {
    // Verify JWT and get current auth user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Get tenant ID from user metadata
    const tenantId = (user.app_metadata as any)?.tenantId;
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
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

        if (taskId && taskId !== 'tasks') {
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

        // List all tasks
        const { data: tasks, error } = await admin
          .from('tasks')
          .select(
            `
            *,
            assigned_user:users!tasks_assigned_to_fkey(id, first_name, last_name, email),
            project:projects!tasks_project_id_fkey(id, name)
          `,
          )
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
          assignedToName: task.assigned_user
            ? `${task.assigned_user.first_name || ''} ${task.assigned_user.last_name || ''}`.trim()
            : null,
          projectId: task.project_id,
          projectName: task.project?.name,
          dueDate: task.due_date,
          estimatedHours: task.estimated_hours,
          actualHours: task.actual_hours,
          completionPercentage: task.completion_percentage || 0,
          tags: task.tags || [],
          createdAt: task.created_at,
          completedAt: task.completed_at,
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
          customer_id: body.customerId || null,
          due_date: body.dueDate || null,
          estimated_hours: body.estimatedHours || null,
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
});
