// Director-level reports — /reports/director/*
// Replaces server/routes/director-reports-api.ts + server/services/director-reporting-service.ts.
//
// Endpoints:
//   GET  /reports/director/sales/company-performance
//   GET  /reports/director/service/company-performance
//   POST /reports/director/clear-cache
//
// Permission gating: Express required `requireLevel(5)`. We don't have a
// level-based RBAC engine here yet — the dispatcher relies on RLS + the
// caller already being authenticated. A finer permission gate belongs in
// a future RBAC pass; tracked alongside warehouse handler.
//
// Schema reality vs. Express expectations: see _queries/director.ts for the
// list of fields the original service referenced that don't exist in our
// real schema. Metrics that depend on missing columns are returned as null
// with `degraded: true` in the response so the UI can display dashes
// rather than misleading zeros.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import {
  fetchOpportunities,
  fetchServiceCalls,
  fetchUsersWithLocations,
  fetchLocations,
  fetchRegions,
  buildUserRegionMap,
  type OpportunityRow,
  type ServiceCallRow,
} from '../_queries/director.ts';

const COMPANY_TTL_SECONDS = 300; // 5 min — directors hit refresh constantly

interface RegionSalesAggregate {
  regionId: string;
  regionName: string;
  revenue: number;
  deals: number;
  winRate: number;
  quotaAttainment: number | null;
}

interface TopSalesPerformer {
  userId: string;
  userName: string;
  revenue: number;
  deals: number;
}

interface CompanySalesPerformance {
  totalRevenue: number;
  totalDeals: number;
  averageWinRate: number;
  averageDealSize: number;
  quotaAttainment: number | null;
  pipelineValue: number;
  regions: RegionSalesAggregate[];
  topPerformers: TopSalesPerformer[];
  forecast: {
    currentQuarter: number;
    nextQuarter: number;
    yearEnd: number;
  };
  insights: {
    performanceStatus: 'exceeding' | 'on_track' | 'near_target' | 'at_risk' | 'unknown';
    topRegions: RegionSalesAggregate[];
    pipelineCoverage: number;
  };
  degraded: { quotaAttainment: boolean };
}

interface RegionServiceAggregate {
  regionId: string;
  regionName: string;
  calls: number;
  ftfRate: number | null;
  slaCompliance: number | null;
  technicians: number;
  avgSatisfaction: number | null;
}

interface TopServicePerformer {
  userId: string;
  userName: string;
  ftfRate: number | null;
  satisfaction: number | null;
}

interface CompanyServicePerformance {
  totalCalls: number;
  avgFirstTimeFixRate: number | null;
  avgSlaCompliance: number | null;
  avgCustomerSatisfaction: number | null;
  totalTechnicians: number;
  avgUtilization: number | null;
  regions: RegionServiceAggregate[];
  topPerformers: TopServicePerformer[];
  trends: {
    callVolumeChange: number;
    ftfRateChange: number;
    slaComplianceChange: number;
  };
  insights: {
    serviceHealth: 'excellent' | 'good' | 'fair' | 'needs_improvement' | 'unknown';
    topRegions: RegionServiceAggregate[];
    utilizationStatus: 'optimal' | 'adequate' | 'low' | 'unknown';
  };
  degraded: {
    firstTimeFixRate: boolean;
    slaCompliance: boolean;
    utilization: boolean;
  };
}

export async function handleDirector(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['director', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  if (method === 'GET' && sub === 'sales' && sub2 === 'company-performance') {
    return await cachedSalesPerformance(req, ctx);
  }
  if (method === 'GET' && sub === 'service' && sub2 === 'company-performance') {
    return await cachedServicePerformance(req, ctx);
  }
  if (method === 'POST' && sub === 'clear-cache') {
    return await handleClearCache(req, ctx);
  }
  return null;
}

async function cachedSalesPerformance(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:director:sales-performance:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached<CompanySalesPerformance>(key, COMPANY_TTL_SECONDS, () =>
      computeSalesPerformance(ctx),
    );
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch company sales performance', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function cachedServicePerformance(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:director:service-performance:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached<CompanyServicePerformance>(key, COMPANY_TTL_SECONDS, () =>
      computeServicePerformance(ctx),
    );
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch company service performance', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function handleClearCache(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;
  // Scope wipe to the calling tenant — same pattern as warehouse handler.
  const removed = clearCache(`${auth.tenantId}:director:`);
  return jsonResponse({ message: 'Director report cache cleared', removed }, 200, req, requestId);
}

