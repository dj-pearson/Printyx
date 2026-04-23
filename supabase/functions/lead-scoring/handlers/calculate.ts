// Score calculation + retrieval.
//
// Paths (under /lead-scoring):
//   POST /calculate/:leadId              — recompute + persist
//   GET  /score/:leadId                  — latest + factors
//   GET  /score/:leadId/history          — full calc history
//   GET  /leaderboard?limit=100          — top scored (rpc)
//   GET  /grade/:grade?limit=100         — filtered by grade (rpc)
//
// Algorithm follows server/routes/lead-scoring-routes.ts:181-377 exactly, with
// the same caps (demo/firmo/behav/engag max 20 each, bant max 25, bant
// weighted at 0.8), grading thresholds, and tier bands.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

interface Rule {
  id: string;
  rule_name: string;
  category: string;
  field: string;
  operator: string;
  value: unknown;
  score_points: number;
}

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export async function handleCalculate(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];
  const third = pathParts[2];

  // POST /calculate/:leadId
  if (method === 'POST' && first === 'calculate' && second) {
    return await calculate(req, ctx, second);
  }

  // GET /score/:leadId
  if (method === 'GET' && first === 'score' && second && !third) {
    const leadId = second;
    if (!(await verifyLead(db, leadId, auth.tenantId))) {
      return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
    }
    const { data: score } = await db
      .from('lead_score_calculations')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!score) {
      return errorResponse(404, 'No score calculated for this lead', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    const { data: factors } = await db
      .from('lead_scoring_factors')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('evaluated_at', { ascending: false });
    return jsonResponse({ score, factors: factors ?? [] }, 200, req, requestId);
  }

  // GET /score/:leadId/history
  if (method === 'GET' && first === 'score' && second && third === 'history') {
    const leadId = second;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
    if (!(await verifyLead(db, leadId, auth.tenantId))) {
      return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
    }
    const { data, error } = await db
      .from('lead_score_calculations')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('calculated_at', { ascending: false })
      .limit(limit);
    if (error) {
      return errorResponse(500, 'Failed to fetch history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /leaderboard
  if (method === 'GET' && first === 'leaderboard') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
    const { data, error } = await db.rpc('lead_scoring_leaderboard', {
      p_tenant_id: auth.tenantId,
      p_limit: limit,
    });
    if (error) {
      return errorResponse(500, 'Failed to fetch leaderboard', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /grade/:grade
  if (method === 'GET' && first === 'grade' && second) {
    const grade = second;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
    const { data, error } = await db.rpc('lead_scoring_by_grade', {
      p_tenant_id: auth.tenantId,
      p_grade: grade,
      p_limit: limit,
    });
    if (error) {
      return errorResponse(500, 'Failed to fetch leads by grade', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  return null;
}

async function calculate(req: Request, ctx: HandlerCtx, leadId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: lead } = await db
    .from('business_records')
    .select('*')
    .eq('id', leadId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!lead) {
    return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
  }

  const { data: rulesData } = await db
    .from('lead_scoring_rules')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });
  const rules = (rulesData ?? []) as Rule[];

  let demographicScore = 0;
  let firmographicScore = 0;
  let behavioralScore = 0;
  let engagementScore = 0;
  let bantScore = 0;
  const appliedRules: string[] = [];
  const startTime = Date.now();

  // Wipe previous factors for this lead (tenant-scoped for safety).
  await db
    .from('lead_scoring_factors')
    .delete()
    .eq('lead_id', leadId)
    .eq('tenant_id', auth.tenantId);

  const factorInserts: AnyRec[] = [];

  for (const rule of rules) {
    const fieldValue = (lead as AnyRec)[rule.field];
    if (!evaluateRule(rule, fieldValue)) continue;

    appliedRules.push(rule.id);
    factorInserts.push({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      rule_id: rule.id,
      factor_name: rule.rule_name,
      factor_category: rule.category,
      points_awarded: rule.score_points,
      evaluated_field: rule.field,
      evaluated_value: fieldValue ?? null,
      rule_condition: { operator: rule.operator, value: rule.value },
    });

    switch (rule.category) {
      case 'demographic':
        demographicScore += rule.score_points;
        break;
      case 'firmographic':
        firmographicScore += rule.score_points;
        break;
      case 'behavioral':
        behavioralScore += rule.score_points;
        break;
      case 'engagement':
        engagementScore += rule.score_points;
        break;
      case 'bant':
        bantScore += rule.score_points;
        break;
    }
  }

  if (factorInserts.length > 0) {
    await db.from('lead_scoring_factors').insert(factorInserts);
  }

  // BANT override from qualification record
  const { data: bant } = await db
    .from('bant_qualification_criteria')
    .select('total_bant_score')
    .eq('lead_id', leadId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (bant?.total_bant_score != null) {
    bantScore = bant.total_bant_score;
  }

  // Engagement score from tracking (last 30 days)
  const engagementBoost = await getEngagementScore(db, auth.tenantId, leadId, 30);
  engagementScore += engagementBoost;

  // Cap each component
  demographicScore = Math.min(demographicScore, 20);
  firmographicScore = Math.min(firmographicScore, 20);
  behavioralScore = Math.min(behavioralScore, 20);
  engagementScore = Math.min(engagementScore, 20);
  bantScore = Math.min(bantScore, 25);

  const totalScore =
    demographicScore + firmographicScore + behavioralScore + engagementScore + bantScore * 0.8;
  const cappedTotalScore = Math.min(Math.round(totalScore), 100);

  const leadGrade = gradeFromScore(cappedTotalScore);
  const leadTier = tierFromScore(cappedTotalScore);
  const recommendedAction = actionFromScore(cappedTotalScore);

  // Previous score for delta
  const { data: prev } = await db
    .from('lead_score_calculations')
    .select('total_score')
    .eq('lead_id', leadId)
    .eq('tenant_id', auth.tenantId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousScore = prev?.total_score ?? 0;
  const scoreChange = cappedTotalScore - previousScore;

  const calc = {
    tenant_id: auth.tenantId,
    lead_id: leadId,
    demographic_score: demographicScore,
    firmographic_score: firmographicScore,
    behavioral_score: behavioralScore,
    engagement_score: engagementScore,
    bant_score: Math.round(bantScore),
    total_score: cappedTotalScore,
    previous_score: previousScore,
    score_change: scoreChange,
    lead_grade: leadGrade,
    lead_tier: leadTier,
    prediction_score: null,
    confidence_level: 'medium',
    recommended_action: recommendedAction,
    calculation_method: 'rule_based',
    rules_applied: appliedRules,
    calculation_duration_ms: Date.now() - startTime,
  };

  const { data: calculation, error: insErr } = await db
    .from('lead_score_calculations')
    .insert(calc)
    .select()
    .maybeSingle();
  if (insErr) {
    return errorResponse(500, 'Failed to save calculation', req, {
      code: 'DB_ERROR',
      details: insErr,
      requestId,
    });
  }

  // Update business_records.lead_score + priority
  const priority = leadTier === 'hot' ? 'high' : leadTier === 'warm' ? 'medium' : 'low';
  await db
    .from('business_records')
    .update({
      lead_score: cappedTotalScore,
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('tenant_id', auth.tenantId);

  // Return calculation + fresh factors
  const { data: factors } = await db
    .from('lead_scoring_factors')
    .select('*')
    .eq('lead_id', leadId)
    .eq('tenant_id', auth.tenantId)
    .order('evaluated_at', { ascending: false });

  return jsonResponse({ calculation, factors: factors ?? [] }, 200, req, requestId);
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function evaluateRule(rule: Rule, fieldValue: unknown): boolean {
  const v = rule.value as unknown;
  switch (rule.operator) {
    case 'equals':
      return fieldValue === v;
    case 'not_equals':
      return fieldValue !== v;
    case 'greater_than':
      return Number(fieldValue) > Number(v);
    case 'less_than':
      return Number(fieldValue) < Number(v);
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(v);
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(v);
    case 'contains':
      return String(fieldValue ?? '')
        .toLowerCase()
        .includes(String(v).toLowerCase());
    case 'in_list':
      return Array.isArray(v) && (v as unknown[]).includes(fieldValue);
    case 'is_null':
      return fieldValue === null || fieldValue === undefined;
    case 'is_not_null':
      return fieldValue !== null && fieldValue !== undefined;
    default:
      return false;
  }
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  return 'D';
}

function tierFromScore(score: number): string {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  return 'cold';
}

function actionFromScore(score: number): string {
  if (score >= 75) return 'contact_immediately';
  if (score >= 50) return 'nurture';
  if (score >= 30) return 'request_more_info';
  return 'disqualify';
}

// deno-lint-ignore no-explicit-any
async function verifyLead(db: any, leadId: string, tenantId: string): Promise<boolean> {
  const { data } = await db
    .from('business_records')
    .select('id')
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !!data;
}

async function getEngagementScore(
  // deno-lint-ignore no-explicit-any
  db: any,
  tenantId: string,
  leadId: string,
  daysSince: number,
): Promise<number> {
  const since = new Date(Date.now() - daysSince * 86400000).toISOString();
  const { data } = await db
    .from('lead_engagement_tracking')
    .select('engagement_value')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .gte('engaged_at', since);

  const total = ((data ?? []) as Array<{ engagement_value: number | null }>).reduce(
    (sum, r) => sum + (r.engagement_value ?? 1),
    0,
  );
  return total;
}
