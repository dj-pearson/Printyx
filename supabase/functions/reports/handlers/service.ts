// Service-persona reports — /reports/service/*
// Replaces server/routes/service-reports-api.ts.
//
// Endpoints:
//   GET  /reports/service/personal/calls
//   GET  /reports/service/personal/calls/:ticketId
//   GET  /reports/service/personal/parts          (degraded — table missing)
//   GET  /reports/service/personal/time           (degraded — task-scoped only)
//   GET  /reports/service/team/dispatch-queue
//   GET  /reports/service/team/quick-stats
//   POST /reports/service/cache/invalidate
//
// Express used `requirePermission('service.ticket.view_own' / 'view_team')`.
// We don't have per-permission RBAC here; hierarchy + tenant filter is the
// trust boundary, same as warehouse + director handlers.
//
// Per-field schema deltas captured in `_queries/service.ts`. Personal calls
// returns the real shape with category / first_time_fix / satisfaction set
// to null. Parts + time endpoints return empty data with `degraded: true`
// because the underlying tables don't exist in our schema.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { getAccessibleUserIds } from '../_hierarchy.ts';
import {
  fetchPersonalTickets,
  fetchDispatchQueue,
  fetchTeamTickets,
  fetchCustomerNames,
  type TicketRow,
} from '../_queries/service.ts';

const TTL_SECONDS = 300;

interface CallRow {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  equipmentModel: string | null;
  serialNumber: string | null;
  priority: string | null;
  status: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  duration: number;
  category: string | null;
  resolutionType: string | null;
  firstTimeFixRate: boolean | null;
  customerSatisfaction: number | null;
}

interface CallSummary {
  calls: CallRow[];
  summary: {
    totalCalls: number;
    completed: number;
    inProgress: number;
    scheduled: number;
    averageDuration: number;
    firstTimeFixRate: number | null;
    averageSatisfaction: number | null;
    callsByPriority: Record<string, number>;
    callsByCategory: Record<string, number>;
  };
  performance: {
    productivity: number;
    quality: number | null;
    satisfaction: number | null;
    efficiency: number;
  };
  degraded: {
    category: boolean;
    resolutionType: boolean;
    firstTimeFix: boolean;
    customerSatisfaction: boolean;
    equipmentModel: boolean;
  };
}

export async function handleService(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['service', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];
  const sub3 = pathParts[3];

  if (method === 'GET' && sub === 'personal' && sub2 === 'calls' && !sub3) {
    return await cachedPersonalCalls(req, ctx);
  }
  if (method === 'GET' && sub === 'personal' && sub2 === 'calls' && sub3) {
    return await ticketDetail(req, ctx, sub3);
  }
  if (method === 'GET' && sub === 'personal' && sub2 === 'parts') {
    return jsonResponse(emptyPartsReport(), 200, req, ctx.requestId);
  }
  if (method === 'GET' && sub === 'personal' && sub2 === 'time') {
    return jsonResponse(emptyTimeReport(), 200, req, ctx.requestId);
  }
  if (method === 'GET' && sub === 'team' && sub2 === 'dispatch-queue') {
    return await cachedDispatchQueue(req, ctx);
  }
  if (method === 'GET' && sub === 'team' && sub2 === 'quick-stats') {
    return await cachedTeamQuickStats(req, ctx);
  }
  if (method === 'POST' && sub === 'cache' && sub2 === 'invalidate') {
    return await cacheInvalidate(req, ctx);
  }
  return null;
}

// ─── /personal/calls ────────────────────────────────────────────────────────

