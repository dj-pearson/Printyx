// Customer journeys.
//
// Paths (dispatcher stripped /customer-success/journeys):
//   GET    /                                  (?currentStage&lifecyclePhase&journeyHealth)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   GET    /customer/:customerId              (latest journey for customer)
//   POST   /:id/advance-stage                 (body: stage, reason?)
//   POST   /:id/record-touchpoint             (body: touchpointType, notes?)
//   GET    /needing-attention                 (journey_health in at_risk/poor OR blockers[])

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const ATTENTION_HEALTH = ['at_risk', 'poor', 'critical'];

export async function handleJourneys(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /customer/:customerId
  if (method === 'GET' && first === 'customer' && second) {
    const { data } = await db
      .from('customer_journeys')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', second)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data)
      return errorResponse(404, 'No journey for this customer', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /needing-attention
  if (method === 'GET' && first === 'needing-attention') {
    const { data, error } = await db
      .from('customer_journeys')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .in('journey_health', ATTENTION_HEALTH)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) return dbErr(req, requestId, 'Failed to fetch attention list', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:id/advance-stage
  if (method === 'POST' && first && second === 'advance-stage') {
    const body = (await req.json().catch(() => ({}))) as {
      stage?: string;
      newStage?: string;
      new_stage?: string;
    };
    const newStage = body.stage ?? body.newStage ?? body.new_stage;
    if (!newStage) {
      return errorResponse(400, 'stage (new stage) is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }

    // Load current stage for previous_stage tracking.
    const { data: current } = await db
      .from('customer_journeys')
      .select('current_stage')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    const previousStage = current?.current_stage ?? null;

    const { data, error } = await db
      .from('customer_journeys')
      .update({
        previous_stage: previousStage,
        current_stage: newStage,
        stage_entered_at: new Date().toISOString(),
        days_since_stage_change: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to advance stage', error);
    if (!data)
      return errorResponse(404, 'Journey not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /:id/record-touchpoint
  if (method === 'POST' && first && second === 'record-touchpoint') {
    const body = (await req.json().catch(() => ({}))) as {
      touchpointType?: string;
      touchpoint_type?: string;
    };
    const touchType = body.touchpointType ?? body.touchpoint_type ?? 'contact';

    // Read current counter + compute delta.
    const { data: current } = await db
      .from('customer_journeys')
      .select('total_touchpoints, last_touchpoint_date')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    const currentCount = (current?.total_touchpoints as number | null) ?? 0;

    const now = new Date().toISOString();
    let avgDays: number | null = null;
    if (current?.last_touchpoint_date && currentCount > 0) {
      const msSince = Date.now() - new Date(current.last_touchpoint_date as string).getTime();
      const newAvg = Math.max(1, Math.round(msSince / 86400000 / (currentCount + 1)));
      avgDays = newAvg;
    }

    const update: Record<string, unknown> = {
      total_touchpoints: currentCount + 1,
      last_touchpoint_date: now,
      last_touchpoint_type: touchType,
      updated_at: now,
    };
    if (avgDays !== null) update.avg_days_between_touchpoints = avgDays;

    const { data, error } = await db
      .from('customer_journeys')
      .update(update)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to record touchpoint', error);
    if (!data)
      return errorResponse(404, 'Journey not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // GET /
  if (method === 'GET' && !first) {
    let q = db.from('customer_journeys').select('*').eq('tenant_id', auth.tenantId);
    const currentStage = url.searchParams.get('currentStage');
    const lifecyclePhase = url.searchParams.get('lifecyclePhase');
    const journeyHealth = url.searchParams.get('journeyHealth');
    if (currentStage) q = q.eq('current_stage', currentStage);
    if (lifecyclePhase) q = q.eq('lifecycle_phase', lifecyclePhase);
    if (journeyHealth) q = q.eq('journey_health', journeyHealth);
    q = q.order('updated_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch journeys', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('customer_journeys')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch journey', error);
    if (!data)
      return errorResponse(404, 'Journey not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapJourney(body);
    row.tenant_id = auth.tenantId;
    if (
      !row.customer_id ||
      !row.current_stage ||
      !row.stage_entered_at ||
      !row.lifecycle_phase ||
      !row.journey_health
    ) {
      return errorResponse(
        400,
        'customer_id, current_stage, stage_entered_at, lifecycle_phase, journey_health required',
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    const { data, error } = await db.from('customer_journeys').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create journey', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapJourney(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('customer_journeys')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update journey', error);
    if (!data)
      return errorResponse(404, 'Journey not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

function mapJourney(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('customer_id', 'customerId', 'customer_id');
  set('current_stage', 'currentStage', 'current_stage');
  set('previous_stage', 'previousStage', 'previous_stage');
  set('stage_entered_at', 'stageEnteredAt', 'stage_entered_at');
  set('days_since_stage_change', 'daysSinceStageChange', 'days_since_stage_change');
  set('total_days_as_customer', 'totalDaysAsCustomer', 'total_days_as_customer');
  set('lifecycle_phase', 'lifecyclePhase', 'lifecycle_phase');
  set('onboarding_completed', 'onboardingCompleted', 'onboarding_completed');
  set('onboarding_completed_at', 'onboardingCompletedAt', 'onboarding_completed_at');
  set('first_service_completed', 'firstServiceCompleted', 'first_service_completed');
  set('first_service_completed_at', 'firstServiceCompletedAt', 'first_service_completed_at');
  set('first_renewal_completed', 'firstRenewalCompleted', 'first_renewal_completed');
  set('first_renewal_completed_at', 'firstRenewalCompletedAt', 'first_renewal_completed_at');
  set('engagement_trend', 'engagementTrend', 'engagement_trend');
  set('next_expected_stage', 'nextExpectedStage', 'next_expected_stage');
  set('predicted_stage_change_date', 'predictedStageChangeDate', 'predicted_stage_change_date');
  set('recommended_actions', 'recommendedActions', 'recommended_actions');
  set('journey_health', 'journeyHealth', 'journey_health');
  if (body.blockers !== undefined) r.blockers = body.blockers;
  set('current_intervention_id', 'currentInterventionId', 'current_intervention_id');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
