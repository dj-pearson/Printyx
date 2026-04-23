// Churn predictions.
//
// Paths (dispatcher stripped /customer-success/churn-predictions):
//   GET    /                         (?churnRisk&modelType)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   GET    /customer/:customerId     (latest prediction)
//   GET    /high-risk                (risk in high/critical)
//   GET    /expired                  (expires_at passed)
//   GET    /intervention-required    (intervention_required=true, triggered=false)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const HIGH_RISK = ['high', 'critical', 'very_high'];

export async function handleChurnPredictions(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /customer/:customerId
  if (method === 'GET' && first === 'customer' && second) {
    const { data } = await db
      .from('churn_predictions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return errorResponse(404, 'No churn prediction for this customer', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /high-risk
  if (method === 'GET' && first === 'high-risk') {
    const { data, error } = await db
      .from('churn_predictions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .in('churn_risk', HIGH_RISK)
      .order('churn_probability', { ascending: false })
      .limit(200);
    if (error) return dbErr(req, requestId, 'Failed to fetch high-risk predictions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /expired
  if (method === 'GET' && first === 'expired') {
    const { data, error } = await db
      .from('churn_predictions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(200);
    if (error) return dbErr(req, requestId, 'Failed to fetch expired predictions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /intervention-required
  if (method === 'GET' && first === 'intervention-required') {
    const { data, error } = await db
      .from('churn_predictions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('intervention_required', true)
      .eq('intervention_triggered', false)
      .order('churn_probability', { ascending: false });
    if (error)
      return dbErr(req, requestId, 'Failed to fetch intervention-required predictions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /
  if (method === 'GET' && !first) {
    let q = db.from('churn_predictions').select('*').eq('tenant_id', auth.tenantId);
    const churnRisk = url.searchParams.get('churnRisk');
    const modelType = url.searchParams.get('modelType');
    if (churnRisk) q = q.eq('churn_risk', churnRisk);
    if (modelType) q = q.eq('model_type', modelType);
    q = q.order('predicted_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch predictions', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('churn_predictions')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch prediction', error);
    if (!data)
      return errorResponse(404, 'Prediction not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapPrediction(body);
    row.tenant_id = auth.tenantId;
    if (!row.customer_id || !row.churn_risk || row.churn_probability === undefined) {
      return errorResponse(400, 'customer_id, churn_risk, churn_probability required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('churn_predictions').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create prediction', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapPrediction(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('churn_predictions')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update prediction', error);
    if (!data)
      return errorResponse(404, 'Prediction not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

function mapPrediction(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('customer_id', 'customerId', 'customer_id');
  set('churn_risk', 'churnRisk', 'churn_risk');
  set('churn_probability', 'churnProbability', 'churn_probability');
  set('confidence_level', 'confidenceLevel', 'confidence_level');
  set('predicted_churn_date', 'predictedChurnDate', 'predicted_churn_date');
  set('days_until_churn', 'daysUntilChurn', 'days_until_churn');
  set('contract_end_date', 'contractEndDate', 'contract_end_date');
  set('primary_risk_factors', 'primaryRiskFactors', 'primary_risk_factors');
  set('secondary_risk_factors', 'secondaryRiskFactors', 'secondary_risk_factors');
  set('model_version', 'modelVersion', 'model_version');
  set('model_type', 'modelType', 'model_type');
  set('feature_importance', 'featureImportance', 'feature_importance');
  set('estimated_mrr', 'estimatedMrr', 'estimated_mrr');
  set('estimated_ltv', 'estimatedLtv', 'estimated_ltv');
  set('retention_cost', 'retentionCost', 'retention_cost');
  set('intervention_required', 'interventionRequired', 'intervention_required');
  set('intervention_triggered', 'interventionTriggered', 'intervention_triggered');
  set('intervention_id', 'interventionId', 'intervention_id');
  set('expires_at', 'expiresAt', 'expires_at');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
