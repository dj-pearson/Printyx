// Team-lead reports — /reports/team/*
// Replaces server/routes/team-reports-api.ts.
//
// Endpoints:
//   GET  /reports/team/pipeline-comparison
//   GET  /reports/team/activity-leaderboard
//   GET  /reports/team/performance-dashboard
//   GET  /reports/team/lead-management
//   GET  /reports/team/coaching
//   GET  /reports/team/quick-stats
//   POST /reports/team/clear-cache
//
// Team scope = self + direct reports (users.manager_id = self), resolved
// via getAccessibleUserIds(scope='team'). The base sales/service handlers
// expose `/team/*` endpoints too (comparison, pipeline, dispatch-queue,
// quick-stats); this handler adds the team-lead-specific reports the
// Express version had under /api/team-reports/*.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { rangeFromQuery } from '../_date.ts';
import { cached, paramKey, clear as clearCache } from '../_cache.ts';
import { getAccessibleUserIds } from '../_hierarchy.ts';
import { fetchOpps, fetchActivities, fetchUserNames } from '../_queries/sales.ts';
import { fetchTeamTickets } from '../_queries/service.ts';

const TTL_SECONDS = 300;

export async function handleTeam(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['team', ...]
  const sub = pathParts[1];

  if (method === 'GET') {
    if (sub === 'pipeline-comparison') return cachedPipelineComparison(req, ctx);
    if (sub === 'activity-leaderboard') return cachedActivityLeaderboard(req, ctx);
    if (sub === 'performance-dashboard') return cachedPerformanceDashboard(req, ctx);
    if (sub === 'lead-management') return cachedLeadManagement(req, ctx);
    if (sub === 'coaching') return cachedCoaching(req, ctx);
    if (sub === 'quick-stats') return cachedQuickStats(req, ctx);
  }
  if (method === 'POST' && sub === 'clear-cache') {
    return cacheInvalidate(req, ctx);
  }
  return null;
}

// ─── pipeline-comparison ────────────────────────────────────────────────────

