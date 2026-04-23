// Customer health scores.
//
// Paths (dispatcher already stripped /customer-success/health-scores):
//   GET    /                              (?healthStatus&trend&minScore&maxScore)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   GET    /customer/:customerId          (latest score)
//   GET    /customer/:customerId/history  (all scores for customer)
//   GET    /due-calculation               (next_calculation_due <= now)
//   GET    /at-risk                       (status in at_risk/critical)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const AT_RISK_STATUSES = ['at_risk', 'critical', 'poor'];

export async function handleHealthScores(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];
  const third = pathParts[2];

  // GET /customer/:customerId[/history]
  if (method === 'GET' && first === 'customer' && second) {
    if (third === 'history') {
      const { data, error } = await db
        .from('customer_health_scores')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('customer_id', second)
        .order('calculated_at', { ascending: false })
        .limit(200);
      if (error) return dbErr(req, requestId, 'Failed to fetch history', error);
      return jsonResponse(data ?? [], 200, req, requestId);
    }
    const { data } = await db
      .from('customer_health_scores')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return errorResponse(404, 'No health score for this customer', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /due-calculation
  if (method === 'GET' && first === 'due-calculation') {
    const { data, error } = await db
      .from('customer_health_scores')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lte('next_calculation_due', new Date().toISOString())
      .order('next_calculation_due', { ascending: true })
      .limit(200);
    if (error) return dbErr(req, requestId, 'Failed to fetch due calculations', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /at-risk
  if (method === 'GET' && first === 'at-risk') {
    const threshold = Math.max(0, parseInt(url.searchParams.get('threshold') ?? '50', 10) || 50);
    const { data, error } = await db
      .from('customer_health_scores')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .or(`health_status.in.(${AT_RISK_STATUSES.join(',')}),overall_score.lte.${threshold}`)
      .order('overall_score', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch at-risk customers', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /
  if (method === 'GET' && !first) {
    let q = db.from('customer_health_scores').select('*').eq('tenant_id', auth.tenantId);
    const healthStatus = url.searchParams.get('healthStatus');
    const trend = url.searchParams.get('trend');
    const minScore = url.searchParams.get('minScore');
    const maxScore = url.searchParams.get('maxScore');
    if (healthStatus) q = q.eq('health_status', healthStatus);
    if (trend) q = q.eq('trend', trend);
    if (minScore) q = q.gte('overall_score', parseInt(minScore, 10));
    if (maxScore) q = q.lte('overall_score', parseInt(maxScore, 10));
    q = q.order('calculated_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch health scores', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('customer_health_scores')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch score', error);
    if (!data)
      return errorResponse(404, 'Health score not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapScore(body);
    row.tenant_id = auth.tenantId;
    row.calculated_by = row.calculated_by ?? auth.userId;
    if (!row.customer_id || row.overall_score === undefined) {
      return errorResponse(400, 'customer_id and overall_score are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('customer_health_scores')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create score', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapScore(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('customer_health_scores')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update score', error);
    if (!data)
      return errorResponse(404, 'Health score not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

function mapScore(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('customer_id', 'customerId', 'customer_id');
  set('overall_score', 'overallScore', 'overall_score');
  set('health_status', 'healthStatus', 'health_status');
  if (body.trend !== undefined) r.trend = body.trend;
  set('usage_score', 'usageScore', 'usage_score');
  set('engagement_score', 'engagementScore', 'engagement_score');
  set('support_score', 'supportScore', 'support_score');
  set('payment_score', 'paymentScore', 'payment_score');
  set('satisfaction_score', 'satisfactionScore', 'satisfaction_score');
  set('days_since_last_service', 'daysSinceLastService', 'days_since_last_service');
  set('open_tickets_count', 'openTicketsCount', 'open_tickets_count');
  set('overdue_invoices_count', 'overdueInvoicesCount', 'overdue_invoices_count');
  set('nps_score', 'npsScore', 'nps_score');
  if (body.csat !== undefined) r.csat = body.csat;
  set('risk_factors', 'riskFactors', 'risk_factors');
  set('strength_factors', 'strengthFactors', 'strength_factors');
  if (body.recommendations !== undefined) r.recommendations = body.recommendations;
  set('calculated_at', 'calculatedAt', 'calculated_at');
  set('calculated_by', 'calculatedBy', 'calculated_by');
  set('next_calculation_due', 'nextCalculationDue', 'next_calculation_due');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
