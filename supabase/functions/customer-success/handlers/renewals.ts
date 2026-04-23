// Renewal opportunities.
//
// Paths (dispatcher stripped /customer-success/renewals):
//   GET    /                              (?renewalStatus&renewalRisk filters)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   GET    /customer/:customerId          (all renewals for customer, newest first)
//   GET    /contract/:contractId          (renewals tied to a contract)
//   POST   /:id/assign-csm                (body: assignedCsm) — manager+
//   POST   /:id/close                     (body: outcome, notes, actualRenewalDate, projectedMrr, winReason, lostReason)
//   GET    /upcoming/:days                (contract_end_date within :days days, status not closed)
//   GET    /high-value/:minMrr            (current_mrr >= :minMrr)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { isManagerOrAbove } from '../_rbac.ts';

const CLOSED_STATUSES = ['won', 'lost', 'closed'];

export async function handleRenewals(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /customer/:customerId
  if (method === 'GET' && first === 'customer' && second) {
    const { data, error } = await db
      .from('renewal_opportunities')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('contract_end_date', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch customer renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /contract/:contractId
  if (method === 'GET' && first === 'contract' && second) {
    const { data, error } = await db
      .from('renewal_opportunities')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('contract_id', second)
      .order('contract_end_date', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch contract renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /upcoming/:days
  if (method === 'GET' && first === 'upcoming' && second) {
    const days = Math.max(1, Math.min(parseInt(second, 10) || 30, 365));
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await db
      .from('renewal_opportunities')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lte('contract_end_date', cutoff)
      .not('renewal_status', 'in', `(${CLOSED_STATUSES.join(',')})`)
      .order('contract_end_date', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch upcoming renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /high-value/:minMrr
  if (method === 'GET' && first === 'high-value' && second) {
    const minMrr = Math.max(0, parseFloat(second) || 0);
    const { data, error } = await db
      .from('renewal_opportunities')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .gte('current_mrr', minMrr)
      .order('current_mrr', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch high-value renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:id/assign-csm
  if (method === 'POST' && first && second === 'assign-csm') {
    if (!isManagerOrAbove(auth)) {
      return errorResponse(403, 'Manager role required', req, { code: 'FORBIDDEN', requestId });
    }
    const body = (await req.json().catch(() => ({}))) as {
      assignedCsm?: string;
      assigned_csm?: string;
    };
    const csm = body.assignedCsm ?? body.assigned_csm;
    if (!csm) {
      return errorResponse(400, 'assignedCsm is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('renewal_opportunities')
      .update({ assigned_csm: csm, updated_at: new Date().toISOString() })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to assign CSM', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /:id/close
  if (method === 'POST' && first && second === 'close') {
    const body = (await req.json().catch(() => ({}))) as {
      outcome?: string; // 'won' | 'lost' | 'renegotiated'
      notes?: string;
      actualRenewalDate?: string;
      actual_renewal_date?: string;
      projectedMrr?: number;
      projected_mrr?: number;
      projectedContractValue?: number;
      projected_contract_value?: number;
      winReason?: string;
      win_reason?: string;
      lostReason?: string;
      lost_reason?: string;
    };
    const outcome = (body.outcome ?? 'won').toLowerCase();
    const status = outcome === 'lost' ? 'lost' : outcome === 'won' ? 'won' : 'closed';

    const update: Record<string, unknown> = {
      renewal_status: status,
      outcome_notes: body.notes ?? null,
      actual_renewal_date:
        body.actualRenewalDate ?? body.actual_renewal_date ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (body.projectedMrr !== undefined || body.projected_mrr !== undefined)
      update.projected_mrr = body.projectedMrr ?? body.projected_mrr;
    if (body.projectedContractValue !== undefined || body.projected_contract_value !== undefined)
      update.projected_contract_value =
        body.projectedContractValue ?? body.projected_contract_value;
    if (status === 'won' && (body.winReason ?? body.win_reason))
      update.win_reason = body.winReason ?? body.win_reason;
    if (status === 'lost' && (body.lostReason ?? body.lost_reason))
      update.lost_reason = body.lostReason ?? body.lost_reason;

    const { data, error } = await db
      .from('renewal_opportunities')
      .update(update)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to close renewal', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /
  if (method === 'GET' && !first) {
    let q = db.from('renewal_opportunities').select('*').eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('renewalStatus') ?? url.searchParams.get('status');
    const risk = url.searchParams.get('renewalRisk') ?? url.searchParams.get('risk');
    if (status) q = q.eq('renewal_status', status);
    if (risk) q = q.eq('renewal_risk', risk);
    q = q.order('contract_end_date', { ascending: true }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch renewals', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('renewal_opportunities')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch renewal', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRenewal(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    const required = [
      'customer_id',
      'contract_id',
      'renewal_type',
      'renewal_status',
      'contract_end_date',
      'renewal_risk',
    ] as const;
    for (const k of required) {
      if (row[k] === undefined) {
        return errorResponse(400, `${k} is required`, req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
    }
    // Defaults for required-with-defaults columns if caller didn't supply
    if (row.renewal_probability === undefined) row.renewal_probability = 0.5;
    if (row.current_mrr === undefined) row.current_mrr = 0;
    if (row.projected_mrr === undefined) row.projected_mrr = row.current_mrr;
    if (row.days_until_renewal === undefined && row.contract_end_date) {
      const d = new Date(row.contract_end_date as string).getTime();
      row.days_until_renewal = Math.max(0, Math.floor((d - Date.now()) / 86400000));
    }

    const { data, error } = await db
      .from('renewal_opportunities')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create renewal', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRenewal(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('renewal_opportunities')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update renewal', error);
    if (!data)
      return errorResponse(404, 'Renewal not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

function mapRenewal(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('customer_id', 'customerId', 'customer_id');
  set('contract_id', 'contractId', 'contract_id');
  set('renewal_type', 'renewalType', 'renewal_type');
  set('renewal_status', 'renewalStatus', 'renewal_status');
  set('renewal_probability', 'renewalProbability', 'renewal_probability');
  set('contract_end_date', 'contractEndDate', 'contract_end_date');
  set('days_until_renewal', 'daysUntilRenewal', 'days_until_renewal');
  set('outreach_start_date', 'outreachStartDate', 'outreach_start_date');
  set('target_close_date', 'targetCloseDate', 'target_close_date');
  set('actual_renewal_date', 'actualRenewalDate', 'actual_renewal_date');
  set('current_mrr', 'currentMrr', 'current_mrr');
  set('projected_mrr', 'projectedMrr', 'projected_mrr');
  set('mrr_change', 'mrrChange', 'mrr_change');
  set('mrr_change_percent', 'mrrChangePercent', 'mrr_change_percent');
  set('current_contract_value', 'currentContractValue', 'current_contract_value');
  set('projected_contract_value', 'projectedContractValue', 'projected_contract_value');
  set('expansion_potential', 'expansionPotential', 'expansion_potential');
  set('suggested_add_ons', 'suggestedAddOns', 'suggested_add_ons');
  set('suggested_upgrades', 'suggestedUpgrades', 'suggested_upgrades');
  set('estimated_expansion_value', 'estimatedExpansionValue', 'estimated_expansion_value');
  set('renewal_risk', 'renewalRisk', 'renewal_risk');
  set('risk_factors', 'riskFactors', 'risk_factors');
  set('strength_factors', 'strengthFactors', 'strength_factors');
  set('assigned_csm', 'assignedCsm', 'assigned_csm');
  set('assigned_sales_rep', 'assignedSalesRep', 'assigned_sales_rep');
  set('last_contact_date', 'lastContactDate', 'last_contact_date');
  set('next_contact_date', 'nextContactDate', 'next_contact_date');
  set('contact_frequency', 'contactFrequency', 'contact_frequency');
  set('action_plan', 'actionPlan', 'action_plan');
  set('internal_notes', 'internalNotes', 'internal_notes');
  set('competitor_threats', 'competitorThreats', 'competitor_threats');
  set('outcome_notes', 'outcomeNotes', 'outcome_notes');
  set('lost_reason', 'lostReason', 'lost_reason');
  set('win_reason', 'winReason', 'win_reason');
  set('related_health_score_id', 'relatedHealthScoreId', 'related_health_score_id');
  set('related_churn_prediction_id', 'relatedChurnPredictionId', 'related_churn_prediction_id');
  set('related_intervention_ids', 'relatedInterventionIds', 'related_intervention_ids');
  set('quote_id', 'quoteId', 'quote_id');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
