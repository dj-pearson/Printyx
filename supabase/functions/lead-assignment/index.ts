// Lead Assignment Edge Function
// Handles lead assignment rules, rep capacity, and assignment queue
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
    const resource = pathParts[1]; // rules, capacity, history, queue
    const resourceId = pathParts[2];
    const subResource = pathParts[3];

    // GET /lead-assignment/rules - List assignment rules
    if (req.method === 'GET' && resource === 'rules' && !resourceId) {
      const { data: rules, error } = await admin
        .from('lead_assignment_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /lead-assignment/rules/:id - Get single rule
    if (req.method === 'GET' && resource === 'rules' && resourceId) {
      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /lead-assignment/rules - Create assignment rule
    if (req.method === 'POST' && resource === 'rules') {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          conditions: body.conditions || {},
          assignment_type: body.assignmentType || body.assignment_type || 'round_robin',
          assigned_users: body.assignedUsers || body.assigned_users || [],
          priority: body.priority || 0,
          is_active: body.isActive !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create assignment rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /lead-assignment/rules/:id - Update assignment rule
    if (req.method === 'PUT' && resource === 'rules' && resourceId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .update({
          name: body.name,
          description: body.description,
          conditions: body.conditions,
          assignment_type: body.assignmentType || body.assignment_type,
          assigned_users: body.assignedUsers || body.assigned_users,
          priority: body.priority,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update assignment rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // DELETE /lead-assignment/rules/:id - Delete assignment rule
    if (req.method === 'DELETE' && resource === 'rules' && resourceId) {
      const { error } = await admin
        .from('lead_assignment_rules')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete assignment rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Assignment rule deleted' }, 200, req);
    }

    // GET /lead-assignment/capacity - List rep capacity
    if (req.method === 'GET' && resource === 'capacity' && !resourceId) {
      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .select(
          `
          *,
          user:user_id (id, full_name, email)
        `,
        )
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch rep capacity' }, 500, req);
      }

      return createCorsResponse(capacity || [], 200, req);
    }

    // GET /lead-assignment/capacity/:userId - Get rep capacity
    if (req.method === 'GET' && resource === 'capacity' && resourceId) {
      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .select('*')
        .eq('user_id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Rep capacity not found' }, 404, req);
      }

      return createCorsResponse(capacity, 200, req);
    }

    // POST /lead-assignment/capacity - Create/update rep capacity
    if (req.method === 'POST' && resource === 'capacity') {
      const body = await req.json();

      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .upsert({
          tenant_id: tenantId,
          user_id: body.userId || body.user_id,
          max_leads: body.maxLeads || body.max_leads || 50,
          current_leads: body.currentLeads || body.current_leads || 0,
          is_available: body.isAvailable !== false,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rep capacity' }, 500, req);
      }

      return createCorsResponse(capacity, 200, req);
    }

    // PATCH /lead-assignment/capacity/:userId/availability - Update availability
    if (
      req.method === 'PATCH' &&
      resource === 'capacity' &&
      resourceId &&
      subResource === 'availability'
    ) {
      const body = await req.json();

      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .update({
          is_available: body.isAvailable ?? body.is_available,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update availability' }, 500, req);
      }

      return createCorsResponse(capacity, 200, req);
    }

    // GET /lead-assignment/history/:leadId - Get assignment history for lead
    if (req.method === 'GET' && resource === 'history' && resourceId) {
      const { data: history, error } = await admin
        .from('lead_assignment_history')
        .select(
          `
          *,
          assigned_to:assigned_to_id (id, full_name),
          assigned_by:assigned_by_id (id, full_name)
        `,
        )
        .eq('lead_id', resourceId)
        .eq('tenant_id', tenantId)
        .order('assigned_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment history' }, 500, req);
      }

      return createCorsResponse(history || [], 200, req);
    }

    // POST /lead-assignment/history - Record assignment
    if (req.method === 'POST' && resource === 'history') {
      const body = await req.json();

      const { data: history, error } = await admin
        .from('lead_assignment_history')
        .insert({
          tenant_id: tenantId,
          lead_id: body.leadId || body.lead_id,
          assigned_to_id: body.assignedToId || body.assigned_to_id,
          assigned_by_id: body.assignedById || body.assigned_by_id || user.id,
          assignment_reason: body.reason || body.assignment_reason,
          rule_id: body.ruleId || body.rule_id,
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record assignment' }, 500, req);
      }

      return createCorsResponse(history, 201, req);
    }

    // GET /lead-assignment/queue - Get assignment queue
    if (req.method === 'GET' && resource === 'queue') {
      const status = url.searchParams.get('status') || 'pending';

      const { data: queue, error } = await admin
        .from('lead_assignment_queue')
        .select(
          `
          *,
          lead:lead_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .order('created_at', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment queue' }, 500, req);
      }

      return createCorsResponse(queue || [], 200, req);
    }

    // POST /lead-assignment/queue - Add to queue
    if (req.method === 'POST' && resource === 'queue' && !resourceId) {
      const body = await req.json();

      const { data: queueItem, error } = await admin
        .from('lead_assignment_queue')
        .insert({
          tenant_id: tenantId,
          lead_id: body.leadId || body.lead_id,
          priority: body.priority || 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add to queue' }, 500, req);
      }

      return createCorsResponse(queueItem, 201, req);
    }

    // POST /lead-assignment/queue/:id/process - Process queue item
    if (req.method === 'POST' && resource === 'queue' && resourceId && subResource === 'process') {
      const { data: queueItem, error } = await admin
        .from('lead_assignment_queue')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to process queue item' }, 500, req);
      }

      return createCorsResponse(queueItem, 200, req);
    }

    // POST /lead-assignment/assign - Manually assign lead
    if (req.method === 'POST' && resource === 'assign') {
      const body = await req.json();

      // Update lead assignment
      const { error: updateError } = await admin
        .from('leads')
        .update({
          assigned_to_id: body.assignedToId || body.assigned_to_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.leadId || body.lead_id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        return createCorsResponse({ error: 'Failed to assign lead' }, 500, req);
      }

      // Record in history
      await admin.from('lead_assignment_history').insert({
        tenant_id: tenantId,
        lead_id: body.leadId || body.lead_id,
        assigned_to_id: body.assignedToId || body.assigned_to_id,
        assigned_by_id: user.id,
        assignment_reason: body.reason || 'manual',
        assigned_at: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          success: true,
          message: 'Lead assigned successfully',
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in lead-assignment function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