async function cachedPipelineComparison(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:pipeline-comparison:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: ids,
        start: range.start,
        end: range.end,
      });
      const userNames = await fetchUserNames(db, ids);

      const perMember = new Map<
        string,
        {
          revenue: number;
          won: number;
          closed: number;
          inProgress: number;
          pipelineValue: number;
        }
      >();
      for (const id of ids) {
        perMember.set(id, { revenue: 0, won: 0, closed: 0, inProgress: 0, pipelineValue: 0 });
      }
      for (const o of opps) {
        if (!o.owner_id) continue;
        const m = perMember.get(o.owner_id);
        if (!m) continue;
        const isWon = o.is_won === true || o.stage_name === 'Closed Won';
        const isClosed = o.is_closed === true || isWon || o.stage_name === 'Closed Lost';
        const amount = parseFloatSafe(o.amount);
        if (isWon) {
          m.revenue += amount;
          m.won += 1;
        }
        if (isClosed) m.closed += 1;
        else {
          m.inProgress += 1;
          m.pipelineValue += parseFloatSafe(o.expected_revenue, amount);
        }
      }

      const teamMembers = [...perMember.entries()]
        .map(([userId, s]) => {
          const winRate = s.closed > 0 ? round2((s.won / s.closed) * 100) : 0;
          // Coverage = pipeline / revenue (over period). For an empty rep, coverage is null.
          const pipelineCoverage = s.revenue > 0 ? round2((s.pipelineValue / s.revenue) * 100) : 0;
          return {
            userId,
            userName: userNames.get(userId) ?? 'Unknown',
            revenue: round2(s.revenue),
            dealsWon: s.won,
            dealsInProgress: s.inProgress,
            pipelineValue: round2(s.pipelineValue),
            pipelineCoverage,
            winRate,
          };
        })
        .sort((a, b) => b.pipelineValue - a.pipelineValue);

      const teamPipelineCoverage =
        teamMembers.length > 0
          ? round2(teamMembers.reduce((s, m) => s + m.pipelineCoverage, 0) / teamMembers.length)
          : 0;

      const pipelineCoverageStatus =
        teamPipelineCoverage >= 300
          ? 'excellent'
          : teamPipelineCoverage >= 200
            ? 'good'
            : teamPipelineCoverage >= 100
              ? 'fair'
              : 'needs_attention';

      return {
        teamMembers,
        summary: {
          teamSize: teamMembers.length,
          totalRevenue: teamMembers.reduce((s, m) => s + m.revenue, 0),
          totalPipeline: teamMembers.reduce((s, m) => s + m.pipelineValue, 0),
          teamPipelineCoverage,
        },
        insights: {
          pipelineCoverageStatus,
          topPerformers: teamMembers.slice(0, 3),
          lowCoverage: teamMembers.filter((m) => m.pipelineCoverage < 100),
          averageCoverage: teamPipelineCoverage,
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team pipeline comparison', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── activity-leaderboard ───────────────────────────────────────────────────

async function cachedActivityLeaderboard(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:activity-leaderboard:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const userNames = await fetchUserNames(db, ids);

      // Per-user activity counts.
      const allRows = await Promise.all(
        ids.map((id) =>
          fetchActivities(db, auth.tenantId, id, range.start, range.end).then((rows) =>
            rows.map((r) => ({ ...r, _userId: id })),
          ),
        ),
      );

      const perUser = new Map<
        string,
        {
          calls: number;
          emails: number;
          meetings: number;
          demos: number;
          proposals: number;
          completed: number;
          total: number;
        }
      >();
      for (const id of ids) {
        perUser.set(id, {
          calls: 0,
          emails: 0,
          meetings: 0,
          demos: 0,
          proposals: 0,
          completed: 0,
          total: 0,
        });
      }
      for (const r of allRows.flat()) {
        const stats = perUser.get(r._userId);
        if (!stats) continue;
        stats.total += 1;
        if (r.completed_date) stats.completed += 1;
        switch (r.activity_type) {
          case 'call':
            stats.calls += 1;
            break;
          case 'email':
            stats.emails += 1;
            break;
          case 'meeting':
            stats.meetings += 1;
            break;
          case 'demo':
            stats.demos += 1;
            break;
          case 'proposal':
            stats.proposals += 1;
            break;
        }
      }

      const activities = [...perUser.entries()]
        .map(([userId, s]) => ({
          userId,
          userName: userNames.get(userId) ?? 'Unknown',
          calls: s.calls,
          emails: s.emails,
          meetings: s.meetings,
          demos: s.demos,
          proposals: s.proposals,
          totalActivities: s.total,
          completionRate: s.total > 0 ? round2((s.completed / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.totalActivities - a.totalActivities);

      const activityTypeBreakdown = activities.reduce(
        (acc, a) => ({
          calls: acc.calls + a.calls,
          emails: acc.emails + a.emails,
          meetings: acc.meetings + a.meetings,
          demos: acc.demos + a.demos,
          proposals: acc.proposals + a.proposals,
        }),
        { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 },
      );

      const completionRateAvg =
        activities.length > 0
          ? activities.reduce((s, a) => s + a.completionRate, 0) / activities.length
          : 0;

      return {
        activities,
        summary: {
          teamSize: activities.length,
          totalActivities: activities.reduce((s, a) => s + a.totalActivities, 0),
          activityTypeBreakdown,
          completionRateAvg: round2(completionRateAvg),
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team activity leaderboard', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── performance-dashboard ──────────────────────────────────────────────────

async function cachedPerformanceDashboard(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:performance-dashboard:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const userNames = await fetchUserNames(db, ids);

      const [opps, tickets] = await Promise.all([
        fetchOpps(db, {
          tenantId: auth.tenantId,
          ownerIds: ids,
          start: range.start,
          end: range.end,
        }),
        fetchTeamTickets(db, auth.tenantId, ids, range.start, range.end),
      ]);

      const perMember = new Map<
        string,
        {
          revenue: number;
          deals: number;
          tickets: number;
          ticketsCompleted: number;
        }
      >();
      for (const id of ids)
        perMember.set(id, { revenue: 0, deals: 0, tickets: 0, ticketsCompleted: 0 });

      for (const o of opps) {
        if (!o.owner_id) continue;
        const m = perMember.get(o.owner_id);
        if (!m) continue;
        if (o.is_won === true || o.stage_name === 'Closed Won') {
          m.revenue += parseFloatSafe(o.amount);
          m.deals += 1;
        }
      }
      for (const t of tickets) {
        if (!t.assigned_technician_id) continue;
        const m = perMember.get(t.assigned_technician_id);
        if (!m) continue;
        m.tickets += 1;
        if (t.status === 'completed') m.ticketsCompleted += 1;
      }

      const members = [...perMember.entries()]
        .map(([userId, s]) => ({
          userId,
          userName: userNames.get(userId) ?? 'Unknown',
          revenue: round2(s.revenue),
          deals: s.deals,
          tickets: s.tickets,
          ticketCompletionRate: s.tickets > 0 ? round2((s.ticketsCompleted / s.tickets) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        members,
        summary: {
          teamSize: members.length,
          totalRevenue: members.reduce((s, m) => s + m.revenue, 0),
          totalDeals: members.reduce((s, m) => s + m.deals, 0),
          totalTickets: members.reduce((s, m) => s + m.tickets, 0),
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team performance dashboard', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── lead-management ────────────────────────────────────────────────────────

async function cachedLeadManagement(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:lead-management:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const userNames = await fetchUserNames(db, ids);

      // business_records is the unified leads + customers table; record_type
      // discriminates. Owner column is `owner_id` or `assigned_to` depending
      // on the schema variant; we try owner_id first.
      const { data: leads, error } = await db
        .from('business_records')
        .select('id, record_type, status, owner_id, created_at, lead_status')
        .eq('tenant_id', auth.tenantId)
        .in('record_type', ['lead', 'customer'])
        .gte('created_at', range.start.toISOString())
        .lte('created_at', range.end.toISOString());
      if (error) throw new Error(`fetchLeads: ${error.message}`);

      type LeadRow = {
        id: string;
        record_type: string;
        status: string | null;
        owner_id: string | null;
        created_at: string;
        lead_status: string | null;
      };
      const rows = ((leads ?? []) as LeadRow[]).filter(
        (r) => r.owner_id && ids.includes(r.owner_id),
      );

      const perMember = new Map<
        string,
        {
          leadsCreated: number;
          leadsQualified: number;
          leadsConverted: number;
          customersCreated: number;
        }
      >();
      for (const id of ids) {
        perMember.set(id, {
          leadsCreated: 0,
          leadsQualified: 0,
          leadsConverted: 0,
          customersCreated: 0,
        });
      }
      for (const r of rows) {
        const m = perMember.get(r.owner_id!);
        if (!m) continue;
        if (r.record_type === 'lead') {
          m.leadsCreated += 1;
          if (r.lead_status === 'qualified' || r.lead_status === 'proposal') m.leadsQualified += 1;
        } else if (r.record_type === 'customer') {
          m.customersCreated += 1;
          m.leadsConverted += 1;
        }
      }

      const members = [...perMember.entries()]
        .map(([userId, s]) => {
          const conversionRate =
            s.leadsCreated > 0 ? round2((s.leadsConverted / s.leadsCreated) * 100) : 0;
          return {
            userId,
            userName: userNames.get(userId) ?? 'Unknown',
            ...s,
            conversionRate,
          };
        })
        .sort((a, b) => b.leadsCreated - a.leadsCreated);

      return {
        members,
        summary: {
          teamSize: members.length,
          totalLeadsCreated: members.reduce((s, m) => s + m.leadsCreated, 0),
          totalLeadsQualified: members.reduce((s, m) => s + m.leadsQualified, 0),
          totalLeadsConverted: members.reduce((s, m) => s + m.leadsConverted, 0),
        },
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team lead management', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── coaching ───────────────────────────────────────────────────────────────

async function cachedCoaching(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:coaching:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const userNames = await fetchUserNames(db, ids);

      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: ids,
        start: range.start,
        end: range.end,
      });

      const perMember = new Map<
        string,
        { won: number; closed: number; lost: number; revenue: number }
      >();
      for (const id of ids) perMember.set(id, { won: 0, closed: 0, lost: 0, revenue: 0 });

      for (const o of opps) {
        if (!o.owner_id) continue;
        const m = perMember.get(o.owner_id);
        if (!m) continue;
        const isWon = o.is_won === true || o.stage_name === 'Closed Won';
        const isLost = o.stage_name === 'Closed Lost';
        const isClosed = o.is_closed === true || isWon || isLost;
        if (isWon) {
          m.won += 1;
          m.revenue += parseFloatSafe(o.amount);
        }
        if (isLost) m.lost += 1;
        if (isClosed) m.closed += 1;
      }

      const members = [...perMember.entries()].map(([userId, s]) => {
        const winRate = s.closed > 0 ? round2((s.won / s.closed) * 100) : 0;
        const lossRate = s.closed > 0 ? round2((s.lost / s.closed) * 100) : 0;
        const flags: string[] = [];
        if (winRate < 20 && s.closed >= 5) flags.push('low_win_rate');
        if (s.revenue === 0 && s.closed === 0) flags.push('no_activity');
        if (lossRate > 60 && s.closed >= 5) flags.push('high_loss_rate');
        return {
          userId,
          userName: userNames.get(userId) ?? 'Unknown',
          winRate,
          lossRate,
          dealsClosed: s.closed,
          revenue: round2(s.revenue),
          flags,
          coachingPriority: flags.length >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low',
        };
      });

      const needsAttention = members.filter((m) => m.flags.length > 0);

      return {
        members,
        summary: {
          teamSize: members.length,
          membersNeedingAttention: needsAttention.length,
          highPriorityCount: members.filter((m) => m.coachingPriority === 'high').length,
        },
        recommendations: needsAttention.slice(0, 5).map((m) => ({
          userId: m.userId,
          userName: m.userName,
          flags: m.flags,
          priority: m.coachingPriority,
        })),
      };
    });
    return jsonResponse(result, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, 'Failed to fetch team coaching report', req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── quick-stats ────────────────────────────────────────────────────────────

async function cachedQuickStats(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const range = rangeFromQuery(url);
  const key = `${auth.tenantId}:team:quick-stats:${auth.userId}:${paramKey({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })}`;

  try {
    const result = await cached(key, TTL_SECONDS, async () => {
      const ids = await getAccessibleUserIds(db, auth, 'team');
      const opps = await fetchOpps(db, {
        tenantId: auth.tenantId,
        ownerIds: ids,
        start: range.start,
        end: range.end,
      });
      const tickets = await fetchTeamTickets(db, auth.tenantId, ids, range.start, range.end);

      const wonOpps = opps.filter((o) => o.is_won === true || o.stage_name === 'Closed Won');
      const totalRevenue = wonOpps.reduce((s, o) => s + parseFloatSafe(o.amount), 0);
      const completedTickets = tickets.filter((t) => t.status === 'completed').length;

      return {
        team: {
          memberCount: ids.length,
        },
        sales: {
          totalRevenue: round2(totalRevenue),
          wonDeals: wonOpps.length,
          openOpps: opps.filter((o) => !(o.is_closed === true || o.is_won === true)).length,
        },
        service: {
          totalTickets: tickets.length,
          completed: completedTickets,
          completionRate:
            tickets.length > 0 ? round2((completedTickets / tickets.length) * 100) : 0,
        },
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

// ─── cache invalidate ───────────────────────────────────────────────────────

async function cacheInvalidate(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, requestId } = ctx;
  const removed = clearCache(`${auth.tenantId}:team:`);
  return jsonResponse({ message: 'Team report cache cleared', removed }, 200, req, requestId);
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
