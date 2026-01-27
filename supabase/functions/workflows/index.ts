// Workflows Edge Function
// Handles workflow automation CRUD and execution
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
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
    const workflowId = pathParts[1];
    const subResource = pathParts[2];

    // GET /workflows - List all workflows
    if (req.method === 'GET' && !workflowId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('workflows')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: workflows, error } = await query;

      if (error) {
        console.error('Error fetching workflows:', error);
        return createCorsResponse({ error: 'Failed to fetch workflows' }, 500, req);
      }

      return createCorsResponse(workflows || [], 200, req);
    }

    // GET /workflows/:id - Get single workflow with details
    if (req.method === 'GET' && workflowId && !subResource) {
      const { data: workflow, error } = await admin
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Workflow not found' }, 404, req);
      }

      // Get related data
      const [{ data: triggers }, { data: steps }, { data: versions }] = await Promise.all([
        admin.from('workflow_triggers').select('*').eq('workflow_id', workflowId),
        admin.from('workflow_steps').select('*').eq('workflow_id', workflowId).order('step_order'),
        admin
          .from('workflow_versions')
          .select('*')
          .eq('workflow_id', workflowId)
          .order('version', { ascending: false }),
      ]);

      return createCorsResponse(
        {
          ...workflow,
          triggers: triggers || [],
          steps: steps || [],
          versions: versions || [],
        },
        200,
        req,
      );
    }

    // POST /workflows - Create new workflow
    if (req.method === 'POST' && !workflowId) {
      const body = await req.json();

      const workflowData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        status: body.status || 'draft',
        trigger_type: body.triggerType || body.trigger_type,
        trigger_config: body.triggerConfig || body.trigger_config || {},
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: workflow, error } = await admin
        .from('workflows')
        .insert(workflowData)
        .select()
        .single();

      if (error) {
        console.error('Error creating workflow:', error);
        return createCorsResponse({ error: 'Failed to create workflow' }, 500, req);
      }

      return createCorsResponse(workflow, 201, req);
    }

    // PUT /workflows/:id - Update workflow
    if (req.method === 'PUT' && workflowId && !subResource) {
      const body = await req.json();

      const { data: workflow, error } = await admin
        .from('workflows')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating workflow:', error);
        return createCorsResponse({ error: 'Failed to update workflow' }, 500, req);
      }

      return createCorsResponse(workflow, 200, req);
    }

    // POST /workflows/:id/activate - Activate workflow
    if (req.method === 'POST' && workflowId && subResource === 'activate') {
      const { data: workflow, error } = await admin
        .from('workflows')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to activate workflow' }, 500, req);
      }

      return createCorsResponse(workflow, 200, req);
    }

    // POST /workflows/:id/deactivate - Deactivate workflow
    if (req.method === 'POST' && workflowId && subResource === 'deactivate') {
      const { data: workflow, error } = await admin
        .from('workflows')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to deactivate workflow' }, 500, req);
      }

      return createCorsResponse(workflow, 200, req);
    }

    // POST /workflows/:id/execute - Manually execute workflow
    if (req.method === 'POST' && workflowId && subResource === 'execute') {
      const body = await req.json();

      // Create execution record
      const { data: execution, error } = await admin
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          tenant_id: tenantId,
          status: 'running',
          trigger_type: 'manual',
          trigger_data: body.triggerData || {},
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to execute workflow' }, 500, req);
      }

      return createCorsResponse(
        {
          executionId: execution.id,
          status: 'running',
          message: 'Workflow execution started',
        },
        200,
        req,
      );
    }

    // GET /workflows/:id/executions - Get workflow execution history
    if (req.method === 'GET' && workflowId && subResource === 'executions') {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { data: executions } = await admin
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return createCorsResponse(executions || [], 200, req);
    }

    // DELETE /workflows/:id - Delete workflow
    if (req.method === 'DELETE' && workflowId) {
      const { error } = await admin
        .from('workflows')
        .delete()
        .eq('id', workflowId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete workflow' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Workflow deleted' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in workflows function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
