/**
 * REPORTS-CHARTS-002: the /reports dashboard charts, and the month-overflow
 * hole the work uncovered on the way.
 *
 * AUDIT-020 deleted the three charts this panel used to draw because
 * `generateMockChartData` was Math.random() with a hardcoded 40000 target laid
 * over it, on a routed page. The decision here is BUILD for the three
 * categories with a table behind them and REFUSE, by name, for the five that
 * have none - because a trend line over a category with no source is the same
 * fabrication drawn from the server instead of the client.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '@shared/drizzle-schema';
import {
  buildChartSeries,
  CHARTED_CATEGORIES,
  isChartedCategory,
  monthKey,
  monthKeysBetween,
  percentageChange,
  UNCHARTED_REASON,
  UNSPECIFIED,
} from '@shared/report-chart-series';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const utc = (iso: string) => new Date(iso);

describe('month keys', () => {
  it('reads a date or an ISO string, in UTC', () => {
    expect(monthKey('2026-03-31T23:30:00Z')).toBe('2026-03');
    expect(monthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });

  it('is null for anything unreadable, rather than guessing a bucket', () => {
    expect(monthKey(null)).toBeNull();
    expect(monthKey(undefined)).toBeNull();
    expect(monthKey('not a date')).toBeNull();
    expect(monthKey(1234)).toBeNull();
  });

  it('steps month by month without skipping one', () => {
    // Anchored to the first of the month: a cursor carrying day 31 would jump
    // from 31 January to 3 March and February would be missing from the series,
    // which reads as a month that did not happen.
    expect(monthKeysBetween(utc('2026-01-31T00:00:00Z'), utc('2026-04-15T00:00:00Z'))).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('crosses a year boundary and handles a single-month window', () => {
    expect(monthKeysBetween(utc('2025-11-05T00:00:00Z'), utc('2026-02-01T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(monthKeysBetween(utc('2026-06-01T00:00:00Z'), utc('2026-06-30T00:00:00Z'))).toEqual([
      '2026-06',
    ]);
  });

  it('returns nothing for an unreadable range rather than looping', () => {
    expect(monthKeysBetween(new Date('x'), utc('2026-01-01T00:00:00Z'))).toEqual([]);
  });
});

describe('percentageChange', () => {
  it('is null when the previous value is zero', () => {
    // "Up 100% from nothing" is a statement about division, not the business.
    expect(percentageChange(5, 0)).toBeNull();
    expect(percentageChange(0, 0)).toBeNull();
  });

  it('computes a signed percentage against the previous magnitude', () => {
    expect(percentageChange(150, 100)).toBe(50);
    expect(percentageChange(75, 100)).toBe(-25);
    expect(percentageChange(100, 100)).toBe(0);
  });

  it('is null for values that are not finite', () => {
    expect(percentageChange(NaN, 100)).toBeNull();
    expect(percentageChange(100, NaN)).toBeNull();
  });
});

describe('buildChartSeries', () => {
  const window = { start: utc('2026-01-10T00:00:00Z'), end: utc('2026-03-20T00:00:00Z') };

  it('emits a ZERO bucket for a month inside the window with no rows', () => {
    // The rows were looked for. A gap in a chart reads as a month that did not
    // happen; a zero reads as a month with nothing in it, which is the truth.
    const s = buildChartSeries({
      current: [{ at: '2026-01-15T00:00:00Z', amount: 100, key: 'open' }],
      previous: [],
      ...window,
    });
    expect(s.trend.map((p) => p.period)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(s.trend[1]).toEqual({ period: '2026-02', count: 0, value: 0 });
  });

  it('sums money and counts rows per month', () => {
    const s = buildChartSeries({
      current: [
        { at: '2026-01-15T00:00:00Z', amount: 100.5, key: 'won' },
        { at: '2026-01-20T00:00:00Z', amount: '49.5', key: 'won' },
        { at: '2026-03-01T00:00:00Z', amount: 10, key: 'lost' },
      ],
      previous: [],
      ...window,
    });
    expect(s.trend[0]).toEqual({ period: '2026-01', count: 2, value: 150 });
    expect(s.trend[2]).toEqual({ period: '2026-03', count: 1, value: 10 });
  });

  it('counts a row outside the emitted range rather than discarding it', () => {
    // The window belongs to the query; a boundary row is real data and the
    // alternative is a total that does not match the rows behind it.
    const s = buildChartSeries({
      current: [{ at: '2025-12-31T23:00:00Z', amount: 5, key: 'open' }],
      previous: [],
      ...window,
    });
    expect(s.trend.find((p) => p.period === '2025-12')).toEqual({
      period: '2025-12',
      count: 1,
      value: 5,
    });
    expect(s.comparison.current.count).toBe(1);
  });

  it('counts undated rows and names them rather than dropping them', () => {
    const s = buildChartSeries({
      current: [
        { at: null, amount: 10, key: 'open' },
        { at: 'nonsense', amount: 10, key: 'open' },
      ],
      previous: [],
      ...window,
    });
    expect(s.undated).toBe(2);
    expect(s.unbacked.join(' ')).toMatch(/2 row\(s\) had no readable date/);
    // Still in the distribution and the totals: they are real rows.
    expect(s.comparison.current.count).toBe(2);
  });

  it('keeps an explicit unspecified bucket in the distribution', () => {
    // Omitting rows with no category is how a grouped view stops adding up to
    // the total printed beside it (COP-B10).
    const s = buildChartSeries({
      current: [
        { at: '2026-01-15T00:00:00Z', amount: 1, key: 'open' },
        { at: '2026-01-16T00:00:00Z', amount: 1, key: null },
        { at: '2026-01-17T00:00:00Z', amount: 1, key: '   ' },
      ],
      previous: [],
      ...window,
    });
    const unspecified = s.distribution.find((d) => d.key === UNSPECIFIED);
    expect(unspecified?.count).toBe(2);
    expect(s.distribution.reduce((n, d) => n + d.count, 0)).toBe(3);
  });

  it('orders the distribution by size then key, so two equal slices are stable', () => {
    const s = buildChartSeries({
      current: [
        { at: '2026-01-15T00:00:00Z', key: 'zebra' },
        { at: '2026-01-15T00:00:00Z', key: 'alpha' },
        { at: '2026-01-15T00:00:00Z', key: 'big' },
        { at: '2026-01-15T00:00:00Z', key: 'big' },
      ],
      previous: [],
      ...window,
    });
    expect(s.distribution.map((d) => d.key)).toEqual(['big', 'alpha', 'zebra']);
  });

  it('declares a money total a FLOOR when any row carries no amount', () => {
    const s = buildChartSeries({
      current: [
        { at: '2026-01-15T00:00:00Z', amount: 100, key: 'open' },
        { at: '2026-01-16T00:00:00Z', amount: null, key: 'open' },
      ],
      previous: [],
      ...window,
    });
    expect(s.comparison.current.valueIsFloor).toBe(true);
    expect(s.comparison.current.value).toBe(100);
    expect(s.unbacked.join(' ')).toMatch(/floor rather than a sum/);
  });

  it('is not a floor when every row carries an amount', () => {
    const s = buildChartSeries({
      current: [{ at: '2026-01-15T00:00:00Z', amount: 100, key: 'open' }],
      previous: [{ at: '2025-12-15T00:00:00Z', amount: 50, key: 'open' }],
      ...window,
    });
    expect(s.comparison.current.valueIsFloor).toBe(false);
    expect(s.unbacked.join(' ')).not.toMatch(/floor rather than a sum/);
  });

  it('compares against the previous window, and answers null with nothing to compare to', () => {
    const empty = buildChartSeries({
      current: [{ at: '2026-01-15T00:00:00Z', amount: 100, key: 'open' }],
      previous: [],
      ...window,
    });
    expect(empty.comparison.countChangePercent).toBeNull();
    expect(empty.comparison.valueChangePercent).toBeNull();

    const both = buildChartSeries({
      current: [
        { at: '2026-01-15T00:00:00Z', amount: 100, key: 'open' },
        { at: '2026-01-16T00:00:00Z', amount: 100, key: 'open' },
      ],
      previous: [{ at: '2025-12-15T00:00:00Z', amount: 100, key: 'open' }],
      ...window,
    });
    expect(both.comparison.countChangePercent).toBe(100);
    expect(both.comparison.valueChangePercent).toBe(100);
  });

  it('always says there is no target to draw', () => {
    // AC3. sales_goals holds an ACTIVITY count (calls, emails, meetings), not a
    // currency goal, so the 40000 line the mock drew has no real counterpart.
    const s = buildChartSeries({ current: [], previous: [], ...window });
    expect(s.unbacked[0]).toMatch(/No per-tenant revenue target exists/);
  });
});

describe('which categories are charted', () => {
  it('exactly the three with a table behind them', () => {
    expect(Object.keys(CHARTED_CATEGORIES).sort()).toEqual(['finance', 'sales', 'service']);
    for (const c of ['sales', 'service', 'finance']) expect(isChartedCategory(c)).toBe(true);
    for (const c of ['operations', 'hr', 'it', 'compliance', 'executive', '', 'nonsense']) {
      expect({ c, charted: isChartedCategory(c) }).toEqual({ c, charted: false });
    }
  });

  it('every uncharted category has its OWN reason, not one generic line', () => {
    // A reader who sees the same sentence under every category learns nothing
    // from it, and the sentence stops being read.
    const reasons = Object.values(UNCHARTED_REASON);
    expect(reasons).toHaveLength(5);
    expect(new Set(reasons).size).toBe(5);
    for (const r of reasons) expect(r.length).toBeGreaterThan(40);
  });

  it('the page category union and the reason map cover each other exactly', () => {
    const page = read('client/src/pages/EnhancedReportsHub.tsx');
    const block = page.slice(page.indexOf('  category:'), page.indexOf('organizationalScope'));
    const declared = [...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(declared.length).toBe(8);
    const covered = [...Object.keys(CHARTED_CATEGORIES), ...Object.keys(UNCHARTED_REASON)];
    expect(declared.slice().sort()).toEqual(covered.slice().sort());
  });
});

describe('the endpoint reads real columns', () => {
  const HANDLER = stripComments(read('supabase/functions/reports/handlers/reporting.ts'));

  const columnsOf = (table: string) => {
    for (const t of Object.values(schema as Record<string, unknown>)) {
      try {
        const cfg = getTableConfig(t as never);
        if (cfg.name === table) return cfg.columns.map((c) => c.name);
      } catch {
        /* not a table */
      }
    }
    return null;
  };

  it('every column the chart spec names exists on its table', () => {
    // check:phantom-cols cannot resolve `.from(spec.table)` - the table is a
    // variable - so this is the check that matters, the same treatment COP-B04
    // prescribes for a payload built by a helper. `deals` is the trap: it has
    // `amount`, NOT `deal_value`, `value` or `closed_at`.
    const at = HANDLER.indexOf('const spec = {');
    expect(at).toBeGreaterThan(-1);
    const spec = HANDLER.slice(at, HANDLER.indexOf('}[source.table];', at));
    const entries = [
      ...spec.matchAll(
        /table: '(\w+)',\s*at: '(\w+)',\s*amount: (?:'(\w+)'|null),\s*\n?\s*key: '(\w+)'/g,
      ),
    ];
    expect(entries.length).toBe(3);
    for (const [, table, atCol, amountCol, keyCol] of entries) {
      const cols = columnsOf(table);
      expect({ table, known: cols !== null }).toEqual({ table, known: true });
      for (const col of [atCol, keyCol, ...(amountCol ? [amountCol] : [])]) {
        expect({ table, col, exists: cols!.includes(col) }).toEqual({ table, col, exists: true });
      }
      expect({ table, tenant: cols!.includes('tenant_id') }).toEqual({ table, tenant: true });
    }
  });

  it('scopes every read to the tenant and pages it', () => {
    const at = HANDLER.indexOf('const load = async');
    expect(at).toBeGreaterThan(-1);
    const body = HANDLER.slice(at, HANDLER.indexOf('let currentRows', at));
    expect(body).toMatch(/\.eq\('tenant_id', auth\.tenantId\)/);
    expect(body).toMatch(/fetchAllRows</);
  });

  it('snaps the calendar-date window only, and uses a strict upper bound', () => {
    // invoice_date is a calendar date stored at midnight (DATE-LOCAL-002 names
    // it); created_at is an instant and snapping it would move the window.
    expect(HANDLER).toMatch(/const calendarDated = category === 'finance';/);
    expect(HANDLER).toMatch(/calendarDated \? startOfUtcDay\(d\) : d/);
    expect(HANDLER).toMatch(/calendarDated \? startOfNextUtcDay\(d\) : d/);
    expect(HANDLER).toMatch(/\.lt\(spec\.at, upper\(to\)\)/);
  });

  it('answers the five uncharted categories with their reason, not an empty chart', () => {
    const at = HANDLER.indexOf('if (!isChartedCategory(category))');
    expect(at).toBeGreaterThan(-1);
    const branch = HANDLER.slice(at, HANDLER.indexOf('const period =', at));
    expect(branch).toMatch(/charted: false/);
    expect(branch).toMatch(/UNCHARTED_REASON/);
    expect(branch).not.toMatch(/trend/);
  });

  it('draws no target line', () => {
    expect(HANDLER).toMatch(/target: null,/);
    expect(HANDLER).not.toMatch(/40000/);
  });
});

