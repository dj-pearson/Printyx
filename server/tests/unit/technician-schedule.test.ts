/**
 * A technician's schedule, over tables that exist (WF-V-07).
 *
 * `/technician-management/:id/schedule` read `work_orders` - no Drizzle schema,
 * no migration, and not in this repo's database export either - and discarded
 * the error into `schedule || []`, so every technician's week was a permanent
 * empty list at 200. An empty week and a broken query rendered identically.
 *
 * The merge is exercised as a FUNCTION against real inputs; the query shapes are
 * necessarily source assertions, because nothing typechecks or executes the edge
 * tree here, and those are bound to the branch and read from a comment-stripped
 * copy - all three files still NAME work_orders in prose explaining the fix.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTechnicianSchedule,
  DELIVERY_CAVEAT,
  type ScheduleSource,
} from '../../../supabase/functions/_shared/technician-schedule';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const TM = stripComments(read('supabase/functions/technician-management/index.ts'));
const SC = stripComments(read('supabase/functions/service-contracts/index.ts'));

/** The schedule branch alone, stopping at the next one. */
const scheduleBranch = (() => {
  const head = "if (req.method === 'GET' && techId && subResource === 'schedule') {";
  const at = TM.indexOf(head);
  expect(at, 'schedule branch not found').toBeGreaterThan(-1);
  const rest = TM.slice(at + head.length);
  const next = rest.indexOf('if (req.method');
  return next === -1 ? rest : rest.slice(0, next);
})();

