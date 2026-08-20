// Contract Renewal Edge Function
// Handles contract renewal management and tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import {
  buildRenewalAnalysisPrompt,
  buildRenewalPricingPrompt,
  buildRenewalProposalRow,
  heuristicRenewalAnalysis,
  heuristicRenewalPricing,
  type ProposalContractInput,
  type RenewalAnalysisInput,
} from '../_shared/renewal-analysis.ts';

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

    // POST /contract-renewal/analyze-all
    //
    // Scores every contract inside the renewal window and writes the result
    // back to contract_renewal_tracking.
    //
    // The model call is best-effort: prompt and deterministic fallback both come
    // from _shared/renewal-analysis.ts, which is locked to the Express service by
    // server/tests/unit/renewal-analysis-parity.test.ts. With no CLAUDE_API_KEY
    // configured the heuristic is the only path that runs, and it is the same
    // heuristic Express uses — so this endpoint works with or without the key
    // rather than depending on one nobody has verified is set.
    //
    // Proposal auto-generation is included: when auto_send_proposals is on and
    // the action is send_proposal, a renewal_proposals row is written and the
    // tracking record is marked. Its pricing has the same shape as the analysis
    // above — model first, rule-based pricing when that is unavailable — and
    // both live in the same parity-locked module, because these numbers are the
    // price a customer is quoted.
    if (req.method === 'POST' && endpoint === 'analyze-all') {
      const { data: rules } = await admin
        .from('renewal_automation_rules')
        .select(
          'renewal_window_days, auto_send_proposals, max_discount_percent, min_price_increase_percent, max_price_increase_percent',
        )
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const renewalWindowDays = rules?.renewal_window_days ?? 90;

      const { data: contracts, error: contractsError } = await admin
        .from('contract_renewal_tracking')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lt('days_until_expiration', renewalWindowDays)
        .gte('days_until_expiration', 0);

      if (contractsError) {
        console.error('Error loading contracts to analyze:', contractsError);
        return createCorsResponse({ error: 'Failed to load contracts' }, 500, req);
      }

      const results: Array<Record<string, unknown>> = [];
      let proposalsCreated = 0;
      const now = Date.now();

      for (const row of contracts ?? []) {
        const contract = toCamel<RenewalAnalysisInput & { id: string }>(row);
        let analysis = heuristicRenewalAnalysis(contract);
        let analysedBy: 'model' | 'heuristic' = 'heuristic';

        try {
          const text = await generateCompletion({
            max_tokens: 2048,
            messages: [{ role: 'user', content: buildRenewalAnalysisPrompt(contract) }],
          });
          const parsed = JSON.parse(text);
          analysis = {
            renewalProbability: parsed.renewalProbability,
            churnRiskScore: parsed.churnRiskScore,
            renewalRisk: parsed.renewalRisk,
            recommendedAction: parsed.recommendedAction,
            aiAnalysis: {
              summary: parsed.summary,
              strengths: parsed.strengths,
              concerns: parsed.concerns,
              opportunities: parsed.opportunities,
              recommendedStrategy: parsed.recommendedStrategy,
            },
            riskFactors: parsed.concerns,
            opportunityFactors: parsed.opportunities,
            confidenceScore: parsed.confidenceScore || 70,
          };
          analysedBy = 'model';
        } catch (modelError) {
          // Missing key, transport failure or unparseable JSON all land here and
          // keep the heuristic result already computed above.
          console.warn(
            'Renewal model analysis unavailable, using heuristic:',
            modelError instanceof Error ? modelError.message : modelError,
          );
        }

        const { error: updateError } = await admin
          .from('contract_renewal_tracking')
          .update({
            renewal_probability: analysis.renewalProbability,
            churn_risk_score: analysis.churnRiskScore,
            renewal_risk: analysis.renewalRisk,
            ai_analysis: analysis.aiAnalysis,
            risk_factors: analysis.riskFactors,
            opportunity_factors: analysis.opportunityFactors,
            recommended_action: analysis.recommendedAction,
            confidence_score: analysis.confidenceScore,
            last_analyzed_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          })
          .eq('id', row.id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error('Error writing renewal analysis:', updateError);
          results.push({
            contractId: row.id,
            contractNumber: row.contract_number,
            customerName: row.customer_name,
            error: updateError.message,
          });
          continue;
        }

        let proposalCreated = false;
        if (
          rules?.auto_send_proposals &&
          analysis.recommendedAction === 'send_proposal' &&
          !row.proposal_generated
        ) {
          const currentMrr = toNumber(row.monthly_recurring_revenue) || 0;
          const currentAcv = toNumber(row.annual_contract_value) || currentMrr * 12;
          const pricingRules = {
            maxDiscountPercent: rules.max_discount_percent,
            minPriceIncreasePercent: rules.min_price_increase_percent,
            maxPriceIncreasePercent: rules.max_price_increase_percent,
          };

          let recommendations = heuristicRenewalPricing(analysis, currentMrr, pricingRules);
          try {
            const pricingText = await generateCompletion({
              max_tokens: 2048,
              messages: [
                {
                  role: 'user',
                  content: buildRenewalPricingPrompt(
                    analysis,
                    currentMrr,
                    currentAcv,
                    pricingRules,
                  ),
                },
              ],
            });
            const priced = JSON.parse(pricingText);
            recommendations = {
              proposedMrr: priced.proposedMrr,
              proposedAcv: priced.proposedAcv,
              proposedTermMonths: priced.proposedTermMonths,
              discountPercentage: priced.discountPercentage,
              incentiveOffered: priced.incentiveOffered ?? null,
              incentiveValue: priced.incentiveValue ?? 0,
              pricingStrategy: {
                reasoning: priced.pricingReasoning,
                competitivePosition: priced.competitivePosition,
                valueJustification: priced.valueJustification,
              },
              upsellOpportunities: priced.upsellOpportunities || [],
            };
          } catch (pricingError) {
            console.warn(
              'Renewal model pricing unavailable, using rule-based pricing:',
              pricingError instanceof Error ? pricingError.message : pricingError,
            );
          }

          const proposalNumber = `REN-${now}-${crypto.randomUUID().slice(0, 9).toUpperCase()}`;
          const proposalRow = buildRenewalProposalRow(
            contract as ProposalContractInput,
            analysis,
            recommendations,
            proposalNumber,
            now,
          );

          const { error: proposalError } = await admin.from('renewal_proposals').insert({
            ...proposalRow,
            tenant_id: tenantId,
            contract_renewal_tracking_id: row.id,
          });

          if (proposalError) {
            console.error('Error creating renewal proposal:', proposalError);
          } else {
            proposalCreated = true;
            proposalsCreated++;
            await admin
              .from('contract_renewal_tracking')
              .update({
                proposal_generated: true,
                proposal_generated_at: new Date(now).toISOString(),
                proposed_mrr: recommendations.proposedMrr.toString(),
                proposed_acv: recommendations.proposedAcv.toString(),
                proposed_term_months: recommendations.proposedTermMonths,
                proposed_discount: recommendations.discountPercentage.toString(),
                upsell_opportunities: recommendations.upsellOpportunities,
                updated_at: new Date(now).toISOString(),
              })
              .eq('id', row.id)
              .eq('tenant_id', tenantId);
          }
        }

        results.push({
          contractId: row.id,
          contractNumber: row.contract_number,
          customerName: row.customer_name,
          analysedBy,
          analysis,
          proposalCreated,
        });
      }

      return createCorsResponse(
        {
          analyzed: results.length,
          proposalsCreated,
          results,
        },
        200,
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