describe('the panel replaced the placeholder', () => {
  const PAGE = read('client/src/pages/EnhancedReportsHub.tsx');
  const PANEL = stripComments(read('client/src/components/reports/ReportChartsPanel.tsx'));

  it('the NotConnectedState is gone and the panel is rendered', () => {
    // AC4: the placeholder does not outlive the decision.
    expect(stripComments(PAGE)).not.toMatch(/NotConnectedState/);
    expect(PAGE).toMatch(/<ReportChartsPanel category=\{dashboardState\.selectedCategory\} \/>/);
  });

  it('a failed read renders an error, never an empty chart', () => {
    // CR-033: "nothing in this period" is a claim about the tenant and must not
    // be what a failure looks like.
    expect(PANEL).toMatch(/isError \|\| !data/);
    expect(PANEL).toMatch(/InlineQueryError/);
    const emptyAt = PANEL.indexOf('Nothing in this period');
    const errorAt = PANEL.indexOf('InlineQueryError');
    expect(errorAt).toBeLessThan(emptyAt);
  });

  it("renders the server's own reason for an uncharted category", () => {
    expect(PANEL).toMatch(/\{data\.reason\}/);
  });

  it('shows an em dash rather than 0% when a change cannot be computed', () => {
    const at = PANEL.indexOf('function changeLabel');
    expect(at).toBeGreaterThan(-1);
    expect(PANEL.slice(at, at + 250)).toMatch(/return '—';/);
  });

  it('renders what the response says it cannot measure', () => {
    expect(PANEL).toMatch(/data\.unbacked\?\.length/);
  });
});

