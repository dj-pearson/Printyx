// Contract Renewals Edge Function
// Handles contract renewal management and tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /contract-renewals, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'contract-renewals');
    const renewalId = parts[0];
    const action = parts[1];

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
          contract:contract_id (id, contract_number, monthly_base, end_date),
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('renewal_target_date', { ascending: true });

      if (status) query = query.eq('renewal_status', status);
      if (ownerId) query = query.eq('renewal_owner_id', ownerId);
      if (riskLevel) query = query.eq('renewal_risk_level', riskLevel);

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
          contract:contract_id (id, contract_number, end_date),
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('renewal_status', ['at_risk', 'overdue'])
        .order('renewal_target_date', { ascending: true });

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
          customer:customer_id (id, company_name)
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

      // COP-M01: contract_renewals prefixes nearly everything — renewal_status,
      // renewal_risk_level, renewal_owner_id, renewal_target_date — and spells
      // the money current_contract_value / proposed_contract_value and the free
      // text internal_notes. Not one of the names below was a column, so
      // creating a renewal failed outright. (current_value was not even caught
      // by check:phantom-cols: this is a named-variable payload, its documented
      // blind spot.)
      const renewalData = {
        tenant_id: tenantId,
        contract_id: body.contractId || body.contract_id,
        customer_id: body.customerId || body.customer_id,
        renewal_owner_id: body.ownerId || body.owner_id || user.id,
        renewal_target_date: body.renewalDate || body.renewal_date,
        current_contract_value: body.currentValue ?? body.current_value ?? null,
        proposed_contract_value: body.proposedValue ?? body.proposed_value ?? null,
        renewal_status: body.status || 'pending',
        renewal_risk_level: body.riskLevel || body.risk_level || 'low',
        internal_notes: body.notes ?? null,
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
          renewal_owner_id: body.ownerId || body.owner_id,
          renewal_target_date: body.renewalDate || body.renewal_date,
          proposed_contract_value: body.proposedValue ?? body.proposed_value,
          renewal_status: body.status,
          renewal_risk_level: body.riskLevel || body.risk_level,
          internal_notes: body.notes,
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
        // renewal_closed_date is the only close timestamp there is, and there is
        // no final_value column — the agreed figure would overwrite
        // proposed_contract_value, which means something else, so it is reported
        // rather than misfiled.
        .update({
          renewal_status: 'won',
          renewal_closed_date: new Date().toISOString(),
          renewal_won_reason: body.reason ?? body.won_reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error marking renewal won:', error);
        return createCorsResponse(
          { error: 'Failed to mark renewal as won', details: error.message },
          500,
          req,
        );
      }

      const unpersisted =
        (body.finalValue ?? body.final_value)
          ? [
              'finalValue: contract_renewals has no final-value column; proposed_contract_value means the proposal, not the outcome',
            ]
          : [];

      return createCorsResponse({ ...renewal, unpersisted }, 200, req);
    }

    // POST /contract-renewals/:id/lost - Mark renewal as lost
    if (req.method === 'POST' && renewalId && action === 'lost') {
      const body = await req.json();

      const { data: renewal, error } = await admin
        .from('contract_renewals')
        .update({
          renewal_status: 'lost',
          renewal_lost_reason: body.reason || body.lost_reason,
          renewal_closed_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error marking renewal lost:', error);
        return createCorsResponse(
          { error: 'Failed to mark renewal as lost', details: error.message },
          500,
          req,
        );
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
        (new Date(renewal.renewal_target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      let riskLevel = 'low';
      if (daysUntilRenewal < 30) riskLevel = 'high';
      else if (daysUntilRenewal < 60) riskLevel = 'medium';

      const { data: updated, error } = await admin
        .from('contract_renewals')
        // renewal_risk_level, and there is no separate risk_calculated_at —
        // updated_at is the only timestamp this write leaves behind.
        .update({
          renewal_risk_level: riskLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error recalculating renewal risk:', error);
        return createCorsResponse(
          { error: 'Failed to recalculate risk', details: error.message },
          500,
          req,
        );
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
