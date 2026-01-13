// Onboarding Edge Function
// Handles customer onboarding workflows, checklists, and equipment setup
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const checklistId = pathParts[1];
    const subResource = pathParts[2]; // 'equipment', 'sections', 'tasks'

    // GET /onboarding/checklists - List checklists
    if (req.method === 'GET' && !checklistId && pathParts[0] === 'onboarding') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('equipment_onboarding_checklists')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: checklists, error, count } = await query;

      if (error) {
        console.error('Error fetching checklists:', error);
        return createCorsResponse({ error: 'Failed to fetch checklists' }, 500, req);
      }

      return createCorsResponse(
        {
          data: checklists || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /onboarding/:id - Get single checklist with related data
    if (req.method === 'GET' && checklistId && !subResource) {
      const [checklist, equipment, sections, tasks] = await Promise.all([
        admin
          .from('equipment_onboarding_checklists')
          .select('*')
          .eq('id', checklistId)
          .eq('tenant_id', tenantId)
          .single(),
        admin
          .from('onboarding_equipment')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId),
        admin
          .from('onboarding_dynamic_sections')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId)
          .order('order_index', { ascending: true }),
        admin
          .from('onboarding_tasks')
          .select('*')
          .eq('checklist_id', checklistId)
          .eq('tenant_id', tenantId)
          .order('task_order', { ascending: true }),
      ]);

      if (checklist.error) {
        console.error('Error fetching checklist:', checklist.error);
        return createCorsResponse({ error: 'Checklist not found' }, 404, req);
      }

      return createCorsResponse(
        {
          ...checklist.data,
          equipment: equipment.data || [],
          sections: sections.data || [],
          tasks: tasks.data || [],
        },
        200,
        req,
      );
    }

    // GET /onboarding/:id/equipment - Get checklist equipment
    if (req.method === 'GET' && checklistId && subResource === 'equipment') {
      const { data: equipment, error } = await admin
        .from('onboarding_equipment')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching equipment:', error);
        return createCorsResponse({ error: 'Failed to fetch equipment' }, 500, req);
      }

      return createCorsResponse(equipment || [], 200, req);
    }

    // GET /onboarding/:id/sections - Get checklist sections
    if (req.method === 'GET' && checklistId && subResource === 'sections') {
      const { data: sections, error } = await admin
        .from('onboarding_dynamic_sections')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching sections:', error);
        return createCorsResponse({ error: 'Failed to fetch sections' }, 500, req);
      }

      return createCorsResponse(sections || [], 200, req);
    }

    // GET /onboarding/:id/tasks - Get checklist tasks
    if (req.method === 'GET' && checklistId && subResource === 'tasks') {
      const { data: tasks, error } = await admin
        .from('onboarding_tasks')
        .select('*')
        .eq('checklist_id', checklistId)
        .eq('tenant_id', tenantId)
        .order('task_order', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        return createCorsResponse({ error: 'Failed to fetch tasks' }, 500, req);
      }

      return createCorsResponse(tasks || [], 200, req);
    }

    // POST /onboarding/checklists - Create checklist
    if (req.method === 'POST' && !checklistId && pathParts[0] === 'onboarding') {
      const body = await req.json();

      const checklistData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        business_record_id: body.businessRecordId || body.business_record_id || null,
        quote_id: body.quoteId || body.quote_id || null,
        status: body.status || 'draft',
        assigned_to: body.assignedTo || body.assigned_to || user.id,
        installation_date: body.installationDate || body.installation_date || null,
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: checklist, error } = await admin
        .from('equipment_onboarding_checklists')
        .insert(checklistData)
        .select()
        .single();

      if (error) {
        console.error('Error creating checklist:', error);
        return createCorsResponse(
          { error: 'Failed to create checklist', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(checklist, 201, req);
    }

    // POST /onboarding/:id/equipment - Add equipment to checklist
    if (req.method === 'POST' && checklistId && subResource === 'equipment') {
      const body = await req.json();

      const equipmentData = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        equipment_id: body.equipmentId || body.equipment_id,
        serial_number: body.serialNumber || body.serial_number || null,
        model_number: body.modelNumber || body.model_number || null,
        installation_location: body.installationLocation || body.installation_location || null,
        ip_address: body.ipAddress || body.ip_address || null,
        is_primary:
          body.isPrimary !== undefined
            ? body.isPrimary
            : body.is_primary !== undefined
              ? body.is_primary
              : false,
      };

      const { data: equipment, error } = await admin
        .from('onboarding_equipment')
        .insert(equipmentData)
        .select()
        .single();

      if (error) {
        console.error('Error adding equipment:', error);
        return createCorsResponse({ error: 'Failed to add equipment' }, 500, req);
      }

      return createCorsResponse(equipment, 201, req);
    }

    // POST /onboarding/:id/sections - Add section to checklist
    if (req.method === 'POST' && checklistId && subResource === 'sections') {
      const body = await req.json();

      const sectionData = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        section_title: body.sectionTitle || body.section_title,
        section_content: body.sectionContent || body.section_content || null,
        order_index: body.orderIndex || body.order_index || 0,
      };

      const { data: section, error } = await admin
        .from('onboarding_dynamic_sections')
        .insert(sectionData)
        .select()
        .single();

      if (error) {
        console.error('Error adding section:', error);
        return createCorsResponse({ error: 'Failed to add section' }, 500, req);
      }

      return createCorsResponse(section, 201, req);
    }

    // POST /onboarding/:id/tasks - Add task to checklist
    if (req.method === 'POST' && checklistId && subResource === 'tasks') {
      const body = await req.json();

      const taskData = {
        tenant_id: tenantId,
        checklist_id: checklistId,
        task_title: body.taskTitle || body.task_title,
        task_description: body.taskDescription || body.task_description || null,
        task_order: body.taskOrder || body.task_order || 0,
        is_completed: false,
        completed_by: null,
        completed_at: null,
      };

      const { data: task, error } = await admin
        .from('onboarding_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error('Error adding task:', error);
        return createCorsResponse({ error: 'Failed to add task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    // PATCH /onboarding/:id - Update checklist
    if ((req.method === 'PATCH' || req.method === 'PUT') && checklistId && !subResource) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        status: 'status',
        assignedTo: 'assigned_to',
        installationDate: 'installation_date',
        notes: 'notes',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: checklist, error } = await admin
        .from('equipment_onboarding_checklists')
        .update(updateData)
        .eq('id', checklistId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating checklist:', error);
        return createCorsResponse({ error: 'Failed to update checklist' }, 500, req);
      }

      return createCorsResponse(checklist, 200, req);
    }

    // DELETE /onboarding/:id - Delete checklist
    if (req.method === 'DELETE' && checklistId && !subResource) {
      const { error } = await admin
        .from('equipment_onboarding_checklists')
        .delete()
        .eq('id', checklistId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting checklist:', error);
        return createCorsResponse({ error: 'Failed to delete checklist' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Checklist deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid onboarding endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in onboarding function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
