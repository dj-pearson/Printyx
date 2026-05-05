// Automation Edge Function
// Handles automation rules and scheduled tasks
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'automation');
    const resource = parts[0]; // 'rules' or 'tasks'
    const resourceId = parts[1];

    // GET /automation/rules - List automation rules
    if (req.method === 'GET' && resource === 'rules' && !resourceId) {
      const { data: rules, error } = await admin
        .from('automation_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching automation rules:', error);
        return createCorsResponse({ error: 'Failed to fetch automation rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /automation/rules/:id - Get single rule
    if (req.method === 'GET' && resource === 'rules' && resourceId) {
      const { data: rule, error } = await admin
        .from('automation_rules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Automation rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /automation/rules - Create automation rule
    if (req.method === 'POST' && resource === 'rules') {
      const body = await req.json();

      const ruleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        trigger_type: body.triggerType || body.trigger_type,
        trigger_config: body.triggerConfig || body.trigger_config || {},
        conditions: body.conditions || [],
        actions: body.actions || [],
        is_active: body.isActive !== false,
        priority: body.priority || 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from('automation_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating automation rule:', error);
        return createCorsResponse({ error: 'Failed to create automation rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /automation/rules/:id - Update automation rule
    if (req.method === 'PUT' && resource === 'rules' && resourceId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('automation_rules')
        .update({
          name: body.name,
          description: body.description,
          trigger_type: body.triggerType || body.trigger_type,
          trigger_config: body.triggerConfig || body.trigger_config,
          conditions: body.conditions,
          actions: body.actions,
          is_active: body.isActive ?? body.is_active,
          priority: body.priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update automation rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // DELETE /automation/rules/:id - Delete automation rule
    if (req.method === 'DELETE' && resource === 'rules' && resourceId) {
      const { error } = await admin
        .from('automation_rules')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete automation rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Automation rule deleted' }, 200, req);
    }

    // GET /automation/tasks - List scheduled tasks
    if (req.method === 'GET' && resource === 'tasks' && !resourceId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('scheduled_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('next_run_at', { ascending: true });

      if (status) query = query.eq('status', status);

      const { data: tasks, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch scheduled tasks' }, 500, req);
      }

      return createCorsResponse(tasks || [], 200, req);
    }

    // POST /automation/tasks - Create scheduled task
    if (req.method === 'POST' && resource === 'tasks') {
      const body = await req.json();

      const taskData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        task_type: body.taskType || body.task_type,
        schedule: body.schedule,
        config: body.config || {},
        is_active: body.isActive !== false,
        next_run_at: body.nextRunAt || body.next_run_at,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: task, error } = await admin
        .from('scheduled_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create scheduled task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    // PUT /automation/tasks/:id - Update scheduled task
    if (req.method === 'PUT' && resource === 'tasks' && resourceId) {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('scheduled_tasks')
        .update({
          name: body.name,
          description: body.description,
          schedule: body.schedule,
          config: body.config,
          is_active: body.isActive ?? body.is_active,
          next_run_at: body.nextRunAt || body.next_run_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update scheduled task' }, 500, req);
      }

      return createCorsResponse(task, 200, req);
    }

    // DELETE /automation/tasks/:id - Delete scheduled task
    if (req.method === 'DELETE' && resource === 'tasks' && resourceId) {
      const { error } = await admin
        .from('scheduled_tasks')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete scheduled task' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Scheduled task deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in automation function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
