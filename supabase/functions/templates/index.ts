// Templates Edge Function
// Handles project and task templates
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { toCamelShallow } from '../_shared/case.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'templates');
    const templateId = parts[0];
    const action = parts[1];

    // Round 159. Every branch here read and wrote `templates`, a table that is
    // in no schema and no migration (it sat in docs/phantom-tables-baseline.json
    // against this file), so in production the Templates view listed nothing
    // and every write failed. The table the product has, and the one Express
    // always read in dev, is `project_templates`: name, description, category,
    // task_template (jsonb), is_public, created_by. Rows are camelised for the
    // page, with taskCount derived from task_template because the page prints
    // it and no column stores it.
    const toView = (row: Record<string, unknown>) => {
      const tasks = Array.isArray(row.task_template) ? row.task_template : [];
      return { ...toCamelShallow(row), taskCount: tasks.length };
    };

    // GET /templates - List templates
    if (req.method === 'GET' && !templateId) {
      const category = url.searchParams.get('category');

      let query = admin
        .from('project_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (category) query = query.eq('category', category);

      const { data: templates, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch templates' }, 500, req);
      }

      return createCorsResponse((templates || []).map(toView), 200, req);
    }

    // GET /templates/:id - Get single template
    if (req.method === 'GET' && templateId && !action) {
      const { data: template, error } = await admin
        .from('project_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        return createCorsResponse({ error: 'Failed to load template' }, 500, req);
      }
      if (!template) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      return createCorsResponse(toView(template), 200, req);
    }

    // POST /templates - Create template
    if (req.method === 'POST' && !templateId) {
      const body = await req.json().catch(() => ({}));
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return createCorsResponse({ error: 'name is required' }, 400, req);
      }

      const { data: template, error } = await admin
        .from('project_templates')
        .insert({
          tenant_id: tenantId,
          name,
          description: body.description ?? null,
          category: body.category ?? null,
          task_template: Array.isArray(body.taskTemplate ?? body.tasks)
            ? (body.taskTemplate ?? body.tasks)
            : [],
          is_public: body.isPublic === true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create template' }, 500, req);
      }

      return createCorsResponse(toView(template), 201, req);
    }

    // PATCH/PUT /templates/:id - Update template (only the fields sent)
    if ((req.method === 'PUT' || req.method === 'PATCH') && templateId && !action) {
      const body = await req.json().catch(() => ({}));
      const set: Record<string, unknown> = {};
      if (body.name !== undefined) set.name = body.name;
      if (body.description !== undefined) set.description = body.description;
      if (body.category !== undefined) set.category = body.category;
      const tasks = body.taskTemplate ?? body.tasks;
      if (Array.isArray(tasks)) set.task_template = tasks;
      if (typeof body.isPublic === 'boolean') set.is_public = body.isPublic;
      if (Object.keys(set).length === 0) {
        return createCorsResponse(
          { error: 'No writable fields', code: 'NO_WRITABLE_FIELDS' },
          400,
          req,
        );
      }

      const { data: template, error } = await admin
        .from('project_templates')
        .update(set)
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return createCorsResponse({ error: 'Failed to update template' }, 500, req);
      }
      if (!template) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      return createCorsResponse(toView(template), 200, req);
    }

    // POST /templates/:id/instantiate - Create a project and its tasks
    if (req.method === 'POST' && templateId && action === 'instantiate') {
      const body = await req.json().catch(() => ({}));

      const { data: template, error: templateError } = await admin
        .from('project_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (templateError) {
        return createCorsResponse({ error: 'Failed to load template' }, 500, req);
      }
      if (!template) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      const { data: project, error } = await admin
        .from('projects')
        .insert({
          tenant_id: tenantId,
          name: body.name || template.name,
          description: body.description || template.description,
          // AUDIT-037: projects has no template_id column; the id is named back
          // in the response instead of being written nowhere.
          customer_id: body.customerId || body.customer_id || null,
          // A project made from a template has not started; 'planning' is what
          // the Express handler wrote and the first value of project_status.
          status: 'planning',
          start_date: body.startDate || null,
          end_date: body.endDate || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create project from template' }, 500, req);
      }

      // Round 159: this insert omitted created_by, which is NOT NULL on tasks,
      // wrote status 'pending', which is not in the tasks vocabulary
      // (todo/in_progress/review/completed/cancelled), and discarded its
      // result - so every project made from a template had NO tasks and the
      // response said nothing. The project is kept if the tasks fail, because
      // it is real and deleting it would lose what the user typed; the
      // response says the tasks did not land.
      const templateTasks = Array.isArray(template.task_template) ? template.task_template : [];
      let tasksCreated = 0;
      let tasksError: string | null = null;
      if (templateTasks.length > 0) {
        const taskInserts = templateTasks.map((task: Record<string, unknown>) => ({
          tenant_id: tenantId,
          project_id: project.id,
          title: task.title,
          description: task.description ?? null,
          priority: task.priority || 'medium',
          estimated_hours: task.estimatedHours ?? null,
          status: 'todo',
          created_by: user.id,
        }));
        const { data: inserted, error: insertError } = await admin
          .from('tasks')
          .insert(taskInserts)
          .select('id');
        if (insertError) {
          console.error('templates: task insert failed:', insertError.message);
          tasksError = 'The project was created but its template tasks were not.';
        } else {
          tasksCreated = (inserted ?? []).length;
        }
      }

      return createCorsResponse(
        {
          ...toCamelShallow(project),
          instantiatedFromTemplateId: templateId,
          tasksCreated,
          tasksExpected: templateTasks.length,
          warning: tasksError,
          unpersisted: ['templateId'],
          reason: 'projects records no template it was created from.',
        },
        201,
        req,
      );
    }

    // DELETE /templates/:id - Delete template
    if (req.method === 'DELETE' && templateId) {
      const { data: deleted, error } = await admin
        .from('project_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select('id');

      if (error) {
        return createCorsResponse({ error: 'Failed to delete template' }, 500, req);
      }
      if (!deleted || deleted.length === 0) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
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
