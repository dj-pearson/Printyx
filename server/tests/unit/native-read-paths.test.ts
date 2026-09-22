/**
 * The last three React Native read paths (PROD-008).
 *
 * Three screens asked for three endpoints and every one of them answered an
 * error that the screen rendered as an empty state:
 *
 *   (dashboard)/index.tsx    /api/activities/recent
 *     -> the activities function reads parts[0] as an id, so this was a lookup
 *        for an activity whose id is the string "recent": 404, shown as
 *        "No recent activity yet" to every dealer whose reps log calls.
 *   (reports)/index.tsx      /api/analytics/performance-metrics
 *     -> 400 "Invalid analytics type". The function serves `performance`, a
 *        different branch with a different shape, so neither the name nor the
 *        keys matched and all three KPI cards showed "--".
 *   (equipment)/[id].tsx     /api/equipment/:id/service-history
 *     -> 404 "Unknown equipment sub-resource", shown as "No service history"
 *        about machines with tickets against them.
 *
 * The arithmetic is tested against real inputs; the routing is read from source
 * because nothing typechecks the edge tree.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  monthToDateRevenue,
  summariseCloseRate,
  summariseMobileDashboard,
  summariseTicketTurnaround,
} from '@shared/mobile-dashboard';
import { toServiceHistory } from '@shared/service-history';
import { presentActivity } from '@shared/lead-activity-write';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTIVITIES = read('supabase/functions/activities/index.ts');
const ANALYTICS = read('supabase/functions/analytics/index.ts');
const EQUIPMENT = read('supabase/functions/equipment/index.ts');

/** A branch body, bounded by the next branch rather than by a character count. */
function branchAfter(src: string, marker: string): string {
  const bare = stripComments(src);
  const at = bare.indexOf(marker);
  expect({ marker, found: at > -1 }).toEqual({ marker, found: true });
  const rest = bare.slice(at + marker.length);
  const next = rest.search(/\n\s{4}if \(req\.method/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('month-to-date revenue is one definition, shared by both screens', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('sums what was collected this month, not what was billed', () => {
    const r = monthToDateRevenue(
      [
        { amountPaid: '1200.50', paidDate: '2026-09-02T00:00:00Z' },
        { amountPaid: 800, paidDate: '2026-09-19T00:00:00Z' },
        { amountPaid: '9999', paidDate: '2026-08-31T23:59:59Z' },
        { amountPaid: '5000', paidDate: null },
        // Older than the previous month: it is not this month's revenue and it
        // is not the baseline either, so it must reach neither total.
        { amountPaid: '77000', paidDate: '2025-04-01T00:00:00Z' },
      ],
      now,
    );
    expect(r.revenueMtd).toBeCloseTo(2000.5, 6);
    expect(r.revenuePrev).toBe(9999);
    expect(r.uncostedPaidCount).toBe(0);
  });

  it('a settled invoice with no amount is counted, never read as zero', () => {
    const r = monthToDateRevenue(
      [
        { amountPaid: '100', paidDate: '2026-09-05T00:00:00Z' },
        { amountPaid: null, paidDate: '2026-09-06T00:00:00Z' },
        { amountPaid: '', paidDate: '2026-09-07T00:00:00Z' },
      ],
      now,
    );
    expect(r.revenueMtd).toBe(100);
    expect(r.uncostedPaidCount).toBe(2);
  });

  it('the home screen reports the same figure the reports screen does', () => {
    const invoices = [
      { amountPaid: '400', paidDate: '2026-09-03T00:00:00Z' },
      { amountPaid: '600', paidDate: '2026-09-11T00:00:00Z' },
      { amountPaid: '250', paidDate: '2026-08-11T00:00:00Z' },
    ];
    expect(summariseMobileDashboard(invoices, [], now).revenueMtd).toBe(
      monthToDateRevenue(invoices, now).revenueMtd,
    );
  });
});

describe('close rate', () => {
  const since = new Date('2026-08-22T00:00:00Z');
  const now = new Date('2026-09-21T12:00:00Z');

  it('divides by DECIDED deals, so an open pipeline does not count as losses', () => {
    const r = summariseCloseRate(
      [
        { status: 'won', actualCloseDate: '2026-09-01T00:00:00Z' },
        { status: 'lost', actualCloseDate: '2026-09-02T00:00:00Z' },
        { status: 'open', actualCloseDate: null },
        { status: 'open', actualCloseDate: null },
        { status: 'open', actualCloseDate: null },
      ],
      since,
      now,
    );
    expect(r.decidedCount).toBe(2);
    expect(r.closeRate).toBe(50);
  });

  it('is null when nothing closed, never 0%', () => {
    const r = summariseCloseRate([{ status: 'open', actualCloseDate: null }], since, now);
    expect(r.closeRate).toBeNull();
    expect(r.decidedCount).toBe(0);
  });

  it('0% is a real answer when everything decided was lost', () => {
    const r = summariseCloseRate(
      [{ status: 'lost', actualCloseDate: '2026-09-02T00:00:00Z' }],
      since,
      now,
    );
    expect(r.closeRate).toBe(0);
  });

  it('a decision outside the window does not count', () => {
    const r = summariseCloseRate(
      [
        { status: 'won', actualCloseDate: '2026-01-01T00:00:00Z' },
        { status: 'lost', actualCloseDate: '2026-09-02T00:00:00Z' },
      ],
      since,
      now,
    );
    expect(r.wonCount).toBe(0);
    expect(r.closeRate).toBe(0);
  });

  it('a decided deal with no usable close date is reported, not placed', () => {
    // Two undated wins beside one dated LOSS. If an undated deal were treated
    // as closing now it would land in the window and the rate would read 67%;
    // the answer is 0%, measured over the one deal that can be placed.
    const r = summariseCloseRate(
      [
        { status: 'won', actualCloseDate: null },
        { status: 'won', actualCloseDate: 'not-a-date' },
        { status: 'lost', actualCloseDate: '2026-09-02T00:00:00Z' },
      ],
      since,
      now,
    );
    expect(r.undatedDecidedCount).toBe(2);
    expect(r.decidedCount).toBe(1);
    expect(r.wonCount).toBe(0);
    expect(r.closeRate).toBe(0);
  });

  it('an unrecognised status is neither won nor lost', () => {
    const r = summariseCloseRate(
      [
        { status: 'abandoned', actualCloseDate: '2026-09-02T00:00:00Z' },
        { status: null, actualCloseDate: '2026-09-02T00:00:00Z' },
        { status: 'WON', actualCloseDate: '2026-09-03T00:00:00Z' },
      ],
      since,
      now,
    );
    expect(r.decidedCount).toBe(1);
    expect(r.wonCount).toBe(1);
    expect(r.undatedDecidedCount).toBe(0);
  });
});

describe('ticket turnaround', () => {
  const since = new Date('2026-08-22T00:00:00Z');
  const now = new Date('2026-09-21T12:00:00Z');

  it('averages hours from raised to resolved', () => {
    const r = summariseTicketTurnaround(
      [
        { createdAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-01T04:00:00Z' },
        { createdAt: '2026-09-02T00:00:00Z', resolvedAt: '2026-09-02T08:00:00Z' },
      ],
      since,
      now,
    );
    expect(r.avgTicketHours).toBe(6);
    expect(r.resolvedCount).toBe(2);
  });

  it('counts a ticket by when it was RESOLVED, however long it was open', () => {
    // Opened before the window, closed inside it: a resolution this month with
    // a long turnaround, which is the number a service manager wants.
    const r = summariseTicketTurnaround(
      [{ createdAt: '2026-08-01T00:00:00Z', resolvedAt: '2026-09-01T00:00:00Z' }],
      since,
      now,
    );
    expect(r.resolvedCount).toBe(1);
    expect(r.avgTicketHours).toBe(31 * 24);
  });

  it('is null when nothing resolved, never 0 hours', () => {
    const r = summariseTicketTurnaround(
      [{ createdAt: '2026-09-01T00:00:00Z', resolvedAt: null }],
      since,
      now,
    );
    expect(r.avgTicketHours).toBeNull();
    expect(r.resolvedCount).toBe(0);
  });

  it('refuses a resolution earlier than its own creation rather than averaging it', () => {
    const r = summariseTicketTurnaround(
      [
        { createdAt: '2026-09-02T00:00:00Z', resolvedAt: '2026-09-01T00:00:00Z' },
        { createdAt: '2026-09-03T00:00:00Z', resolvedAt: '2026-09-03T02:00:00Z' },
      ],
      since,
      now,
    );
    expect(r.unmeasurableCount).toBe(1);
    expect(r.resolvedCount).toBe(1);
    expect(r.avgTicketHours).toBe(2);
  });

  it('a resolved ticket with no creation date is unmeasurable, not instant', () => {
    const r = summariseTicketTurnaround(
      [{ createdAt: null, resolvedAt: '2026-09-01T00:00:00Z' }],
      since,
      now,
    );
    expect(r.unmeasurableCount).toBe(1);
    expect(r.avgTicketHours).toBeNull();
  });

  it('a resolution outside the window is not counted', () => {
    const r = summariseTicketTurnaround(
      [{ createdAt: '2026-01-01T00:00:00Z', resolvedAt: '2026-01-02T00:00:00Z' }],
      since,
      now,
    );
    expect(r.resolvedCount).toBe(0);
    expect(r.unmeasurableCount).toBe(0);
  });
});

describe('service history', () => {
  it('dates an entry by the work, not by the row', () => {
    const [open, closed] = toServiceHistory([
      { id: 'b', created_at: '2026-09-01T00:00:00Z', resolved_at: null },
      { id: 'a', created_at: '2026-08-01T00:00:00Z', resolved_at: '2026-09-10T00:00:00Z' },
    ]);
    expect(closed.date).toBe('2026-09-01T00:00:00Z');
    expect(closed.isOpen).toBe(true);
    expect(open.date).toBe('2026-09-10T00:00:00Z');
    expect(open.isOpen).toBe(false);
  });

  it('is newest work first', () => {
    const rows = toServiceHistory([
      { id: '1', created_at: '2026-01-01T00:00:00Z' },
      { id: '3', created_at: '2026-03-01T00:00:00Z' },
      { id: '2', created_at: '2026-02-01T00:00:00Z' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('an entry with no date at all sorts LAST, not first', () => {
    const rows = toServiceHistory([
      { id: 'undated' },
      { id: 'old', created_at: '2020-01-01T00:00:00Z' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['old', 'undated']);
  });

  it('reads either spelling, because the two hosts send different ones', () => {
    const [snake] = toServiceHistory([
      { id: 's', ticket_number: 'T-1', resolution_notes: 'swapped drum', created_at: 'x' },
    ]);
    const [camel] = toServiceHistory([
      { id: 's', ticketNumber: 'T-1', resolutionNotes: 'swapped drum', createdAt: 'x' },
    ]);
    expect(snake.ticketNumber).toBe(camel.ticketNumber);
    expect(snake.resolutionNotes).toBe(camel.resolutionNotes);
  });

  it('`type` is the priority, and a ticket without one is null rather than labelled', () => {
    const [withPriority, without] = toServiceHistory([
      { id: 'b', priority: 'high', created_at: '2026-02-01T00:00:00Z' },
      { id: 'a', priority: null, created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(withPriority.type).toBe('high');
    expect(without.type).toBeNull();
  });

  it('a row with no id is dropped rather than rendered with a blank key', () => {
    expect(toServiceHistory([{ created_at: '2026-01-01T00:00:00Z' }])).toEqual([]);
  });
});

describe('the recent-activity feed answers what the screen reads', () => {
  it('presentActivity emits description, title, type and createdAt', () => {
    // The screen renders `item.description || item.title`, a Badge from
    // `item.type`, and a relative time from `item.createdAt`.
    const row = presentActivity({
      id: 'a1',
      activity_type: 'call',
      subject: 'Called Acme about the lease',
      description: null,
      created_at: '2026-09-20T09:00:00Z',
    });
    expect(row.description ?? row.title).toBe('Called Acme about the lease');
    expect(row.type).toBe('call');
    expect(row.createdAt).toBe('2026-09-20T09:00:00Z');
  });

  it('title is the subject, so a logged call with no description is not a blank row', () => {
    expect(presentActivity({ subject: 'Left voicemail' }).title).toBe('Left voicemail');
  });
});

describe('the three branches exist and are reached', () => {
  it('activities routes /recent ABOVE the :id lookup', () => {
    const bare = stripComments(ACTIVITIES);
    const recent = bare.indexOf("activityId === 'recent'");
    const byId = bare.indexOf("if (req.method === 'GET' && activityId) {");
    expect(recent).toBeGreaterThan(-1);
    expect(byId).toBeGreaterThan(-1);
    // Below the :id branch it would never run: parts[0] is "recent" there too.
    expect(recent).toBeLessThan(byId);
  });

  it('the recent feed is scoped to the caller on the column the table has', () => {
    const body = branchAfter(ACTIVITIES, "activityId === 'recent'");
    expect(body).toMatch(/resolveScope\(/);
    expect(body).toMatch(/applyUserScope\(\s*query,\s*'created_by'/);
    expect(body).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(body).toMatch(/\.from\('business_record_activities'\)/);
  });

  it('the recent feed answers a BARE ARRAY, because the screen tests isArray', () => {
    const body = branchAfter(ACTIVITIES, "activityId === 'recent'");
    expect(body).toMatch(/createCorsResponse\(\s*\(recent \|\| \[\]\)\.map\(/);
    expect(read('mobile/app/(app)/(dashboard)/index.tsx')).toMatch(
      /Array\.isArray\(recentActivity\)/,
    );
  });

  it('analytics serves performance-metrics, distinctly from performance', () => {
    const bare = stripComments(ANALYTICS);
    expect(bare).toMatch(/metricType === 'performance-metrics'/);
    expect(bare).toMatch(/metricType === 'performance'/);
  });

  it('the KPI branch answers the three keys the screen reads', () => {
    const body = branchAfter(ANALYTICS, "metricType === 'performance-metrics'");
    for (const key of ['revenueMtd:', 'closeRate:', 'avgTicketTime:']) {
      expect({ key, present: body.includes(key) }).toEqual({ key, present: true });
    }
    const screen = read('mobile/app/(app)/(reports)/index.tsx');
    for (const key of ['revenueMtd', 'closeRate', 'avgTicketTime']) {
      expect({ key, read: screen.includes(`kpis?.${key}`) }).toEqual({ key, read: true });
    }
  });

  it('the KPI window is snapped to a day boundary, once, for both reads', () => {
    const body = branchAfter(ANALYTICS, "metricType === 'performance-metrics'");
    expect(body).toMatch(/const windowStart = startOfUtcDay\(startDate\);/);
    // Both bounds and both summarisers take the SAME window, or a row is
    // fetched and then dropped - or expected and never fetched.
    expect(body).toMatch(/\.gte\('actual_close_date', windowStart\.toISOString\(\)\)/);
    expect(body).toMatch(/\.gte\('resolved_at', windowStart\.toISOString\(\)\)/);
    expect((body.match(/\bwindowStart,\n/g) ?? []).length).toBe(2);
    // An unsnapped bound would move the window on every request.
    expect(body).not.toMatch(/startDate\.toISOString\(\)/);
    // paid_date is a calendar date too and gets the same treatment.
    expect(body).toMatch(/startOfUtcDay\(previousUtcMonthStart\(now\)\)/);
  });

  it('the KPI branch scopes deals and says so, and names what it cannot scope', () => {
    const body = branchAfter(ANALYTICS, "metricType === 'performance-metrics'");
    expect(body).toMatch(/applyUserScope\(q, \['owner_id', 'created_by_id'\], scope\)/);
    expect(body).toMatch(/scopeTier: scope\.tier/);
    expect(body).toMatch(/unbacked/);
    // Revenue and turnaround are tenant-wide ON PURPOSE - invoices carry no
    // owner and a ticket's technician is not the person reading a sales KPI -
    // so the response has to say it rather than imply a personal figure.
    expect(body).toMatch(/tenant-wide/);
  });

  it('every KPI falls back to null, never to a flattering zero', () => {
    const body = branchAfter(ANALYTICS, "metricType === 'performance-metrics'");
    // Bound each value to the NEXT key in the literal rather than to a
    // character count: the avgTicketTime expression is three lines long, and a
    // fixed window either truncates it or runs into its neighbour.
    const keys = [
      'period,',
      'scopeTier:',
      'revenueMtd:',
      'revenueIsFloor:',
      'closeRate:',
      'dealsWon:',
      'dealsLost:',
      'avgTicketTime:',
      'ticketsResolved:',
      'unbacked,',
    ];
    const at = keys.map((k) => {
      const i = body.indexOf(k);
      expect({ k, found: i > -1 }).toEqual({ k, found: true });
      return i;
    });
    // Emitted in this order, so slicing between consecutive ones is the value.
    expect(at).toEqual([...at].sort((a, b) => a - b));

    for (const key of ['revenueMtd:', 'closeRate:', 'avgTicketTime:']) {
      const i = keys.indexOf(key);
      const expr = body.slice(at[i], at[i + 1]);
      expect({ key, fallsBackToNull: /:\s*null,?\s*$/.test(expr.trimEnd()) }).toEqual({
        key,
        fallsBackToNull: true,
      });
      expect({ key, zeroed: /\|\|\s*0\b|\?\?\s*0\b/.test(expr) }).toEqual({
        key,
        zeroed: false,
      });
    }
  });

  it('equipment serves the service-history sub-resource above the 404', () => {
    const bare = stripComments(EQUIPMENT);
    const branch = bare.indexOf("subResource === 'service-history'");
    const unknown = bare.indexOf('Unknown equipment sub-resource');
    expect(branch).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(unknown);
  });

  it('the sub-resource is tenant AND equipment scoped', () => {
    const body = branchAfter(EQUIPMENT, "subResource === 'service-history'");
    expect(body).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(body).toMatch(/\.eq\('equipment_id', equipmentId\)/);
  });

  it('both readers of the history go through the one mapper and one column list', () => {
    const bare = stripComments(EQUIPMENT);
    // Two shapes for one concept inside one file is how they drift.
    const mapped = bare.match(/toServiceHistory\(/g) ?? [];
    expect(mapped.length).toBeGreaterThanOrEqual(2);
    const selects = bare.match(/\.select\(SERVICE_HISTORY_COLUMNS\)/g) ?? [];
    expect(selects.length).toBe(2);
    // And the old narrow select is gone, so the embedded list cannot answer
    // fields the sub-resource does not.
    expect(bare).not.toMatch(/'id, ticket_number, status, created_at, resolved_at'/);
  });
});

describe('the reports screen distinguishes a measured zero from a missing one', () => {
  const SCREEN = read('mobile/app/(app)/(reports)/index.tsx');

  it('all three cards test for null, not for truthiness', () => {
    for (const key of ['revenueMtd', 'closeRate', 'avgTicketTime']) {
      expect({ key, guarded: SCREEN.includes(`kpis?.${key} != null`) }).toEqual({
        key,
        guarded: true,
      });
    }
  });

  it('a floored revenue total says so rather than reading as exact', () => {
    expect(SCREEN).toMatch(/revenueIsFloor/);
    expect(SCREEN).toMatch(/caveats/);
  });
});
