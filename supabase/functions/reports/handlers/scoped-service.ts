// Service manager (region-scoped) + service supervisor (location-scoped) reports.
// Replaces server/routes/service-manager-reports-api.ts +
// server/routes/service-supervisor-reports-api.ts.
//
// URL conventions:
//   manager:    /service-manager/{regional-service-calls,regional-performance,regional-sla,regional-activity,clear-cache}
//   supervisor: /service-supervisor/{location-service-calls,location-performance,location-sla,location-activity,clear-cache}
//
// Service tickets per unit are computed by joining
//   service_tickets.assigned_technician_id → users.primary_location_id
//   → locations.region_id (when unit === 'region').
//
// SLA endpoints are degraded — service_tickets has no `sla_deadline` column
// in the real schema; the original SQL was speculative. We return zeroed
// metrics with `degraded: true`.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { fetchTeamTickets } from '../_queries/service.ts';
import { fetchActivities } from '../_queries/sales.ts';
import {
  fetchUnits,
  fetchUsersWithUnits,
  fetchLocationLookup,
  buildUserUnitMap,
  type Unit,
} from '../_queries/scoped.ts';

const TTL_SECONDS = 300;

type Op = 'service-calls' | 'performance' | 'sla' | 'activity' | 'clear-cache' | 'unknown';

function normalizeOp(unit: Unit, pathParts: string[]): Op {
  // pathParts: ['service-manager' | 'service-supervisor', ...]
  const p1 = pathParts[1];
  if (p1 === 'clear-cache') return 'clear-cache';

  if (unit === 'region') {
    if (p1 === 'regional-service-calls') return 'service-calls';
    if (p1 === 'regional-performance') return 'performance';
    if (p1 === 'regional-sla') return 'sla';
    if (p1 === 'regional-activity') return 'activity';
  } else {
    if (p1 === 'location-service-calls') return 'service-calls';
    if (p1 === 'location-performance') return 'performance';
    if (p1 === 'location-sla') return 'sla';
    if (p1 === 'location-activity') return 'activity';
  }
  return 'unknown';
}

export async function handleScopedService(
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
    case 'service-calls':
      return cachedServiceCalls(req, ctx, unit);
    case 'performance':
      return cachedPerformance(req, ctx, unit);
    case 'sla':
      return jsonResponse(degradedSla(unit), 200, req, requestId);
    case 'activity':
      return cachedActivity(req, ctx, unit);
    default:
      return null;
  }
}

// ─── service-calls (per-unit) ───────────────────────────────────────────────

