// Opportunities Edge Function
// Queries the deals table and maps to opportunity-style response format
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { dashboardRollup, byStageRollup } from '../_shared/opportunity-rollups.ts';

// Rollup endpoints fold rows in the function because PostgREST has no GROUP BY
// or SUM. The cap keeps a large tenant from pulling an unbounded page into
// memory; past it the dashboard under-reports rather than timing out.
const ROLLUP_ROW_CAP = 10000;

// Map a deal record to the opportunity response format
// Field names use snake_case — iOS decoder uses convertFromSnakeCase to map to camelCase Swift properties
function mapDealToOpportunity(deal: any): any {
  return {
    id: deal.id,
    tenant_id: deal.tenant_id,
    // iOS Opportunity model fields (snake_case for automatic conversion)
    company_name: deal.company_name || deal.title,
    primary_contact_name: deal.primary_contact_name,
    primary_contact_email: deal.email,
    primary_contact_phone: deal.phone,
    record_type: deal.deal_type || 'deal',
    status: deal.status,
    sales_stage: deal.deal_stage?.name || deal.status || 'new',
    estimated_amount: deal.amount,
    probability: deal.probability,
    close_date: deal.expected_close_date,
    source: deal.source,
    interest_level: null,
    priority: deal.priority,
    owner_id: deal.owner_id,
    assigned_sales_rep: deal.owner_id,
    territory: null,
    notes: deal.description,
    customer_rating: null,
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

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant — otherwise any
    // authenticated user can read/write another tenant by spoofing the header.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;

    if (!tenantId) {
      // Fallback: look up tenant from public.users
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'opportunities' ? rawParts.slice(1) : rawParts;
    const opportunityId = pathParts[0];
    // The sub-resource after the id: 'stage' on a pipeline move,
    // 'convert-to-deal' on the legacy bridge. Read explicitly so those paths
    // cannot fall through to the plain /:id handlers below - a POST to
    // /:id/convert-to-deal used to land on the create branch and open a second
    // deal from an empty body.
    const subResource = pathParts[1];

    // GET /opportunities/dashboard - pipeline counts and value
    if (req.method === 'GET' && opportunityId === 'dashboard') {
      const { data, error } = await admin
        .from('deals')
        .select('amount, priority')
        .eq('tenant_id', tenantId)
        .limit(ROLLUP_ROW_CAP);

      if (error) {
        console.error('Error fetching opportunities dashboard:', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities dashboard' }, 500, req);
      }

      return createCorsResponse(dashboardRollup(data ?? []), 200, req);
    }

    // GET /opportunities/by-stage - count and value per pipeline stage
    if (req.method === 'GET' && opportunityId === 'by-stage') {
      const { data, error } = await admin
        .from('deals')
        .select('amount, status, deal_stage:deal_stages!stage_id(name)')
        .eq('tenant_id', tenantId)
        .limit(ROLLUP_ROW_CAP);

      if (error) {
        console.error('Error fetching opportunities by stage:', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities by stage' }, 500, req);
      }

      return createCorsResponse(byStageRollup(data ?? []), 200, req);
    }

    // POST /opportunities/:id/convert-to-deal - legacy bridge, now a no-op.
    //
    // The Express copy read a business_records row and INSERTED a deal from it.
    // This function has always backed opportunities with the deals table, so
    // the record the caller wants already is the deal and converting it would
    // duplicate it. Answer with the deal so an old client's success path still
    // works, and 404 when there is nothing under that id.
    if (req.method === 'POST' && opportunityId && subResource === 'convert-to-deal') {
      const { data: deal, error } = await admin
        .from('deals')
        .select('*')
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error resolving opportunity for conversion:', error);
        return createCorsResponse({ error: 'Failed to convert opportunity' }, 500, req);
      }
      if (!deal) {
        return createCorsResponse({ error: 'Opportunity not found' }, 404, req);
      }

      return createCorsResponse(mapDealToOpportunity(deal), 200, req);
    }

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

      // COP-M07: deliberately still the legacy embed, not a canonical read.
      //
      // PostgREST can only embed across a declared FOREIGN KEY, and
      // pipeline_stages.legacy_stage_id is not one — going canonical here means
      // a second query and an in-memory join, the way pipeline-forecast does it.
      // That is worth doing when it changes an answer, and today it does not:
      // the mirror COPIES name and colour from the legacy row, so both tables
      // say the same thing. Revisit if canonical stages ever become
      // independently editable — see the one-way note in COP-M07.
      let query = admin
        .from('deals')
        .select(
          '*, deal_stage:deal_stages!stage_id(id, name, color, is_won_stage, is_closing_stage)',
          { count: 'exact' },
        )
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
        query = query.or(
          `title.ilike.%${search}%,company_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%`,
        );
      }

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching opportunities (deals):', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities' }, 500, req);
      }

      const opportunities = (deals || []).map(mapDealToOpportunity);

      // Return plain array — iOS JSONDecoder expects [Opportunity] directly
      return createCorsResponse(opportunities, 200, req);
    }

    // GET /opportunities/:id - Get single opportunity (from deals table)
    if (req.method === 'GET' && opportunityId) {
      const { data: deal, error } = await admin
        .from('deals')
        .select(
          '*, deal_stage:deal_stages!stage_id(id, name, color, is_won_stage, is_closing_stage)',
        )
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
        customer_id:
          body.accountId || body.account_id || body.customerId || body.customer_id || null,
        company_name:
          body.accountName || body.account_name || body.companyName || body.company_name || null,
        amount: body.amount || 0,
        probability: body.probability || 10,
        expected_close_date: body.closeDate || body.close_date || body.expectedCloseDate || null,
        source: body.leadSource || body.lead_source || body.source || null,
        deal_type:
          body.opportunityType || body.opportunity_type || body.dealType || body.deal_type || null,
        status: 'open',
        owner_id: body.ownerId || body.owner_id || user.id,
        description: body.description || null,
        primary_contact_name: body.primaryContactName || body.primary_contact_name || null,
        email: body.email || null,
        phone: body.phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: deal, error } = await admin.from('deals').insert(dealData).select().single();

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

      // Pipeline stage moves: the app sends `stage` (kanban "Move Forward")
      // or `sales_stage`/`salesStage` (detail Save). Stage is persisted on
      // deals.status — sales_stage is derived from it in mapDealToOpportunity
      // and the list filter matches on status — so fold any of these into
      // status (lowercased to match the stage-name filter convention).
      const incomingStage = body.stage ?? body.sales_stage ?? body.salesStage;
      const hasStage =
        incomingStage !== undefined && incomingStage !== null && incomingStage !== '';
      // PATCH /:id/stage is stage-only: without one there is nothing to do, and
      // silently writing just updated_at would report a move that never
      // happened. The plain /:id update keeps accepting a body with no stage.
      if (subResource === 'stage' && !hasStage) {
        return createCorsResponse({ error: 'stage is required' }, 400, req);
      }
      if (hasStage) {
        updateData.status = String(incomingStage).toLowerCase();
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
