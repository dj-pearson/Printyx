// Onboarding Checklists Edge Function
// Handles customer onboarding checklists
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    // /onboarding-checklists, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'onboarding-checklists');
    const checklistId = parts[1]; // onboarding/checklists/:id
    const subResource = parts[2];

    // GET /onboarding/checklists - List checklists
    if (req.method === 'GET' && !checklistId) {
      const customerId = url.searchParams.get('customerId');
      const status = url.searchParams.get('status');

      let query = admin
        .from('onboarding_checklists')
        .select(
          `
          *,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (customerId) query = query.eq('customer_id', customerId);
      if (status) query = query.eq('status', status);

      const { data: checklists, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch onboarding checklists' }, 500, req);
      }

      return createCorsResponse(checklists || [], 200, req);
    }

    // GET /onboarding/checklists/:id - Get single checklist
    if (req.method === 'GET' && checklistId && !subResource) {
      const { data: checklist, error } = await admin
        .from('onboarding_checklists')
        .select(
          `
          *,
          customer:customer_id (*),
          sections:onboarding_sections (*),
          tasks:onboarding_tasks (*)
        `,
        )
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Checklist not found' }, 404, req);
      }

      return createCorsResponse(checklist, 200, req);
    }

    // POST /onboarding/checklists - Create checklist
    if (req.method === 'POST' && !checklistId) {
      const body = await req.json();

      // COP-M01: this is not a rename, it is a different model. The handler
      // describes a checklist as name / description / status / customer_id /
      // template_id / assigned_to / due_date; onboarding_checklists has NONE of
      // those. It is a per-USER progress record — user_id, lifecycle_event_id, an
      // `items` jsonb, total_items / completed_items / progress_percent,
      // started_at, target_completion_date, check_ins. Every field the caller
      // sends has nowhere to go, and the insert has been failing outright.
      //
      // Guessing a mapping here would invent a product decision (what a
      // checklist IS, and how a template becomes one), so the endpoint says so
      // rather than half-writing a row.
      return createCorsResponse(
        {
          error:
            'Creating a checklist from a name/template is not supported by the current schema. ' +
            "onboarding_checklists records one user's progress through a lifecycle event " +
            '(user_id, lifecycle_event_id, items[]), and has no name, status, template or ' +
            'assignee column.',
          code: 'CHECKLIST_MODEL_MISMATCH',
          expects: ['userId', 'lifecycleEventId', 'items', 'targetCompletionDate'],
        },
        501,
        req,
      );
    }

    // PUT /onboarding/checklists/:id - Update checklist
    if (req.method === 'PUT' && checklistId && !subResource) {
      const body = await req.json();

      // Only the progress fields exist on this table (see the create branch for
      // why). name / description / status / assigned_to / due_date are reported
      // back rather than written to columns that are not there.
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.items !== undefined) update.items = body.items;
      if (body.completedItems ?? body.completed_items) {
        update.completed_items = body.completedItems ?? body.completed_items;
      }
      if (body.progressPercent ?? body.progress_percent) {
        update.progress_percent = body.progressPercent ?? body.progress_percent;
      }
      if (body.targetCompletionDate ?? body.target_completion_date) {
        update.target_completion_date = body.targetCompletionDate ?? body.target_completion_date;
      }
      if (body.nextCheckIn ?? body.next_check_in) {
        update.next_check_in = body.nextCheckIn ?? body.next_check_in;
      }
      if (body.status === 'completed') update.completed_at = new Date().toISOString();

      const unpersisted = (
        ['name', 'description', 'status', 'assignedTo', 'dueDate'] as const
      ).filter((field) => body[field] !== undefined);

      const { data: checklist, error } = await admin
        .from('onboarding_checklists')
        .update(update)
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update checklist' }, 500, req);
      }

      return createCorsResponse({ ...checklist, unpersisted }, 200, req);
    }

    // POST /onboarding/checklists/:checklistId/sections - Add section
    if (req.method === 'POST' && checklistId && subResource === 'sections') {
      const body = await req.json();

      const { data: section, error } = await admin
        .from('onboarding_sections')
        .insert({
          checklist_id: checklistId,
          name: body.name,
          description: body.description,
          order: body.order || 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add section' }, 500, req);
      }

      return createCorsResponse(section, 201, req);
    }

    // POST /onboarding/checklists/:checklistId/tasks - Add task
    if (req.method === 'POST' && checklistId && subResource === 'tasks') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('onboarding_tasks')
        // COP-M01: onboarding_tasks names these task_title, task_description and
        // assigned_to, and has no `order` column — sequencing is section_id plus
        // priority. tenant_id was never set either.
        .insert({
          tenant_id: tenantId,
          checklist_id: checklistId,
          section_id: body.sectionId || body.section_id,
          task_title: body.title ?? body.task_title,
          task_description: body.description ?? body.task_description ?? null,
          task_type: body.taskType || body.task_type || null,
          priority: body.priority || null,
          status: 'pending',
          assigned_to: body.assigneeId || body.assignee_id || body.assignedTo || null,
          due_date: body.dueDate || body.due_date || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding onboarding task:', error);
        return createCorsResponse(
          { error: 'Failed to add task', details: error.message },
          500,
          req,
        );
      }

      const unpersisted =
        body.order !== undefined
          ? ['order: onboarding_tasks sequences by section_id and priority, not an order column']
          : [];

      return createCorsResponse({ ...task, unpersisted }, 201, req);
    }

    // DELETE /onboarding/checklists/:id - Delete checklist
    if (req.method === 'DELETE' && checklistId) {
      // Delete related tasks and sections first
      await admin.from('onboarding_tasks').delete().eq('checklist_id', checklistId);
      await admin.from('onboarding_sections').delete().eq('checklist_id', checklistId);

      const { error } = await admin
        .from('onboarding_checklists')
        .delete()
        .eq('id', checklistId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete checklist' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Checklist deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in onboarding-checklists function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
