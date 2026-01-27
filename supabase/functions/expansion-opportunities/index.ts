// Expansion Opportunities Edge Function
// Handles upsell and cross-sell opportunity tracking
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
    const opportunityId = pathParts[1];
    const action = pathParts[2];

    // GET /expansion-opportunities - List opportunities
    if (req.method === 'GET' && !opportunityId) {
      const status = url.searchParams.get('status');
      const type = url.searchParams.get('type');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('expansion_opportunities')
        .select(
          `
          *,
          customer:customer_id (id, company_name),
          owner:owner_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('potential_value', { ascending: false });

      if (status) query = query.eq('status', status);
      if (type) query = query.eq('opportunity_type', type);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: opportunities, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch expansion opportunities' }, 500, req);
      }

      return createCorsResponse(opportunities || [], 200, req);
    }

    // GET /expansion-opportunities/:id - Get single opportunity
    if (req.method === 'GET' && opportunityId && !action) {
      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .select(
          `
          *,
          customer:customer_id (*),
          owner:owner_id (id, full_name, email)
        `,
        )
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Expansion opportunity not found' }, 404, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities - Create opportunity
    if (req.method === 'POST' && !opportunityId) {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .insert({
          tenant_id: tenantId,
          customer_id: body.customerId || body.customer_id,
          owner_id: body.ownerId || body.owner_id || user.id,
          opportunity_type: body.opportunityType || body.opportunity_type || 'upsell',
          name: body.name,
          description: body.description,
          potential_value: body.potentialValue || body.potential_value,
          probability: body.probability || 50,
          status: body.status || 'identified',
          products: body.products || [],
          target_close_date: body.targetCloseDate || body.target_close_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create expansion opportunity' }, 500, req);
      }

      return createCorsResponse(opportunity, 201, req);
    }

    // PUT /expansion-opportunities/:id - Update opportunity
    if (req.method === 'PUT' && opportunityId && !action) {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .update({
          owner_id: body.ownerId || body.owner_id,
          name: body.name,
          description: body.description,
          potential_value: body.potentialValue || body.potential_value,
          probability: body.probability,
          status: body.status,
          products: body.products,
          target_close_date: body.targetCloseDate || body.target_close_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update expansion opportunity' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities/:id/won - Mark as won
    if (req.method === 'POST' && opportunityId && action === 'won') {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .update({
          status: 'won',
          actual_value: body.actualValue || body.actual_value,
          won_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark opportunity as won' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /expansion-opportunities/:id/lost - Mark as lost
    if (req.method === 'POST' && opportunityId && action === 'lost') {
      const body = await req.json();

      const { data: opportunity, error } = await admin
        .from('expansion_opportunities')
        .update({
          status: 'lost',
          lost_reason: body.reason || body.lost_reason,
          lost_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark opportunity as lost' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // DELETE /expansion-opportunities/:id - Delete opportunity
    if (req.method === 'DELETE' && opportunityId) {
      const { error } = await admin
        .from('expansion_opportunities')
        .delete()
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete expansion opportunity' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Expansion opportunity deleted' },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in expansion-opportunities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
