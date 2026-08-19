// Workflows Edge Function
// Handles workflow automation CRUD and execution
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'workflows');
    const workflowId = parts[0];
    const subResource = parts[1];

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
        // COP-M01: `workflow_steps` is a DIFFERENT table — a session step log
        // keyed on session_id. The automation steps live in
        // workflow_steps_automation, ordered by order_index.
        admin
          .from('workflow_steps_automation')
          .select('*')
          .eq('workflow_id', workflowId)
          .order('order_index'),
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

      // COP-M01: `workflows` carries no trigger — triggers are rows in
      // workflow_triggers (type, event_name, payload_mapping). Writing them here
      // failed the insert outright.
      const workflowData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description ?? null,
        category: body.category ?? null,
        status: body.status || 'draft',
        is_template: body.isTemplate ?? body.is_template ?? false,
        created_by: user.id,
        last_modified_by: user.id,
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
        return createCorsResponse(
          { error: 'Failed to create workflow', details: error.message },
          500,
          req,
        );
      }

      // A requested trigger becomes a workflow_triggers row rather than being
      // dropped. Reported, not swallowed, if it fails — a workflow with no
      // trigger never fires, and that is not something to discover later.
      const triggerType = body.triggerType || body.trigger_type;
      const warnings: string[] = [];
      if (triggerType) {
        const { error: triggerError } = await admin.from('workflow_triggers').insert({
          workflow_id: workflow.id,
          type: triggerType,
          event_name: body.eventName || body.event_name || null,
          payload_mapping: body.triggerConfig || body.trigger_config || null,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (triggerError) {
          console.error('Error creating workflow trigger:', triggerError);
          warnings.push(`trigger not created: ${triggerError.message}`);
        }
      }

      return createCorsResponse({ ...workflow, warnings }, 201, req);
    }

    // PUT /workflows/:id - Update workflow
    if (req.method === 'PUT' && workflowId && !subResource) {
      const body = await req.json();

      // Whitelisted rather than spread: `...body` handed PostgREST whatever the
      // caller sent, so one unknown key took the whole update down with a 42703.
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of ['name', 'description', 'category', 'status'] as const) {
        if (body[field] !== undefined) update[field] = body[field];
      }
      if (body.isTemplate ?? body.is_template) {
        update.is_template = body.isTemplate ?? body.is_template;
      }
      update.last_modified_by = user.id;

      const { data: workflow, error } = await admin
        .from('workflows')
        .update({
          ...update,
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
        // There is no activated_at column; status plus updated_at is the record.
        .update({
          status: 'active',
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
    //
    // COP-M01, and this one is deliberately NOT repaired into a working insert.
    // It wrote trigger_type and trigger_data (neither is a column on
    // workflow_executions) and, more to the point, inserted the row with
    // status:'running' and no workflow_version_id, no context and no dedupe_key.
    //
    // workflow_executions is the durable runtime's table (CRMX-008). Executions
    // are created by enrollment, claimed atomically queued|paused -> running, and
    // resumed by the boot-started sweeper against context._runtime. A row hand-
    // written as `running` would be one the sweeper cannot resume and that the
    // dedupe index cannot protect. Making this insert succeed would wire a second
    // trigger path into a runtime whose documented single seam is
    // dispatchWorkflowEvent, so the endpoint refuses and says where to go.
    if (req.method === 'POST' && workflowId && subResource === 'execute') {
      return createCorsResponse(
        {
          error:
            'Manual execution is not available here. workflow_executions is owned by the durable ' +
            'workflow runtime, which creates executions through enrollment and claims them ' +
            'atomically; a row inserted directly cannot be resumed or deduplicated.',
          code: 'USE_WORKFLOW_RUNTIME',
          use: 'dispatchWorkflowEvent(tenantId, eventName, payload, { dedupeKey }) — see server/services/workflow-runtime.ts',
        },
        501,
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
