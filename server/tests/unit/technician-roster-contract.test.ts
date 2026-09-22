/**
 * Round 141 - the Technician Management page was broken in production three
 * ways, and worked in dev, so nobody filed it.
 *
 * `/api/technician-management` is NOT proxied, so dev runs
 * server/routes-technician-management.ts and production runs the edge
 * function. Every caller in every client tree asks for exactly three paths:
 * /technicians, /technicians/:id and /dashboard.
 *
 *   1. The edge list branch is the BARE path, so `technicians` was read as a
 *      technician id and the roster 404'd on every load in production. The
 *      /:id, /:id/skills and /:id/schedule branches were unreachable too.
 *   2. There was no /dashboard branch at all, so the four stat cards were
 *      empty there.
 *   3. The edge list answered the RAW row - first_name, skills, is_active -
 *      while the page reads name, specialties, status. Even once routed, every
 *      cell would have been blank.
 *
 * The projection lives in shared/technician-roster.ts. Express keeps doing it
 * in SQL on purpose: its `count(*) FILTER` GROUP BY is what AUDIT-007 put
 * there to kill a 2N round trip, and moving that into JS would undo it. So the
 * two cannot share an implementation and the contract is asserted instead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  bucketTicketCounts,
  technicianName,
  toRosterRow,
  TERMINAL_TICKET_STATUSES,
} from '../../../shared/technician-roster';

const ROOT = resolve(__dirname, '../../..');
const EDGE = resolve(ROOT, 'supabase/functions/technician-management/index.ts');
const EXPRESS = resolve(ROOT, 'server/routes-technician-management.ts');
const PAGE = resolve(ROOT, 'client/src/pages/TechnicianManagement.tsx');

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('the roster projection', () => {
  const row = {
    id: 't1',
    user_id: 'u1',
    employee_id: 'E-7',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.test',
    phone: '555',
    skills: ['copiers', 'network'],
    certifications: ['canon'],
    current_location: 'Depot',
    is_active: true,
    is_available: false,
    hourly_rate: '42.50',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };

  it('maps the columns the page reads', () => {
    const out = toRosterRow(row);
    expect(out.name).toBe('Ada Lovelace');
    expect(out.specialties).toEqual(['copiers', 'network']);
    expect(out.status).toBe('active');
    expect(out.availability).toBe('busy');
    expect(out.location).toBe('Depot');
    expect(out.hourlyRate).toBe(42.5);
  });

  it('trims a name with only one half present', () => {
    expect(technicianName({ first_name: 'Ada', last_name: null })).toBe('Ada');
    expect(technicianName({ first_name: null, last_name: 'Lovelace' })).toBe('Lovelace');
    expect(technicianName({})).toBe('');
  });

  it('never invents the two states nothing records', () => {
    // 'on_leave' and 'offline' are in the page's union and no column produces
    // them, so they must not be guessed from the two booleans.
    for (const active of [true, false]) {
      for (const availableNow of [true, false]) {
        const out = toRosterRow({ is_active: active, is_available: availableNow });
        expect(['active', 'inactive']).toContain(out.status);
        expect(['available', 'busy']).toContain(out.availability);
      }
    }
  });

  it('treats a non-array skills value as empty rather than throwing', () => {
    expect(toRosterRow({ skills: null }).specialties).toEqual([]);
    expect(toRosterRow({ skills: 'copiers' }).specialties).toEqual([]);
  });
});

describe('ticket bucketing', () => {
  const monthStart = new Date('2026-03-01T00:00:00Z');

  it('counts open tickets and this month completions separately', () => {
    const counts = bucketTicketCounts(
      ['a', 'b'],
      [
        { assigned_technician_id: 'a', status: 'in_progress' },
        { assigned_technician_id: 'a', status: 'open' },
        { assigned_technician_id: 'a', status: 'completed', updated_at: '2026-03-05T00:00:00Z' },
        { assigned_technician_id: 'b', status: 'completed', updated_at: '2026-02-20T00:00:00Z' },
      ],
      monthStart,
    );
    expect(counts.get('a')).toEqual({ activeTickets: 2, completedThisMonth: 1 });
    // February's completion belongs to February.
    expect(counts.get('b')).toEqual({ activeTickets: 0, completedThisMonth: 0 });
  });

  it('a technician with no tickets appears at zero, not absent', () => {
    // The rows were looked for, so zero is a measurement.
    const counts = bucketTicketCounts(['a', 'quiet'], [], monthStart);
    expect(counts.get('quiet')).toEqual({ activeTickets: 0, completedThisMonth: 0 });
  });

  it('cancelled is terminal and is counted nowhere', () => {
    const counts = bucketTicketCounts(
      ['a'],
      [{ assigned_technician_id: 'a', status: 'cancelled', updated_at: '2026-03-05T00:00:00Z' }],
      monthStart,
    );
    expect(counts.get('a')).toEqual({ activeTickets: 0, completedThisMonth: 0 });
  });

  it('a completion with no usable timestamp is not placed in this month', () => {
    for (const updated of [undefined, null, 'not-a-date']) {
      const counts = bucketTicketCounts(
        ['a'],
        [{ assigned_technician_id: 'a', status: 'completed', updated_at: updated as never }],
        monthStart,
      );
      expect(counts.get('a')!.completedThisMonth).toBe(0);
    }
  });

  it('ignores a ticket assigned to somebody outside the page', () => {
    const counts = bucketTicketCounts(
      ['a'],
      [{ assigned_technician_id: 'stranger', status: 'open' }],
      monthStart,
    );
    expect(counts.get('a')!.activeTickets).toBe(0);
    expect(counts.has('stranger')).toBe(false);
  });
});

describe('both hosts answer the same field set', () => {
  const express = strip(read(EXPRESS));

  it("Express's SQL projection and the shared mapper emit the same keys", () => {
    // Express does the projection in SQL because its count(*) FILTER GROUP BY
    // is AUDIT-007's fix for a 2N round trip. It cannot import the mapper, so
    // the contract is compared instead.
    const select = /\.select\(\{([\s\S]*?)\n          \}\)/.exec(express);
    expect(select, 'Express projection not found').not.toBeNull();
    const expressKeys = new Set(
      [...select![1].matchAll(/^\s*([a-zA-Z][A-Za-z0-9]*):/gm)].map((m) => m[1]),
    );
    expect(expressKeys.size).toBeGreaterThanOrEqual(15);

    const mapped = new Set(Object.keys(toRosterRow({})));
    // The two counts are added after the projection on the Express side.
    mapped.delete('activeTickets');
    mapped.delete('completedThisMonth');
    for (const k of expressKeys) {
      expect(mapped.has(k), `shared mapper is missing ${k}`).toBe(true);
    }
  });
});

describe('the edge function serves the paths the page calls', () => {
  const edge = strip(read(EDGE));
  const page = strip(read(PAGE));

  it('strips an optional leading technicians segment', () => {
    expect(edge).toMatch(/rawParts\[0\] === 'technicians' \? rawParts\.slice\(1\) : rawParts/);
  });

  it('routes /dashboard above the /:id branches', () => {
    const dash = edge.indexOf("techId === 'dashboard'");
    const byId = edge.indexOf("req.method === 'GET' && techId && !subResource");
    expect(dash).toBeGreaterThan(-1);
    expect(byId).toBeGreaterThan(-1);
    // Otherwise 'dashboard' is looked up as a technician id and 404s.
    expect(dash).toBeLessThan(byId);
  });

  it('scopes the dashboard counts the way the roster is scoped', () => {
    const at = edge.indexOf("techId === 'dashboard'");
    const branch = edge.slice(at, edge.indexOf("req.method === 'GET' && techId && !subResource"));
    expect(branch).toMatch(/applyUserScope\(q, 'user_id', scope\)/);
    expect(branch).toMatch(/\.eq\('tenant_id', tenantId\)/);
  });

  it('answers null rather than zero for a count it could not read', () => {
    const at = edge.indexOf("techId === 'dashboard'");
    const branch = edge.slice(at, edge.indexOf("req.method === 'GET' && techId && !subResource"));
    expect(branch).toMatch(/return null;/);
    expect(branch).toMatch(/degraded/);
    // 0% utilisation over an empty crew is a claim, not a measurement.
    expect(branch).toMatch(/active === 0 \? null/);
  });

  it('counts tickets in one paged fetch, not per technician', () => {
    expect(edge).toMatch(/fetchAllRows<TicketRow>\(\(\) =>/);
    const at = edge.indexOf('fetchAllRows<TicketRow>');
    // No per-row await inside the roster mapping.
    const mapAt = edge.indexOf('rows.map((r) => toRosterRow(');
    expect(mapAt).toBeGreaterThan(at);
    expect(edge.slice(mapAt, mapAt + 200)).not.toMatch(/await/);
  });

  it('the page renders a null count as an em dash, never as zero', () => {
    expect(page).toMatch(/function statValue\(/);
    // The property is that every .toFixed() on a nullable count is GUARDED,
    // not that the call is absent - the guarded one is the correct code.
    for (const m of page.matchAll(/dashboardStats\.(\w+)\.toFixed/g)) {
      const before = page.slice(Math.max(0, m.index! - 200), m.index!);
      expect(before, `${m[1]}.toFixed() is not guarded against null`).toMatch(
        new RegExp(`dashboardStats\\.${m[1]} === null`),
      );
    }
    expect(page).toMatch(/dashboardStats\.utilizationRate === null/);
    // And every raw count goes through the em-dash helper.
    for (const field of [
      'totalTechnicians',
      'activeTechnicians',
      'availableTechnicians',
      'busyTechnicians',
    ]) {
      expect(page, `${field} must render through statValue`).toMatch(
        new RegExp(`statValue\\(dashboardStats\\.${field}\\)`),
      );
    }
  });

  it('the page says when the counts cover less than the tenant', () => {
    expect(page).toMatch(/coversWholeTenant === false/);
  });
});

describe('terminal statuses match the Express predicate', () => {
  it('is completed and cancelled, the same two words', () => {
    expect([...TERMINAL_TICKET_STATUSES].sort()).toEqual(['cancelled', 'completed']);
    const express = strip(read(EXPRESS));
    expect(express).toMatch(/NOT IN \('completed', 'cancelled'\)/);
  });
});
