/**
 * WF-V-03: the dispatch board, and the assign step that never existed.
 *
 * Before this there was no page anywhere that wrote service_tickets
 * .assigned_technician_id. ServiceHub offered a "Smart Routing" modal recommending
 * "John Smith, 95% match, ETA 30 min" - two hardcoded technicians who are not rows
 * in anyone's database - beside an Assign button with no onClick. /service-dispatch
 * was a ComingSoon.
 *
 * The transitions below are the point of the story, and the middle one was broken
 * in a way no type checker could see: the handler read
 * `body[camelKey] || body[snakeKey]`, so the board's `assignedTechnicianId: null`
 * became undefined, supabase-js dropped the key from the JSON payload, and the
 * unassign answered 200 with the ticket still assigned.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import {
  applyTicketFields,
  assignmentNotification,
  dispatchLoad,
  OPEN_TICKET_STATUSES,
} from '../../../supabase/functions/service-tickets/_dispatch';

const read = (p: string) => readFileSync(p, 'utf8');
/** A comment describes a deleted feature as vividly as the feature did. */
const code = (p: string) =>
  read(p)
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const HANDLER = 'supabase/functions/service-tickets/index.ts';
const BOARD = 'client/src/pages/ServiceDispatchOptimization.tsx';
const SERVICE_HUB = 'client/src/pages/ServiceHub.tsx';

const ticket = (over: Record<string, unknown> = {}) => ({
  id: 't-1',
  ticket_number: 'SVC-1001',
  title: 'Fuser jam',
  status: 'open',
  priority: 'high',
  assigned_technician_id: null,
  ...over,
});

describe('assign / reassign / unassign', () => {
  it('assigns an unassigned ticket and records the change', () => {
    const { updateData, changes } = applyTicketFields(
      { assignedTechnicianId: 'tech-a', status: 'assigned' },
      ticket(),
    );

    expect(updateData.assigned_technician_id).toBe('tech-a');
    expect(updateData.status).toBe('assigned');
    expect(changes).toEqual([
      { field: 'status', oldValue: 'open', newValue: 'assigned' },
      { field: 'assigned_technician_id', oldValue: null, newValue: 'tech-a' },
    ]);
  });

  it('reassigns, carrying the previous technician as the old value', () => {
    const { updateData, changes } = applyTicketFields(
      { assignedTechnicianId: 'tech-b' },
      ticket({ assigned_technician_id: 'tech-a', status: 'assigned' }),
    );

    expect(updateData.assigned_technician_id).toBe('tech-b');
    expect(changes).toEqual([
      { field: 'assigned_technician_id', oldValue: 'tech-a', newValue: 'tech-b' },
    ]);
  });

  it('UNASSIGNS - the null reaches the update payload instead of vanishing', () => {
    const { updateData, changes } = applyTicketFields(
      { assignedTechnicianId: null, status: 'open' },
      ticket({ assigned_technician_id: 'tech-a', status: 'assigned' }),
    );

    // The regression: `||` turned this into undefined, JSON.stringify dropped the
    // key, and the technician stayed assigned.
    expect(Object.prototype.hasOwnProperty.call(updateData, 'assigned_technician_id')).toBe(true);
    expect(updateData.assigned_technician_id).toBeNull();
    expect(JSON.parse(JSON.stringify(updateData))).toHaveProperty('assigned_technician_id', null);
    expect(changes).toContainEqual({
      field: 'assigned_technician_id',
      oldValue: 'tech-a',
      newValue: null,
    });
  });

  it('leaves untouched fields out of the payload entirely', () => {
    const { updateData } = applyTicketFields({ assignedTechnicianId: 'tech-a' }, ticket());
    expect(Object.keys(updateData)).toEqual(['assigned_technician_id']);
  });

  it('keeps other falsy values the caller actually sent', () => {
    const { updateData } = applyTicketFields(
      { laborHours: 0, resolutionNotes: '' },
      ticket({ labor_hours: 3, resolution_notes: 'partial' }),
    );
    expect(updateData.labor_hours).toBe(0);
    expect(updateData.resolution_notes).toBe('');
  });

  it('accepts snake_case from callers that send it', () => {
    const { updateData } = applyTicketFields({ assigned_technician_id: 'tech-c' }, ticket());
    expect(updateData.assigned_technician_id).toBe('tech-c');
  });

  it('records no change when the assignment is re-sent unchanged', () => {
    const { changes } = applyTicketFields(
      { assignedTechnicianId: 'tech-a' },
      ticket({ assigned_technician_id: 'tech-a' }),
    );
    expect(changes).toEqual([]);
  });
});

