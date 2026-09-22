/**
 * PROD-008: /api/mobile/dashboard had three consumers, three shapes, and
 * answered a fixture that matched none of them.
 *
 *   mobile/(dashboard)/index.tsx   reads openLeads, activeTickets, revenueMtd,
 *                                  totalEquipment, revenueTrend, leadsTrend
 *   mobile/(service)/field-service reads it as a ticket LIST
 *   client/src/MobileServiceApp    reads jobsQueue, technician.rating,
 *                                  partsInventory.vanStock.tonerCartridges …
 *
 * The Express handler returned "TECH-001", a 4.8 rating, 1247 completed jobs
 * and $2,340.50 of revenue today, so the two React Native screens showed "$—"
 * and blanks while the web page rendered fiction - and the edge function had no
 * branch at all, so both native screens 404'd on their only host.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  percentageChange,
  previousUtcMonthStart,
  summariseMobileDashboard,
  toMobileTickets,
  utcMonthStart,
} from '@shared/mobile-dashboard';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOW = new Date('2026-09-21T12:00:00.000Z');

describe('month boundaries', () => {
  it('are UTC midnights, so a range filter lands on a day boundary', () => {
    expect(utcMonthStart(NOW).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(previousUtcMonthStart(NOW).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('step back through a year boundary without overflowing', () => {
    // Date.UTC(y, -1, 1) is December of the previous year, which is why the
    // cursor is pinned to day 1 rather than built with setUTCMonth.
    const jan = new Date('2026-01-15T00:00:00.000Z');
    expect(previousUtcMonthStart(jan).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  it('a 31st does not skip a month', () => {
    // setUTCMonth on 31 March asks for "31 February" and lands in March.
    const mar31 = new Date('2026-03-31T23:00:00.000Z');
    expect(previousUtcMonthStart(mar31).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('percentageChange', () => {
  it('is null when the previous window was empty', () => {
    // Going from nothing to something is not "up 100%", it is the first of its
    // kind, and printing a number there invents momentum.
    expect(percentageChange(5000, 0)).toBeNull();
  });

  it('measures a real change', () => {
    expect(percentageChange(150, 100)).toBe(50);
    expect(percentageChange(50, 100)).toBe(-50);
  });

  it('is null rather than NaN for an unusable input', () => {
    expect(percentageChange(Number.NaN, 100)).toBeNull();
  });
});

describe('summariseMobileDashboard', () => {
  const paid = [
    { amountPaid: '1200.00', paidDate: '2026-09-04T10:00:00.000Z' },
    { amountPaid: '800', paidDate: '2026-09-18T10:00:00.000Z' },
    { amountPaid: '1000', paidDate: '2026-08-12T10:00:00.000Z' },
    { amountPaid: '9999', paidDate: '2026-06-01T10:00:00.000Z' }, // outside both windows
  ];
  const leads = [
    { createdAt: '2026-09-02T10:00:00.000Z' },
    { createdAt: '2026-09-11T10:00:00.000Z' },
    { createdAt: '2026-09-19T10:00:00.000Z' },
    { createdAt: '2026-08-20T10:00:00.000Z' },
    { createdAt: '2025-01-01T10:00:00.000Z' },
  ];

  it('sums what was COLLECTED this month, not what was billed', () => {
    // Money billed is not money collected; a home screen that conflates them
    // tells a dealer they are doing better than they are.
    expect(summariseMobileDashboard(paid, leads, NOW).revenueMtd).toBe(2000);
  });

  it('ignores a settlement outside both windows', () => {
    const out = summariseMobileDashboard(paid, leads, NOW);
    expect(out.revenueTrend).toBe(100); // 2000 vs 1000, not vs 10999
  });

  it('counts leads this month against last month for the trend', () => {
    // 3 this month, 1 last month.
    expect(summariseMobileDashboard(paid, leads, NOW).leadsTrend).toBe(200);
  });

  it('openLeads is every lead, not just this month', () => {
    expect(summariseMobileDashboard(paid, leads, NOW).openLeads).toBe(5);
  });

  it('a trend with no previous month is null, not zero', () => {
    const firstMonth = [{ amountPaid: '500', paidDate: '2026-09-03T10:00:00.000Z' }];
    const out = summariseMobileDashboard(firstMonth, [], NOW);
    expect(out.revenueMtd).toBe(500);
    expect(out.revenueTrend).toBeNull();
    expect(out.leadsTrend).toBeNull();
  });

  it('a settled invoice with no amount makes the total a floor and says so', () => {
    const out = summariseMobileDashboard(
      [...paid, { amountPaid: null, paidDate: '2026-09-09T10:00:00.000Z' }],
      leads,
      NOW,
    );
    expect(out.revenueMtd).toBe(2000);
    expect(out.uncostedPaidCount).toBe(1);
  });

  it('an unparseable amount is not a zero', () => {
    const out = summariseMobileDashboard(
      [{ amountPaid: 'n/a', paidDate: '2026-09-09T10:00:00.000Z' }],
      [],
      NOW,
    );
    expect(out.uncostedPaidCount).toBe(1);
    expect(out.revenueMtd).toBe(0);
  });

  it('a lead with no created date still counts, and skews no trend', () => {
    const out = summariseMobileDashboard(paid, [...leads, { createdAt: null }], NOW);
    expect(out.openLeads).toBe(6);
    expect(out.leadsTrend).toBe(200); // unchanged
  });
});

describe('toMobileTickets', () => {
  const names = new Map([['c1', 'Acme Print Co']]);
  const rows = [
    {
      id: 't2',
      ticketNumber: 'SV-2',
      description: 'Paper jam',
      priority: 'high',
      status: 'assigned',
      customerId: 'c1',
      customerAddress: '1 High St',
      customerPhone: '555-0100',
      scheduledDate: '2026-09-21T14:00:00.000Z',
      estimatedDuration: '90',
      requiredParts: [{ partNumber: 'X' }],
    },
    { id: 't1', scheduledDate: '2026-09-21T09:00:00.000Z', customerId: 'c1' },
    { id: 't3', scheduledDate: null, customerId: 'unknown-customer' },
  ];

  it('orders the day soonest first', () => {
    expect(toMobileTickets(rows, names).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('puts an unscheduled ticket last, not first', () => {
    // A ticket with no time on it is not the most urgent thing in the day, it
    // is the one nobody has placed yet.
    expect(toMobileTickets(rows, names).at(-1)!.id).toBe('t3');
  });

  it('resolves the customer name, and leaves it null when unknown', () => {
    const byId = new Map(toMobileTickets(rows, names).map((t) => [t.id, t]));
    expect(byId.get('t2')!.customerName).toBe('Acme Print Co');
    expect(byId.get('t3')!.customerName).toBeNull();
  });

  it('carries the fields the field-service screen reads', () => {
    const t2 = toMobileTickets(rows, names).find((t) => t.id === 't2')!;
    expect({
      address: t2.address,
      phone: t2.contactPhone,
      issue: t2.issueDescription,
      duration: t2.estimatedDuration,
    }).toEqual({
      address: '1 High St',
      phone: '555-0100',
      issue: 'Paper jam',
      duration: 90,
    });
  });

  it('a missing duration is null, not zero', () => {
    const t1 = toMobileTickets(rows, names).find((t) => t.id === 't1')!;
    expect(t1.estimatedDuration).toBeNull();
  });

  it('requiredParts is always an array, whatever the jsonb holds', () => {
    const odd = toMobileTickets([{ id: 'x', requiredParts: 'not an array' }], names);
    expect(odd[0].requiredParts).toEqual([]);
  });

  it('a row with no id is dropped rather than rendered as a blank card', () => {
    expect(toMobileTickets([{ id: null }, { id: 'ok' }], names).map((t) => t.id)).toEqual(['ok']);
  });
});

describe('the handler', () => {
  const fn = strip(read('supabase/functions/mobile/index.ts'));
  const at = fn.indexOf("resource === 'dashboard'");
  // Bounded by the next CODE construct, not by the comment banner that used to
  // follow it - `fn` has its comments stripped, so that marker is not in the
  // string and indexOf returned -1, running the slice to the end of the file
  // and quietly asserting about three other branches. Sixth time this session
  // that a window has failed to be a scope.
  const end = fn.indexOf('const denyIfTicketOutOfScope', at);
  expect(end).toBeGreaterThan(at);
  const branch = fn.slice(at, end);

  it('serves GET /mobile/dashboard', () => {
    expect(at).toBeGreaterThan(-1);
    expect(branch.length).toBeGreaterThan(500);
  });

  it('answers every key the React Native dashboard reads', () => {
    // Derived from the screen, not listed: a seventh field added there fails
    // here rather than rendering blank.
    const screen = read('mobile/app/(app)/(dashboard)/index.tsx');
    const reads = [...screen.matchAll(/dashboardData\?\.([a-zA-Z]+)/g)].map((m) => m[1]);
    expect(reads.length).toBeGreaterThan(3);
    const missing = [...new Set(reads)].filter((k) => !new RegExp(`\\b${k}:`).test(branch));
    expect(missing).toEqual([]);
  });

  it('answers the ticket list the field-service screen reads', () => {
    const screen = read('mobile/app/(app)/(service)/field-service.tsx');
    expect(screen).toMatch(/assignments\?\.tickets/);
    expect(branch).toMatch(/tickets: tickets \?\? \[\]/);
  });

  it('each section is caught separately so one failure is not six zeroes', () => {
    // A count of zero is a measurement about a quiet day; a null says the query
    // did not run, and the screen can tell them apart.
    expect((branch.match(/catch \(err\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(branch).toMatch(/activeTickets,/);
    expect(branch).toMatch(/let activeTickets: number \| null = null/);
  });

  it('every read is tenant-scoped', () => {
    const reads = [...branch.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(reads.length).toBeGreaterThan(2);
    expect((branch.match(/\.eq\('tenant_id', tenantId\)/g) ?? []).length).toBe(reads.length);
  });

  it('short-circuits rather than sending an .in() with no values', () => {
    expect(branch).toMatch(/customerIds\.length > 0/);
  });

  it('names the jobsQueue gap instead of filling it', () => {
    expect(branch).toMatch(/unbacked\.push\(/);
    expect(branch).toMatch(/jobsQueue is not returned/);
  });
});

describe('the fixture-rendering web page is left alone, with the reason', () => {
  it('/api/mobile/dashboard is NOT proxied', () => {
    // MobileServiceApp.tsx dereferences mobileData.technician.name and
    // partsInventory.vanStock.tonerCartridges with no guard, so handing it the
    // real shape turns a dev-only fixture into an immediate crash.
    const proxy = read('server/middleware/edge-function-proxy.ts');
    expect(proxy).not.toMatch(/'\/api\/mobile\/dashboard'/);
    expect(proxy).not.toMatch(/'\/api\/mobile': /);
  });

  it('the page says so at the top, where somebody about to wire it will look', () => {
    const page = read('client/src/pages/MobileServiceApp.tsx');
    expect(page.slice(0, 1600)).toMatch(/DO NOT WIRE THIS PAGE/);
    expect(page.slice(0, 1600)).toMatch(/AUDIT-033/);
  });

  it('the page really does make those unguarded reads, so the warning is not stale', () => {
    // Derived: if somebody guards them, this fails and the note gets revisited
    // rather than quietly outliving its reason.
    const page = read('client/src/pages/MobileServiceApp.tsx');
    expect(page).toMatch(/mobileData\.technician\.name/);
    expect(page).toMatch(/mobileData\.partsInventory\.vanStock/);
  });
});
