// Sales Handoffs Edge Function
// Handles sales to implementation handoff process
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
    const handoffId = pathParts[1];
    const action = pathParts[2];

    // GET /sales-handoffs - List handoffs
    if (req.method === 'GET' && !handoffId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('sales_handoffs')
        .select(
          `
          *,
          deal:deal_id (id, name, value),
          customer:customer_id (id, company_name),
          sales_rep:sales_rep_id (id, full_name),
          implementation_lead:implementation_lead_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: handoffs, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch sales handoffs' }, 500, req);
      }

      return createCorsResponse(handoffs || [], 200, req);
    }

    // GET /sales-handoffs/:id - Get single handoff
    if (req.method === 'GET' && handoffId && !action) {
      const { data: handoff, error } = await admin
        .from('sales_handoffs')
        .select(
          `
          *,
          deal:deal_id (*),
          customer:customer_id (*),
          sales_rep:sales_rep_id (id, full_name, email),
          implementation_lead:implementation_lead_id (id, full_name, email)
        `,
        )
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Sales handoff not found' }, 404, req);
      }

      return createCorsResponse(handoff, 200, req);
    }

    // POST /sales-handoffs - Create handoff
    if (req.method === 'POST' && !handoffId) {
      const body = await req.json();

      const { data: handoff, error } = await admin
        .from('sales_handoffs')
        .insert({
          tenant_id: tenantId,
          deal_id: body.dealId || body.deal_id,
          customer_id: body.customerId || body.customer_id,
          sales_rep_id: body.salesRepId || body.sales_rep_id || user.id,
          implementation_lead_id: body.implementationLeadId || body.implementation_lead_id,
          status: 'pending',
          notes: body.notes,
          requirements: body.requirements || {},
          timeline: body.timeline,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create sales handoff' }, 500, req);
      }

      return createCorsResponse(handoff, 201, req);
    }

    // PUT /sales-handoffs/:id - Update handoff
    if (req.method === 'PUT' && handoffId && !action) {
      const body = await req.json();

      const { data: handoff, error } = await admin
        .from('sales_handoffs')
        .update({
          implementation_lead_id: body.implementationLeadId || body.implementation_lead_id,
          status: body.status,
          notes: body.notes,
          requirements: body.requirements,
          timeline: body.timeline,
          updated_at: new Date().toISOString(),
        })
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update sales handoff' }, 500, req);
      }

      return createCorsResponse(handoff, 200, req);
    }

    // POST /sales-handoffs/:id/complete - Complete handoff
    if (req.method === 'POST' && handoffId && action === 'complete') {
      const body = await req.json();

      const { data: handoff, error } = await admin
        .from('sales_handoffs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: body.notes || body.completion_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to complete sales handoff' }, 500, req);
      }

      return createCorsResponse(handoff, 200, req);
    }

    // DELETE /sales-handoffs/:id - Delete handoff
    if (req.method === 'DELETE' && handoffId) {
      const { error } = await admin
        .from('sales_handoffs')
        .delete()
        .eq('id', handoffId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete sales handoff' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Sales handoff deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-handoffs function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
