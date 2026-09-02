// Handoff Task Templates Edge Function
// Handles templates for handoff tasks
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { normalizeHandoffType } from '../_shared/sales-handoff.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /handoff-task-templates, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'handoff-task-templates');
    const templateId = parts[0];

    // GET /handoff-task-templates - List templates
    if (req.method === 'GET' && !templateId) {
      // WF-C-06: the real columns are template_name and handoff_type. This
      // ordered by `name` and filtered on `category`, neither of which exists, so
      // the list was a 42703 on every request and the two writes below dropped
      // four keys each - name, description, category and default_assignee_role -
      // while never setting template_name or handoff_type, both NOT NULL. Nothing
      // caught it because nothing called it.
      const handoffType =
        url.searchParams.get('handoffType') || url.searchParams.get('handoff_type');

      let query = admin
        .from('handoff_task_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('template_name', { ascending: true });

      if (handoffType) query = query.eq('handoff_type', handoffType);

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

      // Both are NOT NULL, so a 400 naming the field beats a 23502 the caller
      // reads as a server fault.
      const missing: string[] = [];
      if (!(body.templateName || body.template_name || body.name)) missing.push('templateName');
      if (!normalizeHandoffType(body.handoffType ?? body.handoff_type ?? body.category)) {
        missing.push('handoffType');
      }
      if (missing.length > 0) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}`, missing },
          400,
          req,
        );
      }

      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .insert({
          tenant_id: tenantId,
          template_name: body.templateName || body.template_name || body.name,
          handoff_type: normalizeHandoffType(
            body.handoffType ?? body.handoff_type ?? body.category,
          ),
          description: body.description ?? null,
          tasks: body.tasks || [],
          is_active: body.isActive !== false,
          is_default: body.isDefault === true,
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
          template_name: body.templateName ?? body.template_name ?? body.name,
          handoff_type: normalizeHandoffType(body.handoffType ?? body.handoff_type),
          description: body.description,
          tasks: body.tasks,
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
