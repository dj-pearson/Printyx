/**
 * Round 146: GET /api/service-analytics, both hosts.
 *
 * Dev was served by routes-misc-stubs.ts, which answered zeros for every count;
 * production counted real tickets against a status list older than WF-V-05's
 * vocabulary, so scheduled, on_hold and cancelled tickets were neither open nor
 * closed. One summariser now, over the canonical vocabulary, and one host.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import {
  summariseServiceTickets,
  type AnalyticsTicket,
} from '../../../shared/service-analytics-summary';
import {
  SERVICE_TICKET_STATUSES,
  SERVICE_TICKET_PRIORITIES,
} from '../../../shared/service-ticket-vocabulary';

const t = (over: Partial<AnalyticsTicket>): AnalyticsTicket => ({
  status: 'open',
  priority: 'medium',
  created_at: null,
  resolved_at: null,
  assigned_technician_id: null,
  ...over,
});

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('summariseServiceTickets', () => {
  it('counts every canonical status as open or closed, so the cards add up', () => {
    const tickets = SERVICE_TICKET_STATUSES.map((status) => t({ status }));
    const { overview } = summariseServiceTickets(tickets);
    expect(overview.totalTickets).toBe(SERVICE_TICKET_STATUSES.length);
    expect(overview.openTickets + overview.closedTickets).toBe(overview.totalTickets);
  });

  it('counts scheduled and on_hold as open and cancelled as closed', () => {
    const { overview } = summariseServiceTickets([
      t({ status: 'scheduled' }),
      t({ status: 'on_hold' }),
      t({ status: 'cancelled' }),
    ]);
    expect(overview.openTickets).toBe(2);
    expect(overview.closedTickets).toBe(1);
  });

  it('normalises aliases into the canonical bucket', () => {
    const { byStatus } = summariseServiceTickets([
      t({ status: 'in-progress' }),
      t({ status: 'resolved' }),
      t({ status: 'new' }),
    ]);
    expect(byStatus.in_progress).toBe(1);
    expect(byStatus.completed).toBe(1);
    expect(byStatus.open).toBe(1);
    expect(Object.keys(byStatus)).not.toContain('new');
  });

  it('counts an unknown status or priority rather than dropping it', () => {
    const { byStatus, byPriority, overview } = summariseServiceTickets([
      t({ status: 'frobnicated', priority: 'whenever' }),
      t({ status: 'open', priority: 'emergency' }),
    ]);
    expect(byStatus.unrecognised).toBe(1);
    expect(byPriority.unrecognised).toBe(1);
    expect(byPriority.urgent).toBe(1);
    const statusSum = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const prioritySum = Object.values(byPriority).reduce((a, b) => a + b, 0);
    expect(statusSum).toBe(overview.totalTickets);
    expect(prioritySum).toBe(overview.totalTickets);
  });

  it('carries every canonical status and priority key even at zero', () => {
    const { byStatus, byPriority } = summariseServiceTickets([]);
    for (const s of SERVICE_TICKET_STATUSES) expect(byStatus[s]).toBe(0);
    for (const p of SERVICE_TICKET_PRIORITIES) expect(byPriority[p]).toBe(0);
  });

  it('answers null average resolution when nothing resolved, and skips negative intervals', () => {
    expect(summariseServiceTickets([t({})]).overview.avgResolutionTime).toBeNull();
    const { overview } = summariseServiceTickets([
      t({ created_at: '2026-09-01T00:00:00Z', resolved_at: '2026-09-01T04:00:00Z' }),
      t({ created_at: '2026-09-02T00:00:00Z', resolved_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(overview.avgResolutionTime).toBe(4);
  });

  it('credits a technician for completed tickets only, not cancelled ones', () => {
    const { technicians } = summariseServiceTickets([
      t({ assigned_technician_id: 'u1', status: 'completed' }),
      t({ assigned_technician_id: 'u1', status: 'cancelled' }),
      t({ assigned_technician_id: 'u1', status: 'closed' }),
      t({ assigned_technician_id: 'u1', status: 'on_site' }),
    ]);
    expect(technicians).toEqual([
      { technicianId: 'u1', assignedTickets: 4, completedTickets: 2, completionRate: 50 },
    ]);
  });
});

describe('service-analytics wiring', () => {
  const edge = stripComments(readFileSync('supabase/functions/service-analytics/index.ts', 'utf8'));

  it('the edge function counts through the shared summariser', () => {
    expect(edge).toMatch(/from '\.\.\/\.\.\/\.\.\/shared\/service-analytics-summary\.ts'/);
    expect(edge).toMatch(/summariseServiceTickets\(allTickets\)/);
    expect(existsSync('shared/service-analytics-summary.ts')).toBe(true);
  });

  it('carries no hand-written status list of its own', () => {
    expect(edge).not.toMatch(/\['new',/);
    expect(edge).not.toMatch(/\['completed', 'resolved', 'closed'\]/);
  });

  it('dev runs the edge function: the prefix is proxied and the stub is gone', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/service-analytics': 'service-analytics'/);
    expect(existsSync('server/routes-misc-stubs.ts')).toBe(false);
    const registry = stripComments(readFileSync('server/routes-registry.ts', 'utf8'));
    expect(registry).not.toMatch(/registerMiscStubRoutes|routes-misc-stubs/);
  });
});