describe('both shared imports resolve from where they sit', () => {
  /**
   * A handler in `<fn>/handlers/` is FOUR levels below the repo root, not
   * three. The precedent I copied - `supabase/functions/seo/index.ts` importing
   * `../../../shared/seo-checks.ts` - sits one directory higher, so the same
   * specifier resolves to `supabase/shared/` from a handler and to nothing.
   *
   * server.ts loads each function with `await import()` inside a try/catch and
   * OMITS the ones that throw, so the whole function answers 404 "Function not
   * found" in production - silently, and invisibly in dev when the prefix is
   * served by Express. check:edge-boot is what catches it, and it is not one of
   * the guards a change to a handler obviously touches.
   */
  it('each shared import resolves to a file that exists', () => {
    const cases = [
      'supabase/functions/lead-scoring/handlers/bant.ts',
      'supabase/functions/reports/handlers/reporting.ts',
    ];
    for (const file of cases) {
      const src = read(file);
      const specs = [...src.matchAll(/from '((?:\.\.\/)+shared\/[\w.-]+\.ts)'/g)].map((m) => m[1]);
      expect({ file, found: specs.length > 0 }).toEqual({ file, found: true });
      for (const spec of specs) {
        const resolved = join(repo, file, '..', spec);
        expect({ file, spec, exists: existsSync(resolved) }).toEqual({
          file,
          spec,
          exists: true,
        });
      }
    }
  });
});

