// Onboarding Checklists Edge Function
// Handles customer onboarding checklists
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
    const checklistId = pathParts[2]; // onboarding/checklists/:id
    const subResource = pathParts[3];

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

      const { data: checklist, error } = await admin
        .from('onboarding_checklists')
        .insert({
          tenant_id: tenantId,
          customer_id: body.customerId || body.customer_id,
          name: body.name,
          description: body.description,
          template_id: body.templateId || body.template_id,
          status: 'in_progress',
          assigned_to: body.assignedTo || body.assigned_to,
          due_date: body.dueDate || body.due_date,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create checklist' }, 500, req);
      }

      return createCorsResponse(checklist, 201, req);
    }

    // PUT /onboarding/checklists/:id - Update checklist
    if (req.method === 'PUT' && checklistId && !subResource) {
      const body = await req.json();

      const { data: checklist, error } = await admin
        .from('onboarding_checklists')
        .update({
          name: body.name,
          description: body.description,
          status: body.status,
          assigned_to: body.assignedTo || body.assigned_to,
          due_date: body.dueDate || body.due_date,
          completed_at: body.status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update checklist' }, 500, req);
      }

      return createCorsResponse(checklist, 200, req);
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
        .insert({
          checklist_id: checklistId,
          section_id: body.sectionId || body.section_id,
          title: body.title,
          description: body.description,
          status: 'pending',
          assignee_id: body.assigneeId || body.assignee_id,
          due_date: body.dueDate || body.due_date,
          order: body.order || 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
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
