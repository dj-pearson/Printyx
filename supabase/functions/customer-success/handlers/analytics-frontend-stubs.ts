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

import { jsonResponse } from '../../_shared/http.ts';
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

export async function handleSatisfaction(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  if (ctx.method !== 'GET') return null;
  return jsonResponse(
    {
      summary: {
        npsScore: null,
        overallSatisfaction: null,
        responseRate: null,
      },
      categoryTrends: {},
      recentSurveys: [],
      degraded: {
        satisfaction: true,
        reason:
          'No satisfaction data exists to aggregate. customer_satisfaction_surveys, its templates and its questions are read in three places and written by nothing at all - no survey can be created, so none can be answered.',
      },
    },
    200,
    req,
    ctx.requestId,
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
