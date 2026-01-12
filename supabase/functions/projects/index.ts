// Projects Edge Function
// Handles CRUD operations for projects
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

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
    // Verify JWT and get current auth user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      console.error('Authorization header:', req.headers.get('Authorization'));
      return createCorsResponse({ error: 'Unauthorized', details: userError?.message }, 401, req);
    }

    // Get tenant ID from user metadata
    const tenantId = (user.app_metadata as any)?.tenantId;
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
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

        // List all projects
        const { data: projects, error } = await admin
          .from('projects')
          .select(
            `
            *,
            project_manager:users!projects_project_manager_id_fkey(id, first_name, last_name),
            customer:business_records!projects_customer_id_fkey(id, company_name)
          `,
          )
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
            projectManager: project.project_manager_id,
            projectManagerName: project.project_manager
              ? `${project.project_manager.first_name || ''} ${project.project_manager.last_name || ''}`.trim()
              : null,
            customerId: project.customer_id,
            customerName: project.customer?.company_name,
            startDate: project.start_date,
            endDate: project.end_date,
            estimatedBudget: project.estimated_budget,
            actualBudget: project.actual_budget,
            taskCount,
            completedTaskCount,
            completionPercentage:
              taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0,
            tags: project.tags || [],
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
          project_manager_id: body.projectManager || null,
          customer_id: body.customerId || null,
          start_date: body.startDate || null,
          end_date: body.endDate || null,
          estimated_budget: body.estimatedBudget ? parseInt(body.estimatedBudget) * 100 : null, // Store in cents
          tags: body.tags || [],
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
        if (body.projectManager !== undefined) updateData.project_manager_id = body.projectManager;
        if (body.customerId !== undefined) updateData.customer_id = body.customerId;
        if (body.startDate !== undefined) updateData.start_date = body.startDate;
        if (body.endDate !== undefined) updateData.end_date = body.endDate;
        if (body.estimatedBudget !== undefined)
          updateData.estimated_budget = parseInt(body.estimatedBudget) * 100;
        if (body.actualBudget !== undefined)
          updateData.actual_budget = parseInt(body.actualBudget) * 100;
        if (body.tags !== undefined) updateData.tags = body.tags;

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
