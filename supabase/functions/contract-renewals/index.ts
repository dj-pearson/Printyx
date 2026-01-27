// Contract Renewals Edge Function
// Handles contract renewal management and tracking
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
    const renewalId = pathParts[1];
    const action = pathParts[2];

    // GET /contract-renewals - List renewals
    if (req.method === 'GET' && !renewalId) {
      const status = url.searchParams.get('status');
      const ownerId = url.searchParams.get('ownerId');
      const riskLevel = url.searchParams.get('riskLevel');

      let query = admin
        .from('contract_renewals')
        .select(
          `
          *,
          contract:contract_id (id, name, value),
          customer:customer_id (id, company_name),
          owner:owner_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('renewal_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (ownerId) query = query.eq('owner_id', ownerId);
      if (riskLevel) query = query.eq('risk_level', riskLevel);

      const { data: renewals, error } = await query;

      if (error) {
        console.error('Error fetching renewals:', error);
        return createCorsResponse({ error: 'Failed to fetch renewals' }, 500, req);
      }

      return createCorsResponse(renewals || [], 200, req);
    }

    // GET /contract-renewals/alerts/attention-needed - Get renewals needing attention
    if (req.method === 'GET' && renewalId === 'alerts' && action === 'attention-needed') {
      const { data: renewals, error } = await admin
        .from('contract_renewals')
        .select(
          `
          *,
          contract:contract_id (id, name),
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['at_risk', 'overdue'])
        .order('renewal_date', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch alerts' }, 500, req);
      }

      return createCorsResponse(renewals || [], 200, req);
    }

    // GET /contract-renewals/:id - Get single renewal
    if (req.method === 'GET' && renewalId && !action) {
      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .select(
          `
          *,
          contract:contract_id (*),
          customer:customer_id (id, company_name),
          owner:owner_id (id, full_name, email)
        `,
        )
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Renewal not found' }, 404, req);
      }

      return createCorsResponse(renewal, 200, req);
    }

    // POST /contract-renewals - Create renewal
    if (req.method === 'POST' && !renewalId) {
      const body = await req.json();

      const renewalData = {
        tenant_id: tenantId,
        contract_id: body.contractId || body.contract_id,
        customer_id: body.customerId || body.customer_id,
        owner_id: body.ownerId || body.owner_id || user.id,
        renewal_date: body.renewalDate || body.renewal_date,
        current_value: body.currentValue || body.current_value,
        proposed_value: body.proposedValue || body.proposed_value,
        status: body.status || 'pending',
        risk_level: body.riskLevel || body.risk_level || 'low',
        notes: body.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .insert(renewalData)
        .select()
        .single();

      if (error) {
        console.error('Error creating renewal:', error);
        return createCorsResponse({ error: 'Failed to create renewal' }, 500, req);
      }

      return createCorsResponse(renewal, 201, req);
    }

    // PUT /contract-renewals/:id - Update renewal
    if (req.method === 'PUT' && renewalId && !action) {
      const body = await req.json();

      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .update({
          owner_id: body.ownerId || body.owner_id,
          renewal_date: body.renewalDate || body.renewal_date,
          proposed_value: body.proposedValue || body.proposed_value,
          status: body.status,
          risk_level: body.riskLevel || body.risk_level,
          notes: body.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update renewal' }, 500, req);
      }

      return createCorsResponse(renewal, 200, req);
    }

    // POST /contract-renewals/:id/won - Mark renewal as won
    if (req.method === 'POST' && renewalId && action === 'won') {
      const body = await req.json();

      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .update({
          status: 'won',
          final_value: body.finalValue || body.final_value,
          won_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark renewal as won' }, 500, req);
      }

      return createCorsResponse(renewal, 200, req);
    }

    // POST /contract-renewals/:id/lost - Mark renewal as lost
    if (req.method === 'POST' && renewalId && action === 'lost') {
      const body = await req.json();

      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .update({
          status: 'lost',
          lost_reason: body.reason || body.lost_reason,
          lost_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark renewal as lost' }, 500, req);
      }

      return createCorsResponse(renewal, 200, req);
    }

    // POST /contract-renewals/:id/recalculate-risk - Recalculate risk score
    if (req.method === 'POST' && renewalId && action === 'recalculate-risk') {
      const { data: renewal } = await admin
        .from('contract_renewals')
        .select('*, customer:customer_id (*)')
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .single();

      if (!renewal) {
        return createCorsResponse({ error: 'Renewal not found' }, 404, req);
      }

      // Simple risk calculation based on days until renewal and other factors
      const daysUntilRenewal = Math.ceil(
        (new Date(renewal.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      let riskLevel = 'low';
      if (daysUntilRenewal < 30) riskLevel = 'high';
      else if (daysUntilRenewal < 60) riskLevel = 'medium';

      const { data: updated, error } = await admin
        .from('contract_renewals')
        .update({
          risk_level: riskLevel,
          risk_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to recalculate risk' }, 500, req);
      }

      return createCorsResponse(updated, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in contract-renewals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