describe('the merge answers what it can and says what it cannot', () => {
  const src = (over: Partial<ScheduleSource> = {}): ScheduleSource[] => [
    {
      kind: 'installation',
      rows: [{ id: 'i1', scheduled_date: '2026-03-02T00:00:00Z', status: 'scheduled' }],
    },
    { kind: 'delivery', rows: [{ id: 'd1', scheduled_date: '2026-03-01T00:00:00Z' }] },
    {
      kind: 'service',
      rows: [{ id: 's1', scheduled_date: '2026-03-03T00:00:00Z', title: 'Paper jam' }],
    },
    ...(over.kind ? [over as ScheduleSource] : []),
  ];

  it('merges the three families into one list, earliest first', () => {
    const { items } = buildTechnicianSchedule(src());
    expect(items.map((i) => i.id)).toEqual(['d1', 'i1', 's1']);
    expect(items.map((i) => i.kind)).toEqual(['delivery', 'installation', 'service']);
  });

  it('a family whose read FAILED is degraded, not empty', () => {
    // A count over a failed read is a measurement saying the week is empty.
    const { items, degraded } = buildTechnicianSchedule([
      { kind: 'installation', rows: null },
      { kind: 'service', rows: [{ id: 's1', scheduled_date: '2026-03-03T00:00:00Z' }] },
    ]);
    expect(degraded).toEqual(['installation']);
    expect(items.map((i) => i.id)).toEqual(['s1']);
  });

  it('a family that returned nothing is NOT degraded', () => {
    const { degraded } = buildTechnicianSchedule([{ kind: 'installation', rows: [] }]);
    expect(degraded).toEqual([]);
  });

  it('an undated row sorts last, not first', () => {
    // A row nobody has placed is not the earliest thing in the day.
    const { items } = buildTechnicianSchedule([
      {
        kind: 'service',
        rows: [{ id: 'unplaced' }, { id: 'placed', scheduled_date: '2026-03-04' }],
      },
    ]);
    expect(items.map((i) => i.id)).toEqual(['placed', 'unplaced']);
  });

  it('sorting is total, so two rows on the same date do not swap between calls', () => {
    const rows = [
      { id: 'b', scheduled_date: '2026-03-02' },
      { id: 'a', scheduled_date: '2026-03-02' },
    ];
    expect(buildTechnicianSchedule([{ kind: 'service', rows }]).items.map((i) => i.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('names the delivery caveat whenever deliveries were asked for', () => {
    // delivery_schedules has no technician column at all - it has driver_id.
    expect(buildTechnicianSchedule(src()).unbacked).toEqual([DELIVERY_CAVEAT]);
    expect(DELIVERY_CAVEAT).toMatch(/driver_id/);
    expect(buildTechnicianSchedule([{ kind: 'service', rows: [] }]).unbacked).toEqual([]);
  });

  it("takes each kind's own notes column rather than inventing one", () => {
    // Looked up by id rather than destructured in source order: these rows are
    // undated, so the list is ordered by the tiebreak and positional unpacking
    // would be asserting the sort by accident.
    const { items } = buildTechnicianSchedule([
      // The installation row carries a title it must NOT keep: only
      // service_tickets has that column, and without this key the mutant
      // taking title from every kind is indistinguishable from the fix.
      {
        kind: 'installation',
        rows: [{ id: 'i', installation_notes: 'third floor', title: 'not a real column' }],
      },
      { kind: 'delivery', rows: [{ id: 'd', special_instructions: 'loading bay' }] },
      { kind: 'service', rows: [{ id: 's', description: 'jammed', title: 'Paper jam' }] },
    ]);
    const byId = (id: string) => items.find((i) => i.id === id)!;
    const install = byId('i');
    const delivery = byId('d');
    const service = byId('s');
    expect(install.notes).toBe('third floor');
    expect(delivery.notes).toBe('loading bay');
    expect(service.notes).toBe('jammed');
    // Only service_tickets carries a title; the others say null rather than ''.
    expect(install.title).toBeNull();
    expect(service.title).toBe('Paper jam');
  });

  it('coerces a numeric duration and refuses a junk one', () => {
    const [good, bad] = buildTechnicianSchedule([
      {
        kind: 'service',
        rows: [
          { id: 'a', estimated_duration: '90', scheduled_date: '2026-03-01' },
          { id: 'b', estimated_duration: 'soon', scheduled_date: '2026-03-02' },
        ],
      },
    ]).items;
    expect(good.estimatedDurationMinutes).toBe(90);
    expect(bad.estimatedDurationMinutes).toBeNull();
  });
});

describe('the handler queries the three real tables on the right id', () => {
  it('resolves technicians.id to user_id before querying anything', () => {
    // All three tables key the assignee on users.id. Querying them with the
    // technicians.id this route receives returns nothing, for everyone.
    expect(scheduleBranch).toContain("from('technicians')");
    expect(scheduleBranch).toContain("select('id, user_id')");
    const resolveAt = scheduleBranch.indexOf("from('technicians')");
    for (const table of ['installation_schedules', 'delivery_schedules', 'service_tickets']) {
      const at = scheduleBranch.indexOf(`from('${table}')`);
      expect(at, `${table} not queried`).toBeGreaterThan(resolveAt);
    }
  });

  it.each([
    ['installation_schedules', 'technician_id'],
    ['delivery_schedules', 'driver_id'],
    ['service_tickets', 'assigned_technician_id'],
  ])('%s is matched on %s and filtered by tenant', (table, column) => {
    // Bound to the query, not to a character count: a fixed window ran past the
    // delivery chain into the next .from(), so a mutant deleting the delivery
    // tenant filter matched the service ticket one and survived.
    const at = scheduleBranch.indexOf(`from('${table}')`);
    const after = scheduleBranch.indexOf('.from(', at + 6);
    const chain = scheduleBranch.slice(at, after === -1 ? undefined : after);
    expect(chain).toContain(`.eq('${column}', userId)`);
    // The old query had no tenant filter at all.
    expect(chain).toContain(".eq('tenant_id', tenantId)");
  });

  it('a technician with no linked user says so instead of answering an empty week', () => {
    expect(scheduleBranch).toContain('if (!technician.user_id)');
    expect(scheduleBranch).toMatch(/no linked user account/);
  });

  it('snaps the date window to day boundaries with an exclusive upper bound', () => {
    // scheduled_date is a timestamp holding a calendar date (DATE-LOCAL-002);
    // 23:59:59 is a real timestamp a row can exceed.
    expect(scheduleBranch).toContain('startOfUtcDay(new Date(startDate))');
    expect(scheduleBranch).toContain('startOfNextUtcDay(new Date(endDate))');
    expect(scheduleBranch).toContain(".lt('scheduled_date'");
    expect(scheduleBranch).not.toContain('23:59:59');
  });
});

describe('the phantom table is gone from every live reader', () => {
  it('no edge function queries work_orders any more', () => {
    // Comments are stripped: all three files still name the table in prose
    // explaining what was wrong with it.
    for (const [label, src] of [
      ['technician-management', TM],
      ['service-contracts', SC],
    ] as const) {
      expect(src, label).not.toContain("from('work_orders')");
    }
  });

  it('the work-orders edge function is deleted, baselines and all', () => {
    expect(() => read('supabase/functions/work-orders/index.ts')).toThrow();
    for (const baseline of [
      'docs/unreferenced-edge-fns-baseline.json',
      'docs/edge-rbac-baseline.json',
      'docs/phantom-tables-baseline.json',
      'docs/calendar-date-bounds-baseline.json',
    ]) {
      expect(read(baseline), baseline).not.toContain('functions/work-orders/');
    }
    const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
    expect(triage.triage.find((e: { fn: string }) => e.fn === 'work-orders')).toBeUndefined();
    // The file asserts its own summary, so removing an entry must recount.
    const counts: Record<string, number> = {};
    for (const e of triage.triage as { verdict: string }[]) {
      counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
    }
    expect(triage.counts).toEqual(counts);
  });

  it('service history comes from service_tickets, and a failed read is null', () => {
    // An empty history reads as "this equipment has been trouble-free", which
    // is a different claim from "we could not look".
    expect(SC).toContain("from('service_tickets')");
    expect(SC).toContain('serviceHistory: services,');
    expect(SC).not.toContain('serviceHistory: services || []');
    // PostgREST rejects an .in() with no values.
    expect(SC).toContain('equipmentIds.length > 0');
  });
});
