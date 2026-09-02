// Service Tickets Edge Function
// Handles service ticket CRUD and dispatch operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { enrichTickets } from './_enrich.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';

// Helper: Batch-enrich records with customer names from business_records
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

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'service-tickets');
    const ticketId = parts[0]; // /service-tickets/:id
    const subResource = parts[1]; // /service-tickets/:id/updates

    // GET /service-tickets/stats - status/priority counts across ALL tickets
    // (not just the current page) for the dashboard stat cards.
    if (req.method === 'GET' && ticketId === 'stats') {
      const base = () =>
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
      // WF-V-01: BOTH spellings, because service_tickets.status has two
      // vocabularies in this repo and picking one silently zeroes a card. The
      // schema comment says `in-progress` and Express counted that; the demo
      // seeder writes `in_progress` and this function counted that; `completed`
      // was resolved to Express and not here. A superset cannot under-count, and
      // under-counting is the failure that looks like real data. Which spelling
      // is canonical is a separate question - see the WF-V-01 note.
      const [total, open, inProgress, urgent, resolved] = await Promise.all([
        base(),
        base().eq('status', 'open'),
        base().in('status', ['in_progress', 'in-progress']),
        base().in('priority', ['urgent', 'critical']),
        base().in('status', ['resolved', 'closed', 'completed']),
      ]);
      return createCorsResponse(
        {
          total: total.count || 0,
          open: open.count || 0,
          in_progress: inProgress.count || 0,
          urgent: urgent.count || 0,
          resolved: resolved.count || 0,
        },
        200,
        req,
      );
    }

    // GET /service-tickets - List all tickets with filters
    if (req.method === 'GET' && !ticketId) {
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const technicianId =
        url.searchParams.get('technicianId') || url.searchParams.get('technician_id');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('service_tickets')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // WF-R-04: a technician's queue is their own tickets, not the tenant's.
      // Unassigned tickets stay visible above `own` scope - a dispatch queue that
      // hides the work nobody has picked up yet is worse than no filter at all.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, ['assigned_technician_id', 'created_by'], scope);

      if (status) {
        query = query.eq('status', status);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (technicianId) {
        query = query.eq('assigned_technician_id', technicianId);
      }

      if (search) {
        query = query.or(
          `ticket_number.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const { data: tickets, error, count } = await query;

      if (error) {
        console.error('Error fetching service tickets:', error);
        return createCorsResponse({ error: 'Failed to fetch service tickets' }, 500, req);
      }

      // WF-V-01: the machine and the technician, not just the customer.
      const enriched = await enrichTickets(admin, tenantId, tickets || []);
      return createCorsResponse({ data: enriched, total: count || 0 }, 200, req);
    }

    // GET /service-tickets/:id/updates - Get ticket timeline/updates
    if (req.method === 'GET' && ticketId && subResource === 'updates') {
      const { data: updates, error } = await admin
        .from('service_ticket_updates')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ticket updates:', error);
        return createCorsResponse({ error: 'Failed to fetch ticket updates' }, 500, req);
      }

      // Enrich updates with user info
      if (updates && updates.length > 0) {
        const userIds = [...new Set(updates.map((u: any) => u.updated_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: users } = await admin
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', userIds);
          const userMap = new Map((users || []).map((u: any) => [u.id, u]));
          const enrichedUpdates = updates.map((u: any) => ({
            ...u,
            user: userMap.get(u.updated_by) || null,
          }));
          return createCorsResponse(enrichedUpdates, 200, req);
        }
      }

      return createCorsResponse(updates || [], 200, req);
    }

    // GET /service-tickets/:id - Get single ticket
    if (req.method === 'GET' && ticketId) {
      const { data: ticket, error } = await admin
        .from('service_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching service ticket:', error);
        return createCorsResponse({ error: 'Service ticket not found' }, 404, req);
      }

      // Also fetch ticket updates
      const { data: updates } = await admin
        .from('service_ticket_updates')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // WF-V-01: the same three joins as the list, so a ticket does not gain or
      // lose fields depending on which screen opened it.
      const [enrichedTicket] = await enrichTickets(admin, tenantId, [ticket]);

      return createCorsResponse({ ...enrichedTicket, updates: updates || [] }, 200, req);
    }

    // POST /service-tickets - Create new ticket
    if (req.method === 'POST' && !ticketId) {
      const body = await req.json();

      // Generate ticket number if not provided
      const ticketNumber = body.ticketNumber || body.ticket_number || `TKT-${Date.now()}`;

      const ticketData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        equipment_id: body.equipmentId || body.equipment_id || null,
        ticket_number: ticketNumber,
        title: body.title,
        description: body.description || null,
        priority: body.priority || 'medium',
        status: body.status || 'open',
        assigned_technician_id: body.assignedTechnicianId || body.assigned_technician_id || null,
        scheduled_date: body.scheduledDate || body.scheduled_date || null,
        estimated_duration: body.estimatedDuration || body.estimated_duration || null,
        customer_address: body.customerAddress || body.customer_address || null,
        customer_phone: body.customerPhone || body.customer_phone || null,
        required_skills: body.requiredSkills || body.required_skills || null,
        required_parts: body.requiredParts || body.required_parts || null,
        work_order_notes: body.workOrderNotes || body.work_order_notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        console.error('Error creating service ticket:', error);
        return createCorsResponse(
          { error: 'Failed to create service ticket', details: error },
          500,
          req,
        );
      }

      // Create initial update entry
      await admin.from('service_ticket_updates').insert({
        tenant_id: tenantId,
        ticket_id: ticket.id,
        update_type: 'status_change',
        new_value: 'open',
        notes: 'Ticket created',
        updated_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(ticket, 201, req);
    }

    // POST /service-tickets/:id/updates - Add update to ticket
    if (req.method === 'POST' && ticketId && subResource === 'updates') {
      const body = await req.json();

      const updateData = {
        tenant_id: tenantId,
        ticket_id: ticketId,
        update_type: body.updateType || body.update_type || 'note',
        old_value: body.oldValue || body.old_value || null,
        new_value: body.newValue || body.new_value || null,
        notes: body.notes || null,
        updated_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { data: update, error } = await admin
        .from('service_ticket_updates')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket update:', error);
        return createCorsResponse({ error: 'Failed to create ticket update' }, 500, req);
      }

      // Update the ticket's updated_at timestamp
      await admin
        .from('service_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(update, 201, req);
    }

    // PATCH /service-tickets/:id - Update ticket
    if ((req.method === 'PATCH' || req.method === 'PUT') && ticketId && !subResource) {
      const body = await req.json();

      // Fetch current ticket for comparison
      const { data: currentTicket } = await admin
        .from('service_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map camelCase to snake_case and track changes
      const fieldMap: Record<string, string> = {
        customerId: 'customer_id',
        equipmentId: 'equipment_id',
        ticketNumber: 'ticket_number',
        title: 'title',
        description: 'description',
        priority: 'priority',
        status: 'status',
        assignedTechnicianId: 'assigned_technician_id',
        scheduledDate: 'scheduled_date',
        estimatedDuration: 'estimated_duration',
        customerAddress: 'customer_address',
        customerPhone: 'customer_phone',
        requiredSkills: 'required_skills',
        requiredParts: 'required_parts',
        workOrderNotes: 'work_order_notes',
        resolutionNotes: 'resolution_notes',
        customerSignature: 'customer_signature',
        partsUsed: 'parts_used',
        laborHours: 'labor_hours',
      };

      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          const newValue = body[camelKey] || body[snakeKey];
          updateData[snakeKey] = newValue;

          if (currentTicket && currentTicket[snakeKey] !== newValue) {
            changes.push({
              field: snakeKey,
              oldValue: currentTicket[snakeKey],
              newValue,
            });
          }
        }
      }

      // If status is completed, set resolved_at
      if (updateData.status === 'completed' && !currentTicket?.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating service ticket:', error);
        return createCorsResponse({ error: 'Failed to update service ticket' }, 500, req);
      }

      // Create update entries for significant changes
      for (const change of changes) {
        if (['status', 'assigned_technician_id', 'priority'].includes(change.field)) {
          await admin.from('service_ticket_updates').insert({
            tenant_id: tenantId,
            ticket_id: ticketId,
            update_type: change.field === 'status' ? 'status_change' : 'assignment',
            old_value: String(change.oldValue || ''),
            new_value: String(change.newValue || ''),
            notes: `${change.field} updated`,
            updated_by: user.id,
            created_at: new Date().toISOString(),
          });
        }
      }

      return createCorsResponse(ticket, 200, req);
    }

    // DELETE /service-tickets/:id - Delete ticket
    if (req.method === 'DELETE' && ticketId) {
      // First delete related updates
      await admin
        .from('service_ticket_updates')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId);

      // Then delete the ticket
      const { error } = await admin
        .from('service_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting service ticket:', error);
        return createCorsResponse({ error: 'Failed to delete service ticket' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Service ticket deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in service-tickets function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
