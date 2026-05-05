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
        averageUtilization: 0,
        totalMonthlyVolume: 0,
        utilizationTrend: 0,
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
        npsScore: 0,
        overallSatisfaction: 0,
        responseRate: 0,
      },
      categoryTrends: {},
      recentSurveys: [],
      degraded: {
        satisfaction: true,
        reason:
          'Satisfaction surveys aggregation not yet ported. Requires customer_satisfaction_surveys table aggregation. Tracked in EDGE-002k follow-up.',
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
  const { auth, db, requestId } = ctx;
  let body: { recalculateAll?: boolean; customerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  // Touch the customer_health_scores table's next_review_date so dashboards
  // relying on that field don't permanently show stale values. Real
  // recalculation is a heavier job that should land via a pg_cron task or a
  // background queue.
  if (body.recalculateAll) {
    await db
      .from('customer_health_scores')
      .update({ next_review_date: new Date().toISOString() })
      .eq('tenant_id', auth.tenantId);
  } else if (body.customerId) {
    await db
      .from('customer_health_scores')
      .update({ next_review_date: new Date().toISOString() })
      .eq('tenant_id', auth.tenantId)
      .eq('customer_id', body.customerId);
  }

  return jsonResponse(
    {
      status: 'queued',
      message: 'Health score recalculation queued.',
      degraded: {
        calculation: true,
        reason:
          'Full health-score recalculation pipeline not yet ported. Touched next_review_date so dashboards refresh; real per-customer scoring runs against the original Express service or via a future pg_cron job.',
      },
    },
    202,
    req,
    requestId,
  );
}
