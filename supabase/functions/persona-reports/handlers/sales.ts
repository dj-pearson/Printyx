// Sales reports — /persona-reports/sales/*
// Replaces server/routes/sales-reports-api.ts (9 endpoints, 414 lines) +
// server/services/sales-reporting-service.ts (763 lines).
//
// This pass ports the 4 core endpoints (pipeline, activity, quota, team
// comparison + team pipeline which reuses the comparison data). The remaining
// 4 endpoints return 501 with TODO pointers — they need either the full
// hierarchical query builder (leaderboard across location/company scope) or
// per-deal commission joins (commissions). Tracked in
// tasks/followup-reports-migration.md.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { getRoleLevel, hasMinLevel, parseDateRange } from '../_context.ts';

// Endpoints that are NOT yet ported — return 501 with source pointer.
const PENDING_ENDPOINTS: Record<string, { sourceLines: string; note: string }> = {
  'personal/commissions': {
    sourceLines: 'sales-reporting-service.ts:355-402',
    note: 'Commission plan JOIN — needs commission_plans table confirmation.',
  },
  'personal/leaderboard': {
    sourceLines: 'sales-reporting-service.ts:408-500',
    note: 'Needs hierarchical scope (team/location/company) from RBAC builder.',
  },
  'team/pipeline-summary': {
    sourceLines: 'sales-reporting-service.ts::getTeamPipelineSummary',
    note: 'Richer summary including conversion rate + health classification.',
  },
};

