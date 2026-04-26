// Sales-persona reports — /reports/sales/*
// Replaces server/routes/sales-reports-api.ts.
//
// Endpoints:
//   GET  /reports/sales/personal/pipeline
//   GET  /reports/sales/personal/activity
//   GET  /reports/sales/personal/quota          (degraded — no sales_quotas table)
//   GET  /reports/sales/personal/commissions    (degraded — no commissions table)
//   GET  /reports/sales/personal/leaderboard
//   GET  /reports/sales/team/comparison
//   GET  /reports/sales/team/pipeline
//   GET  /reports/sales/team/pipeline-summary
//   POST /reports/sales/cache/invalidate
//
// Permission gating intentionally omitted (same as warehouse / director /
// service / executive handlers); RLS + hierarchy filter is the trust
// boundary today. Add granular permissions in a future RBAC pass.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery, parsePeriod, rangeForPeriod } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { getAccessibleUserIds } from '../_hierarchy.ts';
import { fetchOpps, fetchActivities, fetchUserNames, type OppRow } from '../_queries/sales.ts';

const TTL_SECONDS = 300;

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'demo', 'proposal'] as const;
type ActivityKey = (typeof ACTIVITY_TYPES)[number];

export async function handleSales(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['sales', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  if (method === 'GET' && sub === 'personal') {
    if (sub2 === 'pipeline') return await cachedPersonalPipeline(req, ctx);
    if (sub2 === 'activity') return await cachedPersonalActivity(req, ctx);
    if (sub2 === 'quota') return jsonResponse(degradedQuota(), 200, req, ctx.requestId);
    if (sub2 === 'commissions') return jsonResponse(degradedCommissions(), 200, req, ctx.requestId);
    if (sub2 === 'leaderboard') return await cachedLeaderboard(req, ctx);
  }
  if (method === 'GET' && sub === 'team') {
    if (sub2 === 'comparison') return await cachedTeamComparison(req, ctx);
    if (sub2 === 'pipeline') return await cachedTeamPipeline(req, ctx);
    if (sub2 === 'pipeline-summary') return await cachedTeamPipelineSummary(req, ctx);
  }
  if (method === 'POST' && sub === 'cache' && sub2 === 'invalidate') {
    return await cacheInvalidate(req, ctx);
  }
  return null;
}

// ─── Personal pipeline ──────────────────────────────────────────────────────

async function cachedPersonalPipeline(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:sales:personal-pipeline:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: [auth.userId],
        start: range.start,
        end: range.end,
      });
      const pipeline = aggregateByStage(opps);
      return {
        pipeline,
        totalDeals: pipeline.reduce((s, p) => s + p.count, 0),
        totalValue: pipeline.reduce((s, p) => s + p.totalValue, 0),
        weightedValue: pipeline.reduce((s, p) => s + p.weightedValue, 0),
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch pipeline data', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── Personal activity ──────────────────────────────────────────────────────

async function cachedPersonalActivity(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  if (!dateFrom || !dateTo) {
    return errorResponse(400, 'dateFrom and dateTo are required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const granularity = (url.searchParams.get('granularity') ?? 'day') as 'day' | 'week';

  const key = `${auth.tenantId}:sales:personal-activity:${auth.userId}:${paramKey({
    start: start.toISOString(),
    end: end.toISOString(),
    granularity,
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const rows = await fetchActivities(db, auth.tenantId, auth.userId, start, end);
      const activities = bucketActivities(rows, start, end, granularity);

      const totals = activities.reduce(
        (acc, day) => ({
          calls: acc.calls + day.calls,
          emails: acc.emails + day.emails,
          meetings: acc.meetings + day.meetings,
          demos: acc.demos + day.demos,
          proposals: acc.proposals + day.proposals,
        }),
        { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 },
      );
      const denom = activities.length || 1;
      return {
        activities,
        totals,
        averagePerDay: {
          calls: totals.calls / denom,
          emails: totals.emails / denom,
          meetings: totals.meetings / denom,
          demos: totals.demos / denom,
          proposals: totals.proposals / denom,
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch activity data', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

async function cachedLeaderboard(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const metric = (url.searchParams.get('metric') ?? 'revenue') as
    | 'revenue'
    | 'deals'
    | 'pipeline'
    | 'activities';
  const scope = (url.searchParams.get('scope') ?? 'location') as 'team' | 'location' | 'company';
  const period = rangeForPeriod(parsePeriod(url.searchParams.get('period')));

  const key = `${auth.tenantId}:sales:leaderboard:${auth.userId}:${paramKey({
    metric,
    scope,
    start: period.start.toISOString(),
    end: period.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth);
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: ids,
        start: period.start,
        end: period.end,
      });
      const userNames = await fetchUserNames(db, ids);

      const byOwner = new Map<string, { revenue: number; deals: number; pipeline: number }>();
      for (const o of opps) {
        if (!o.owner_id) continue;
        const entry = byOwner.get(o.owner_id) ?? { revenue: 0, deals: 0, pipeline: 0 };
        const isWon = o.is_won === true || o.stage_name === 'Closed Won';
        const isClosed = o.is_closed === true || isWon || o.stage_name === 'Closed Lost';
        if (isWon) {
          entry.revenue += parseFloatSafe(o.amount);
          entry.deals += 1;
        }
        if (!isClosed)
          entry.pipeline += parseFloatSafe(o.expected_revenue, parseFloatSafe(o.amount));
        byOwner.set(o.owner_id, entry);
      }

      const leaderboard = [...byOwner.entries()]
        .map(([userId, m]) => ({
          userId,
          userName: userNames.get(userId) ?? 'Unknown',
          revenue: round2(m.revenue),
          deals: m.deals,
          pipeline: round2(m.pipeline),
          activities: 0, // not yet computed — would join business_record_activities
        }))
        .sort((a, b) => leaderboardSortKey(b, metric) - leaderboardSortKey(a, metric))
        .map((e, i) => ({ ...e, rank: i + 1 }));

      const myPosition = leaderboard.find((e) => e.userId === auth.userId);
      const percentile = myPosition
        ? Math.round(((leaderboard.length - myPosition.rank + 1) / leaderboard.length) * 100)
        : 0;

      return {
        leaderboard,
        myPosition,
        totalParticipants: leaderboard.length,
        percentile,
        scope,
        metric,
        degraded: { activitiesMetric: true },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch leaderboard', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── Team comparison / pipeline / pipeline-summary ──────────────────────────

async function cachedTeamComparison(req: Request, ctx: HandlerCtx): Promise<Response> {
  return await teamReport(req, ctx, 'comparison');
}

async function cachedTeamPipeline(req: Request, ctx: HandlerCtx): Promise<Response> {
  return await teamReport(req, ctx, 'pipeline');
}

async function cachedTeamPipelineSummary(req: Request, ctx: HandlerCtx): Promise<Response> {
  return await teamReport(req, ctx, 'pipeline-summary');
}

async function teamReport(
  req: Request,
  ctx: HandlerCtx,
  flavor: 'comparison' | 'pipeline' | 'pipeline-summary',
): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:sales:team-${flavor}:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth);
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: ids,
        start: range.start,
        end: range.end,
      });
      const userNames = await fetchUserNames(db, ids);

      const members = computeTeamMembers(opps, ids, userNames);

      if (flavor === 'comparison') {
        return {
          comparison: members,
          summary: {
            teamSize: members.length,
            totalPipeline: members.reduce((s, m) => s + m.pipelineValue, 0),
            averageWinRate:
              members.length > 0 ? members.reduce((s, m) => s + m.winRate, 0) / members.length : 0,
            averageQuotaAttainment: 0, // degraded — no quotas
            topPerformer: members[0] ?? null,
          },
          degraded: { quotaAttainment: true },
        };
      }

      if (flavor === 'pipeline') {
        return {
          pipelineData: members.map((m) => ({
            userId: m.userId,
            userName: m.userName,
            pipelineValue: m.pipelineValue,
            dealsInProgress: m.dealsInProgress,
            averageDealSize: m.averageDealSize,
          })),
          totalPipeline: members.reduce((s, m) => s + m.pipelineValue, 0),
          totalDeals: members.reduce((s, m) => s + m.dealsInProgress, 0),
        };
      }

      // flavor === 'pipeline-summary'
      const totalTeamValue = members.reduce((s, m) => s + m.pipelineValue, 0);
      const totalTeamDeals = members.reduce((s, m) => s + m.dealsInProgress, 0);
      const totalWon = members.reduce((s, m) => s + m.dealsWon, 0);
      const totalClosed = members.reduce((s, m) => s + m.dealsClosed, 0);
      const teamConversionRate = totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0;
      const pipelineHealth =
        teamConversionRate >= 20
          ? 'healthy'
          : teamConversionRate >= 10
            ? 'fair'
            : 'needs_attention';
      return {
        individualPipelines: members,
        summary: {
          totalTeamValue: round2(totalTeamValue),
          totalTeamDeals,
          teamConversionRate: round2(teamConversionRate),
        },
        metrics: {
          teamSize: members.length,
          averageValuePerRep: members.length > 0 ? totalTeamValue / members.length : 0,
          averageDealsPerRep: members.length > 0 ? totalTeamDeals / members.length : 0,
          pipelineHealth,
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, `Failed to fetch team ${flavor}`, req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── Cache invalidate ───────────────────────────────────────────────────────

async function cacheInvalidate(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;
  let body: { userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }
  // Clear all sales entries for the tenant (Express had `invalidateUserCache`
  // and `clearAllCaches` — we simplify to tenant scope).
  const removed = clearCache(`${auth.tenantId}:sales:`);
  return jsonResponse(
    { message: 'Sales report cache invalidated', userId: body.userId, removed },
    200,
    req,
    requestId,
  );
}

// ─── degraded reports ───────────────────────────────────────────────────────

function degradedQuota(): unknown {
  return {
    quota: {
      quotaAmount: 0,
      actualRevenue: 0,
      attainmentPercent: 0,
      averageDealSize: 0,
      period: 'current',
    },
    performance: {
      onTrack: false,
      gap: 0,
      gapPercent: 0,
      dealsNeeded: 0,
    },
    degraded: { salesQuotasTable: true },
  };
}

function degradedCommissions(): unknown {
  return {
    commissions: [],
    summary: {
      totalCommission: 0,
      pending: 0,
      approved: 0,
      paid: 0,
      count: 0,
    },
    degraded: { commissionsTable: true },
  };
}

// ─── transforms ─────────────────────────────────────────────────────────────

interface StageBucket {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
}

function aggregateByStage(opps: OppRow[]): StageBucket[] {
  const map = new Map<string, StageBucket>();
  for (const o of opps) {
    const stage = o.stage_name ?? 'Unknown';
    const amount = parseFloatSafe(o.amount);
    const weighted = parseFloatSafe(o.expected_revenue, amount);
    const entry = map.get(stage) ?? { stage, count: 0, totalValue: 0, weightedValue: 0 };
    entry.count += 1;
    entry.totalValue += amount;
    entry.weightedValue += weighted;
    map.set(stage, entry);
  }
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
}

interface ActivityBucket {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}

function bucketActivities(
  rows: Array<{ activity_type: string; created_at: string; completed_date: string | null }>,
  start: Date,
  end: Date,
  granularity: 'day' | 'week',
): ActivityBucket[] {
  // Pre-build empty buckets for every day/week in range so the frontend gets
  // a continuous series rather than gaps where a tech was idle.
  const buckets = new Map<string, ActivityBucket>();
  const stepMs = granularity === 'week' ? 7 * 86_400_000 : 86_400_000;
  for (let t = startOfBucket(start, granularity); t <= end.getTime(); t += stepMs) {
    const date = new Date(t).toISOString().slice(0, 10);
    buckets.set(date, { date, calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 });
  }
  for (const r of rows) {
    const when = new Date(r.completed_date ?? r.created_at);
    const bucketStart = startOfBucket(when, granularity);
    const date = new Date(bucketStart).toISOString().slice(0, 10);
    const bucket = buckets.get(date) ?? {
      date,
      calls: 0,
      emails: 0,
      meetings: 0,
      demos: 0,
      proposals: 0,
    };
    if (ACTIVITY_TYPES.includes(r.activity_type as ActivityKey)) {
      const key =
        r.activity_type === 'call'
          ? 'calls'
          : r.activity_type === 'email'
            ? 'emails'
            : r.activity_type === 'meeting'
              ? 'meetings'
              : r.activity_type === 'demo'
                ? 'demos'
                : 'proposals';
      bucket[key] += 1;
    }
    buckets.set(date, bucket);
  }
  return [...buckets.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function startOfBucket(date: Date | number, granularity: 'day' | 'week'): number {
  const t = typeof date === 'number' ? new Date(date) : date;
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  if (granularity === 'week') {
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  }
  return d.getTime();
}

interface TeamMember {
  userId: string;
  userName: string;
  pipelineValue: number;
  dealsInProgress: number;
  dealsWon: number;
  dealsClosed: number;
  averageDealSize: number;
  winRate: number;
  quotaAttainment: number; // always 0 — no quotas table
}

function computeTeamMembers(
  opps: OppRow[],
  ids: string[],
  userNames: Map<string, string>,
): TeamMember[] {
  const map = new Map<string, TeamMember>();
  for (const id of ids) {
    map.set(id, {
      userId: id,
      userName: userNames.get(id) ?? 'Unknown',
      pipelineValue: 0,
      dealsInProgress: 0,
      dealsWon: 0,
      dealsClosed: 0,
      averageDealSize: 0,
      winRate: 0,
      quotaAttainment: 0,
    });
  }
  for (const o of opps) {
    if (!o.owner_id) continue;
    const m = map.get(o.owner_id);
    if (!m) continue;
    const isWon = o.is_won === true || o.stage_name === 'Closed Won';
    const isClosed = o.is_closed === true || isWon || o.stage_name === 'Closed Lost';
    const amount = parseFloatSafe(o.amount);
    if (isWon) m.dealsWon += 1;
    if (isClosed) m.dealsClosed += 1;
    if (!isClosed) {
      m.dealsInProgress += 1;
      m.pipelineValue += parseFloatSafe(o.expected_revenue, amount);
    }
  }
  for (const m of map.values()) {
    m.averageDealSize = m.dealsInProgress > 0 ? round2(m.pipelineValue / m.dealsInProgress) : 0;
    m.winRate = m.dealsClosed > 0 ? round2((m.dealsWon / m.dealsClosed) * 100) : 0;
    m.pipelineValue = round2(m.pipelineValue);
  }
  return [...map.values()].sort((a, b) => b.pipelineValue - a.pipelineValue);
}

function leaderboardSortKey(
  e: { revenue: number; deals: number; pipeline: number; activities: number },
  metric: string,
): number {
  switch (metric) {
    case 'deals':
      return e.deals;
    case 'pipeline':
      return e.pipeline;
    case 'activities':
      return e.activities;
    case 'revenue':
    default:
      return e.revenue;
  }
}

function parseFloatSafe(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