describe('the month-overflow hole this uncovered', () => {
  it('rangeForPeriod no longer uses the overflowing UTC idiom', () => {
    // On 31 March, `start.setUTCMonth(start.getUTCMonth() - 1)` asks for "31
    // February" and gets 3 MARCH, so period=month was a 28-day window entirely
    // inside the current month. Every report handler taking its range from here
    // was wrong together, on the last days of any long month.
    const dateSrc = read('supabase/functions/reports/_date.ts');
    expect(stripComments(dateSrc)).not.toMatch(/setUTCMonth\(|setUTCFullYear\(/);
    expect(dateSrc).toMatch(/subtractUtcMonths\(now, 1\)/);
    expect(dateSrc).toMatch(/subtractUtcMonths\(now, 3\)/);
    expect(dateSrc).toMatch(/subtractUtcYears\(now, 1\)/);
  });

  it('the guard bans both tenses of the idiom', () => {
    // A ban that names one spelling bans one spelling.
    const guard = read('scripts/check-month-arithmetic.mjs');
    const m = /const IDIOM =\s*([^;]+);/.exec(guard);
    expect(m).not.toBeNull();
    const idiom = new RegExp(m![1].trim().replace(/^\/|\/$/g, ''));
    expect(idiom.test('start.setUTCMonth(start.getUTCMonth() - 1)')).toBe(true);
    expect(idiom.test('start.setMonth(start.getMonth() - 1)')).toBe(true);
    expect(idiom.test('d.setUTCFullYear(d.getUTCFullYear() - 1)')).toBe(true);
    // Not a false positive on a literal argument.
    expect(idiom.test('d.setUTCMonth(0)')).toBe(false);
  });

  it('the reopened baseline says why it grew', () => {
    // A count that jumps from 0 to 15 reads as a regression otherwise.
    const note = JSON.parse(read('docs/month-arithmetic-baseline.json')).note as string;
    expect(note).toMatch(/BECAUSE THE GUARD GOT BETTER/);
    expect(note).toMatch(/29 February/);
  });
});
