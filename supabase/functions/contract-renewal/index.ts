// Contract Renewal Edge Function
// Handles contract renewal management and tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';

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
    const { parts } = normalizePath(url.pathname, 'contract-renewal');
    const endpoint = parts[0];
    const contractId = parts[1];

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

    // ─── Renewal-autopilot endpoints (EDGE-002g) ────────────────────────────
    //
    // ContractRenewalDashboard.tsx calls /dashboard, /at-risk, /expiring and
    // /proposals. Only /expiring existed, and it was wrong three ways at once:
    // it read `contracts` (the minimal billing table) rather than
    // contract_renewal_tracking (what the autopilot and the Express service
    // use), it returned an OBJECT where the page does useQuery<any[]> and calls
    // .map, and it returned snake_case where the page reads customerName,
    // contractNumber, daysUntilExpiration, renewalRisk and
    // monthlyRecurringRevenue. A 200 with the wrong shape is worse than a 404,
    // so /expiring is rebuilt here alongside the three missing endpoints.
    //
    // Rows go through toCamel because PostgREST returns snake_case while these
    // pages were written against Drizzle's camelCase output.

    // GET /contract-renewal/dashboard - Metrics for the dashboard header
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const { data: rules } = await admin
        .from('renewal_automation_rules')
        .select('renewal_window_days')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const renewalWindowDays = rules?.renewal_window_days ?? 90;

      const countOf = async (apply: (q: any) => any): Promise<number> => {
        const { count } = await apply(
          admin
            .from('contract_renewal_tracking')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const [activeContracts, expiringSoon, atRisk] = await Promise.all([
        countOf((q) => q.eq('status', 'active')),
        countOf((q) =>
          q.lt('days_until_expiration', renewalWindowDays).gte('days_until_expiration', 0),
        ),
        countOf((q) => q.in('renewal_risk', ['high', 'very_high'])),
      ]);

      const { count: proposalsOutstanding } = await admin
        .from('renewal_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['sent', 'viewed']);

      // MRR at risk is a SUM, which PostgREST cannot do, so the at-risk rows
      // come back and are added here — same as the Express service does it.
      const { data: atRiskRows } = await admin
        .from('contract_renewal_tracking')
        .select('monthly_recurring_revenue')
        .eq('tenant_id', tenantId)
        .in('renewal_risk', ['high', 'very_high']);
      const mrrAtRisk = (atRiskRows ?? []).reduce(
        (sum: number, r: any) => sum + (toNumber(r.monthly_recurring_revenue) || 0),
        0,
      );

      const { data: analytics } = await admin
        .from('renewal_analytics')
        .select('renewal_rate, mrr_retained, auto_renewal_success_rate')
        .eq('tenant_id', tenantId)
        .eq('period_type', 'monthly')
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      return createCorsResponse(
        {
          activeContracts,
          expiringSoon,
          atRisk,
          proposalsOutstanding: proposalsOutstanding ?? 0,
          mrrAtRisk,
          renewalRate: toNumber(analytics?.renewal_rate) || 0,
          mrrRetained: toNumber(analytics?.mrr_retained) || 0,
          autoRenewalSuccessRate: toNumber(analytics?.auto_renewal_success_rate) || 0,
        },
        200,
        req,
      );
    }

    // GET /contract-renewal/at-risk - Contracts most likely to churn
    if (req.method === 'GET' && endpoint === 'at-risk') {
      const { data: contracts, error } = await admin
        .from('contract_renewal_tracking')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('renewal_risk', ['high', 'very_high'])
        .order('churn_risk_score', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching at-risk contracts:', error);
        return createCorsResponse({ error: 'Failed to fetch at-risk contracts' }, 500, req);
      }

      return createCorsResponse(toCamel(contracts ?? []), 200, req);
    }

    // GET /contract-renewal/expiring - Contracts inside the renewal window
    if (req.method === 'GET' && endpoint === 'expiring') {
      const days = parseInt(url.searchParams.get('days') || '90');

      const { data: contracts, error } = await admin
        .from('contract_renewal_tracking')
        .select('*')
        .eq('tenant_id', tenantId)
        .lt('days_until_expiration', days)
        .gte('days_until_expiration', 0)
        .order('days_until_expiration', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching expiring contracts:', error);
        return createCorsResponse({ error: 'Failed to fetch expiring contracts' }, 500, req);
      }

      return createCorsResponse(toCamel(contracts ?? []), 200, req);
    }

    // GET /contract-renewal/proposals - Renewal proposals
    if (req.method === 'GET' && endpoint === 'proposals' && !contractId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('renewal_proposals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (status) query = query.eq('status', status);

      const { data: proposals, error } = await query;

      if (error) {
        console.error('Error fetching renewal proposals:', error);
        return createCorsResponse({ error: 'Failed to fetch proposals' }, 500, req);
      }

      return createCorsResponse(toCamel(proposals ?? []), 200, req);
    }

    // GET /contract-renewal/stats - Get renewal statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());
      const yearStart = new Date(year, 0, 1).toISOString();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();

      // COP-M01: monthly_value and renewal_status are not columns. The
      // contracts table is minimal — monthly_base carries the recurring amount
      // and `status` carries the lifecycle — so this select 42703'd and every
      // figure below came out zero through `|| 0`.
      const { data: renewals } = await admin
        .from('contracts')
        .select('id, monthly_base, status')
        .eq('tenant_id', tenantId)
        .gte('end_date', yearStart)
        .lte('end_date', yearEnd);

      const renewed = renewals?.filter((c: any) => c.status === 'renewed') || [];
      const churned = renewals?.filter((c: any) => c.status === 'churned') || [];

      // monthly_base is numeric, which PostgREST returns as a string.
      const annualized = (rows: any[]) =>
        rows.reduce((sum: number, c: any) => sum + toNumber(c.monthly_base) * 12, 0);
      const renewedValue = annualized(renewed);
      const churnedValue = annualized(churned);

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
        // COP-M01: contract_type, previous_contract_id and created_by are not
        // columns on `contracts`, and the recurring amount is monthly_base.
        // Copying the rate columns keeps the renewal on the same pricing, which
        // is what a renewal means here.
        .insert({
          tenant_id: tenantId,
          customer_id: currentContract.customer_id,
          contract_number: `${currentContract.contract_number}-R`,
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString(),
          monthly_base: body.monthlyValue ?? currentContract.monthly_base,
          black_rate: currentContract.black_rate,
          color_rate: currentContract.color_rate,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating renewal contract:', error);
        return createCorsResponse(
          { error: 'Failed to create renewal', details: error.message },
          500,
          req,
        );
      }

      // Update old contract. `status` is the only lifecycle column there is;
      // renewed_contract_id has no home, so the link between the two contracts
      // is NOT persisted and the caller is told so rather than left to assume.
      const { error: closeError } = await admin
        .from('contracts')
        .update({ status: 'renewed', updated_at: new Date().toISOString() })
        .eq('id', targetContractId)
        .eq('tenant_id', tenantId);

      if (closeError) {
        console.error('Error closing the renewed contract:', closeError);
      }

      return createCorsResponse(
        {
          previousContract: currentContract,
          newContract,
          unpersisted: [
            'renewedContractId: contracts has no column linking a renewal to its predecessor',
          ],
        },
        201,
        req,
      );
    }

    // POST /contract-renewal/:contractId/mark-churned - Mark as churned
    if (req.method === 'POST' && contractId && parts[2] === 'mark-churned') {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('contracts')
        // Only `status` exists; churn_reason, churn_notes and churned_at have no
        // columns, so they are reported back rather than silently dropped.
        .update({
          status: 'churned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error marking contract churned:', error);
        return createCorsResponse(
          { error: 'Failed to mark as churned', details: error.message },
          500,
          req,
        );
      }

      const unpersisted: string[] = [];
      if (body.reason) unpersisted.push('reason: contracts has no churn_reason column');
      if (body.notes) unpersisted.push('notes: contracts has no churn_notes column');

      return createCorsResponse({ ...contract, unpersisted }, 200, req);
    }

    // POST /contract-renewal/analyze-all - NOT PORTED YET (EDGE-002g remainder).
    //
    // A 501 naming the gap rather than the prod 404 this used to be, and rather
    // than a partial port: the Express implementation runs an Anthropic analysis
    // per in-window contract, falls back to a heuristic when the model call
    // fails, writes the scores back to contract_renewal_tracking, and — when
    // autoSendProposals is on — generates and stores a renewal proposal. Porting
    // only the analysis would leave the endpoint reporting work it did not do.
    //
    // The pieces are all available: _shared/anthropic.ts is the Deno client
    // (CLAUDE_API_KEY), and the prompt, heuristic and proposal generation live in
    // server/services/contract-renewal-service.ts.
    if (req.method === 'POST' && endpoint === 'analyze-all') {
      return createCorsResponse(
        {
          error: 'Bulk renewal analysis is not available on the edge function yet',
          code: 'ANALYZE_ALL_NOT_PORTED',
          details:
            'Needs the AI analysis + heuristic fallback + proposal generation from ' +
            'server/services/contract-renewal-service.ts, and CLAUDE_API_KEY in the edge ' +
            'environment. The dashboard read endpoints (/dashboard, /at-risk, /expiring, ' +
            '/proposals) are served.',
        },
        501,
        req,
      );
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
