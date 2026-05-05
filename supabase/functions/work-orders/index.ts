// Work Orders Edge Function
// Handles work order management
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
    const { parts } = normalizePath(url.pathname, 'work-orders');
    const workOrderId = parts[0];
    const subResource = parts[1];

    // GET /work-orders - List work orders
    if (req.method === 'GET' && !workOrderId) {
      const status = url.searchParams.get('status');
      const technicianId = url.searchParams.get('technicianId');
      const customerId = url.searchParams.get('customerId');
      const priority = url.searchParams.get('priority');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('work_orders')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name
          ),
          technician:assigned_technician_id (
            id,
            full_name
          )
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (technicianId) query = query.eq('assigned_technician_id', technicianId);
      if (customerId) query = query.eq('customer_id', customerId);
      if (priority) query = query.eq('priority', priority);

      const { data: workOrders, count, error } = await query;

      if (error) {
        console.error('Error fetching work orders:', error);
        return createCorsResponse({ error: 'Failed to fetch work orders' }, 500, req);
      }

      return createCorsResponse(
        {
          workOrders: workOrders || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /work-orders/today - Get today's work orders
    if (req.method === 'GET' && workOrderId === 'today') {
      const today = new Date().toISOString().split('T')[0];

      const { data: workOrders } = await admin
        .from('work_orders')
        .select(
          `
          *,
          customer:customer_id (id, company_name, address)
        `,
        )
        .eq('tenant_id', tenantId)
        .gte('scheduled_date', `${today}T00:00:00`)
        .lte('scheduled_date', `${today}T23:59:59`)
        .order('scheduled_date', { ascending: true });

      return createCorsResponse(workOrders || [], 200, req);
    }

    // GET /work-orders/:id - Get single work order
    if (req.method === 'GET' && workOrderId && !subResource) {
      const { data: workOrder, error } = await admin
        .from('work_orders')
        .select('*')
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Work order not found' }, 404, req);
      }

      // Get parts used
      const { data: parts } = await admin
        .from('work_order_parts')
        .select('*')
        .eq('work_order_id', workOrderId);

      // Get labor entries
      const { data: labor } = await admin
        .from('work_order_labor')
        .select('*')
        .eq('work_order_id', workOrderId);

      // Get notes/history
      const { data: notes } = await admin
        .from('work_order_notes')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      return createCorsResponse(
        {
          ...workOrder,
          parts: parts || [],
          labor: labor || [],
          notes: notes || [],
        },
        200,
        req,
      );
    }

    // POST /work-orders - Create work order
    if (req.method === 'POST' && !workOrderId) {
      const body = await req.json();

      const workOrderData = {
        tenant_id: tenantId,
        work_order_number: body.workOrderNumber || body.work_order_number || `WO-${Date.now()}`,
        customer_id: body.customerId || body.customer_id,
        equipment_id: body.equipmentId || body.equipment_id,
        contract_id: body.contractId || body.contract_id,
        service_type: body.serviceType || body.service_type || 'repair',
        priority: body.priority || 'normal',
        status: body.status || 'open',
        description: body.description,
        problem_reported: body.problemReported || body.problem_reported,
        scheduled_date: body.scheduledDate || body.scheduled_date,
        assigned_technician_id: body.assignedTechnicianId || body.assigned_technician_id,
        estimated_duration: body.estimatedDuration || body.estimated_duration,
        customer_po: body.customerPo || body.customer_po,
        site_address: body.siteAddress || body.site_address,
        contact_name: body.contactName || body.contact_name,
        contact_phone: body.contactPhone || body.contact_phone,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: workOrder, error } = await admin
        .from('work_orders')
        .insert(workOrderData)
        .select()
        .single();

      if (error) {
        console.error('Error creating work order:', error);
        return createCorsResponse({ error: 'Failed to create work order' }, 500, req);
      }

      return createCorsResponse(workOrder, 201, req);
    }

    // PUT /work-orders/:id - Update work order
    if (req.method === 'PUT' && workOrderId && !subResource) {
      const body = await req.json();

      const { data: workOrder, error } = await admin
        .from('work_orders')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update work order' }, 500, req);
      }

      return createCorsResponse(workOrder, 200, req);
    }

    // POST /work-orders/:id/assign - Assign technician
    if (req.method === 'POST' && workOrderId && subResource === 'assign') {
      const body = await req.json();

      const { data: workOrder, error } = await admin
        .from('work_orders')
        .update({
          assigned_technician_id: body.technicianId || body.technician_id,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to assign technician' }, 500, req);
      }

      return createCorsResponse(workOrder, 200, req);
    }

    // POST /work-orders/:id/start - Start work
    if (req.method === 'POST' && workOrderId && subResource === 'start') {
      const { data: workOrder, error } = await admin
        .from('work_orders')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to start work order' }, 500, req);
      }

      return createCorsResponse(workOrder, 200, req);
    }

    // POST /work-orders/:id/complete - Complete work order
    if (req.method === 'POST' && workOrderId && subResource === 'complete') {
      const body = await req.json();

      const { data: workOrder, error } = await admin
        .from('work_orders')
        .update({
          status: 'completed',
          resolution: body.resolution,
          work_performed: body.workPerformed || body.work_performed,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to complete work order' }, 500, req);
      }

      return createCorsResponse(workOrder, 200, req);
    }

    // POST /work-orders/:id/parts - Add parts used
    if (req.method === 'POST' && workOrderId && subResource === 'parts') {
      const body = await req.json();

      const { data: part, error } = await admin
        .from('work_order_parts')
        .insert({
          work_order_id: workOrderId,
          part_id: body.partId || body.part_id,
          part_number: body.partNumber || body.part_number,
          description: body.description,
          quantity: body.quantity || 1,
          unit_cost: body.unitCost || body.unit_cost || 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add part' }, 500, req);
      }

      return createCorsResponse(part, 201, req);
    }

    // POST /work-orders/:id/labor - Add labor entry
    if (req.method === 'POST' && workOrderId && subResource === 'labor') {
      const body = await req.json();

      const { data: labor, error } = await admin
        .from('work_order_labor')
        .insert({
          work_order_id: workOrderId,
          technician_id: body.technicianId || body.technician_id || user.id,
          labor_type: body.laborType || body.labor_type || 'standard',
          hours: body.hours,
          hourly_rate: body.hourlyRate || body.hourly_rate,
          description: body.description,
          work_date: body.workDate || body.work_date || new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add labor' }, 500, req);
      }

      return createCorsResponse(labor, 201, req);
    }

    // POST /work-orders/:id/notes - Add note
    if (req.method === 'POST' && workOrderId && subResource === 'notes') {
      const body = await req.json();

      const { data: note, error } = await admin
        .from('work_order_notes')
        .insert({
          work_order_id: workOrderId,
          note: body.note || body.content,
          note_type: body.noteType || body.note_type || 'general',
          is_internal: body.isInternal || body.is_internal || false,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add note' }, 500, req);
      }

      return createCorsResponse(note, 201, req);
    }

    // DELETE /work-orders/:id - Delete work order
    if (req.method === 'DELETE' && workOrderId) {
      // Delete related records first
      await admin.from('work_order_parts').delete().eq('work_order_id', workOrderId);
      await admin.from('work_order_labor').delete().eq('work_order_id', workOrderId);
      await admin.from('work_order_notes').delete().eq('work_order_id', workOrderId);

      const { error } = await admin
        .from('work_orders')
        .delete()
        .eq('id', workOrderId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete work order' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Work order deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in work-orders function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
