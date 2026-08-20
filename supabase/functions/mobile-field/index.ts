// Mobile Field Edge Function
// Handles mobile field service operations for technicians
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
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
    // /mobile-field, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'mobile-field');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // GET /mobile-field/my-tickets - Get technician's assigned tickets
    if (req.method === 'GET' && endpoint === 'my-tickets') {
      const status = url.searchParams.get('status');

      let query = admin
        .from('service_tickets')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            primary_contact_name,
            primary_contact_phone
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      } else {
        query = query.in('status', ['assigned', 'en_route', 'on_site', 'in_progress']);
      }

      const { data: tickets, error } = await query;

      if (error) {
        console.error('Error fetching technician tickets:', error);
        return createCorsResponse({ error: 'Failed to fetch tickets' }, 500, req);
      }

      return createCorsResponse(tickets || [], 200, req);
    }

    // GET /mobile-field/today - Get today's schedule
    if (req.method === 'GET' && endpoint === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: tickets } = await admin
        .from('service_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .gte('scheduled_date', todayStart.toISOString())
        .lte('scheduled_date', todayEnd.toISOString())
        .order('scheduled_date', { ascending: true });

      return createCorsResponse(
        {
          date: todayStart.toISOString().split('T')[0],
          tickets: tickets || [],
          count: tickets?.length || 0,
        },
        200,
        req,
      );
    }

    // POST /mobile-field/check-in - Check in at customer location
    //
    // service_tickets carries no check_in_time or check_in_location, so writing
    // them made every check-in a 42703 — a technician arriving on site could not
    // record it at all. mobile_service_sessions is the table built for this
    // (check_in_latitude/longitude/address/timestamp, hours, status), with
    // time_tracking_entries logging the arrival/departure events against it.
    if (req.method === 'POST' && endpoint === 'check-in') {
      const body = await req.json();
      const { ticketId, latitude, longitude, address } = body;
      const checkedInAt = new Date().toISOString();

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update({
          status: 'on_site',
          updated_at: checkedInAt,
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to check in' }, 500, req);
      }

      const { data: session, error: sessionError } = await admin
        .from('mobile_service_sessions')
        .insert({
          tenant_id: tenantId,
          service_ticket_id: ticketId,
          technician_id: user.id,
          check_in_latitude: latitude ?? null,
          check_in_longitude: longitude ?? null,
          check_in_address: address ?? null,
          check_in_timestamp: checkedInAt,
          status: 'checked_in',
          created_at: checkedInAt,
          updated_at: checkedInAt,
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error opening mobile service session:', sessionError);
      } else if (session?.id) {
        // 'arrival' is a check_in_type enum value; the enum is
        // arrival|departure|break_start|break_end.
        await admin.from('time_tracking_entries').insert({
          tenant_id: tenantId,
          session_id: session.id,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          address: address ?? null,
          check_in_type: 'arrival',
          timestamp: checkedInAt,
          created_at: checkedInAt,
        });
      }

      return createCorsResponse(
        {
          success: true,
          ticket,
          sessionId: session?.id ?? null,
          checkedInAt,
        },
        200,
        req,
      );
    }

    // POST /mobile-field/check-out - Check out from customer location
    if (req.method === 'POST' && endpoint === 'check-out') {
      const body = await req.json();
      const { ticketId, latitude, longitude, notes, partsUsed, laborHours } = body;

      const checkedOutAt = new Date().toISOString();

      // Same as check-in: check_out_time and check_out_location are not columns
      // on service_tickets. Everything else here is real (resolution_notes,
      // parts_used, labor_hours, resolved_at), so only the two GPS fields move
      // to the session row.
      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update({
          status: 'completed',
          resolution_notes: notes,
          parts_used: partsUsed || [],
          labor_hours: laborHours,
          resolved_at: checkedOutAt,
          updated_at: checkedOutAt,
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to check out' }, 500, req);
      }

      // Close the session this ticket's check-in opened.
      const { data: openSession } = await admin
        .from('mobile_service_sessions')
        .select('id, check_in_timestamp')
        .eq('tenant_id', tenantId)
        .eq('service_ticket_id', ticketId)
        .eq('technician_id', user.id)
        .is('check_out_timestamp', null)
        .order('check_in_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession?.id) {
        const startedAt = openSession.check_in_timestamp
          ? new Date(openSession.check_in_timestamp as string).getTime()
          : null;
        const totalHours = startedAt
          ? Math.round(((new Date(checkedOutAt).getTime() - startedAt) / 3_600_000) * 100) / 100
          : null;

        await admin
          .from('mobile_service_sessions')
          .update({
            check_out_latitude: latitude ?? null,
            check_out_longitude: longitude ?? null,
            check_out_timestamp: checkedOutAt,
            total_hours: totalHours,
            working_hours: laborHours ?? totalHours,
            service_notes: notes ?? null,
            status: 'completed',
            updated_at: checkedOutAt,
          })
          .eq('id', openSession.id)
          .eq('tenant_id', tenantId);

        await admin.from('time_tracking_entries').insert({
          tenant_id: tenantId,
          session_id: openSession.id,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          check_in_type: 'departure',
          timestamp: checkedOutAt,
          created_at: checkedOutAt,
        });
      }

      return createCorsResponse(
        {
          success: true,
          ticket,
          sessionId: openSession?.id ?? null,
          checkedOutAt,
        },
        200,
        req,
      );
    }

    // POST /mobile-field/update-status - Update ticket status
    if (req.method === 'POST' && endpoint === 'update-status') {
      const body = await req.json();
      const { ticketId, status, notes } = body;

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update({
          status,
          work_order_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update status' }, 500, req);
      }

      return createCorsResponse(ticket, 200, req);
    }

    // POST /mobile-field/add-note - Add note to ticket
    if (req.method === 'POST' && endpoint === 'add-note') {
      const body = await req.json();
      const { ticketId, note, isInternal } = body;

      const { data: ticketNote, error } = await admin
        .from('ticket_notes')
        .insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          content: note,
          is_internal: isInternal || false,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding note:', error);
        return createCorsResponse({ error: 'Failed to add note' }, 500, req);
      }

      return createCorsResponse(ticketNote, 201, req);
    }

    // POST /mobile-field/log-time - Log time entry
    if (req.method === 'POST' && endpoint === 'log-time') {
      const body = await req.json();
      const { ticketId, hours, description, activityType } = body;

      // time_entries is the PROJECT time tracker: task_id, user_id, description,
      // hours, entry_date, started_at, is_running. It has no ticket_id and no
      // activity_type, so this insert was a 42703 and no field time was ever
      // logged. Ticket time is not a spelling difference away — it lives on the
      // visit, as mobile_service_sessions.working_hours (set at check-out) — so
      // this refuses and says where the hours belong rather than filing the
      // entry against a task id it does not have.
      void hours;
      void description;
      void activityType;
      return createCorsResponse(
        {
          error: 'Ticket time is not logged through time_entries',
          code: 'TIME_ENTRIES_ARE_TASK_SCOPED',
          details:
            'time_entries links to task_id, not to a service ticket, and has no activity_type. ' +
            'Hours for a ticket visit are recorded on mobile_service_sessions (working_hours, ' +
            'set by /mobile-field/check-out) for ticket ' +
            String(ticketId) +
            '.',
        },
        501,
        req,
      );
    }

    // GET /mobile-field/parts-inventory - Get available parts
    if (req.method === 'GET' && endpoint === 'parts-inventory') {
      const search = url.searchParams.get('search');

      let query = admin
        .from('inventory')
        .select('id, name, sku, quantity, location')
        .eq('tenant_id', tenantId)
        .gt('quantity', 0);

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data: parts } = await query.limit(50);

      return createCorsResponse(parts || [], 200, req);
    }

    // POST /mobile-field/request-parts - Request parts for a ticket
    if (req.method === 'POST' && endpoint === 'request-parts') {
      const body = await req.json();
      const { ticketId, parts } = body;

      const { data: request, error } = await admin
        .from('parts_requests')
        .insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          requested_by: user.id,
          parts: parts,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to request parts' }, 500, req);
      }

      return createCorsResponse(request, 201, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in mobile-field function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
