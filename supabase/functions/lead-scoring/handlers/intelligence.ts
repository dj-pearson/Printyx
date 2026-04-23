// Lead Intelligence handlers.
//
// Paths (under /lead-intelligence):
//   GET  /:leadId                     — full intel bundle
//   POST /:leadId/score               — recompute score
//   POST /:leadId/enrich              — Apollo match + field copy
//   POST /:leadId/process             — enrich + score (lead creation)
//   POST /batch/score                 — bulk re-score (cap 100)
//   GET  /analytics/overview          — scoring analytics aggregates
//   GET  /attention/required          — hot leads requiring contact
//
// Internally delegates the scoring math to handlers/calculate.ts so there's
// exactly one implementation of the rule engine.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const MAX_BATCH = 100;

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export async function handleIntelligence(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  if (!first) return null;

  // GET /analytics/overview
  if (method === 'GET' && first === 'analytics' && second === 'overview') {
    const { data, error } = await db.rpc('lead_scoring_analytics', {
      p_tenant_id: auth.tenantId,
    });
    if (error) {
      return errorResponse(500, 'Failed to fetch analytics', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // GET /attention/required
  if (method === 'GET' && first === 'attention' && second === 'required') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 100);
    return await attentionRequired(req, ctx, limit);
  }

  // POST /batch/score
  if (method === 'POST' && first === 'batch' && second === 'score') {
    const body = (await req.json().catch(() => null)) as { leadIds?: string[] } | null;
    if (!Array.isArray(body?.leadIds) || body!.leadIds.length === 0) {
      return errorResponse(400, 'leadIds array required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    if (body!.leadIds.length > MAX_BATCH) {
      return errorResponse(400, `Batch size exceeds limit of ${MAX_BATCH}`, req, {
        code: 'BATCH_TOO_LARGE',
        requestId,
      });
    }
    return await batchScore(req, ctx, body!.leadIds);
  }

  // /:leadId/* routes — `first` is the leadId
  const leadId = first;
  if (!(await verifyLead(db, leadId, auth.tenantId))) {
    return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
  }

  // POST /:leadId/score
  if (method === 'POST' && second === 'score') {
    const score = await computeScoreInline(db, auth.tenantId, auth.userId, leadId);
    return jsonResponse({ success: true, score }, 200, req, requestId);
  }

  // POST /:leadId/enrich
  if (method === 'POST' && second === 'enrich') {
    const result = await enrichFromApollo(db, auth.tenantId, auth.userId, leadId);
    return jsonResponse({ success: true, enrichment: result }, 200, req, requestId);
  }

  // POST /:leadId/process (enrich + score + qualification_history)
  if (method === 'POST' && second === 'process') {
    const enrichment = await enrichFromApollo(db, auth.tenantId, auth.userId, leadId);
    const score = await computeScoreInline(db, auth.tenantId, auth.userId, leadId);

    // Seed a qualification-history row so the lead's arc is tracked from day one.
    await db.from('lead_qualification_history').insert({
      tenant_id: auth.tenantId,
      lead_id: leadId,
      previous_status: null,
      new_status: score.leadTier === 'hot' ? 'mql' : 'new',
      status_reason: 'Initial scoring on lead processing',
      score_at_change: score.totalScore,
      bant_score_at_change: score.bantScore,
      changed_by: auth.userId ?? 'system',
      change_reason: 'automatic',
    });

    return jsonResponse({ success: true, enrichment, score }, 200, req, requestId);
  }

  // GET /:leadId — intel bundle (no sub-path)
  if (method === 'GET' && !second) {
    return await leadIntelligenceBundle(req, ctx, leadId);
  }

  return null;
}

// ─── Intel bundle ─────────────────────────────────────────────────────────────

async function leadIntelligenceBundle(
  req: Request,
  ctx: HandlerCtx,
  leadId: string,
): Promise<Response> {
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

  const [latest, factors, bant, engagements, history, apollo] = await Promise.all([
    db
      .from('lead_score_calculations')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('lead_scoring_factors')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId),
    db
      .from('bant_qualification_criteria')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle(),
    db
      .from('lead_engagement_tracking')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .gte('engaged_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('engaged_at', { ascending: false })
      .limit(50),
    db
      .from('lead_qualification_history')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('changed_at', { ascending: false })
      .limit(20),
    db
      .from('tenant_apollo_leads')
      .select('id, apollo_contact_id, apollo_id, status')
      .eq('tenant_id', auth.tenantId)
      .eq('business_record_id', leadId)
      .limit(1)
      .maybeSingle(),
  ]);

  const score = latest.data
    ? {
        totalScore: latest.data.total_score,
        demographicScore: latest.data.demographic_score ?? 0,
        firmographicScore: latest.data.firmographic_score ?? 0,
        behavioralScore: latest.data.behavioral_score ?? 0,
        engagementScore: latest.data.engagement_score ?? 0,
        bantScore: latest.data.bant_score ?? 0,
        leadGrade: latest.data.lead_grade ?? 'D',
        leadTier: (latest.data.lead_tier ?? 'cold') as 'hot' | 'warm' | 'cold',
        recommendedAction: latest.data.recommended_action ?? 'request_more_info',
        factors: ((factors.data ?? []) as AnyRec[]).map((f) => ({
          ruleName: f.factor_name,
          category: f.factor_category,
          points: f.points_awarded,
          field: f.evaluated_field ?? '',
          value: f.evaluated_value,
        })),
      }
    : null;

  return jsonResponse(
    {
      leadId,
      score,
      enrichment: apollo.data
        ? {
            enriched: true,
            source: 'apollo',
            fieldsUpdated: [],
            apolloContactId: apollo.data.apollo_contact_id,
            confidence: 1.0,
          }
        : null,
      bantQualification: bant.data ?? null,
      recentEngagements: engagements.data ?? [],
      qualificationHistory: history.data ?? [],
      syncStatus: {
        salesforce: !!lead.external_salesforce_id,
        apollo: !!apollo.data,
        lastSyncDate: lead.last_sync_date ?? null,
      },
    },
    200,
    req,
    requestId,
  );
}

// ─── Batch scoring ────────────────────────────────────────────────────────────

async function batchScore(req: Request, ctx: HandlerCtx, leadIds: string[]): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const errors: string[] = [];
  let processed = 0;
  for (const id of leadIds) {
    try {
      await computeScoreInline(db, auth.tenantId, auth.userId, id);
      processed++;
    } catch (err) {
      errors.push(`Lead ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return jsonResponse({ processed, errors }, 200, req, requestId);
}

// ─── Hot leads requiring attention ────────────────────────────────────────────

async function attentionRequired(req: Request, ctx: HandlerCtx, limit: number): Promise<Response> {
  const { auth, db, requestId } = ctx;
  // DISTINCT ON is easiest via rpc. Reuse lead_scoring_leaderboard then filter
  // client-side to lead_tier='hot'; for large tenants, add a dedicated rpc.
  const { data, error } = await db.rpc('lead_scoring_leaderboard', {
    p_tenant_id: auth.tenantId,
    p_limit: 500, // wider net so post-filter still hits the requested limit
  });
  if (error) {
    return errorResponse(500, 'Failed to fetch attention list', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  const hot = ((data ?? []) as AnyRec[]).filter((r) => r.leadTier === 'hot').slice(0, limit);
  return jsonResponse(hot, 200, req, requestId);
}

// ─── Apollo enrichment (simplified vs Express) ────────────────────────────────
//
// The deleted Express path was ~180 lines of per-field copy + tenant_apollo_leads
// upsert + optional org fetch. This version:
//   1. Looks up an apollo contact by lead.email.
//   2. If found, copies missing fields onto business_records.
//   3. Upserts a tenant_apollo_leads row keyed by (tenant, apollo_contact_id).
// Full Express fidelity (org fetch, multi-email fallback, phone arrays) is a
// follow-up — noted in the PRD.

async function enrichFromApollo(
  // deno-lint-ignore no-explicit-any
  db: any,
  tenantId: string,
  userId: string,
  leadId: string,
): Promise<{
  enriched: boolean;
  source: string;
  fieldsUpdated: string[];
  apolloContactId?: string;
  confidence: number;
  reason?: string;
}> {
  const { data: lead } = await db
    .from('business_records')
    .select('*')
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!lead) return { enriched: false, source: 'apollo', fieldsUpdated: [], confidence: 0 };

  if (!lead.email) {
    return {
      enriched: false,
      source: 'apollo',
      fieldsUpdated: [],
      confidence: 0,
      reason: 'Lead has no email to match against',
    };
  }

  const { data: apollo } = await db
    .from('centralized_apollo_contacts')
    .select('*')
    .eq('email', lead.email)
    .limit(1)
    .maybeSingle();
  if (!apollo) {
    return {
      enriched: false,
      source: 'apollo',
      fieldsUpdated: [],
      confidence: 0,
      reason: 'No Apollo contact found for lead email',
    };
  }

  const updates: AnyRec = {};
  const fieldsUpdated: string[] = [];
  const copy = (leadKey: string, apolloKey: string) => {
    if (!lead[leadKey] && apollo[apolloKey]) {
      updates[leadKey] = apollo[apolloKey];
      fieldsUpdated.push(leadKey);
    }
  };
  copy('first_name', 'first_name');
  copy('last_name', 'last_name');
  copy('job_title', 'title');
  copy('linkedin_url', 'linkedin_url');
  copy('industry', 'industry');
  copy('employee_count', 'employee_count');
  copy('website', 'website_url');
  copy('company_name', 'organization_name');

  // Phone: apollo stores string[] in phone_numbers
  if (!lead.phone && Array.isArray(apollo.phone_numbers) && apollo.phone_numbers.length > 0) {
    updates.phone = apollo.phone_numbers[0];
    fieldsUpdated.push('phone');
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    updates.enriched_from_apollo = true;
    updates.apollo_enriched_at = new Date().toISOString();
    await db.from('business_records').update(updates).eq('id', leadId).eq('tenant_id', tenantId);
  }

  // Tenant-apollo lead record — upsert
  const { data: existing } = await db
    .from('tenant_apollo_leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('apollo_contact_id', apollo.id)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from('tenant_apollo_leads')
      .update({
        business_record_id: leadId,
        status: 'added_to_crm',
        added_to_crm: true,
        added_at: new Date().toISOString(),
        added_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await db.from('tenant_apollo_leads').insert({
      tenant_id: tenantId,
      apollo_contact_id: apollo.id,
      apollo_id: apollo.apollo_id,
      business_record_id: leadId,
      status: 'added_to_crm',
      added_to_crm: true,
      added_at: new Date().toISOString(),
      added_by: userId,
      discovered_via: 'apollo_enrichment',
    });
  }

  return {
    enriched: fieldsUpdated.length > 0,
    source: 'apollo',
    fieldsUpdated,
    apolloContactId: apollo.id,
    confidence: 0.95,
  };
}

// ─── Score computation (delegates to handlers/calculate.ts) ──────────────────

async function computeScoreInline(
  // deno-lint-ignore no-explicit-any
  db: any,
  tenantId: string,
  userId: string,
  leadId: string,
): Promise<{
  totalScore: number;
  bantScore: number;
  leadTier: string;
  leadGrade: string;
}> {
  // Rather than spawn an HTTP call, fabricate a minimal Request + HandlerCtx and
  // call handleCalculate directly. That keeps the rule engine in one place.
  const fakeUrl = new URL(`http://internal/lead-scoring/calculate/${leadId}`);
  const fakeReq = new Request(fakeUrl.toString(), { method: 'POST' });
  // Import lazily to avoid top-level circular import.
  const { handleCalculate } = await import('./calculate.ts');
  const ctx: HandlerCtx = {
    auth: { tenantId, userId } as AnyRec,
    db,
    requestId: 'internal',
    pathParts: ['calculate', leadId],
    method: 'POST',
    url: fakeUrl,
  };
  const res = await handleCalculate(fakeReq, ctx);
  if (!res) throw new Error('Internal calculate() returned null');
  const body = (await res.json()) as AnyRec;
  const calc = body.calculation as AnyRec | undefined;
  return {
    totalScore: calc?.total_score ?? 0,
    bantScore: calc?.bant_score ?? 0,
    leadTier: calc?.lead_tier ?? 'cold',
    leadGrade: calc?.lead_grade ?? 'D',
  };
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