describe('assignment notification', () => {
  const now = '2026-09-02T10:00:00.000Z';

  it('notifies the technician a ticket was dispatched to', () => {
    const { changes } = applyTicketFields({ assignedTechnicianId: 'tech-a' }, ticket());
    const row = assignmentNotification(changes, ticket(), 'dispatcher-1', 'tenant-1', 't-1', now);

    expect(row).toMatchObject({
      tenant_id: 'tenant-1',
      user_id: 'tech-a',
      category: 'service',
      action_url: '/mobile-field-service/t-1',
      read: false,
    });
    expect(String(row?.message)).toContain('SVC-1001');
  });

  it('raises the notification priority for an urgent call', () => {
    const { changes } = applyTicketFields({ assignedTechnicianId: 'tech-a' }, ticket());
    const row = assignmentNotification(
      changes,
      ticket({ priority: 'urgent' }),
      'dispatcher-1',
      'tenant-1',
      't-1',
      now,
    );
    expect(row?.priority).toBe('high');
  });

  it('sends nothing on an unassign, or when the dispatcher takes it themselves', () => {
    const cleared = applyTicketFields(
      { assignedTechnicianId: null },
      ticket({ assigned_technician_id: 'tech-a' }),
    );
    expect(
      assignmentNotification(cleared.changes, ticket(), 'dispatcher-1', 'tenant-1', 't-1', now),
    ).toBeNull();

    const self = applyTicketFields({ assignedTechnicianId: 'dispatcher-1' }, ticket());
    expect(
      assignmentNotification(self.changes, ticket(), 'dispatcher-1', 'tenant-1', 't-1', now),
    ).toBeNull();

    const statusOnly = applyTicketFields({ status: 'in_progress' }, ticket());
    expect(
      assignmentNotification(statusOnly.changes, ticket(), 'dispatcher-1', 'tenant-1', 't-1', now),
    ).toBeNull();
  });
});

describe('dispatch load', () => {
  const rows = [
    { assigned_technician_id: 'tech-a', scheduled_date: '2026-09-02T09:00:00Z' },
    { assigned_technician_id: 'tech-a', scheduled_date: '2026-09-05T09:00:00Z' },
    { assigned_technician_id: 'tech-b', scheduled_date: null },
    { assigned_technician_id: null, scheduled_date: '2026-09-02T11:00:00Z' },
    { assigned_technician_id: null, scheduled_date: null },
  ];

  it('counts open work per technician and the unassigned queue', () => {
    const { unassigned, load } = dispatchLoad(rows, '2026-09-02');
    expect(unassigned).toBe(2);
    expect(load).toEqual([
      { technicianId: 'tech-a', openCount: 2, todayCount: 1 },
      { technicianId: 'tech-b', openCount: 1, todayCount: 0 },
    ]);
  });

  it('reports an empty board rather than guessing', () => {
    expect(dispatchLoad([], '2026-09-02')).toEqual({ unassigned: 0, load: [] });
  });

  it('counts only outstanding statuses - closed work is not load', () => {
    expect(OPEN_TICKET_STATUSES).not.toContain('completed');
    expect(OPEN_TICKET_STATUSES).not.toContain('cancelled');
    expect(OPEN_TICKET_STATUSES).toContain('assigned');
    // The handler filters on exactly this list rather than a second copy.
    expect(code(HANDLER)).toContain(".in('status', OPEN_TICKET_STATUSES)");
  });
});

describe('the board is wired to real endpoints', () => {
  it('exists and is routed', () => {
    expect(existsSync(BOARD)).toBe(true);
    expect(code('client/src/App.tsx')).toContain(
      '<Route path="/service-dispatch" component={ServiceDispatchOptimization} />',
    );
  });

  it('PATCHes the ticket rather than pretending', () => {
    const board = code(BOARD);
    expect(board).toContain('/api/service-tickets/${ticketId}');
    expect(board).toContain('assignedTechnicianId: technicianId');
    expect(board).toContain('/api/service-tickets/dispatch-load');
    expect(board).not.toMatch(/ComingSoon/);
  });

  it('the handler serves the load endpoint the board reads', () => {
    expect(code(HANDLER)).toContain("ticketId === 'dispatch-load'");
  });

  it('assignment goes through the WF-R-07 row-scope gate', () => {
    const handler = code(HANDLER);
    const patchAt = handler.indexOf("req.method === 'PATCH'");
    expect(patchAt).toBeGreaterThan(-1);
    const patchBlock = handler.slice(patchAt, patchAt + 600);
    expect(patchBlock).toContain('denyIfTicketOutOfScope(ticketId)');
  });
});

describe('the fabricated Smart Routing modal is gone', () => {
  const hub = code(SERVICE_HUB);

  it('no longer invents technicians, match scores or arrival times', () => {
    expect(hub).not.toContain('getIntelligentRoutingSuggestions');
    expect(hub).not.toContain('showIntelligentRouting');
    expect(hub).not.toContain('John Smith');
    expect(hub).not.toContain('Sarah Johnson');
    expect(hub).not.toContain('estimatedArrival');
    expect(hub).not.toContain('% match');
  });

  it('points the dispatcher at the board that actually assigns', () => {
    expect(hub).toContain("setLocation('/service-dispatch')");
  });
});
