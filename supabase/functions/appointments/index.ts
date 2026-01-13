// Appointments Edge Function
// Handles service appointments and scheduling
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
    const appointmentId = pathParts[1];

    // GET /appointments - List appointments
    if (req.method === 'GET' && !appointmentId) {
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const technicianId =
        url.searchParams.get('technicianId') || url.searchParams.get('technician_id');
      const status = url.searchParams.get('status');
      const startDate = url.searchParams.get('startDate') || url.searchParams.get('start_date');
      const endDate = url.searchParams.get('endDate') || url.searchParams.get('end_date');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('service_appointments')
        .select(
          `
          *,
          customer:business_records!service_appointments_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_phone, address_line1, city, state),
          technician:users!service_appointments_technician_id_fkey(id, first_name, last_name, email, phone)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('scheduled_date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (technicianId) {
        query = query.eq('technician_id', technicianId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('scheduled_date', startDate);
      }

      if (endDate) {
        query = query.lte('scheduled_date', endDate);
      }

      const { data: appointments, error, count } = await query;

      if (error) {
        console.error('Error fetching appointments:', error);
        return createCorsResponse({ error: 'Failed to fetch appointments' }, 500, req);
      }

      return createCorsResponse(
        {
          data: appointments || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /appointments/:id - Get single appointment
    if (req.method === 'GET' && appointmentId) {
      const { data: appointment, error } = await admin
        .from('service_appointments')
        .select(
          `
          *,
          customer:business_records!service_appointments_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_phone, primary_contact_email, address_line1, address_line2, city, state, postal_code),
          technician:users!service_appointments_technician_id_fkey(id, first_name, last_name, email, phone),
          equipment:equipment(id, serial_number, model_number, manufacturer)
        `,
        )
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching appointment:', error);
        return createCorsResponse({ error: 'Appointment not found' }, 404, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // POST /appointments - Create appointment
    if (req.method === 'POST') {
      const body = await req.json();

      const appointmentData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        equipment_id: body.equipmentId || body.equipment_id || null,
        technician_id: body.technicianId || body.technician_id || null,
        scheduled_date: body.scheduledDate || body.scheduled_date,
        scheduled_time: body.scheduledTime || body.scheduled_time || null,
        duration_minutes: body.durationMinutes || body.duration_minutes || 60,
        appointment_type: body.appointmentType || body.appointment_type || 'service',
        status: body.status || 'scheduled',
        priority: body.priority || 'normal',
        description: body.description || null,
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: appointment, error } = await admin
        .from('service_appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating appointment:', error);
        return createCorsResponse(
          { error: 'Failed to create appointment', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(appointment, 201, req);
    }

    // PATCH /appointments/:id - Update appointment
    if ((req.method === 'PATCH' || req.method === 'PUT') && appointmentId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        technicianId: 'technician_id',
        scheduledDate: 'scheduled_date',
        scheduledTime: 'scheduled_time',
        durationMinutes: 'duration_minutes',
        appointmentType: 'appointment_type',
        status: 'status',
        priority: 'priority',
        description: 'description',
        notes: 'notes',
        completedAt: 'completed_at',
        cancelledAt: 'cancelled_at',
        cancellationReason: 'cancellation_reason',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: appointment, error } = await admin
        .from('service_appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating appointment:', error);
        return createCorsResponse({ error: 'Failed to update appointment' }, 500, req);
      }

      return createCorsResponse(appointment, 200, req);
    }

    // DELETE /appointments/:id - Delete appointment
    if (req.method === 'DELETE' && appointmentId) {
      const { error } = await admin
        .from('service_appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting appointment:', error);
        return createCorsResponse({ error: 'Failed to delete appointment' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Appointment deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in appointments function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