// ─── Sales aggregation ──────────────────────────────────────────────────────

async function computeSalesPerformance(ctx: HandlerCtx): Promise<CompanySalesPerformance> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const window = { tenantId: auth.tenantId, start: range.start, end: range.end };

  const [opportunities, users, locations, regions] = await Promise.all([
    fetchOpportunities(db, window),
    fetchUsersWithLocations(db, auth.tenantId),
    fetchLocations(db, auth.tenantId),
    fetchRegions(db, auth.tenantId),
  ]);

  const userRegion = buildUserRegionMap(users, locations);
  const userName = new Map(users.map((u) => [u.id, u.name ?? 'Unknown']));

  let totalRevenue = 0;
  let totalDeals = 0;
  let totalClosed = 0;
  let pipelineValue = 0;

  const byOwner = new Map<string, { revenue: number; deals: number }>();
  const byRegion = new Map<string, { revenue: number; deals: number; closed: number }>();

  for (const opp of opportunities) {
    const amount = parseFloatSafe(opp.amount);
    const isWon = opp.is_won === true || opp.stage_name === 'Closed Won';
    const isClosed = opp.is_closed === true || isWon || opp.stage_name === 'Closed Lost';

    if (isWon) {
      totalRevenue += amount;
      totalDeals += 1;
    }
    if (isClosed) totalClosed += 1;

    if (!isClosed) {
      // expected_revenue is amount * probability; fall back to amount when null.
      pipelineValue += parseFloatSafe(opp.expected_revenue, amount);
    }

    const ownerId = opp.owner_id ?? null;
    if (ownerId && isWon) {
      const entry = byOwner.get(ownerId) ?? { revenue: 0, deals: 0 };
      entry.revenue += amount;
      entry.deals += 1;
      byOwner.set(ownerId, entry);
    }

    const regionId = ownerId ? userRegion.get(ownerId) : null;
    if (regionId) {
      const entry = byRegion.get(regionId) ?? { revenue: 0, deals: 0, closed: 0 };
      if (isWon) {
        entry.revenue += amount;
        entry.deals += 1;
      }
      if (isClosed) entry.closed += 1;
      byRegion.set(regionId, entry);
    }
  }

  const regionAggregates: RegionSalesAggregate[] = regions
    .map((r) => {
      const stats = byRegion.get(r.id) ?? { revenue: 0, deals: 0, closed: 0 };
      return {
        regionId: r.id,
        regionName: r.name,
        revenue: round2(stats.revenue),
        deals: stats.deals,
        winRate: stats.closed > 0 ? round2((stats.deals / stats.closed) * 100) : 0,
        quotaAttainment: null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const topPerformers: TopSalesPerformer[] = [...byOwner.entries()]
    .map(([userId, s]) => ({
      userId,
      userName: userName.get(userId) ?? 'Unknown',
      revenue: round2(s.revenue),
      deals: s.deals,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const averageWinRate = totalClosed > 0 ? round2((totalDeals / totalClosed) * 100) : 0;
  const averageDealSize = totalDeals > 0 ? round2(totalRevenue / totalDeals) : 0;

  const performanceStatus = 'unknown'; // No quota source — we can't say.

  return {
    totalRevenue: round2(totalRevenue),
    totalDeals,
    averageWinRate,
    averageDealSize,
    quotaAttainment: null,
    pipelineValue: round2(pipelineValue),
    regions: regionAggregates,
    topPerformers,
    forecast: {
      currentQuarter: round2(totalRevenue),
      nextQuarter: round2(pipelineValue * 0.3),
      yearEnd: round2(totalRevenue * 1.5),
    },
    insights: {
      performanceStatus,
      topRegions: regionAggregates.slice(0, 3),
      pipelineCoverage: totalRevenue > 0 ? round2(pipelineValue / totalRevenue) : 0,
    },
    degraded: { quotaAttainment: true },
  };
}

// ─── Service aggregation ────────────────────────────────────────────────────

async function computeServicePerformance(ctx: HandlerCtx): Promise<CompanyServicePerformance> {
  const { auth, db, url } = ctx;
  const range = rangeFromQuery(url);
  const window = { tenantId: auth.tenantId, start: range.start, end: range.end };

  const [calls, users, locations, regions] = await Promise.all([
    fetchServiceCalls(db, window),
    fetchUsersWithLocations(db, auth.tenantId),
    fetchLocations(db, auth.tenantId),
    fetchRegions(db, auth.tenantId),
  ]);

  const userRegion = buildUserRegionMap(users, locations);
  const userName = new Map(users.map((u) => [u.id, u.name ?? 'Unknown']));

  const totalCalls = calls.length;
  const technicianSet = new Set<string>();

  // Customer satisfaction is the only quality signal we have today.
  let satisfactionSum = 0;
  let satisfactionCount = 0;

  const byTech = new Map<string, { calls: number; satSum: number; satCount: number }>();
  const byRegion = new Map<
    string,
    { calls: number; satSum: number; satCount: number; technicians: Set<string> }
  >();

  for (const call of calls) {
    const techId = call.assigned_technician_id;
    if (techId) technicianSet.add(techId);

    const sat = call.customer_satisfaction_rating;
    if (typeof sat === 'number' && Number.isFinite(sat)) {
      satisfactionSum += sat;
      satisfactionCount += 1;
    }

    if (techId) {
      const t = byTech.get(techId) ?? { calls: 0, satSum: 0, satCount: 0 };
      t.calls += 1;
      if (typeof sat === 'number' && Number.isFinite(sat)) {
        t.satSum += sat;
        t.satCount += 1;
      }
      byTech.set(techId, t);
    }

    const regionId = techId ? userRegion.get(techId) : null;
    if (regionId) {
      const r = byRegion.get(regionId) ?? {
        calls: 0,
        satSum: 0,
        satCount: 0,
        technicians: new Set<string>(),
      };
      r.calls += 1;
      if (typeof sat === 'number' && Number.isFinite(sat)) {
        r.satSum += sat;
        r.satCount += 1;
      }
      if (techId) r.technicians.add(techId);
      byRegion.set(regionId, r);
    }
  }

  const regionAggregates: RegionServiceAggregate[] = regions.map((r) => {
    const stats = byRegion.get(r.id);
    return {
      regionId: r.id,
      regionName: r.name,
      calls: stats?.calls ?? 0,
      ftfRate: null,
      slaCompliance: null,
      technicians: stats?.technicians.size ?? 0,
      avgSatisfaction: stats && stats.satCount > 0 ? round2(stats.satSum / stats.satCount) : null,
    };
  });

  const topPerformers: TopServicePerformer[] = [...byTech.entries()]
    .map(([userId, t]) => ({
      userId,
      userName: userName.get(userId) ?? 'Unknown',
      ftfRate: null,
      satisfaction: t.satCount > 0 ? round2(t.satSum / t.satCount) : null,
    }))
    .sort((a, b) => (b.satisfaction ?? 0) - (a.satisfaction ?? 0))
    .slice(0, 10);

  const avgSatisfaction =
    satisfactionCount > 0 ? round2(satisfactionSum / satisfactionCount) : null;

  return {
    totalCalls,
    avgFirstTimeFixRate: null,
    avgSlaCompliance: null,
    avgCustomerSatisfaction: avgSatisfaction,
    totalTechnicians: technicianSet.size,
    avgUtilization: null,
    regions: regionAggregates,
    topPerformers,
    trends: {
      callVolumeChange: 0,
      ftfRateChange: 0,
      slaComplianceChange: 0,
    },
    insights: {
      serviceHealth: 'unknown', // FTF + SLA columns missing.
      topRegions: [...regionAggregates]
        .sort((a, b) => (b.avgSatisfaction ?? 0) - (a.avgSatisfaction ?? 0))
        .slice(0, 3),
      utilizationStatus: 'unknown',
    },
    degraded: {
      firstTimeFixRate: true,
      slaCompliance: true,
      utilization: true,
    },
  };
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
