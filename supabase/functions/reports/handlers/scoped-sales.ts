// Sales manager (region-scoped) + sales supervisor (location-scoped) reports.
// Replaces server/routes/sales-manager-reports-api.ts +
// server/routes/sales-supervisor-reports-api.ts.
//
// One handler covers both personas because the underlying queries are
// identical — only the scoping unit (region vs location) differs. The
// dispatcher in index.ts injects the unit when routing the URL prefix.
//
// URL conventions differ between the two Express files:
//   manager:    /sales-manager/regional-{pipeline,performance,quota,activity}
//               /sales-manager/clear-cache
//   supervisor: /sales-supervisor/location/{pipeline-overview,performance,quota,activity}
//               /sales-supervisor/cache/invalidate
//
// Both shapes resolve to the same compute path here; we just normalize the
// "operation" name from the path before dispatching.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { fetchOpps, fetchActivities } from '../_queries/sales.ts';
import {
  fetchUnits,
  fetchUsersWithUnits,
  fetchLocationLookup,
  buildUserUnitMap,
  type Unit,
} from '../_queries/scoped.ts';

const TTL_SECONDS = 300;

type Op = 'pipeline' | 'performance' | 'quota' | 'activity' | 'clear-cache' | 'unknown';

function normalizeOp(unit: Unit, pathParts: string[]): Op {
  // pathParts: ['sales-manager' | 'sales-supervisor', ...]
  const p1 = pathParts[1];
  const p2 = pathParts[2];

  if (p1 === 'clear-cache' || (p1 === 'cache' && p2 === 'invalidate')) return 'clear-cache';

  if (unit === 'region') {
    if (p1 === 'regional-pipeline') return 'pipeline';
    if (p1 === 'regional-performance') return 'performance';
    if (p1 === 'regional-quota') return 'quota';
    if (p1 === 'regional-activity') return 'activity';
  } else {
    if (p1 === 'location' && p2 === 'pipeline-overview') return 'pipeline';
    if (p1 === 'location' && p2 === 'performance') return 'performance';
    if (p1 === 'location' && p2 === 'quota') return 'quota';
    if (p1 === 'location' && p2 === 'activity') return 'activity';
  }
  return 'unknown';
}

export async function handleScopedSales(
  req: Request,
  ctx: HandlerCtx,
  unit: Unit,
): Promise<Response | null> {
  const { method, pathParts, requestId } = ctx;
  const op = normalizeOp(unit, pathParts);

  if (op === 'clear-cache' && method === 'POST') {
    return clearScopedCache(req, ctx, unit);
  }
  if (method !== 'GET') return null;

  switch (op) {
    case 'pipeline':
      return cachedPipeline(req, ctx, unit);
    case 'performance':
      return cachedPerformance(req, ctx, unit);
    case 'quota':
      return jsonResponse(degradedQuota(unit), 200, req, requestId);
    case 'activity':
      return cachedActivity(req, ctx, unit);
    default:
      return null;
  }
}

// ─── pipeline (per-unit) ────────────────────────────────────────────────────

