// Technicians Edge Function
// Handles field service technician management, availability, and performance
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
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const technicianId = pathParts[1];
    const subResource = pathParts[2]; // 'availability', 'performance', 'dashboard'

    // GET /technicians - List technicians
    if (req.method === 'GET' && !technicianId) {
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
      const skillSet = url.searchParams.get('skillSet') || url.searchParams.get('skill_set');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('technicians')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('first_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('employment_status', status);
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }

      if (skillSet) {
        query = query.contains('skill_set', [skillSet]);
      }

      const { data: technicians, error, count } = await query;

      if (error) {
        console.error('Error fetching technicians:', error);
        return createCorsResponse({ error: 'Failed to fetch technicians' }, 500, req);
      }

      return createCorsResponse(
        {
          data: technicians || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /technicians/:id - Get single technician
    if (req.method === 'GET' && technicianId && !subResource) {
      const { data: technician, error } = await admin
        .from('technicians')
        .select('*')
        .eq('id', technicianId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching technician:', error);
        return createCorsResponse({ error: 'Technician not found' }, 404, req);
      }

      return createCorsResponse(technician, 200, req);
    }

    // GET /technicians/:id/availability - Get technician availability
    if (req.method === 'GET' && technicianId && subResource === 'availability') {
      const startDate = url.searchParams.get('startDate') || url.searchParams.get('start_date');
      const endDate = url.searchParams.get('endDate') || url.searchParams.get('end_date');

      let query = admin
        .from('technician_availability')
        .select('*')
        .eq('technician_id', technicianId)
        .eq('tenant_id', tenantId)
        .order('date', { ascending: true });

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: availability, error } = await query;

      if (error) {
        console.error('Error fetching technician availability:', error);
        return createCorsResponse({ error: 'Failed to fetch availability' }, 500, req);
      }

      return createCorsResponse(availability || [], 200, req);
    }

    // GET /technicians/:id/performance - Get technician performance metrics
    if (req.method === 'GET' && technicianId && subResource === 'performance') {
      // Fetch service tickets assigned to this technician
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('id, status, priority, created_at, completed_at, first_response_time')
        .eq('assigned_technician_id', technicianId)
        .eq('tenant_id', tenantId);

      const totalTickets = tickets?.length || 0;
      const completedTickets = tickets?.filter((t) => t.status === 'completed').length || 0;
      const avgResponseTime =
        tickets
          ?.filter((t) => t.first_response_time)
          .reduce((sum, t) => sum + (t.first_response_time || 0), 0) / (tickets?.length || 1) || 0;

      return createCorsResponse(
        {
          technicianId,
          totalTickets,
          completedTickets,
          completionRate: totalTickets > 0 ? (completedTickets / totalTickets) * 100 : 0,
          avgResponseTime,
          periodStart: url.searchParams.get('startDate') || null,
          periodEnd: url.searchParams.get('endDate') || null,
        },
        200,
        req,
      );
    }

    // GET /technicians/:id/dashboard - Get technician dashboard statistics
    if (req.method === 'GET' && technicianId && subResource === 'dashboard') {
      const today = new Date().toISOString().split('T')[0];

      const [tickets, availability] = await Promise.all([
        admin
          .from('service_tickets')
          .select('id, status, priority')
          .eq('assigned_technician_id', technicianId)
          .eq('tenant_id', tenantId)
          .in('status', ['assigned', 'in_progress', 'on_hold']),
        admin
          .from('technician_availability')
          .select('*')
          .eq('technician_id', technicianId)
          .eq('tenant_id', tenantId)
          .gte('date', today)
          .lte('date', today)
          .single(),
      ]);

      return createCorsResponse(
        {
          activeTickets: tickets.data || [],
          todayAvailability: availability.data || null,
          summary: {
            totalActive: tickets.data?.length || 0,
            highPriority: tickets.data?.filter((t) => t.priority === 'high').length || 0,
          },
        },
        200,
        req,
      );
    }

    // POST /technicians - Create technician
    if (req.method === 'POST' && !technicianId) {
      const body = await req.json();

      const technicianData = {
        tenant_id: tenantId,
        user_id: body.user_id || body.user_id || null,
        first_name: body.firstName || body.first_name,
        last_name: body.lastName || body.last_name,
        email: body.email,
        phone: body.phone || null,
        skill_set: body.skillSet || body.skill_set || [],
        certification_level: body.certificationLevel || body.certification_level || null,
        employment_status: body.employmentStatus || body.employment_status || 'active',
        hire_date: body.hireDate || body.hire_date || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: technician, error } = await admin
        .from('technicians')
        .insert(technicianData)
        .select()
        .single();

      if (error) {
        console.error('Error creating technician:', error);
        return createCorsResponse(
          { error: 'Failed to create technician', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(technician, 201, req);
    }

    // POST /technicians/:id/availability - Add availability
    if (req.method === 'POST' && technicianId && subResource === 'availability') {
      const body = await req.json();

      const availabilityData = {
        tenant_id: tenantId,
        technician_id: technicianId,
        date: body.date,
        start_time: body.startTime || body.start_time,
        end_time: body.endTime || body.end_time,
        is_available:
          body.isAvailable !== undefined
            ? body.isAvailable
            : body.is_available !== undefined
              ? body.is_available
              : true,
        notes: body.notes || null,
      };

      const { data: availability, error } = await admin
        .from('technician_availability')
        .insert(availabilityData)
        .select()
        .single();

      if (error) {
        console.error('Error creating availability:', error);
        return createCorsResponse({ error: 'Failed to create availability' }, 500, req);
      }

      return createCorsResponse(availability, 201, req);
    }

    // PATCH /technicians/:id - Update technician
    if ((req.method === 'PATCH' || req.method === 'PUT') && technicianId && !subResource) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        phone: 'phone',
        skillSet: 'skill_set',
        certificationLevel: 'certification_level',
        employmentStatus: 'employment_status',
        hireDate: 'hire_date',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: technician, error } = await admin
        .from('technicians')
        .update(updateData)
        .eq('id', technicianId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating technician:', error);
        return createCorsResponse({ error: 'Failed to update technician' }, 500, req);
      }

      return createCorsResponse(technician, 200, req);
    }

    // DELETE /technicians/:id - Delete technician
    if (req.method === 'DELETE' && technicianId && !subResource) {
      const { error } = await admin
        .from('technicians')
        .delete()
        .eq('id', technicianId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting technician:', error);
        return createCorsResponse({ error: 'Failed to delete technician' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Technician deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid technician endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in technicians function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