async function cachedServiceCalls(req: Request, ctx: HandlerCtx, unit: Unit): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:scoped-service:${unit}:calls:${paramKey({
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
      const tickets = await fetchTeamTickets(
        db,
        auth.tenantId,
        users.map((u) => u.id),
        range.start,
        range.end,
      );

      const perUnit = new Map<
        string,
        {
          total: number;
          completed: number;
          inProgress: number;
          open: number;
          technicians: Set<string>;
        }
      >();
      for (const u of units) {
        perUnit.set(u.id, {
          total: 0,
          completed: 0,
          inProgress: 0,
          open: 0,
          technicians: new Set(),
        });
      }

      for (const t of tickets) {
        if (!t.assigned_technician_id) continue;
        const unitId = userUnit.get(t.assigned_technician_id);
        if (!unitId) continue;
        const stats = perUnit.get(unitId);
        if (!stats) continue;
        stats.total += 1;
        stats.technicians.add(t.assigned_technician_id);
        if (t.status === 'completed') stats.completed += 1;
        else if (t.status === 'in-progress') stats.inProgress += 1;
        else if (t.status === 'open' || t.status === 'assigned' || t.status === 'scheduled') {
          stats.open += 1;
        }
      }

      const regions = units.map((u) => {
        const s = perUnit.get(u.id) ?? {
          total: 0,
          completed: 0,
          inProgress: 0,
          open: 0,
          technicians: new Set<string>(),
        };
        return {
          unitId: u.id,
          unitName: u.name,
          totalCalls: s.total,
          completedCalls: s.completed,
          inProgressCalls: s.inProgress,
          openCalls: s.open,
          technicians: s.technicians.size,
          completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        };
      });

      return {
        unit,
        regions,
        summary: {
          totalUnits: regions.length,
          totalCalls: regions.reduce((sum, r) => sum + r.totalCalls, 0),
          totalCompleted: regions.reduce((sum, r) => sum + r.completedCalls, 0),
          totalTechnicians: regions.reduce((sum, r) => sum + r.technicians, 0),
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped service calls', req, {
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
  const key = `${auth.tenantId}:scoped-service:${unit}:performance:${paramKey({
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
      const tickets = await fetchTeamTickets(
        db,
        auth.tenantId,
        users.map((u) => u.id),
        range.start,
        range.end,
      );

      const perUnit = new Map<
        string,
        {
          total: number;
          completed: number;
          totalDurationMin: number;
          completedWithDuration: number;
        }
      >();
      for (const u of units) {
        perUnit.set(u.id, {
          total: 0,
          completed: 0,
          totalDurationMin: 0,
          completedWithDuration: 0,
        });
      }

      for (const t of tickets) {
        if (!t.assigned_technician_id) continue;
        const unitId = userUnit.get(t.assigned_technician_id);
        if (!unitId) continue;
        const stats = perUnit.get(unitId);
        if (!stats) continue;
        stats.total += 1;
        if (t.status === 'completed') {
          stats.completed += 1;
          if (t.scheduled_date && t.resolved_at) {
            const mins =
              (new Date(t.resolved_at).getTime() - new Date(t.scheduled_date).getTime()) / 60000;
            if (mins > 0 && Number.isFinite(mins)) {
              stats.totalDurationMin += mins;
              stats.completedWithDuration += 1;
            }
          }
        }
      }

      const regions = units.map((u) => {
        const s = perUnit.get(u.id) ?? {
          total: 0,
          completed: 0,
          totalDurationMin: 0,
          completedWithDuration: 0,
        };
        return {
          unitId: u.id,
          unitName: u.name,
          totalCalls: s.total,
          completedCalls: s.completed,
          completionRate: s.total > 0 ? round2((s.completed / s.total) * 100) : 0,
          avgResolutionMinutes:
            s.completedWithDuration > 0
              ? Math.round(s.totalDurationMin / s.completedWithDuration)
              : 0,
          ftfRate: null,
          slaCompliance: null,
          avgSatisfaction: null,
        };
      });

      return {
        unit,
        regions,
        summary: {
          totalUnits: regions.length,
          averageCompletionRate:
            regions.length > 0
              ? round2(regions.reduce((s, r) => s + r.completionRate, 0) / regions.length)
              : 0,
        },
        degraded: { firstTimeFix: true, slaCompliance: true, customerSatisfaction: true },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped service performance', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── activity (per-unit, service activities) ───────────────────────────────

async function cachedActivity(req: Request, ctx: HandlerCtx, unit: Unit): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:scoped-service:${unit}:activity:${paramKey({
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

      // Service activities = service_call + the ticket-status churn proxy.
      // We pull business_record_activities filtered to the service-related
      // activity_type values and bucket per unit.
      const allActivityRows = await Promise.all(
        users.map((u) =>
          fetchActivities(db, auth.tenantId, u.id, range.start, range.end).then((rows) =>
            rows
              .filter(
                (r) =>
                  r.activity_type === 'service_call' ||
                  r.activity_type === 'note' ||
                  r.activity_type === 'task',
              )
              .map((r) => ({ ...r, _userId: u.id })),
          ),
        ),
      );
      const flat = allActivityRows.flat();

      const perUnit = new Map<string, number>();
      for (const u of units) perUnit.set(u.id, 0);
      for (const a of flat) {
        const uid = userUnit.get(a._userId);
        if (!uid) continue;
        perUnit.set(uid, (perUnit.get(uid) ?? 0) + 1);
      }

      return {
        unit,
        regions: units.map((u) => ({
          unitId: u.id,
          unitName: u.name,
          totalActivities: perUnit.get(u.id) ?? 0,
        })),
        totals: { totalActivities: flat.length },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch scoped service activity', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── degraded SLA ──────────────────────────────────────────────────────────

function degradedSla(unit: Unit): unknown {
  return {
    unit,
    regions: [],
    summary: {
      totalCalls: 0,
      onTime: 0,
      atRisk: 0,
      overdue: 0,
      complianceRate: 0,
    },
    degraded: { slaDeadline: true, slaStatus: true },
  };
}

function clearScopedCache(req: Request, ctx: HandlerCtx, unit: Unit): Response {
  const { auth, requestId } = ctx;
  const removed = clearCache(`${auth.tenantId}:scoped-service:${unit}:`);
  return jsonResponse(
    { message: `Service ${unit} report cache cleared`, removed },
    200,
    req,
    requestId,
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