async function cachedPipeline(req: Request, ctx: HandlerCtx, unit: Unit): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:scoped-sales:${unit}:pipeline:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const [units, users, locations] = await Promise.all([
        fetchUnits(db, auth.tenantId, unit),
        fetchUsersWithUnits(db, auth.tenantId),
        fetchLocationLookup(db, auth.tenantId),
      ]);
      const userUnit = buildUserUnitMap(users, locations, unit);
      const ownerIds = users.map((u) => u.id);
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds,
        start: range.start,
        end: range.end,
      });

      // Per-unit per-stage aggregation: pivot on (unitId, stage) → { count, value }
      const perUnit = new Map<
        string,
        {
          stages: Map<string, { count: number; value: number; weighted: number }>;
          deals: number;
          value: number;
        }
      >();
      for (const u of units) {
        perUnit.set(u.id, { stages: new Map(), deals: 0, value: 0 });
      }
      const aggregatedStages = new Map<
        string,
        { stage: string; totalDeals: number; totalValue: number; perUnit: number }
      >();

      for (const o of opps) {
        if (!o.owner_id) continue;
        const unitId = userUnit.get(o.owner_id);
        if (!unitId) continue;
        const stage = o.stage_name ?? 'Unknown';
        const value = parseFloatSafe(o.amount);
        const weighted = parseFloatSafe(o.expected_revenue, value);

        const u = perUnit.get(unitId);
        if (u) {
          const s = u.stages.get(stage) ?? { count: 0, value: 0, weighted: 0 };
          s.count += 1;
          s.value += value;
          s.weighted += weighted;
          u.stages.set(stage, s);
          u.deals += 1;
          u.value += value;
        }

        const agg = aggregatedStages.get(stage) ?? {
          stage,
          totalDeals: 0,
          totalValue: 0,
          perUnit: 0,
        };
        agg.totalDeals += 1;
        agg.totalValue += value;
        aggregatedStages.set(stage, agg);
      }

      const totalUnits = units.length || 1;
      const aggregated = [...aggregatedStages.values()].map((s) => ({
        stage: s.stage,
        totalDeals: s.totalDeals,
        totalValue: round2(s.totalValue),
        avgValuePerRegion: round2(s.totalValue / totalUnits),
      }));

      const byUnit = units.map((u) => {
        const stats = perUnit.get(u.id) ?? { deals: 0, value: 0, stages: new Map() };
        return {
          unitId: u.id,
          unitName: u.name,
          totalDeals: stats.deals,
          totalValue: round2(stats.value),
        };
      });

      const totalDeals = aggregated.reduce((s, a) => s + a.totalDeals, 0);
      const totalValue = aggregated.reduce((s, a) => s + a.totalValue, 0);
      const wonStages = aggregated.find((a) => a.stage === 'Closed Won');
      const healthScore =
        totalDeals > 0 ? Math.round(((wonStages?.totalDeals ?? 0) / totalDeals) * 100) : 0;

      return {
        unit,
        aggregated,
        byUnit,
        summary: { totalDeals, totalValue: round2(totalValue), healthScore },
        insights: {
          stageBreakdown: aggregated.reduce(
            (acc, s) => {
              acc[s.stage.toLowerCase().replace(' ', '_')] = {
                totalDeals: s.totalDeals,
                totalValue: s.totalValue,
                avgValuePerRegion: s.avgValuePerRegion,
              };
              return acc;
            },
            {} as Record<string, unknown>,
          ),
          healthStatus:
            healthScore >= 30 ? 'healthy' : healthScore >= 20 ? 'fair' : 'needs_attention',
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped pipeline', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── performance (per-unit) ─────────────────────────────────────────────────

async function cachedPerformance(req: Request, ctx: HandlerCtx, unit: Unit): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:scoped-sales:${unit}:performance:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const [units, users, locations] = await Promise.all([
        fetchUnits(db, auth.tenantId, unit),
        fetchUsersWithUnits(db, auth.tenantId),
        fetchLocationLookup(db, auth.tenantId),
      ]);
      const userUnit = buildUserUnitMap(users, locations, unit);
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: users.map((u) => u.id),
        start: range.start,
        end: range.end,
      });

      const perUnit = new Map<
        string,
        { revenue: number; won: number; closed: number; pipeline: number }
      >();
      for (const u of units) perUnit.set(u.id, { revenue: 0, won: 0, closed: 0, pipeline: 0 });

      for (const o of opps) {
        if (!o.owner_id) continue;
        const unitId = userUnit.get(o.owner_id);
        if (!unitId) continue;
        const stats = perUnit.get(unitId);
        if (!stats) continue;
        const isWon = o.is_won === true || o.stage_name === 'Closed Won';
        const isClosed = o.is_closed === true || isWon || o.stage_name === 'Closed Lost';
        const amount = parseFloatSafe(o.amount);
        if (isWon) {
          stats.revenue += amount;
          stats.won += 1;
        }
        if (isClosed) stats.closed += 1;
        if (!isClosed) stats.pipeline += parseFloatSafe(o.expected_revenue, amount);
      }

      const regions = units.map((u) => {
        const s = perUnit.get(u.id) ?? { revenue: 0, won: 0, closed: 0, pipeline: 0 };
        const winRate = s.closed > 0 ? round2((s.won / s.closed) * 100) : 0;
        return {
          unitId: u.id,
          unitName: u.name,
          revenue: round2(s.revenue),
          deals: s.won,
          winRate,
          pipelineValue: round2(s.pipeline),
          quotaAttainment: 0, // degraded — no sales_quotas
        };
      });

      return {
        unit,
        regions,
        summary: {
          totalUnits: regions.length,
          totalRevenue: regions.reduce((sum, r) => sum + r.revenue, 0),
          totalPipeline: regions.reduce((sum, r) => sum + r.pipelineValue, 0),
          averageWinRate:
            regions.length > 0
              ? regions.reduce((sum, r) => sum + r.winRate, 0) / regions.length
              : 0,
        },
        attainmentRanges: {
          exceeding: 0,
          onTrack: 0,
          nearTarget: 0,
          atRisk: regions.length, // can't know without quotas
        },
        degraded: { quotaAttainment: true },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped performance', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── activity (per-unit) ────────────────────────────────────────────────────

async function cachedActivity(req: Request, ctx: HandlerCtx, unit: Unit): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:scoped-sales:${unit}:activity:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const [units, users, locations] = await Promise.all([
        fetchUnits(db, auth.tenantId, unit),
        fetchUsersWithUnits(db, auth.tenantId),
        fetchLocationLookup(db, auth.tenantId),
      ]);
      const userUnit = buildUserUnitMap(users, locations, unit);

      // Activities are per-user; we sum into unit buckets. To avoid one
      // query per user we make one query per UNIT batch by listing the
      // user IDs in scope.
      const allActivityRows = await Promise.all(
        users.map((u) =>
          fetchActivities(db, auth.tenantId, u.id, range.start, range.end).then((rows) =>
            rows.map((r) => ({ ...r, _userId: u.id })),
          ),
        ),
      );
      const flat = allActivityRows.flat();

      const perUnit = new Map<
        string,
        { calls: number; emails: number; meetings: number; demos: number; proposals: number }
      >();
      for (const u of units) {
        perUnit.set(u.id, { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 });
      }

      for (const a of flat) {
        const uid = userUnit.get(a._userId);
        if (!uid) continue;
        const bucket = perUnit.get(uid);
        if (!bucket) continue;
        switch (a.activity_type) {
          case 'call':
            bucket.calls += 1;
            break;
          case 'email':
            bucket.emails += 1;
            break;
          case 'meeting':
            bucket.meetings += 1;
            break;
          case 'demo':
            bucket.demos += 1;
            break;
          case 'proposal':
            bucket.proposals += 1;
            break;
        }
      }

      return {
        unit,
        regions: units.map((u) => ({
          unitId: u.id,
          unitName: u.name,
          ...(perUnit.get(u.id) ?? {
            calls: 0,
            emails: 0,
            meetings: 0,
            demos: 0,
            proposals: 0,
          }),
        })),
        totals: [...perUnit.values()].reduce(
          (acc, p) => ({
            calls: acc.calls + p.calls,
            emails: acc.emails + p.emails,
            meetings: acc.meetings + p.meetings,
            demos: acc.demos + p.demos,
            proposals: acc.proposals + p.proposals,
          }),
          { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 },
        ),
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped activity', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── degraded ───────────────────────────────────────────────────────────────

function degradedQuota(unit: Unit): unknown {
  return {
    unit,
    regions: [],
    summary: {
      totalQuota: 0,
      totalActual: 0,
      averageAttainment: 0,
    },
    degraded: { salesQuotasTable: true },
  };
}

function clearScopedCache(req: Request, ctx: HandlerCtx, unit: Unit): Response {
  const { auth, requestId } = ctx;
  const removed = clearCache(`${auth.tenantId}:scoped-sales:${unit}:`);
  return jsonResponse(
    { message: `Sales ${unit} report cache cleared`, removed },
    200,
    req,
    requestId,
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseFloatSafe(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
