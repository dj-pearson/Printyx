// Phone-In Tickets Edge Function
// Handles phone-in ticket CRUD operations
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

    // Extract tenant ID from JWT metadata or header
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const ticketId = pathParts[1]; // /phone-in-tickets/:id
    const subResource = pathParts[2]; // /phone-in-tickets/:id/convert

    // GET /phone-in-tickets - List all phone-in tickets
    if (req.method === 'GET' && !ticketId) {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const converted = url.searchParams.get('converted');

      let query = admin
        .from('phone_in_tickets')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (converted === 'true') {
        query = query.not('converted_to_ticket_id', 'is', null);
      } else if (converted === 'false') {
        query = query.is('converted_to_ticket_id', null);
      }

      const { data: tickets, error, count } = await query;

      if (error) {
        console.error('Error fetching phone-in tickets:', error);
        return createCorsResponse({ error: 'Failed to fetch phone-in tickets' }, 500, req);
      }

      // Map snake_case to camelCase for frontend compatibility
      const mappedTickets = (tickets || []).map((t: any) => ({
        id: t.id,
        tenantId: t.tenant_id,
        callerName: t.caller_name,
        callerPhone: t.caller_phone,
        callerEmail: t.caller_email,
        callerRole: t.caller_role,
        customerId: t.customer_id,
        customerName: t.customer_name,
        locationAddress: t.location_address,
        locationBuilding: t.location_building,
        locationFloor: t.location_floor,
        locationRoom: t.location_room,
        equipmentId: t.equipment_id,
        equipmentBrand: t.equipment_brand,
        equipmentModel: t.equipment_model,
        equipmentSerial: t.equipment_serial,
        issueCategory: t.issue_category,
        issueDescription: t.issue_description,
        urgencyLevel: t.urgency_level,
        priority: t.priority || t.urgency_level || 'medium',
        contactMethod: t.contact_method,
        convertedToTicketId: t.converted_to_ticket_id,
        convertedAt: t.converted_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      return createCorsResponse(mappedTickets, 200, req);
    }

    // GET /phone-in-tickets/:id - Get single phone-in ticket
    if (req.method === 'GET' && ticketId && !subResource) {
      const { data: ticket, error } = await admin
        .from('phone_in_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching phone-in ticket:', error);
        return createCorsResponse({ error: 'Phone-in ticket not found' }, 404, req);
      }

      return createCorsResponse(ticket, 200, req);
    }

    // POST /phone-in-tickets - Create new phone-in ticket
    if (req.method === 'POST' && !ticketId) {
      const body = await req.json();

      // If customerId is provided, fetch customer info
      let customerInfo: Record<string, any> = {};
      if (body.customerId || body.customer_id) {
        const customerId = body.customerId || body.customer_id;
        const { data: customer } = await admin
          .from('business_records')
          .select(
            'id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, address_line2, city, state, postal_code',
          )
          .eq('id', customerId)
          .eq('tenant_id', tenantId)
          .single();

        if (customer) {
          const fullAddress = [
            customer.address_line1,
            customer.address_line2,
            customer.city,
            customer.state,
            customer.postal_code,
          ]
            .filter(Boolean)
            .join(', ');

          customerInfo = {
            customer_name:
              customer.company_name || customer.primary_contact_name || 'Unknown Customer',
            location_address: fullAddress || body.locationAddress || body.location_address,
            caller_name: body.callerName || body.caller_name || customer.primary_contact_name,
            caller_phone: body.callerPhone || body.caller_phone || customer.primary_contact_phone,
            caller_email: body.callerEmail || body.caller_email || customer.primary_contact_email,
          };
        }
      }

      const ticketData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id || null,
        caller_name: body.callerName || body.caller_name,
        caller_phone: body.callerPhone || body.caller_phone,
        caller_email: body.callerEmail || body.caller_email,
        caller_role: body.callerRole || body.caller_role,
        customer_name: body.customerName || body.customer_name,
        location_address: body.locationAddress || body.location_address,
        location_building: body.locationBuilding || body.location_building,
        location_floor: body.locationFloor || body.location_floor,
        location_room: body.locationRoom || body.location_room,
        equipment_id: body.equipmentId || body.equipment_id,
        equipment_brand: body.equipmentBrand || body.equipment_brand,
        equipment_model: body.equipmentModel || body.equipment_model,
        equipment_serial: body.equipmentSerial || body.equipment_serial,
        issue_category: body.issueCategory || body.issue_category || 'general',
        issue_description: body.issueDescription || body.issue_description,
        urgency_level: body.urgencyLevel || body.urgency_level || body.priority || 'medium',
        priority: body.priority || body.urgencyLevel || body.urgency_level || 'medium',
        contact_method: body.contactMethod || body.contact_method || 'phone',
        handled_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...customerInfo,
      };

      const { data: ticket, error } = await admin
        .from('phone_in_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        console.error('Error creating phone-in ticket:', error);
        return createCorsResponse(
          { error: 'Failed to create phone-in ticket', details: error },
          500,
          req,
        );
      }

      // If createServiceTicket flag is set, also create a service ticket
      if (body.createServiceTicket) {
        const ticketNumber = `TK-${Date.now()}`;
        const serviceTicketData = {
          tenant_id: tenantId,
          customer_id: ticket.customer_id || 'unknown',
          ticket_number: ticketNumber,
          title: `${(ticket.issue_category || 'General').replace('_', ' ')} - ${ticket.customer_name || 'Unknown'}`,
          description: ticket.issue_description,
          priority: ticket.priority || ticket.urgency_level || 'medium',
          status: 'new',
          customer_address: ticket.location_address,
          customer_phone: ticket.caller_phone,
          work_order_notes: `Converted from phone-in ticket ${ticket.id}`,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: serviceTicket, error: stError } = await admin
          .from('service_tickets')
          .insert(serviceTicketData)
          .select()
          .single();

        if (!stError && serviceTicket) {
          await admin
            .from('phone_in_tickets')
            .update({
              converted_to_ticket_id: serviceTicket.id,
              converted_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);

          return createCorsResponse({ phoneTicket: ticket, serviceTicket }, 201, req);
        }
      }

      return createCorsResponse({ phoneTicket: ticket }, 201, req);
    }

    // POST /phone-in-tickets/:id/convert - Convert phone-in ticket to service ticket
    if (req.method === 'POST' && ticketId && subResource === 'convert') {
      // Fetch the phone-in ticket
      const { data: phoneTicket, error: fetchError } = await admin
        .from('phone_in_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !phoneTicket) {
        return createCorsResponse({ error: 'Phone-in ticket not found' }, 404, req);
      }

      if (phoneTicket.converted_to_ticket_id) {
        return createCorsResponse({ error: 'Already converted' }, 400, req);
      }

      // Create service ticket
      const ticketNumber = `TK-${Date.now()}`;
      const serviceTicketData = {
        tenant_id: tenantId,
        customer_id: phoneTicket.customer_id || 'unknown',
        ticket_number: ticketNumber,
        title: `${(phoneTicket.issue_category || 'General').replace('_', ' ')} - ${phoneTicket.customer_name || 'Unknown'}`,
        description: phoneTicket.issue_description,
        priority: phoneTicket.priority || phoneTicket.urgency_level || 'medium',
        status: 'new',
        customer_address: phoneTicket.location_address,
        customer_phone: phoneTicket.caller_phone,
        work_order_notes: `
Phone-in ticket details:
- Caller: ${phoneTicket.caller_name || 'Unknown'} (${phoneTicket.caller_role || 'Not specified'})
- Issue Category: ${(phoneTicket.issue_category || 'General').replace('_', ' ')}
- Equipment: ${phoneTicket.equipment_brand || 'Not specified'} ${phoneTicket.equipment_model || ''}
- Location: ${phoneTicket.location_address || 'Not specified'}
        `.trim(),
        created_by: phoneTicket.handled_by || user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: serviceTicket, error: stError } = await admin
        .from('service_tickets')
        .insert(serviceTicketData)
        .select()
        .single();

      if (stError) {
        console.error('Error creating service ticket:', stError);
        return createCorsResponse({ error: 'Failed to create service ticket' }, 500, req);
      }

      // Update phone ticket with conversion info
      await admin
        .from('phone_in_tickets')
        .update({
          converted_to_ticket_id: serviceTicket.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      return createCorsResponse(
        {
          phoneTicket: { ...phoneTicket, converted_to_ticket_id: serviceTicket.id },
          serviceTicket,
        },
        200,
        req,
      );
    }

    // DELETE /phone-in-tickets/:id - Delete phone-in ticket
    if (req.method === 'DELETE' && ticketId) {
      const { error } = await admin
        .from('phone_in_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting phone-in ticket:', error);
        return createCorsResponse({ error: 'Failed to delete phone-in ticket' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Phone-in ticket deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in phone-in-tickets function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
