// Maintenance scheduling handlers (EDGE-002b).
// Ports server/routes-customer-portal.ts maintenance endpoints, used by
// client/src/components/customer-portal/MaintenanceSchedulingComponent.tsx:
//   GET    /maintenance-availability?date=YYYY-MM-DD&duration=60
//   GET    /maintenance-appointments[?status=&includeCompleted=&limit=]
//   POST   /maintenance-appointments
//   GET    /maintenance-appointments/:id
//   PUT    /maintenance-appointments/:id/reschedule
//   DELETE /maintenance-appointments/:id            (cancel)
import { createCorsResponse } from '../../_shared/cors.ts';
import {
  generateConfirmationCode,
  isMissingTableError,
  mapAppointmentRow,
  resolveCustomerId,
  type PortalCtx,
} from './_context.ts';

const MAINTENANCE_TYPES = new Set([
  'routine_maintenance',
  'repair',
  'inspection',
  'installation',
  'training',
  'emergency',
]);

// GET /maintenance-availability — mirrors the Express implementation exactly:
// business-hour slots (8 AM–5 PM) with fixed demo unavailability until a real
// technician-calendar source is wired (technician_availability_slots table).
export function handleMaintenanceAvailability(ctx: PortalCtx): Response {
  const { req, url } = ctx;
  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return createCorsResponse(
      { success: false, message: 'Invalid request parameters: date (YYYY-MM-DD) is required' },
      400,
      req,
    );
  }
  const duration = parseInt(url.searchParams.get('duration') || '60', 10) || 60;

  const availableSlots = [];
  for (let hour = 8; hour < 17; hour++) {
    availableSlots.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      duration,
      technicianId: 'tech-1',
      technicianName: 'Service Technician',
      isAvailable: true,
    });
  }
  // Same fixed unavailable slots as the Express handler (10 AM, 1 PM, 3 PM).
  for (const index of [2, 5, 7]) {
    if (availableSlots[index]) availableSlots[index].isAvailable = false;
  }

  return createCorsResponse({ success: true, data: { date, availableSlots } }, 200, req);
}

