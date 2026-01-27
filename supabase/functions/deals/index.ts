// Deals/Opportunities Edge Function
// Handles sales deals and opportunities management
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
    const dealId = pathParts[1];

    // GET /deals - List deals
    if (req.method === 'GET' && !dealId) {
      const stage = url.searchParams.get('stage');
      const ownerId = url.searchParams.get('ownerId') || url.searchParams.get('owner_id');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('deals')
        .select(
          `
          *,
          business_record:business_records!deals_business_record_id_fkey(id, company_name, primary_contact_name),
          owner:users!deals_owner_id_fkey(id, first_name, last_name)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('expected_close_date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (stage) {
        query = query.eq('stage', stage);
      }

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      if (search) {
        query = query.or(`deal_name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching deals:', error);
        return createCorsResponse({ error: 'Failed to fetch deals' }, 500, req);
      }

      return createCorsResponse(
        {
          data: deals || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /deals/:id - Get single deal
    if (req.method === 'GET' && dealId) {
      const { data: deal, error } = await admin
        .from('deals')
        .select(
          `
          *,
          business_record:business_records!deals_business_record_id_fkey(id, company_name, primary_contact_name, primary_contact_email),
          owner:users!deals_owner_id_fkey(id, first_name, last_name, email, phone)
        `,
        )
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching deal:', error);
        return createCorsResponse({ error: 'Deal not found' }, 404, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // POST /deals - Create deal
    if (req.method === 'POST') {
      const body = await req.json();

      const dealData = {
        tenant_id: tenantId,
        business_record_id: body.businessRecordId || body.business_record_id,
        deal_name: body.dealName || body.deal_name,
        description: body.description || null,
        deal_value: body.dealValue || body.deal_value || 0,
        stage: body.stage || 'prospecting',
        probability: body.probability || 10,
        expected_close_date: body.expectedCloseDate || body.expected_close_date || null,
        owner_id: body.ownerId || body.owner_id || user.id,
        source: body.source || null,
        next_step: body.nextStep || body.next_step || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: deal, error } = await admin.from('deals').insert(dealData).select().single();

      if (error) {
        console.error('Error creating deal:', error);
        return createCorsResponse({ error: 'Failed to create deal', details: error }, 500, req);
      }

      return createCorsResponse(deal, 201, req);
    }

    // PATCH /deals/:id - Update deal
    if ((req.method === 'PATCH' || req.method === 'PUT') && dealId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        dealName: 'deal_name',
        description: 'description',
        dealValue: 'deal_value',
        stage: 'stage',
        probability: 'probability',
        expectedCloseDate: 'expected_close_date',
        ownerId: 'owner_id',
        source: 'source',
        nextStep: 'next_step',
        closedDate: 'closed_date',
        lostReason: 'lost_reason',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: deal, error } = await admin
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating deal:', error);
        return createCorsResponse({ error: 'Failed to update deal' }, 500, req);
      }

      return createCorsResponse(deal, 200, req);
    }

    // DELETE /deals/:id - Delete deal
    if (req.method === 'DELETE' && dealId) {
      const { error } = await admin
        .from('deals')
        .delete()
        .eq('id', dealId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting deal:', error);
        return createCorsResponse({ error: 'Failed to delete deal' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Deal deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in deals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