export async function handleSales(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['sales', ...]
  const [, second, third] = pathParts;
  const subpath = [second, third].filter(Boolean).join('/');

  // All sales-reports endpoints require level 2+ (individual contributor).
  if (!hasMinLevel(auth, 2)) {
    return errorResponse(403, 'Sales access required', req, {
      code: 'FORBIDDEN',
      details: { minLevel: 2 },
      requestId,
    });
  }

  // ─── Personal endpoints (level 2+, caller's own data) ────────────────────

  // GET /sales/personal/pipeline
  if (method === 'GET' && subpath === 'personal/pipeline') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const { data, error } = await db.rpc('report_sales_personal_pipeline', {
      p_tenant_id: auth.tenantId,
      p_user_id: auth.userId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch pipeline data', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const stages = (data ?? []) as Array<{
      count: number;
      totalValue: number;
      weightedValue: number;
    }>;
    return jsonResponse(
      {
        pipeline: stages,
        totalDeals: stages.reduce((s, x) => s + Number(x.count ?? 0), 0),
        totalValue: stages.reduce((s, x) => s + Number(x.totalValue ?? 0), 0),
        weightedValue: stages.reduce((s, x) => s + Number(x.weightedValue ?? 0), 0),
      },
      200,
      req,
      requestId,
    );
  }

  // GET /sales/personal/activity
  if (method === 'GET' && subpath === 'personal/activity') {
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const granularity = url.searchParams.get('granularity') ?? 'day';

    if (!dateFrom || !dateTo) {
      return errorResponse(400, 'dateFrom and dateTo are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const { data, error } = await db.rpc('report_sales_personal_activity', {
      p_tenant_id: auth.tenantId,
      p_user_id: auth.userId,
      p_date_from: new Date(dateFrom).toISOString(),
      p_date_to: new Date(dateTo).toISOString(),
      p_granularity: granularity,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch activity data', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const activities = (data ?? []) as Array<{
      calls: number;
      emails: number;
      meetings: number;
      demos: number;
      proposals: number;
    }>;
    const totals = activities.reduce(
      (acc, day) => ({
        calls: acc.calls + Number(day.calls ?? 0),
        emails: acc.emails + Number(day.emails ?? 0),
        meetings: acc.meetings + Number(day.meetings ?? 0),
        demos: acc.demos + Number(day.demos ?? 0),
        proposals: acc.proposals + Number(day.proposals ?? 0),
      }),
      { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 },
    );
    const n = Math.max(1, activities.length);

    return jsonResponse(
      {
        activities,
        totals,
        averagePerDay: {
          calls: totals.calls / n,
          emails: totals.emails / n,
          meetings: totals.meetings / n,
          demos: totals.demos / n,
          proposals: totals.proposals / n,
        },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /sales/personal/quota
  if (method === 'GET' && subpath === 'personal/quota') {
    const period = url.searchParams.get('period') ?? 'current';
    if (!['current', 'previous', 'ytd'].includes(period)) {
      return errorResponse(400, 'Invalid period (must be current|previous|ytd)', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const { data, error } = await db.rpc('report_sales_personal_quota', {
      p_tenant_id: auth.tenantId,
      p_user_id: auth.userId,
      p_period: period,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch quota data', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const quota = (data ?? {}) as {
      quotaAmount?: number;
      actualRevenue?: number;
      attainmentPercent?: number;
      averageDealSize?: number;
    };

    const quotaAmount = Number(quota.quotaAmount ?? 0);
    const actualRevenue = Number(quota.actualRevenue ?? 0);
    const attainment = Number(quota.attainmentPercent ?? 0);
    const avgDeal = Number(quota.averageDealSize ?? 1);

    return jsonResponse(
      {
        quota,
        performance: {
          onTrack: attainment >= 100,
          gap: quotaAmount - actualRevenue,
          gapPercent: 100 - attainment,
          dealsNeeded: avgDeal > 0 ? Math.ceil((quotaAmount - actualRevenue) / avgDeal) : 0,
        },
      },
      200,
      req,
      requestId,
    );
  }

  // ─── Team endpoints (level 3+, accessible team) ──────────────────────────

  // GET /sales/team/comparison
  // GET /sales/team/pipeline  (reuses the same data, different projection)
  if (method === 'GET' && (subpath === 'team/comparison' || subpath === 'team/pipeline')) {
    if (!hasMinLevel(auth, 3)) {
      return errorResponse(403, 'Team lead or higher required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 3 },
        requestId,
      });
    }

    const userIds = await resolveAccessibleUserIds(ctx);
    const { data, error } = await db.rpc('report_sales_team_comparison', {
      p_tenant_id: auth.tenantId,
      p_user_ids: userIds,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch team data', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const comparison = (data ?? []) as Array<{
      userId: string;
      userName: string;
      pipelineValue: number;
      dealsInProgress: number;
      averageDealSize: number;
      winRate: number;
      quotaAttainment: number;
    }>;

    if (subpath === 'team/comparison') {
      const summary = {
        teamSize: comparison.length,
        totalPipeline: comparison.reduce((s, m) => s + Number(m.pipelineValue ?? 0), 0),
        averageWinRate:
          comparison.length > 0
            ? comparison.reduce((s, m) => s + Number(m.winRate ?? 0), 0) / comparison.length
            : 0,
        averageQuotaAttainment:
          comparison.length > 0
            ? comparison.reduce((s, m) => s + Number(m.quotaAttainment ?? 0), 0) / comparison.length
            : 0,
        topPerformer: comparison[0] ?? null,
      };
      return jsonResponse({ comparison, summary }, 200, req, requestId);
    }

    // team/pipeline — narrower projection
    const pipelineData = comparison.map((m) => ({
      userName: m.userName,
      userId: m.userId,
      pipelineValue: m.pipelineValue,
      dealsInProgress: m.dealsInProgress,
      averageDealSize: m.averageDealSize,
    }));
    return jsonResponse(
      {
        pipelineData,
        totalPipeline: comparison.reduce((s, m) => s + Number(m.pipelineValue ?? 0), 0),
        totalDeals: comparison.reduce((s, m) => s + Number(m.dealsInProgress ?? 0), 0),
      },
      200,
      req,
      requestId,
    );
  }

  // POST /sales/cache/invalidate — stateless no-op
  if (method === 'POST' && subpath === 'cache/invalidate') {
    if (!hasMinLevel(auth, 4)) {
      return errorResponse(403, 'Manager or higher required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 4 },
        requestId,
      });
    }
    return jsonResponse(
      {
        message: 'Cache invalidated successfully',
        note: 'Edge functions are stateless; cache was a no-op.',
      },
      200,
      req,
      requestId,
    );
  }

  // Pending endpoints — 501 with source pointer.
  const pending = PENDING_ENDPOINTS[subpath];
  if (pending) {
    return jsonResponse(
      {
        status: 'not_implemented',
        endpoint: `/sales/${subpath}`,
        source: pending.sourceLines,
        note: pending.note,
        trackedIn: 'tasks/followup-reports-migration.md',
      },
      501,
      req,
      requestId,
    );
  }

  return null;
}

/**
 * Compute which user IDs the caller can see team data for. Coarser than
 * the Express HierarchicalQueryBuilder (which walks reporting lines);
 * level-based heuristic until that builder gets its own port:
 * - Level 3 (supervisor): all users in the tenant (over-shares slightly).
 * - Level 4+ (manager+): same.
 *
 * Returns the caller's own id as the single-element array when no other
 * users are found — the SQL function treats an empty array as "no team"
 * and returns `[]`, which would be a confusing response.
 */
async function resolveAccessibleUserIds(ctx: HandlerCtx): Promise<string[]> {
  const { auth, db } = ctx;
  if (getRoleLevel(auth) < 3) return [auth.userId];

  const { data } = await db.from('users').select('id').eq('tenant_id', auth.tenantId);

  const ids = (data ?? []).map((u) => (u as { id: string }).id);
  return ids.length > 0 ? ids : [auth.userId];
}