async function cachedPersonalCalls(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const status = url.searchParams.get('status') ?? undefined;

  const key = `${auth.tenantId}:service:personal-calls:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    status: status ?? null,
  })}`;

  try {
    const result = await cached<CallSummary>(key, TTL_SECONDS, async () => {
      const tickets = await fetchPersonalTickets(db, {
        tenantId: auth.tenantId,
        technicianIds: [auth.userId],
        start: range.start,
        end: range.end,
        status,
      });
      const customerNames = await fetchCustomerNames(
        db,
        tickets.map((t) => t.customer_id ?? '').filter(Boolean),
      );

      const calls = ticketsToCalls(tickets, customerNames);
      const summary = summarize(calls);
      return {
        calls,
        summary,
        performance: {
          productivity: summary.totalCalls > 0 ? summary.completed / summary.totalCalls : 0,
          quality: null,
          satisfaction: null,
          efficiency: summary.averageDuration,
        },
        degraded: {
          category: true,
          resolutionType: true,
          firstTimeFix: true,
          customerSatisfaction: true,
          equipmentModel: true,
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch service calls', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

async function ticketDetail(req: Request, ctx: HandlerCtx, ticketId: string): Promise<Response> {
  // Express returned a placeholder for this. Preserve that contract until
  // a real detail endpoint is wired (would aggregate ticket + updates +
  // parts_used + labor_hours).
  return jsonResponse(
    {
      message: 'Detailed service call view — to be implemented',
      ticketId,
      degraded: { detail: true },
    },
    200,
    req,
    ctx.requestId,
  );
}

// ─── /team/dispatch-queue ───────────────────────────────────────────────────

async function cachedDispatchQueue(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const priority = url.searchParams.get('priority') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const assignedTo = url.searchParams.get('assignedTo') ?? undefined;

  const key = `${auth.tenantId}:service:dispatch-queue:${auth.userId}:${paramKey({
    priority: priority ?? null,
    status: status ?? null,
    assignedTo: assignedTo ?? null,
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const accessibleIds = await getAccessibleUserIds(db, auth);
      const tickets = await fetchDispatchQueue(db, {
        tenantId: auth.tenantId,
        accessibleTechnicianIds: accessibleIds,
        priority,
        status,
        assignedTo,
      });

      const customerNames = await fetchCustomerNames(
        db,
        tickets.map((t) => t.customer_id ?? '').filter(Boolean),
      );

      const queue = tickets.map((t) => ({
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        customerName: customerNames.get(t.customer_id ?? '') ?? 'Unknown',
        equipmentModel: null,
        location: null,
        priority: t.priority,
        status: t.status,
        assignedTechnicianId: t.assigned_technician_id,
        assignedTechnicianName: null,
        scheduledDate: t.scheduled_date,
        estimatedDuration: t.estimated_duration ?? 0,
        category: null,
        daysOpen: daysSince(t.created_at),
        slaStatus: 'on_time' as const,
        slaDeadline: null,
      }));
      const summary = summarizeDispatch(queue);
      return {
        queue,
        summary,
        workloadMetrics: dispatchWorkload(summary),
        degraded: {
          slaDeadline: true,
          equipmentModel: true,
          location: true,
          assignedTechnicianName: true,
          category: true,
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch dispatch queue', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── /team/quick-stats ──────────────────────────────────────────────────────

async function cachedTeamQuickStats(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:service:team-quick-stats:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth);
      const tickets = await fetchTeamTickets(db, auth.tenantId, ids, range.start, range.end);

      const total = tickets.length;
      const completed = tickets.filter((t) => t.status === 'completed').length;
      const inProgress = tickets.filter((t) => t.status === 'in-progress').length;
      const open = tickets.filter((t) => t.status === 'open' || t.status === 'assigned').length;

      const technicians = new Set<string>();
      const activeTechs = new Set<string>();
      for (const t of tickets) {
        if (!t.assigned_technician_id) continue;
        technicians.add(t.assigned_technician_id);
        if (t.status === 'in-progress' || t.status === 'completed') {
          activeTechs.add(t.assigned_technician_id);
        }
      }

      return {
        activity: {
          totalTickets: total,
          completedTickets: completed,
          inProgressTickets: inProgress,
          openTickets: open,
        },
        team: {
          totalTechnicians: technicians.size,
          activeTechnicians: activeTechs.size,
        },
        performance: {
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          firstTimeFixRate: null,
          averageSatisfaction: null,
        },
        degraded: { firstTimeFixRate: true, averageSatisfaction: true },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team quick stats', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── /cache/invalidate ──────────────────────────────────────────────────────

async function cacheInvalidate(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;
  let body: { pattern?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }
  const pattern = body.pattern
    ? `${auth.tenantId}:service:${body.pattern}`
    : `${auth.tenantId}:service:`;
  const removed = clearCache(pattern);
  return jsonResponse(
    { message: 'Service report cache invalidated', pattern: body.pattern ?? 'all', removed },
    200,
    req,
    requestId,
  );
}

// ─── degraded reports ───────────────────────────────────────────────────────

function emptyPartsReport(): unknown {
  return {
    parts: [],
    summary: {
      totalParts: 0,
      totalCost: 0,
      billableCost: 0,
      nonBillableCost: 0,
      topParts: [],
      costByCategory: {},
    },
    metrics: {
      costPerCall: 0,
      billablePercentage: 0,
      averagePartCost: 0,
    },
    degraded: { partsUsageTable: true },
  };
}

function emptyTimeReport(): unknown {
  return {
    entries: [],
    summary: {
      totalHours: 0,
      productiveHours: 0,
      travelHours: 0,
      utilizationRate: 0,
      hoursByDay: [],
    },
    metrics: {
      productivityRate: 0,
      travelPercentage: 0,
      averageHoursPerDay: 0,
      billableRate: 0,
    },
    degraded: { technicianTimeEntries: true },
  };
}

// ─── transforms / aggregations ──────────────────────────────────────────────

function ticketsToCalls(tickets: TicketRow[], customerNames: Map<string, string>): CallRow[] {
  return tickets
    .map((t) => {
      const scheduled = t.scheduled_date ? new Date(t.scheduled_date).getTime() : null;
      const completed = t.resolved_at ? new Date(t.resolved_at).getTime() : null;
      const duration =
        scheduled !== null && completed !== null && completed > scheduled
          ? Math.round((completed - scheduled) / 60000)
          : 0;
      return {
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        customerName: customerNames.get(t.customer_id ?? '') ?? 'Unknown',
        equipmentModel: null,
        serialNumber: null,
        priority: t.priority,
        status: t.status,
        scheduledDate: t.scheduled_date,
        completedDate: t.resolved_at,
        duration,
        category: null,
        resolutionType: null,
        firstTimeFixRate: null,
        customerSatisfaction: null,
      };
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function summarize(calls: CallRow[]): CallSummary['summary'] {
  const completed = calls.filter((c) => c.status === 'completed').length;
  const inProgress = calls.filter((c) => c.status === 'in-progress').length;
  const scheduled = calls.filter((c) => c.status === 'scheduled' || c.status === 'assigned').length;

  const completedWithDuration = calls.filter((c) => c.status === 'completed' && c.duration > 0);
  const averageDuration =
    completedWithDuration.length > 0
      ? completedWithDuration.reduce((s, c) => s + c.duration, 0) / completedWithDuration.length
      : 0;

  const callsByPriority: Record<string, number> = {};
  for (const c of calls) {
    if (!c.priority) continue;
    callsByPriority[c.priority] = (callsByPriority[c.priority] ?? 0) + 1;
  }

  return {
    totalCalls: calls.length,
    completed,
    inProgress,
    scheduled,
    averageDuration,
    firstTimeFixRate: null,
    averageSatisfaction: null,
    callsByPriority,
    callsByCategory: {},
  };
}

function summarizeDispatch(
  queue: Array<{
    priority: string | null;
    assignedTechnicianId: string | null;
    daysOpen: number;
    slaStatus: string;
  }>,
): {
  totalTickets: number;
  unassigned: number;
  scheduled: number;
  overdue: number;
  atRisk: number;
  byPriority: Record<string, number>;
  byTechnician: Record<string, number>;
  averageDaysOpen: number;
} {
  const totalTickets = queue.length;
  const unassigned = queue.filter((q) => !q.assignedTechnicianId).length;
  const overdue = queue.filter((q) => q.slaStatus === 'overdue').length;
  const atRisk = queue.filter((q) => q.slaStatus === 'at_risk').length;
  const scheduled = queue.length - unassigned;

  const byPriority: Record<string, number> = {};
  const byTechnician: Record<string, number> = {};
  for (const q of queue) {
    if (q.priority) byPriority[q.priority] = (byPriority[q.priority] ?? 0) + 1;
    if (q.assignedTechnicianId) {
      byTechnician[q.assignedTechnicianId] = (byTechnician[q.assignedTechnicianId] ?? 0) + 1;
    }
  }

  const averageDaysOpen =
    queue.length > 0 ? queue.reduce((s, q) => s + q.daysOpen, 0) / queue.length : 0;

  return {
    totalTickets,
    unassigned,
    scheduled,
    overdue,
    atRisk,
    byPriority,
    byTechnician,
    averageDaysOpen,
  };
}

function dispatchWorkload(summary: ReturnType<typeof summarizeDispatch>): unknown {
  const total = summary.totalTickets;
  return {
    averageTicketsPerTech:
      Object.keys(summary.byTechnician).length > 0
        ? total / Object.keys(summary.byTechnician).length
        : 0,
    unassignedPercentage: total > 0 ? (summary.unassigned / total) * 100 : 0,
    overduePercentage: total > 0 ? (summary.overdue / total) * 100 : 0,
    atRiskPercentage: total > 0 ? (summary.atRisk / total) * 100 : 0,
    scheduledPercentage: total > 0 ? (summary.scheduled / total) * 100 : 0,
  };
}

function priorityRank(p: string | null): number {
  switch (p) {
    case 'critical':
    case 'urgent':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
      return 4;
    default:
      return 5;
  }
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}
