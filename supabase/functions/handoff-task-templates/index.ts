// Handoff Task Templates Edge Function
// Handles templates for handoff tasks
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
    const templateId = pathParts[1];

    // GET /handoff-task-templates - List templates
    if (req.method === 'GET' && !templateId) {
      const category = url.searchParams.get('category');

      let query = admin
        .from('handoff_task_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (category) query = query.eq('category', category);

      const { data: templates, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch handoff task templates' }, 500, req);
      }

      return createCorsResponse(templates || [], 200, req);
    }

    // GET /handoff-task-templates/:id - Get single template
    if (req.method === 'GET' && templateId) {
      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Handoff task template not found' }, 404, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /handoff-task-templates - Create template
    if (req.method === 'POST' && !templateId) {
      const body = await req.json();

      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          category: body.category,
          tasks: body.tasks || [],
          default_assignee_role: body.defaultAssigneeRole || body.default_assignee_role,
          is_active: body.isActive !== false,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create handoff task template' }, 500, req);
      }

      return createCorsResponse(template, 201, req);
    }

    // PUT /handoff-task-templates/:id - Update template
    if (req.method === 'PUT' && templateId) {
      const body = await req.json();

      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .update({
          name: body.name,
          description: body.description,
          category: body.category,
          tasks: body.tasks,
          default_assignee_role: body.defaultAssigneeRole || body.default_assignee_role,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update handoff task template' }, 500, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // DELETE /handoff-task-templates/:id - Delete template
    if (req.method === 'DELETE' && templateId) {
      const { error } = await admin
        .from('handoff_task_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete handoff task template' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Handoff task template deleted' },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in handoff-task-templates function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
