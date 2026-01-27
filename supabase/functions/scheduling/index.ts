// Scheduling Edge Function
// Handles appointment and resource scheduling
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
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

    // GET /scheduling/appointments - List appointments
    if (req.method === 'GET' && endpoint === 'appointments' && !resourceId) {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const technicianId = url.searchParams.get('technicianId');
      const customerId = url.searchParams.get('customerId');
      const status = url.searchParams.get('status');

      let query = admin
        .from('appointments')
        .select(
          `
          *,
          customer:customer_id (id, company_name),
          technician:technician_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: true });

      if (startDate) query = query.gte('start_time', startDate);
      if (endDate) query = query.lte('start_time', endDate);
      if (technicianId) query = query.eq('technician_id', technicianId);
      if (customerId) query = query.eq('customer_id', customerId);
      if (status) query = query.eq('status', status);

      const { data: appointments, error } = await query;

      if (error) {
        console.error('Error fetching appointments:', error);
        return createCorsResponse({ error: 'Failed to fetch appointments' }, 500, req);
      }

      return createCorsResponse(appointments || [], 200, req);
    }

    // GET /scheduling/appointments/:id - Get single appointment
    if (req.method === 'GET' && endpoint === 'appointments' && resourceId) {
      const { data: appointment, error } = await admin
        .from('appointments')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Appointment not found' }, 404, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // POST /scheduling/appointments - Create appointment
    if (req.method === 'POST' && endpoint === 'appointments') {
      const body = await req.json();

      const appointmentData = {
        tenant_id: tenantId,
        title: body.title,
        description: body.description,
        customer_id: body.customerId || body.customer_id,
        contact_id: body.contactId || body.contact_id,
        technician_id: body.technicianId || body.technician_id,
        equipment_id: body.equipmentId || body.equipment_id,
        work_order_id: body.workOrderId || body.work_order_id,
        appointment_type: body.appointmentType || body.appointment_type || 'service',
        start_time: body.startTime || body.start_time,
        end_time: body.endTime || body.end_time,
        duration_minutes: body.durationMinutes || body.duration_minutes || 60,
        location: body.location,
        status: body.status || 'scheduled',
        notes: body.notes,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: appointment, error } = await admin
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating appointment:', error);
        return createCorsResponse({ error: 'Failed to create appointment' }, 500, req);
      }

      return createCorsResponse(appointment, 201, req);
    }

    // PUT /scheduling/appointments/:id - Update appointment
    if (req.method === 'PUT' && endpoint === 'appointments' && resourceId) {
      const body = await req.json();

      const { data: appointment, error } = await admin
        .from('appointments')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update appointment' }, 500, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // GET /scheduling/availability - Check technician availability
    if (req.method === 'GET' && endpoint === 'availability') {
      const technicianId = url.searchParams.get('technicianId');
      const date = url.searchParams.get('date');

      if (!date) {
        return createCorsResponse({ error: 'Date is required' }, 400, req);
      }

      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      let query = admin
        .from('appointments')
        .select('start_time, end_time, technician_id')
        .eq('tenant_id', tenantId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .in('status', ['scheduled', 'confirmed', 'in_progress']);

      if (technicianId) {
        query = query.eq('technician_id', technicianId);
      }

      const { data: appointments } = await query;

      // Generate available time slots (simplified)
      const workStart = 8; // 8 AM
      const workEnd = 17; // 5 PM
      const slotDuration = 60; // 60 minutes

      const slots: any[] = [];
      for (let hour = workStart; hour < workEnd; hour++) {
        const slotStart = `${date}T${hour.toString().padStart(2, '0')}:00:00`;
        const slotEnd = `${date}T${(hour + 1).toString().padStart(2, '0')}:00:00`;

        const isBooked = (appointments || []).some((appt: any) => {
          const apptStart = new Date(appt.start_time);
          const apptEnd = new Date(appt.end_time);
          const checkStart = new Date(slotStart);
          const checkEnd = new Date(slotEnd);
          return checkStart < apptEnd && checkEnd > apptStart;
        });

        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          available: !isBooked,
        });
      }

      return createCorsResponse(
        {
          date,
          technicianId,
          slots,
        },
        200,
        req,
      );
    }

    // GET /scheduling/calendar - Get calendar view data
    if (req.method === 'GET' && endpoint === 'calendar') {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const view = url.searchParams.get('view') || 'week';

      let query = admin
        .from('appointments')
        .select(
          `
          id,
          title,
          start_time,
          end_time,
          status,
          technician_id,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: true });

      if (startDate) query = query.gte('start_time', startDate);
      if (endDate) query = query.lte('start_time', endDate);

      const { data: appointments } = await query;

      // Format for calendar display
      const events = (appointments || []).map((appt: any) => ({
        id: appt.id,
        title: appt.title || appt.customer?.company_name || 'Appointment',
        start: appt.start_time,
        end: appt.end_time,
        resourceId: appt.technician_id,
        status: appt.status,
      }));

      return createCorsResponse(
        {
          events,
          view,
        },
        200,
        req,
      );
    }

    // POST /scheduling/appointments/:id/confirm - Confirm appointment
    if (req.method === 'POST' && endpoint === 'appointments' && resourceId === 'confirm') {
      const body = await req.json();
      const appointmentId = body.appointmentId || pathParts[2];

      const { data: appointment, error } = await admin
        .from('appointments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to confirm appointment' }, 500, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // POST /scheduling/appointments/:id/cancel - Cancel appointment
    if (req.method === 'POST' && endpoint === 'appointments' && resourceId === 'cancel') {
      const body = await req.json();
      const appointmentId = body.appointmentId || pathParts[2];

      const { data: appointment, error } = await admin
        .from('appointments')
        .update({
          status: 'cancelled',
          cancellation_reason: body.reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to cancel appointment' }, 500, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // DELETE /scheduling/appointments/:id - Delete appointment
    if (req.method === 'DELETE' && endpoint === 'appointments' && resourceId) {
      const { error } = await admin
        .from('appointments')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete appointment' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Appointment deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in scheduling function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
