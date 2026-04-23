// BANT qualification + qualified leads list + qualification history.
//
// Paths (under /lead-scoring):
//   POST /bant/:leadId                    — upsert BANT; emits qualification_history on status change
//   GET  /bant/:leadId                    — fetch BANT
//   GET  /qualified?minScore=50           — qualified leads list (admin-visible)
//   GET  /bant-analytics                  — aggregates (admin|manager only)
//   GET  /qualification-history/:leadId   — per-lead status changes

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { isAdminOrManager } from '../_rbac.ts';

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export async function handleBant(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /qualified
  if (method === 'GET' && first === 'qualified') {
    const minScore = Math.max(0, parseInt(url.searchParams.get('minScore') ?? '50', 10) || 50);
    const { data: rows, error } = await db
      .from('bant_qualification_criteria')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .gte('total_bant_score', minScore)
      .order('total_bant_score', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch qualified leads', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }

    const leadIds = [...new Set(((rows ?? []) as AnyRec[]).map((r) => r.lead_id as string))];
    const byLead = await fetchBusinessRecordsById(db, leadIds, auth.tenantId);
    const enriched = ((rows ?? []) as AnyRec[]).map((q) => ({
      ...q,
      lead: byLead.get(q.lead_id) ?? null,
    }));
    return jsonResponse(enriched, 200, req, requestId);
  }

  // GET /bant-analytics (admin|manager)
  if (method === 'GET' && first === 'bant-analytics') {
    if (!isAdminOrManager(auth)) {
      return errorResponse(403, 'Admin or manager role required', req, {
        code: 'FORBIDDEN',
        requestId,
      });
    }
    return await bantAnalytics(req, ctx);
  }

  // GET /qualification-history/:leadId
  if (method === 'GET' && first === 'qualification-history' && second) {
    if (!(await verifyLead(db, second, auth.tenantId))) {
      return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
    }
    const { data, error } = await db
      .from('lead_qualification_history')
      .select('*')
      .eq('lead_id', second)
      .eq('tenant_id', auth.tenantId)
      .order('changed_at', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch history', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /bant/:leadId
  if (method === 'POST' && first === 'bant' && second) {
    return await upsertBant(req, ctx, second);
  }

  // GET /bant/:leadId
  if (method === 'GET' && first === 'bant' && second) {
    if (!(await verifyLead(db, second, auth.tenantId))) {
      return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
    }
    const { data } = await db
      .from('bant_qualification_criteria')
      .select('*')
      .eq('lead_id', second)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (!data) {
      return errorResponse(404, 'No BANT qualification found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

async function upsertBant(req: Request, ctx: HandlerCtx, leadId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  if (!(await verifyLead(db, leadId, auth.tenantId))) {
    return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
  }
  const body = (await req.json().catch(() => null)) as AnyRec | null;
  if (!body) {
    return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
  }

  // Scoring (mirrors Express):
  const budgetIdentified = !!(body.budgetIdentified ?? body.budget_identified);
  const budgetApproved = !!(body.budgetApproved ?? body.budget_approved);
  const budgetScore = budgetIdentified ? (budgetApproved ? 25 : 15) : 0;

  const decisionMakerIdentified = !!(
    body.decisionMakerIdentified ?? body.decision_maker_identified
  );
  const authorityScore = decisionMakerIdentified ? 25 : 0;

  const needIdentified = !!(body.needIdentified ?? body.need_identified);
  const needUrgency = String(body.needUrgency ?? body.need_urgency ?? '').toLowerCase();
  const needScore = needIdentified
    ? needUrgency === 'critical'
      ? 25
      : needUrgency === 'high'
        ? 20
        : 15
    : 0;

  const timelineIdentified = !!(body.timelineIdentified ?? body.timeline_identified);
  const decisionTimeline = String(
    body.decisionTimeline ?? body.decision_timeline ?? '',
  ).toLowerCase();
  const timelineScore = timelineIdentified
    ? decisionTimeline === 'immediate'
      ? 25
      : decisionTimeline === '30_days'
        ? 20
        : 15
    : 0;

  const totalBantScore = budgetScore + authorityScore + needScore + timelineScore;
  const qualificationStatus =
    totalBantScore >= 75
      ? 'highly_qualified'
      : totalBantScore >= 50
        ? 'qualified'
        : totalBantScore >= 25
          ? 'partially_qualified'
          : 'unqualified';

  const now = new Date().toISOString();
  const qualifiedDate =
    qualificationStatus === 'qualified' || qualificationStatus === 'highly_qualified' ? now : null;

  const row = mapBantFields(body);
  Object.assign(row, {
    lead_id: leadId,
    tenant_id: auth.tenantId,
    budget_identified: budgetIdentified,
    budget_approved: budgetApproved,
    budget_score: budgetScore,
    decision_maker_identified: decisionMakerIdentified,
    authority_score: authorityScore,
    need_identified: needIdentified,
    need_urgency: needUrgency || null,
    need_score: needScore,
    timeline_identified: timelineIdentified,
    decision_timeline: decisionTimeline || null,
    timeline_score: timelineScore,
    total_bant_score: totalBantScore,
    qualification_status: qualificationStatus,
    qualified_date: qualifiedDate,
    assessed_by: auth.userId,
    last_assessed_at: now,
    updated_at: now,
  });

  const { data: existing } = await db
    .from('bant_qualification_criteria')
    .select('id, qualification_status')
    .eq('lead_id', leadId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  let saved: AnyRec | null = null;
  if (existing?.id) {
    const { data, error } = await db
      .from('bant_qualification_criteria')
      .update(row)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update BANT', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    saved = data;
  } else {
    const { data, error } = await db
      .from('bant_qualification_criteria')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create BANT', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    saved = data;
  }

  // If status changed, log history
  if (existing && existing.qualification_status !== qualificationStatus) {
    await db.from('lead_qualification_history').insert({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      previous_status: existing.qualification_status,
      new_status: qualificationStatus,
      status_reason: 'BANT assessment updated',
      score_at_change: totalBantScore,
      bant_score_at_change: totalBantScore,
      changed_by: auth.userId,
      change_reason: 'bant_assessment',
    });
  }

  return jsonResponse(saved, 200, req, requestId);
}

async function bantAnalytics(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  // Fetch all BANT rows and aggregate in JS — tenant-scoped, typical sizes
  // are 100s-low-1000s per tenant which is fine in-process.
  const { data, error } = await db
    .from('bant_qualification_criteria')
    .select(
      'qualification_status, total_bant_score, budget_score, authority_score, need_score, timeline_score',
    )
    .eq('tenant_id', auth.tenantId);
  if (error) {
    return errorResponse(500, 'Failed to fetch BANT analytics', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  const rows = (data ?? []) as Array<{
    qualification_status: string | null;
    total_bant_score: number | null;
    budget_score: number | null;
    authority_score: number | null;
    need_score: number | null;
    timeline_score: number | null;
  }>;

  const statusDist: Record<string, number> = {};
  let sumTotal = 0;
  let sumB = 0;
  let sumA = 0;
  let sumN = 0;
  let sumT = 0;
  for (const r of rows) {
    const s = r.qualification_status ?? 'unqualified';
    statusDist[s] = (statusDist[s] ?? 0) + 1;
    sumTotal += r.total_bant_score ?? 0;
    sumB += r.budget_score ?? 0;
    sumA += r.authority_score ?? 0;
    sumN += r.need_score ?? 0;
    sumT += r.timeline_score ?? 0;
  }
  const n = rows.length;
  const avg = (x: number) => (n > 0 ? Number((x / n).toFixed(2)) : 0);

  return jsonResponse(
    {
      totalAssessed: n,
      statusDistribution: statusDist,
      averageScores: {
        total: avg(sumTotal),
        budget: avg(sumB),
        authority: avg(sumA),
        need: avg(sumN),
        timeline: avg(sumT),
      },
    },
    200,
    req,
    requestId,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapBantFields(body: AnyRec): AnyRec {
  const r: AnyRec = {};
  const src = (camel: string, snake: string) => body[camel] ?? body[snake];

  if (src('budgetAmount', 'budget_amount') !== undefined)
    r.budget_amount = src('budgetAmount', 'budget_amount');
  if (src('budgetTimeframe', 'budget_timeframe') !== undefined)
    r.budget_timeframe = src('budgetTimeframe', 'budget_timeframe');
  if (src('budgetNotes', 'budget_notes') !== undefined)
    r.budget_notes = src('budgetNotes', 'budget_notes');
  if (src('decisionMakerName', 'decision_maker_name') !== undefined)
    r.decision_maker_name = src('decisionMakerName', 'decision_maker_name');
  if (src('decisionMakerTitle', 'decision_maker_title') !== undefined)
    r.decision_maker_title = src('decisionMakerTitle', 'decision_maker_title');
  if (src('decisionMakerContact', 'decision_maker_contact') !== undefined)
    r.decision_maker_contact = src('decisionMakerContact', 'decision_maker_contact');
  if (src('decisionProcess', 'decision_process') !== undefined)
    r.decision_process = src('decisionProcess', 'decision_process');
  if (src('authorityNotes', 'authority_notes') !== undefined)
    r.authority_notes = src('authorityNotes', 'authority_notes');
  if (src('needType', 'need_type') !== undefined) r.need_type = src('needType', 'need_type');
  if (src('needDescription', 'need_description') !== undefined)
    r.need_description = src('needDescription', 'need_description');
  if (src('painPoints', 'pain_points') !== undefined)
    r.pain_points = src('painPoints', 'pain_points');
  if (src('needNotes', 'need_notes') !== undefined) r.need_notes = src('needNotes', 'need_notes');
  if (src('expectedCloseDate', 'expected_close_date') !== undefined)
    r.expected_close_date = src('expectedCloseDate', 'expected_close_date');
  if (src('implementationTimeline', 'implementation_timeline') !== undefined)
    r.implementation_timeline = src('implementationTimeline', 'implementation_timeline');
  if (body.blockers !== undefined) r.blockers = body.blockers;
  if (src('timelineNotes', 'timeline_notes') !== undefined)
    r.timeline_notes = src('timelineNotes', 'timeline_notes');
  if (src('disqualifiedReason', 'disqualified_reason') !== undefined)
    r.disqualified_reason = src('disqualifiedReason', 'disqualified_reason');
  return r;
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

async function fetchBusinessRecordsById(
  // deno-lint-ignore no-explicit-any
  db: any,
  ids: string[],
  tenantId: string,
): Promise<Map<string, AnyRec>> {
  const m = new Map<string, AnyRec>();
  if (ids.length === 0) return m;
  const { data } = await db
    .from('business_records')
    .select('id, company_name, status, owner_id')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  for (const r of (data ?? []) as AnyRec[]) {
    m.set(r.id, r);
  }
  return m;
}
