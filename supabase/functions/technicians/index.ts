// Technicians Edge Function
// Handles field service technician management, availability, and performance
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /technicians, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'technicians');
    const technicianId = parts[0];
    const subResource = parts[1]; // 'availability', 'performance', 'dashboard'

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

      // WF-R-07: the roster is scoped through `technicians.user_id`, the link to
      // `users`, so a supervisor sees their crew and a manager their location -
      // the same tier ladder every other list uses. A technician (level 1-2) sees
      // their own row and the contractors with no user_id, which are unowned and
      // therefore shared; the dispatch and assignment screens that need the whole
      // roster are level 3 and above, which is what makes this safe to narrow.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, 'user_id', scope);

      if (status) {
        // ?status=active|inactive maps onto the boolean the table has.
        query = query.eq('is_active', status === 'active');
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        );
      }

      if (skillSet) {
        query = query.contains('skills', [skillSet]);
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
        // service_tickets has resolved_at, and records no first-response time at
        // all - so the average below was computed over a column that does not
        // exist and was always 0.
        .select('id, status, priority, created_at, resolved_at')
        .eq('assigned_technician_id', technicianId)
        .eq('tenant_id', tenantId);

      const totalTickets = tickets?.length || 0;
      const completedTickets = tickets?.filter((t) => t.status === 'completed').length || 0;
      // AUDIT-037: this averaged first_response_time, which service_tickets does
      // not record, so it was always 0 - a figure the technician performance
      // panel printed as a response time. What the table DOES carry is
      // created_at and resolved_at, which is a resolution time, not a response
      // time; reporting one as the other would be a different wrong number.
      // So the field is null and named, and the resolution time is reported
      // under its own name.
      const resolved = tickets?.filter((t) => t.resolved_at) ?? [];
      const avgResolutionHours =
        resolved.length > 0
          ? resolved.reduce(
              (sum, t) =>
                sum +
                (new Date(t.resolved_at as string).getTime() -
                  new Date(t.created_at as string).getTime()) /
                  3_600_000,
              0,
            ) / resolved.length
          : null;

      return createCorsResponse(
        {
          technicianId,
          totalTickets,
          completedTickets,
          completionRate: totalTickets > 0 ? (completedTickets / totalTickets) * 100 : 0,
          avgResolutionHours,
          unbacked: ['avgResponseTime: service_tickets records no first-response time'],
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
        user_id: body.userId || body.user_id || null,
        first_name: body.firstName || body.first_name,
        last_name: body.lastName || body.last_name,
        email: body.email,
        phone: body.phone || null,
        // AUDIT-037: the columns are skills, certifications and is_active.
        // skill_set, certification_level, employment_status and hire_date are
        // not columns, so creating a technician 42703'd every time.
        //
        // certification_level was a single string; certifications is a list, so
        // one level becomes a one-element list rather than being dropped.
        // hire_date has no home at all and is not written - the table records
        // what a technician can do, not their employment history.
        skills: body.skillSet || body.skill_set || body.skills || [],
        certifications:
          body.certifications ??
          (body.certificationLevel || body.certification_level
            ? [body.certificationLevel || body.certification_level]
            : []),
        is_active: (body.employmentStatus || body.employment_status || 'active') === 'active',
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
        // AUDIT-037: the column is is_booked, and it is the INVERSE of what this
        // sent. So a slot posted as available would have been stored as booked
        // and vice versa - except that neither is_available nor notes is a
        // column, so the insert 42703'd and no availability was ever recorded.
        // `notes` has no home and is dropped.
        is_booked:
          body.isBooked ?? body.is_booked ?? !(body.isAvailable ?? body.is_available ?? true),
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
        skillSet: 'skills',
        skills: 'skills',
        certifications: 'certifications',
        isActive: 'is_active',
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