export async function handleMaintenanceAppointments(ctx: PortalCtx): Promise<Response> {
  const { req, admin, tenantId, url, parts } = ctx;
  const appointmentId = parts[1];
  const subAction = parts[2];

  const customerId = resolveCustomerId(ctx);
  if (!customerId) {
    return createCorsResponse(
      { success: false, message: 'Missing tenant or customer context' },
      400,
      req,
    );
  }

  // GET /maintenance-appointments — list
  if (req.method === 'GET' && !appointmentId) {
    const status = url.searchParams.get('status');
    const includeCompleted = url.searchParams.get('includeCompleted') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '0', 10);

    let query = admin
      .from('customer_maintenance_appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('appointment_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (!includeCompleted) query = query.neq('status', 'completed');
    if (limit > 0) query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse({ success: true, data: [] }, 200, req);
      }
      console.error('Error fetching maintenance appointments:', error);
      return createCorsResponse(
        { success: false, message: 'Failed to fetch customer appointments' },
        500,
        req,
      );
    }
    return createCorsResponse(
      { success: true, data: (data || []).map(mapAppointmentRow) },
      200,
      req,
    );
  }

  // GET /maintenance-appointments/:id
  if (req.method === 'GET' && appointmentId) {
    const { data, error } = await admin
      .from('customer_maintenance_appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .single();

    if (error || !data) {
      return createCorsResponse({ success: false, message: 'Appointment not found' }, 404, req);
    }
    return createCorsResponse({ success: true, data: mapAppointmentRow(data) }, 200, req);
  }

  // POST /maintenance-appointments — book
  if (req.method === 'POST' && !appointmentId) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return createCorsResponse({ success: false, message: 'Invalid appointment data' }, 400, req);
    }

    const maintenanceType = body.maintenanceType || body.maintenance_type;
    const appointmentDate = body.appointmentDate || body.appointment_date;
    const appointmentTime = body.appointmentTime || body.appointment_time;
    if (
      !maintenanceType ||
      !MAINTENANCE_TYPES.has(maintenanceType) ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return createCorsResponse(
        {
          success: false,
          message:
            'Invalid appointment data: maintenanceType, appointmentDate and appointmentTime are required',
        },
        400,
        req,
      );
    }

    const insertRow = {
      tenant_id: tenantId,
      customer_id: customerId,
      equipment_id: body.equipmentId || body.equipment_id || null,
      equipment_name:
        body.equipmentName ||
        body.equipment_name ||
        (body.equipmentId ? `Equipment ${body.equipmentId}` : null),
      maintenance_type: maintenanceType,
      appointment_date: new Date(appointmentDate).toISOString(),
      appointment_time: appointmentTime,
      duration: parseInt(String(body.duration || 60), 10) || 60,
      description: body.description || null,
      special_instructions: body.specialInstructions || body.special_instructions || null,
      confirmation_code: generateConfirmationCode(),
      contact_method: body.contactMethod || body.contact_method || 'email',
      customer_phone: body.customerPhone || body.customer_phone || null,
      customer_email: body.customerEmail || body.customer_email || null,
      assigned_technician_id: 'tech-1',
      technician_name: 'Service Technician',
      status: 'requested',
    };

    const { data, error } = await admin
      .from('customer_maintenance_appointments')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse(
          {
            success: false,
            message:
              'Maintenance scheduling is not provisioned yet (customer_maintenance_appointments table missing)',
          },
          503,
          req,
        );
      }
      console.error('Error booking maintenance appointment:', error);
      return createCorsResponse(
        { success: false, message: 'Failed to book maintenance appointment' },
        500,
        req,
      );
    }

    return createCorsResponse(
      {
        success: true,
        data: mapAppointmentRow(data),
        message: 'Maintenance appointment booked successfully',
      },
      201,
      req,
    );
  }

  // PUT /maintenance-appointments/:id/reschedule
  if (req.method === 'PUT' && appointmentId && subAction === 'reschedule') {
    const body = await req.json().catch(() => null);
    const newDate = body?.newDate || body?.new_date;
    const newTime = body?.newTime || body?.new_time;
    if (!newDate || !newTime) {
      return createCorsResponse(
        { success: false, message: 'Invalid reschedule data: newDate and newTime are required' },
        400,
        req,
      );
    }

    const { data: existing, error: fetchError } = await admin
      .from('customer_maintenance_appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .single();

    if (fetchError || !existing) {
      return createCorsResponse({ success: false, message: 'Appointment not found' }, 404, req);
    }
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      return createCorsResponse(
        { success: false, message: 'Cannot reschedule completed or cancelled appointment' },
        400,
        req,
      );
    }

    const { data: updated, error: updateError } = await admin
      .from('customer_maintenance_appointments')
      .update({
        original_date: existing.original_date || existing.appointment_date,
        appointment_date: new Date(newDate).toISOString(),
        appointment_time: newTime,
        reschedule_count: (existing.reschedule_count || 0) + 1,
        reschedule_reason: body?.reason || null,
        status: 'rescheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('Error rescheduling appointment:', updateError);
      return createCorsResponse(
        { success: false, message: 'Failed to reschedule appointment' },
        500,
        req,
      );
    }

    return createCorsResponse(
      {
        success: true,
        data: mapAppointmentRow(updated),
        message: 'Appointment rescheduled successfully',
      },
      200,
      req,
    );
  }

  // DELETE /maintenance-appointments/:id — cancel
  if (req.method === 'DELETE' && appointmentId) {
    const body = await req.json().catch(() => ({}));

    const { data: existing, error: fetchError } = await admin
      .from('customer_maintenance_appointments')
      .select('id, status')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .single();

    if (fetchError || !existing) {
      return createCorsResponse({ success: false, message: 'Appointment not found' }, 404, req);
    }
    if (existing.status === 'completed') {
      return createCorsResponse(
        { success: false, message: 'Cannot cancel completed appointment' },
        400,
        req,
      );
    }

    const { data: cancelled, error: cancelError } = await admin
      .from('customer_maintenance_appointments')
      .update({
        status: 'cancelled',
        reschedule_reason: body?.reason || 'Cancelled by customer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (cancelError || !cancelled) {
      console.error('Error cancelling appointment:', cancelError);
      return createCorsResponse(
        { success: false, message: 'Failed to cancel appointment' },
        500,
        req,
      );
    }

    return createCorsResponse(
      {
        success: true,
        data: mapAppointmentRow(cancelled),
        message: 'Appointment cancelled successfully',
      },
      200,
      req,
    );
  }

  return createCorsResponse({ error: 'Method not allowed' }, 405, req);
}
