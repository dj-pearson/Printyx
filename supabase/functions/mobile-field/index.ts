// Mobile Field Edge Function
// Handles mobile field service operations for technicians
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

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
    if (req.method === 'POST' && endpoint === 'check-in') {
      const body = await req.json();
      const { ticketId, latitude, longitude } = body;

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update({
          status: 'on_site',
          check_in_time: new Date().toISOString(),
          check_in_location: { latitude, longitude },
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to check in' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          ticket,
          checkedInAt: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /mobile-field/check-out - Check out from customer location
    if (req.method === 'POST' && endpoint === 'check-out') {
      const body = await req.json();
      const { ticketId, latitude, longitude, notes, partsUsed, laborHours } = body;

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update({
          status: 'completed',
          check_out_time: new Date().toISOString(),
          check_out_location: { latitude, longitude },
          resolution_notes: notes,
          parts_used: partsUsed || [],
          labor_hours: laborHours,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', user.id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to check out' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          ticket,
          checkedOutAt: new Date().toISOString(),
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

      const { data: timeEntry, error } = await admin
        .from('time_entries')
        .insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          user_id: user.id,
          hours,
          description,
          activity_type: activityType || 'service',
          entry_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging time:', error);
        return createCorsResponse({ error: 'Failed to log time' }, 500, req);
      }

      return createCorsResponse(timeEntry, 201, req);
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
