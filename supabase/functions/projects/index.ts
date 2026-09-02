// AUDIT-037 / AUDIT-039. projects has estimated_hours, actual_hours and budget,
// and NOT project_manager, estimated_budget, actual_budget or tags. Migration
// 0000 created task-schema.ts's shape; migration 0002 CONVERTED the table to
// schema.ts's, adding the first three and dropping the other four along with
// color, template, workflow, custom_fields and contract_id. So all four names
// this handler used were 42703s and shared/drizzle-schema.ts resolves the
// collision correctly.
//
// I briefly concluded the opposite from migration 0000 alone and filed
// AUDIT-039 on it. check:declared-cols disagreed, because it replays the whole
// journal, and it was right. Read the chain, not the first file that mentions
// the table.
//
// budget is numeric(10,2) in DOLLARS, so the old "store in cents" multiply is
// gone with the column name it belonged to.
// Projects Edge Function
// Handles CRUD operations for projects
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

/** budget is numeric(10,2) in DOLLARS. Never multiply by 100 into it. */
function toMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

/** estimated_hours and actual_hours are integers. */
function toWholeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const projectId =
    pathParts[pathParts.length - 1] !== 'projects' ? pathParts[pathParts.length - 1] : null;

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

    switch (req.method) {
      case 'GET': {
        if (projectId && projectId !== 'projects') {
          // Get single project with task counts
          const { data: project, error } = await admin
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .eq('tenant_id', tenantId)
            .single();

          if (error || !project) {
            return createCorsResponse({ error: 'Project not found' }, 404, req);
          }

          // Get task counts for this project
          const { data: tasks } = await admin
            .from('tasks')
            .select('status')
            .eq('project_id', projectId)
            .eq('tenant_id', tenantId);

          const taskCount = tasks?.length || 0;
          const completedTaskCount = tasks?.filter((t) => t.status === 'completed').length || 0;

          return createCorsResponse(
            {
              ...project,
              taskCount,
              completedTaskCount,
              completionPercentage:
                taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0,
            },
            200,
            req,
          );
        }

        // List all projects (without joins to avoid FK errors)
        const { data: projects, error } = await admin
          .from('projects')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching projects:', error);
          return createCorsResponse({ error: 'Failed to fetch projects' }, 500, req);
        }

        // Get task counts for all projects
        const projectIds = projects?.map((p) => p.id) || [];
        const { data: allTasks } = await admin
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
          .eq('tenant_id', tenantId);

        // Transform projects with task counts
        const transformedProjects = (projects || []).map((project: any) => {
          const projectTasks = allTasks?.filter((t) => t.project_id === project.id) || [];
          const taskCount = projectTasks.length;
          const completedTaskCount = projectTasks.filter((t) => t.status === 'completed').length;

          return {
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            projectManager: null,
            projectManagerName: null,
            customerId: project.customer_id,
            customerName: project.customer?.company_name,
            startDate: project.start_date,
            endDate: project.end_date,
            budget: project.budget ?? null,
            estimatedHours: project.estimated_hours ?? null,
            actualHours: project.actual_hours ?? null,
            taskCount,
            completedTaskCount,
            completionPercentage:
              taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0,
            tags: [],
            createdAt: project.created_at,
          };
        });

        return createCorsResponse(transformedProjects, 200, req);
      }

      case 'POST': {
        const body = await req.json();

        if (!body.name) {
          return createCorsResponse({ error: 'Project name is required' }, 400, req);
        }

        const projectData = {
          tenant_id: tenantId,
          name: body.name,
          description: body.description || null,
          status: body.status || 'planning',
          customer_id: body.customerId || null,
          start_date: body.startDate || null,
          end_date: body.endDate || null,
          budget: toMoney(body.budget ?? body.estimatedBudget),
          estimated_hours: toWholeNumber(body.estimatedHours),
          created_by: user.id,
        };

        const { data: newProject, error } = await admin
          .from('projects')
          .insert(projectData)
          .select()
          .single();

        if (error) {
          console.error('Error creating project:', error);
          return createCorsResponse({ error: 'Failed to create project' }, 500, req);
        }

        return createCorsResponse(newProject, 201, req);
      }

      case 'PUT':
      case 'PATCH': {
        if (!projectId) {
          return createCorsResponse({ error: 'Project ID required' }, 400, req);
        }

        const body = await req.json();
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.customerId !== undefined) updateData.customer_id = body.customerId;
        if (body.startDate !== undefined) updateData.start_date = body.startDate;
        if (body.endDate !== undefined) updateData.end_date = body.endDate;
        if (body.budget !== undefined) updateData.budget = toMoney(body.budget);
        else if (body.estimatedBudget !== undefined)
          updateData.budget = toMoney(body.estimatedBudget);
        if (body.estimatedHours !== undefined)
          updateData.estimated_hours = toWholeNumber(body.estimatedHours);
        if (body.actualHours !== undefined)
          updateData.actual_hours = toWholeNumber(body.actualHours);

        const { data: updatedProject, error } = await admin
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          console.error('Error updating project:', error);
          return createCorsResponse({ error: 'Failed to update project' }, 500, req);
        }

        return createCorsResponse(updatedProject, 200, req);
      }

      case 'DELETE': {
        if (!projectId) {
          return createCorsResponse({ error: 'Project ID required' }, 400, req);
        }

        const { error } = await admin
          .from('projects')
          .delete()
          .eq('id', projectId)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('Error deleting project:', error);
          return createCorsResponse({ error: 'Failed to delete project' }, 500, req);
        }

        return createCorsResponse({ success: true }, 200, req);
      }

      default:
        return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }
  } catch (error) {
    console.error('Projects function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
