/**
 * Service analytics overview, computed once for the edge function.
 *
 * GET /api/service-analytics used to count tickets against a hand-written
 * status list that predated WF-V-05's vocabulary: `open` tickets were
 * ['new','open','assigned','en_route','on_site','in_progress'] and `closed`
 * were ['completed','resolved','closed']. So a ticket `scheduled` or `on_hold`
 * - both canonical, both enforced by migration 0078's CHECK constraint - was
 * counted as NEITHER, and a `cancelled` one likewise, which meant Open plus
 * Closed never added up to the Total printed beside them. The by-status table
 * listed `new`, which nothing writes, and omitted `open`, `scheduled` and
 * `on_hold`, which are what the writers actually store.
 *
 * Every status now goes through normalizeTicketStatus, so the aliases the
 * vocabulary already accepts (in-progress, resolved, closed) land in the right
 * bucket, and a value the vocabulary does not know is COUNTED under
 * `unrecognised` rather than dropped - a status that vanishes from every card
 * is how the totals stopped adding up in the first place.
 *
 * Dependency-free apart from the vocabulary, and no environment access, so
 * the Deno function imports it at ../../../shared (round 94: one module beats
 * a parity test whenever both runtimes can read it).
 */

import {
  CLOSED_TICKET_STATUSES,
  OPEN_TICKET_STATUSES,
  SERVICE_TICKET_PRIORITIES,
  SERVICE_TICKET_STATUSES,
  normalizeTicketPriority,
  normalizeTicketStatus,
  type ServiceTicketPriority,
  type ServiceTicketStatus,
} from './service-ticket-vocabulary.ts';

export interface AnalyticsTicket {
  status: string | null;
  priority: string | null;
  created_at: string | null;
  resolved_at: string | null;
  assigned_technician_id: string | null;
}

export interface TechnicianTally {
  technicianId: string;
  assignedTickets: number;
  completedTickets: number;
  completionRate: number;
}

export interface ServiceAnalyticsSummary {
  overview: {
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    /** Hours, rounded. Null when nothing has a resolution time to average. */
    avgResolutionTime: number | null;
  };
  byStatus: Record<ServiceTicketStatus | 'unrecognised', number>;
  byPriority: Record<ServiceTicketPriority | 'unrecognised', number>;
  technicians: TechnicianTally[];
}

const HOUR_MS = 60 * 60 * 1000;

export function summariseServiceTickets(tickets: AnalyticsTicket[]): ServiceAnalyticsSummary {
  const byStatus = Object.fromEntries(
    [...SERVICE_TICKET_STATUSES, 'unrecognised'].map((s) => [s, 0]),
  ) as ServiceAnalyticsSummary['byStatus'];
  const byPriority = Object.fromEntries(
    [...SERVICE_TICKET_PRIORITIES, 'unrecognised'].map((p) => [p, 0]),
  ) as ServiceAnalyticsSummary['byPriority'];

  let openTickets = 0;
  let closedTickets = 0;
  let resolutionMs = 0;
  let resolutionCount = 0;
  const technicianMap = new Map<string, { assigned: number; completed: number }>();

  for (const t of tickets) {
    const status = normalizeTicketStatus(t.status);
    byStatus[status ?? 'unrecognised']++;
    if (status && OPEN_TICKET_STATUSES.includes(status)) openTickets++;
    if (status && CLOSED_TICKET_STATUSES.includes(status)) closedTickets++;

    byPriority[normalizeTicketPriority(t.priority) ?? 'unrecognised']++;

    if (t.created_at && t.resolved_at) {
      const elapsed = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      // A resolution earlier than its own creation is clock skew or a
      // backfill, not a negative duration (round 115).
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        resolutionMs += elapsed;
        resolutionCount++;
      }
    }

    if (t.assigned_technician_id) {
      const current = technicianMap.get(t.assigned_technician_id) ?? { assigned: 0, completed: 0 };
      current.assigned++;
      // Completed, not closed: a cancelled ticket is not work the technician
      // finished, and counting it would inflate their completion rate.
      if (status === 'completed') current.completed++;
      technicianMap.set(t.assigned_technician_id, current);
    }
  }

  return {
    overview: {
      totalTickets: tickets.length,
      openTickets,
      closedTickets,
      avgResolutionTime:
        resolutionCount > 0 ? Math.round(resolutionMs / resolutionCount / HOUR_MS) : null,
    },
    byStatus,
    byPriority,
    technicians: Array.from(technicianMap.entries()).map(([technicianId, s]) => ({
      technicianId,
      assignedTickets: s.assigned,
      completedTickets: s.completed,
      completionRate: Math.round((s.completed / s.assigned) * 100),
    })),
  };
}
