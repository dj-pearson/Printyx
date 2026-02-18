// Opportunities Edge Function (Salesforce-style)
// Handles opportunities with Salesforce compatibility
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

    // GET /opportunities - List opportunities
    if (req.method === 'GET' && !opportunityId) {
      const stageName = url.searchParams.get('stageName') || url.searchParams.get('stage_name');
      const ownerId = url.searchParams.get('ownerId') || url.searchParams.get('owner_id');
      const isClosed = url.searchParams.get('isClosed') || url.searchParams.get('is_closed');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('opportunities')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('close_date', { ascending: true })
        .range(offset, offset + limit - 1);

      if (stageName) {
        query = query.eq('stage_name', stageName);
      }

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      if (isClosed !== null && isClosed !== undefined) {
        query = query.eq('is_closed', isClosed === 'true');
      }

      if (search) {
        query = query.or(`opportunity_name.ilike.%${search}%,account_name.ilike.%${search}%`);
      }

      const { data: opportunities, error, count } = await query;

      if (error) {
        // Handle missing table gracefully (opportunities table may not exist yet)
        if (error.code === '42P01') {
          console.warn('Opportunities table does not exist, returning empty list');
          return createCorsResponse({ data: [], total: 0, page, limit }, 200, req);
        }
        console.error('Error fetching opportunities:', error);
        return createCorsResponse({ error: 'Failed to fetch opportunities' }, 500, req);
      }

      return createCorsResponse(
        {
          data: opportunities || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /opportunities/:id - Get single opportunity
    if (req.method === 'GET' && opportunityId) {
      const { data: opportunity, error } = await admin
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching opportunity:', error);
        return createCorsResponse({ error: 'Opportunity not found' }, 404, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // POST /opportunities - Create opportunity
    if (req.method === 'POST') {
      const body = await req.json();

      const opportunityData = {
        tenant_id: tenantId,
        opportunity_name: body.opportunityName || body.opportunity_name,
        account_id: body.accountId || body.account_id || null,
        account_name: body.accountName || body.account_name || null,
        stage_name: body.stageName || body.stage_name || 'Prospecting',
        amount: body.amount || 0,
        probability: body.probability || 10,
        close_date: body.closeDate || body.close_date || null,
        opportunity_type: body.opportunityType || body.opportunity_type || null,
        lead_source: body.leadSource || body.lead_source || null,
        is_won: false,
        is_closed: false,
        owner_id: body.ownerId || body.owner_id || user.id,
        owner_name: body.ownerName || body.owner_name || null,
        description: body.description || null,
        next_step: body.nextStep || body.next_step || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: opportunity, error } = await admin
        .from('opportunities')
        .insert(opportunityData)
        .select()
        .single();

      if (error) {
        console.error('Error creating opportunity:', error);
        return createCorsResponse(
          { error: 'Failed to create opportunity', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(opportunity, 201, req);
    }

    // PATCH /opportunities/:id - Update opportunity
    if ((req.method === 'PATCH' || req.method === 'PUT') && opportunityId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        opportunityName: 'opportunity_name',
        stageName: 'stage_name',
        amount: 'amount',
        probability: 'probability',
        closeDate: 'close_date',
        opportunityType: 'opportunity_type',
        leadSource: 'lead_source',
        isWon: 'is_won',
        isClosed: 'is_closed',
        ownerId: 'owner_id',
        description: 'description',
        nextStep: 'next_step',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: opportunity, error } = await admin
        .from('opportunities')
        .update(updateData)
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating opportunity:', error);
        return createCorsResponse({ error: 'Failed to update opportunity' }, 500, req);
      }

      return createCorsResponse(opportunity, 200, req);
    }

    // DELETE /opportunities/:id - Delete opportunity
    if (req.method === 'DELETE' && opportunityId) {
      const { error } = await admin
        .from('opportunities')
        .delete()
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting opportunity:', error);
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
