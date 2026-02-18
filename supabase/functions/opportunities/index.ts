// Opportunities Edge Function
// Queries the deals table and maps to opportunity-style response format
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Map a deal record to the opportunity response format
function mapDealToOpportunity(deal: any): any {
  return {
    id: deal.id,
    tenant_id: deal.tenant_id,
    opportunity_name: deal.title,
    account_id: deal.customer_id,
    account_name: deal.company_name,
    stage_name: deal.deal_stage?.name || deal.status || 'Prospecting',
    amount: deal.amount,
    probability: deal.probability,
    close_date: deal.expected_close_date,
    is_won: deal.status === 'won',
    is_closed: deal.status === 'won' || deal.status === 'lost',
    owner_id: deal.owner_id,
    description: deal.description,
    source: deal.source,
    deal_type: deal.deal_type,
    priority: deal.priority,
    status: deal.status,
    primary_contact_name: deal.primary_contact_name,
    email: deal.email,
    phone: deal.phone,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
  };
}

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

    // Resolve tenant ID: x-tenant-id header → app_metadata → user_metadata → DB lookup
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      // Fallback: look up tenant from public.users
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2.from('users').select('tenant_id').eq('id', user.id).limit(1).maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // server.ts strips function name: /opportunities/123 → /123
    const opportunityId = pathParts[0];

    // GET /opportunities - List opportunities (from deals table)
    if (req.method === 'GET' && !opportunityId) {
      const stageName = url.searchParams.get('stageName') || url.searchParams.get('stage_name');
      const ownerId = url.searchParams.get('ownerId') || url.searchParams.get('owner_id');
      const isClosed = url.searchParams.get('isClosed') || url.searchParams.get('is_closed');
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('deals')
        .select('*, deal_stage:deal_stages!stage_id(id, name, color, is_won_stage, is_closing_stage)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('expected_close_date', { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (stageName) {
        // Filter by stage name via the related deal_stages table
        // Use status as a fallback filter
        query = query.eq('status', stageName.toLowerCase());
      }

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      if (isClosed !== null && isClosed !== undefined) {
        if (isClosed === 'true') {
          query = query.in('status', ['won', 'lost']);
        } else {
          query = query.in('status', ['open', 'on_hold']);
        }
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%`);
      }

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching opportunities (deals):', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities' }, 500, req);
      }

      const opportunities = (deals || []).map(mapDealToOpportunity);

      return createCorsResponse(
        {
          data: opportunities,
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /opportunities/:id - Get single opportunity (from deals table)
    if (req.method === 'GET' && opportunityId) {
      const { data: deal, error } = await admin
        .from('deals')
        .select('*, deal_stage:deal_stages!stage_id(id, name, color, is_won_stage, is_closing_stage)')
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching opportunity (deal):', error);
        return createCorsResponse({ error: 'Opportunity not found' }, 404, req);
      }

      return createCorsResponse(mapDealToOpportunity(deal), 200, req);
    }

    // POST /opportunities - Create opportunity (as deal)
    if (req.method === 'POST') {
      const body = await req.json();

      const dealData = {
        tenant_id: tenantId,
        title: body.opportunityName || body.opportunity_name || body.title,
        customer_id: body.accountId || body.account_id || body.customerId || body.customer_id || null,
        company_name: body.accountName || body.account_name || body.companyName || body.company_name || null,
        amount: body.amount || 0,
        probability: body.probability || 10,
        expected_close_date: body.closeDate || body.close_date || body.expectedCloseDate || null,
        source: body.leadSource || body.lead_source || body.source || null,
        deal_type: body.opportunityType || body.opportunity_type || body.dealType || body.deal_type || null,
        status: 'open',
        owner_id: body.ownerId || body.owner_id || user.id,
        description: body.description || null,
        primary_contact_name: body.primaryContactName || body.primary_contact_name || null,
        email: body.email || null,
        phone: body.phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: deal, error } = await admin
        .from('deals')
        .insert(dealData)
        .select()
        .single();

      if (error) {
        console.error('Error creating opportunity (deal):', error);
        return createCorsResponse(
          { error: 'Failed to create opportunity', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(mapDealToOpportunity(deal), 201, req);
    }

    // PATCH /opportunities/:id - Update opportunity (as deal)
    if ((req.method === 'PATCH' || req.method === 'PUT') && opportunityId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        opportunityName: 'title',
        title: 'title',
        amount: 'amount',
        probability: 'probability',
        closeDate: 'expected_close_date',
        expectedCloseDate: 'expected_close_date',
        leadSource: 'source',
        source: 'source',
        dealType: 'deal_type',
        opportunityType: 'deal_type',
        ownerId: 'owner_id',
        description: 'description',
        status: 'status',
        priority: 'priority',
        companyName: 'company_name',
        accountName: 'company_name',
        customerId: 'customer_id',
        accountId: 'customer_id',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        }
      }

      // Handle isWon/isClosed by mapping to status
      if (body.isWon === true || body.is_won === true) {
        updateData.status = 'won';
      } else if (body.isClosed === true || body.is_closed === true) {
        updateData.status = 'lost';
      }

      const { data: deal, error } = await admin
        .from('deals')
        .update(updateData)
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating opportunity (deal):', error);
        return createCorsResponse({ error: 'Failed to update opportunity' }, 500, req);
      }

      return createCorsResponse(mapDealToOpportunity(deal), 200, req);
    }

    // DELETE /opportunities/:id - Delete opportunity (deal)
    if (req.method === 'DELETE' && opportunityId) {
      const { error } = await admin
        .from('deals')
        .delete()
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting opportunity (deal):', error);
        return createCorsResponse({ error: 'Failed to delete opportunity' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Opportunity deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in opportunities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
