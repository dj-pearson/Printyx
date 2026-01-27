// Implementation Projects Edge Function
// Handles post-sale implementation project tracking
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
    const projectId = pathParts[1];

    // GET /implementation-projects - List projects
    if (req.method === 'GET' && !projectId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('implementation_projects')
        .select(
          `
          *,
          customer:customer_id (id, company_name),
          handoff:handoff_id (id, status),
          project_manager:project_manager_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: projects, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch implementation projects' }, 500, req);
      }

      return createCorsResponse(projects || [], 200, req);
    }

    // GET /implementation-projects/:id - Get single project
    if (req.method === 'GET' && projectId) {
      const { data: project, error } = await admin
        .from('implementation_projects')
        .select(
          `
          *,
          customer:customer_id (*),
          handoff:handoff_id (*),
          project_manager:project_manager_id (id, full_name, email)
        `,
        )
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Implementation project not found' }, 404, req);
      }

      return createCorsResponse(project, 200, req);
    }

    // POST /implementation-projects - Create project
    if (req.method === 'POST' && !projectId) {
      const body = await req.json();

      const { data: project, error } = await admin
        .from('implementation_projects')
        .insert({
          tenant_id: tenantId,
          handoff_id: body.handoffId || body.handoff_id,
          customer_id: body.customerId || body.customer_id,
          project_manager_id: body.projectManagerId || body.project_manager_id,
          name: body.name,
          description: body.description,
          status: body.status || 'planning',
          start_date: body.startDate || body.start_date,
          target_go_live_date: body.targetGoLiveDate || body.target_go_live_date,
          milestones: body.milestones || [],
          requirements: body.requirements || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create implementation project' }, 500, req);
      }

      return createCorsResponse(project, 201, req);
    }

    // PUT /implementation-projects/:id - Update project
    if (req.method === 'PUT' && projectId) {
      const body = await req.json();

      const { data: project, error } = await admin
        .from('implementation_projects')
        .update({
          project_manager_id: body.projectManagerId || body.project_manager_id,
          name: body.name,
          description: body.description,
          status: body.status,
          start_date: body.startDate || body.start_date,
          target_go_live_date: body.targetGoLiveDate || body.target_go_live_date,
          actual_go_live_date: body.actualGoLiveDate || body.actual_go_live_date,
          milestones: body.milestones,
          requirements: body.requirements,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update implementation project' }, 500, req);
      }

      return createCorsResponse(project, 200, req);
    }

    // DELETE /implementation-projects/:id - Delete project
    if (req.method === 'DELETE' && projectId) {
      const { error } = await admin
        .from('implementation_projects')
        .delete()
        .eq('id', projectId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete implementation project' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Implementation project deleted' },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in implementation-projects function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
