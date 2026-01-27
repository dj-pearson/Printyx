// Templates Edge Function
// Handles project and task templates
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
    const action = pathParts[2];

    // GET /templates - List templates
    if (req.method === 'GET' && !templateId) {
      const type = url.searchParams.get('type');
      const category = url.searchParams.get('category');

      let query = admin
        .from('templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (type) query = query.eq('type', type);
      if (category) query = query.eq('category', category);

      const { data: templates, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch templates' }, 500, req);
      }

      return createCorsResponse(templates || [], 200, req);
    }

    // GET /templates/:id - Get single template
    if (req.method === 'GET' && templateId && !action) {
      const { data: template, error } = await admin
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /templates - Create template
    if (req.method === 'POST' && !templateId) {
      const body = await req.json();

      const { data: template, error } = await admin
        .from('templates')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          type: body.type || 'project',
          category: body.category,
          content: body.content || {},
          tasks: body.tasks || [],
          milestones: body.milestones || [],
          is_active: body.isActive !== false,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create template' }, 500, req);
      }

      return createCorsResponse(template, 201, req);
    }

    // PATCH/PUT /templates/:id - Update template
    if ((req.method === 'PUT' || req.method === 'PATCH') && templateId && !action) {
      const body = await req.json();

      const { data: template, error } = await admin
        .from('templates')
        .update({
          name: body.name,
          description: body.description,
          type: body.type,
          category: body.category,
          content: body.content,
          tasks: body.tasks,
          milestones: body.milestones,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update template' }, 500, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /templates/:id/instantiate - Create project from template
    if (req.method === 'POST' && templateId && action === 'instantiate') {
      const body = await req.json();

      // Get template
      const { data: template } = await admin
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (!template) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      // Create project from template
      const { data: project, error } = await admin
        .from('projects')
        .insert({
          tenant_id: tenantId,
          name: body.name || template.name,
          description: body.description || template.description,
          template_id: templateId,
          customer_id: body.customerId || body.customer_id,
          status: 'active',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create project from template' }, 500, req);
      }

      // Create tasks from template
      if (template.tasks && template.tasks.length > 0) {
        const taskInserts = template.tasks.map((task: any) => ({
          tenant_id: tenantId,
          project_id: project.id,
          title: task.title,
          description: task.description,
          priority: task.priority || 'medium',
          status: 'pending',
          created_at: new Date().toISOString(),
        }));

        await admin.from('tasks').insert(taskInserts);
      }

      return createCorsResponse(project, 201, req);
    }

    // DELETE /templates/:id - Delete template
    if (req.method === 'DELETE' && templateId) {
      const { error } = await admin
        .from('templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete template' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Template deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in templates function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
