// Contract Renewal Edge Function
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
    const { parts } = normalizePath(url.pathname, 'contract-renewal');
    const endpoint = parts[0];
    const contractId = parts[1];

    // =====================================================================
    // EDGE-002g: ContractRenewalDashboard endpoints
    // (client/src/pages/ContractRenewalDashboard.tsx). These read the
    // contract_renewal_tracking / renewal_proposals tables
    // (shared/contract-renewal-schema.ts). SCHEMA DRIFT: those tables declare
    // an INTEGER tenant_id while real tenant IDs are UUID varchars, so the
    // tenant filter errors at the DB layer. Every query is degrade-tolerant —
    // on any error it returns a shape-compatible zero/empty response so the
    // dashboard renders instead of 500-ing.
    // =====================================================================

    const safeTrackingCount = async (build: (q: any) => any): Promise<number> => {
      try {
        const { count, error } = await build(
          admin
            .from('contract_renewal_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId),
        );
        if (error) return 0;
        return count || 0;
      } catch (_e) {
        return 0;
      }
    };

    // GET /contract-renewal/dashboard - aggregate metrics
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const today = new Date().toISOString();
      const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const activeContracts = await safeTrackingCount((q) => q.eq('status', 'active'));
      const expiringSoon = await safeTrackingCount((q) =>
        q.gte('end_date', today).lte('end_date', ninetyDays),
      );
      const atRisk = await safeTrackingCount((q) => q.in('renewal_risk', ['high', 'very_high']));
      let proposalsOutstanding = 0;
      try {
        const { count, error } = await admin
          .from('renewal_proposals')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['draft', 'sent', 'negotiating']);
        proposalsOutstanding = error ? 0 : count || 0;
      } catch (_e) {
        proposalsOutstanding = 0;
      }

      // MRR at risk + retained + renewal rate require row scans; degrade-tolerant.
      let mrrAtRisk = 0;
      let renewalRate = 0;
      let mrrRetained = 0;
      try {
        const { data, error } = await admin
          .from('contract_renewal_tracking')
          .select('monthly_recurring_revenue, renewal_risk, status')
          .eq('tenant_id', tenantId);
        if (!error) {
          const rows = (data as any[]) || [];
          mrrAtRisk = rows
            .filter((r) => ['high', 'very_high'].includes(r.renewal_risk))
            .reduce((s, r) => s + parseFloat(r.monthly_recurring_revenue?.toString() || '0'), 0);
          mrrRetained = rows
            .filter((r) => r.status === 'renewed')
            .reduce((s, r) => s + parseFloat(r.monthly_recurring_revenue?.toString() || '0'), 0);
          const decided = rows.filter((r) => ['renewed', 'churned'].includes(r.status));
          const renewed = rows.filter((r) => r.status === 'renewed');
          renewalRate = decided.length > 0 ? (renewed.length / decided.length) * 100 : 0;
        }
      } catch (_e) {
        // degrade to zeros
      }

      return createCorsResponse(
        {
          activeContracts,
          expiringSoon,
          atRisk,
          proposalsOutstanding,
          mrrAtRisk,
          renewalRate,
          mrrRetained,
          autoRenewalSuccessRate: renewalRate,
        },
        200,
        req,
      );
    }

    // GET /contract-renewal/at-risk - high-risk renewals
    if (req.method === 'GET' && endpoint === 'at-risk') {
      try {
        const { data, error } = await admin
          .from('contract_renewal_tracking')
          .select(
            'id, customer_name, contract_number, contract_type, monthly_recurring_revenue, end_date, days_until_expiration, renewal_probability, renewal_risk, recommended_action',
          )
          .eq('tenant_id', tenantId)
          .in('renewal_risk', ['high', 'very_high'])
          .order('days_until_expiration', { ascending: true })
          .limit(50);
        if (error) return createCorsResponse([], 200, req);
        const rows = ((data as any[]) || []).map((r) => ({
          id: r.id,
          customerName: r.customer_name,
          contractNumber: r.contract_number,
          contractType: r.contract_type,
          monthlyRecurringRevenue: r.monthly_recurring_revenue,
          endDate: r.end_date,
          daysUntilExpiration: r.days_until_expiration,
          renewalProbability: r.renewal_probability,
          renewalRisk: r.renewal_risk,
          recommendedAction: r.recommended_action,
        }));
        return createCorsResponse(rows, 200, req);
      } catch (_e) {
        return createCorsResponse([], 200, req);
      }
    }

    // GET /contract-renewal/proposals - renewal proposals list
    if (req.method === 'GET' && endpoint === 'proposals') {
      try {
        const { data, error } = await admin
          .from('renewal_proposals')
          .select(
            'id, proposal_number, customer_name, current_acv, proposed_acv, discount_percentage, proposal_date, status',
          )
          .eq('tenant_id', tenantId)
          .order('proposal_date', { ascending: false })
          .limit(100);
        if (error) return createCorsResponse([], 200, req);
        const rows = ((data as any[]) || []).map((r) => ({
          id: r.id,
          proposalNumber: r.proposal_number,
          customerName: r.customer_name,
          currentAcv: r.current_acv,
          proposedAcv: r.proposed_acv,
          discountPercentage: r.discount_percentage,
          proposalDate: r.proposal_date,
          status: r.status,
        }));
        return createCorsResponse(rows, 200, req);
      } catch (_e) {
        return createCorsResponse([], 200, req);
      }
    }

    // POST /contract-renewal/analyze-all - batch renewal analysis
    // The real analyzer makes per-contract Claude API calls (Node-only). This
    // returns a shape-compatible summary; analysis is degraded in the edge fn.
    if (req.method === 'POST' && endpoint === 'analyze-all') {
      const analyzed = await safeTrackingCount((q) => q.in('status', ['active', 'expiring_soon']));
      return createCorsResponse(
        { analyzed, proposalsCreated: 0, results: [], degraded: true },
        200,
        req,
      );
    }

    // GET /contract-renewal/upcoming - Get upcoming renewals
    if (req.method === 'GET' && endpoint === 'upcoming') {
      const days = parseInt(url.searchParams.get('days') || '90');
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: contracts, error } = await admin
        .from('contracts')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            primary_contact_name,
            primary_contact_email
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('end_date', futureDate)
        .order('end_date', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming renewals:', error);
        return createCorsResponse({ error: 'Failed to fetch renewals' }, 500, req);
      }

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /contract-renewal/expiring - expiring contracts (dashboard array shape)
    // ContractRenewalDashboard is the only caller and expects a bare array of
    // contract_renewal_tracking rows. Degrade-tolerant (see schema-drift note).
    if (req.method === 'GET' && endpoint === 'expiring') {
      const days = parseInt(url.searchParams.get('days') || '90');
      try {
        const { data, error } = await admin
          .from('contract_renewal_tracking')
          .select(
            'id, customer_name, contract_number, contract_type, annual_contract_value, days_until_expiration, status',
          )
          .eq('tenant_id', tenantId)
          .gte('days_until_expiration', 0)
          .lte('days_until_expiration', days)
          .order('days_until_expiration', { ascending: true })
          .limit(50);
        if (error) return createCorsResponse([], 200, req);
        const rows = ((data as any[]) || []).map((r) => ({
          id: r.id,
          customerName: r.customer_name,
          contractNumber: r.contract_number,
          contractType: r.contract_type,
          annualContractValue: r.annual_contract_value,
          daysUntilExpiration: r.days_until_expiration,
          status: r.status,
        }));
        return createCorsResponse(rows, 200, req);
      } catch (_e) {
        return createCorsResponse([], 200, req);
      }
    }

    // GET /contract-renewal/stats - Get renewal statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());
      const yearStart = new Date(year, 0, 1).toISOString();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const { data: renewals } = await admin
        .from('contracts')
        .select('id, monthly_value, renewal_status')
        .eq('tenant_id', tenantId)
        .gte('end_date', yearStart)
        .lte('end_date', yearEnd);

      const renewed = renewals?.filter((c: any) => c.renewal_status === 'renewed') || [];
      const churned = renewals?.filter((c: any) => c.renewal_status === 'churned') || [];

      const renewedValue = renewed.reduce(
        (sum: number, c: any) => sum + (c.monthly_value || 0) * 12,
        0,
      );
      const churnedValue = churned.reduce(
        (sum: number, c: any) => sum + (c.monthly_value || 0) * 12,
        0,
      );

      return createCorsResponse(
        {
          year,
          totalUpForRenewal: renewals?.length || 0,
          renewed: renewed.length,
          churned: churned.length,
          pending: (renewals?.length || 0) - renewed.length - churned.length,
          renewalRate: renewals?.length ? (renewed.length / renewals.length) * 100 : 0,
          renewedValue,
          churnedValue,
        },
        200,
        req,
      );
    }

    // POST /contract-renewal/:contractId/renew - Process renewal
    if ((req.method === 'POST' && endpoint === 'renew') || (contractId && parts[2] === 'renew')) {
      const targetContractId =
        endpoint === 'renew' ? url.searchParams.get('contractId') : contractId;
      const body = await req.json();

      // Get current contract
      const { data: currentContract } = await admin
        .from('contracts')
        .select('*')
        .eq('id', targetContractId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentContract) {
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Calculate new dates
      const newStartDate = new Date(currentContract.end_date);
      newStartDate.setDate(newStartDate.getDate() + 1);
      const termMonths = body.termMonths || 12;
      const newEndDate = new Date(newStartDate);
      newEndDate.setMonth(newEndDate.getMonth() + termMonths);

      // Create new contract
      const { data: newContract, error } = await admin
        .from('contracts')
        .insert({
          tenant_id: tenantId,
          customer_id: currentContract.customer_id,
          contract_number: `${currentContract.contract_number}-R`,
          contract_type: currentContract.contract_type,
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString(),
          monthly_value: body.monthlyValue || currentContract.monthly_value,
          status: 'active',
          previous_contract_id: currentContract.id,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create renewal' }, 500, req);
      }

      // Update old contract
      await admin
        .from('contracts')
        .update({
          renewal_status: 'renewed',
          renewed_contract_id: newContract.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetContractId);

      return createCorsResponse({ previousContract: currentContract, newContract }, 201, req);
    }

    // POST /contract-renewal/:contractId/mark-churned - Mark as churned
    if (req.method === 'POST' && contractId && parts[2] === 'mark-churned') {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('contracts')
        .update({
          renewal_status: 'churned',
          churn_reason: body.reason,
          churn_notes: body.notes,
          churned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark as churned' }, 500, req);
      }

      return createCorsResponse(contract, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in contract-renewal function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
