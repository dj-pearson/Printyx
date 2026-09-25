// Frontend-stub endpoints for the Customer Success module.
//
// These three endpoints are referenced by client/src/pages/CustomerSuccessManagement.tsx
// (lines 191-215) but were never implemented on the Express side either —
// the page renders defensively (`{usageAnalytics && ...}`), so the absence
// shows blank panels.
//
// Returning shape-compatible degraded responses lets the page render without
// errors and gives a clear place for future real implementations. Each
// response carries a `degraded: { reason }` block so callers can detect
// the stub state.
//
// THE FIGURES ARE NULL, NOT ZERO (AUDIT-028). They used to be zero, and nothing
// on the page read the `degraded` block, so a CSM opening /customer-success was
// told their customers rate them 0.0 out of 5 - drawn as five empty stars -
// with an NPS of 0 in green, a 0% response rate, 0% equipment utilisation
// behind a progress bar, and a "+0%" trend also in green. Zero is a claim, and
// on an NPS scale that runs -100 to 100 it is a specific and quite bad one. A
// figure with no source is null and renders as an em dash.
//
// URLs (dispatched by customer-success/index.ts switch on first segment):
//   GET  /customer-success/usage-analytics       — usage trends + customer breakdown
//   GET  /customer-success/satisfaction          — NPS + survey aggregates
//   POST /customer-success/calculate-health      — trigger health score recalc

import { jsonResponse, errorResponse } from '../../_shared/http.ts';
import { fetchAllRows } from '../../_shared/paged-select.ts';
import { npsCategory, summariseSatisfaction } from '../../../../shared/csat-survey.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleUsageAnalytics(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  if (ctx.method !== 'GET') return null;
  const period = ctx.url.searchParams.get('period') ?? 'month';
  return jsonResponse(
    {
      summary: {
        averageUtilization: null,
        totalMonthlyVolume: null,
        utilizationTrend: null,
      },
      optimizationOpportunities: [],
      customerBreakdown: [],
      period,
      degraded: {
        usageAnalytics: true,
        reason:
          'Usage analytics aggregation not yet ported to edge function. Requires meter-reading + contract-volume joins. Tracked in EDGE-002k follow-up.',
      },
    },
    200,
    req,
    ctx.requestId,
  );
}

/**
 * GET /customer-success/satisfaction (CSAT-PRODUCER-001, round 181).
 *
 * This was a stub answering null with a reason saying no survey could be
 * created. Round 180 built the producer - a completed service ticket now
 * creates one - so this aggregates the real rows: the mean overall score,
 * NPS, the response rate, and the most recent completed surveys with the
 * customer's written feedback. Every figure is null when nothing supports it
 * (summariseSatisfaction), so a tenant whose customers have not answered yet
 * still sees an honest empty state. categoryTrends stays empty: nothing
 * stores per-category history or targets, and a trend drawn from one window
 * is not a trend.
 */
export async function handleSatisfaction(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  if (ctx.method !== 'GET') return null;
  const { db, auth, requestId } = ctx;

  let surveys: Array<Record<string, unknown>>;
  try {
    surveys = await fetchAllRows<Record<string, unknown>>(() =>
      db
        .from('customer_satisfaction_surveys')
        .select('id, customer_id, status, overall_score, nps_score, completed_at')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false }),
    );
  } catch (err) {
    console.error('Error reading satisfaction surveys:', err);
    return errorResponse(500, 'Failed to load satisfaction data', req, {
      code: 'SATISFACTION_READ_FAILED',
      requestId,
    });
  }

  const summary = summariseSatisfaction(surveys as never);

  const recent = surveys
    .filter((s) => s.status === 'completed' && s.completed_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    .slice(0, 10);

  // Written feedback and customer names, one read each for the page of ten.
  const feedback = new Map<string, string>();
  const names = new Map<string, string>();
  if (recent.length > 0) {
    const { data: responses } = await db
      .from('customer_satisfaction_survey_responses')
      .select('survey_id, text_value')
      .in(
        'survey_id',
        recent.map((s) => s.id),
      )
      .not('text_value', 'is', null);
    for (const r of responses ?? []) {
      const text = String(r.text_value ?? '').trim();
      if (text && !feedback.has(r.survey_id)) feedback.set(r.survey_id, text);
    }
    const customerIds = [...new Set(recent.map((s) => s.customer_id as string))];
    const { data: customers } = await db
      .from('business_records')
      .select('id, company_name')
      .eq('tenant_id', auth.tenantId)
      .in('id', customerIds);
    for (const c of customers ?? []) if (c.company_name) names.set(c.id, c.company_name);
  }

  return jsonResponse(
    {
      summary: {
        npsScore: summary.npsScore,
        overallSatisfaction: summary.overallSatisfaction,
        responseRate: summary.responseRate,
      },
      counts: { sent: summary.sentCount, completed: summary.completedCount },
      categoryTrends: {},
      recentSurveys: recent.map((s) => {
        const nps = s.nps_score === null || s.nps_score === undefined ? null : Number(s.nps_score);
        return {
          surveyId: s.id,
          customerName: names.get(s.customer_id as string) ?? 'Unknown customer',
          submittedDate: s.completed_at,
          scores: { overall: Number(s.overall_score ?? 0), nps },
          category: npsCategory(nps) ?? 'unrated',
          feedback: feedback.get(s.id as string) ?? '',
          actionItems: [],
        };
      }),
      degraded:
        summary.completedCount === 0
          ? {
              satisfaction: true,
              reason:
                summary.sentCount === 0
                  ? 'No satisfaction surveys have been sent yet. One is created when a service ticket is completed.'
                  : 'Surveys have been sent, but no customer has completed one yet.',
            }
          : undefined,
    },
    200,
    req,
    requestId,
  );
}

export async function handleCalculateHealth(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  if (ctx.method !== 'POST') return null;
  const { requestId } = ctx;

  // 501, and it no longer touches the database.
  //
  // This used to move customer_health_scores.next_review_date forward and
  // answer 202 "Recalculation queued", while the page toasted "Customer health
  // scores have been recalculated successfully" and then displayed that same
  // next review date. Nothing was recalculated. So the one visible effect of
  // pressing the button was to make a stale score look freshly reviewed - it
  // did not merely report work it had not done, it wrote the appearance of that
  // work into the row a CSM reads. An honest refusal is strictly better, and it
  // is the shape the rest of this tree already uses for an engine that does not
  // exist yet.
  return jsonResponse(
    {
      error: 'Health score recalculation is not implemented',
      detail:
        'The scoring pipeline was never ported from the Express service. Nothing computes a health score today, so there is nothing to recalculate; the stored scores are whatever last wrote them.',
      code: 'NOT_IMPLEMENTED',
    },
    501,
    req,
    requestId,
  );
}
