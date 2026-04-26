// Warehouse persona reports — /reports/warehouse/*
// Replaces server/routes/warehouse-reports-api.ts + server/services/warehouse-reporting-service.ts.
//
// Endpoints:
//   GET  /reports/warehouse/team/quick-stats   — FPY + accuracy + productivity for embedded widget
//   POST /reports/warehouse/cache/invalidate   — drop cached entries (managers)
//
// Permission gating: the Express version checked operations.warehouse.view_*
// and operations.reports.manage_*. We don't have an RBAC engine in this edge
// function yet — RLS at the DB level handles cross-tenant isolation, and the
// hierarchy filter (`accessibleUserIds`) constrains data to the caller's
// scope. A finer-grained permission check belongs in a future RBAC pass.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery, previousRange, trend } from '../_date.ts';
import { getAccessibleUserIds } from '../_hierarchy.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { fetchOperations, fetchTechNames, type WarehouseOperation } from '../_queries/warehouse.ts';

const QUICK_STATS_TTL_SECONDS = 300; // 5 min

interface QuickStats {
  performance: {
    firstPassYield: number;
    accuracyRate: number;
    productivity: number;
    qualityScore: number;
  };
  activity: {
    totalKits: number;
    completedKits: number;
    inProgressKits: number;
    reworkRequired: number;
  };
  team: {
    totalTechnicians: number;
    activeTechnicians: number;
    topTechnician: string;
    techsNeedingSupport: number;
  };
  trends: {
    fpyTrend: 'up' | 'down' | 'stable';
    accuracyTrend: 'up' | 'down' | 'stable';
    productivityTrend: 'up' | 'down' | 'stable';
  };
}

export async function handleWarehouse(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['warehouse', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  if (method === 'GET' && sub === 'team' && sub2 === 'quick-stats') {
    return await handleQuickStats(req, ctx);
  }

  if (method === 'POST' && sub === 'cache' && sub2 === 'invalidate') {
    return await handleCacheInvalidate(req, ctx);
  }

  return null;
}

async function handleQuickStats(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);

  const accessibleIds = await getAccessibleUserIds(db, auth);
  const cacheKey = `${auth.tenantId}:warehouse:quick-stats:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    accessible: accessibleIds.length,
  })}`;

  try {
    const result = await cached<QuickStats>(cacheKey, QUICK_STATS_TTL_SECONDS, async () => {
      const [current, previous] = await Promise.all([
        fetchOperations(db, {
          tenantId: auth.tenantId,
          technicianIds: accessibleIds,
          start: range.start,
          end: range.end,
        }),
        (async () => {
          const prior = previousRange(range);
          return fetchOperations(db, {
            tenantId: auth.tenantId,
            technicianIds: accessibleIds,
            start: prior.start,
            end: prior.end,
          });
        })(),
      ]);

      const techIds = uniqueAssignees(current);
      const techNames = await fetchTechNames(db, techIds);

      return computeQuickStats(current, previous, techNames);
    });

    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch warehouse team stats', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function handleCacheInvalidate(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;

  let body: { pattern?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — clear all entries for this tenant.
  }

  // Scope the wipe to the calling tenant so a manager can't blow away another
  // tenant's cache. If a pattern is provided, AND it with the tenant prefix.
  const pattern = body.pattern ? `${auth.tenantId}:${body.pattern}` : `${auth.tenantId}:`;
  const removed = clearCache(pattern);

  return jsonResponse(
    { message: 'Cache invalidated', pattern: body.pattern ?? 'all', removed },
    200,
    req,
    requestId,
  );
}

function uniqueAssignees(ops: WarehouseOperation[]): string[] {
  const set = new Set<string>();
  for (const op of ops) if (op.assigned_technician) set.add(op.assigned_technician);
  return [...set];
}

function computeQuickStats(
  current: WarehouseOperation[],
  previous: WarehouseOperation[],
  techNames: Map<string, string>,
): QuickStats {
  const totalKits = current.length;
  const completedKits = current.filter((op) => op.operation_status === 'completed').length;
  const inProgressKits = current.filter((op) => op.operation_status === 'in_progress').length;
  const reworkRequired = current.filter((op) => op.rework_required === true).length;
  const firstPassKits = current.filter((op) => op.first_pass_yield === true).length;
  const passedKits = current.filter((op) => op.quality_status === 'pass').length;

  const firstPassYield = completedKits > 0 ? (firstPassKits / completedKits) * 100 : 0;
  const accuracyRate = totalKits > 0 ? (passedKits / totalKits) * 100 : 0;

  const totalMinutes = current.reduce((sum, op) => sum + (op.total_duration_minutes ?? 0), 0);
  const productivity = totalMinutes > 0 ? completedKits / (totalMinutes / 60) : 0;
  const qualityScore = (firstPassYield + accuracyRate) / 2 / 20;

  const technicians = new Set<string>();
  const activeTechnicians = new Set<string>();
  for (const op of current) {
    if (!op.assigned_technician) continue;
    technicians.add(op.assigned_technician);
    if (op.operation_status === 'in_progress' || op.operation_status === 'completed') {
      activeTechnicians.add(op.assigned_technician);
    }
  }

  const technicianStats = [...technicians].map((id) => {
    const ops = current.filter((op) => op.assigned_technician === id);
    const completed = ops.filter((op) => op.operation_status === 'completed').length;
    const fpy = ops.filter((op) => op.first_pass_yield === true).length;
    return {
      id,
      name: techNames.get(id) ?? 'Unknown',
      fpyRate: completed > 0 ? (fpy / completed) * 100 : 0,
    };
  });
  technicianStats.sort((a, b) => b.fpyRate - a.fpyRate);
  const topTechnician = technicianStats[0]?.name ?? 'N/A';
  const techsNeedingSupport = technicianStats.filter((t) => t.fpyRate < 70).length;

  // Previous-window aggregates for trend lines.
  const prevCompleted = previous.filter((op) => op.operation_status === 'completed').length;
  const prevFirstPass = previous.filter((op) => op.first_pass_yield === true).length;
  const prevPassed = previous.filter((op) => op.quality_status === 'pass').length;
  const prevMinutes = previous.reduce((sum, op) => sum + (op.total_duration_minutes ?? 0), 0);

  const prevFPYRate = prevCompleted > 0 ? (prevFirstPass / prevCompleted) * 100 : 0;
  const prevAccuracy = previous.length > 0 ? (prevPassed / previous.length) * 100 : 0;
  const prevProductivity = prevMinutes > 0 ? prevCompleted / (prevMinutes / 60) : 0;

  return {
    performance: {
      firstPassYield: round1(firstPassYield),
      accuracyRate: round1(accuracyRate),
      productivity: round1(productivity),
      qualityScore: round2(qualityScore),
    },
    activity: { totalKits, completedKits, inProgressKits, reworkRequired },
    team: {
      totalTechnicians: technicians.size,
      activeTechnicians: activeTechnicians.size,
      topTechnician,
      techsNeedingSupport,
    },
    trends: {
      fpyTrend: trend(firstPassYield, prevFPYRate, 5),
      accuracyTrend: trend(accuracyRate, prevAccuracy, 5),
      productivityTrend: trend(productivity, prevProductivity, 0.5),
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
