// COP-I06: the four rules that stop a forecast from lying.
//
// Each of these is invisible to tsc and none of them fails loudly: a forecast
// that folds uncategorized deals into pipeline, adds one-time to recurring,
// weights a commit twice, or reports 100% accuracy with nothing captured all
// render perfectly and are all wrong.
import { describe, it, expect } from 'vitest';

import {
  FORECAST_CATEGORIES,
  UNCATEGORIZED,
  parseForecastCategory,
  summarizeAccuracy,
  summarizeForecast,
  type ForecastDealRow,
} from '../../../supabase/functions/_shared/forecast-category';

/** Everything forecasts at 50% unless a test says otherwise. */
const flat = () => 50;

const deal = (over: Partial<ForecastDealRow> = {}): ForecastDealRow => ({
  id: 'd',
  owner_id: 'rep-1',
  status: 'open',
  amount: '10000',
  estimated_monthly_value: null,
  forecast_category: 'commit',
  probability: 50,
  stage_id: 's1',
  ...over,
});

describe('parseForecastCategory', () => {
  it('accepts the four categories, whatever the casing', () => {
    for (const c of FORECAST_CATEGORIES) {
      expect(parseForecastCategory(c)).toBe(c);
      expect(parseForecastCategory(c.toUpperCase())).toBe(c);
      expect(parseForecastCategory(` ${c} `)).toBe(c);
    }
  });

  it('returns null for anything else rather than guessing', () => {
    expect(parseForecastCategory('probable')).toBeNull();
    expect(parseForecastCategory('')).toBeNull();
    expect(parseForecastCategory(null)).toBeNull();
    expect(parseForecastCategory(42)).toBeNull();
  });
});

describe('summarizeForecast — an uncategorized deal is not a pipeline deal', () => {
  it('buckets a deal with no category separately, never as pipeline', () => {
    const out = summarizeForecast(
      [deal({ forecast_category: null }), deal({ forecast_category: 'pipeline' })],
      flat,
    );
    const uncategorized = out.buckets.find((b) => b.category === UNCATEGORIZED);
    const pipeline = out.buckets.find((b) => b.category === 'pipeline');
    expect(uncategorized?.count).toBe(1);
    expect(pipeline?.count).toBe(1);
    expect(out.totals.uncategorizedCount).toBe(1);
  });

  it('buckets an UNRECOGNIZED category as uncategorized rather than inventing one', () => {
    const out = summarizeForecast([deal({ forecast_category: 'probably' })], flat);
    expect(out.buckets.map((b) => b.category)).toEqual([UNCATEGORIZED]);
  });

  it('says so plainly when nothing has been categorized at all', () => {
    const out = summarizeForecast([deal({ forecast_category: null })], flat);
    expect(out.unbacked.join(' ')).toContain('No deal carries a forecast category');
  });

  it('stops saying so once one deal is categorized', () => {
    const out = summarizeForecast(
      [deal({ forecast_category: null }), deal({ forecast_category: 'commit' })],
      flat,
    );
    expect(out.unbacked.join(' ')).not.toContain('No deal carries a forecast category');
  });
});

describe('summarizeForecast — one-time and recurring are different money', () => {
  it('keeps them in separate fields and never sums them', () => {
    const out = summarizeForecast(
      [deal({ amount: '50000', estimated_monthly_value: '1200' })],
      flat,
    );
    const commit = out.buckets.find((b) => b.category === 'commit')!;
    expect(commit.oneTimeValue).toBe(50000);
    expect(commit.recurringMonthlyValue).toBe(1200);
    // The blended figure that would be wrong.
    expect(commit.oneTimeValue).not.toBe(51200);
  });

  it('annualizes recurring separately, at twelve months', () => {
    const out = summarizeForecast([deal({ estimated_monthly_value: '1000' })], flat);
    const commit = out.buckets.find((b) => b.category === 'commit')!;
    expect(commit.recurringAnnualValue).toBe(12000);
    expect(out.totals.recurringAnnualValue).toBe(12000);
  });

  it('reports the recurring half as empty rather than estimating it', () => {
    const out = summarizeForecast([deal({ estimated_monthly_value: null })], flat);
    expect(out.totals.recurringMonthlyValue).toBe(0);
    expect(out.unbacked.join(' ')).toContain('recurring half of the forecast is empty');
  });

  it('counts a deal with no amount rather than dropping it silently', () => {
    const out = summarizeForecast([deal({ amount: null }), deal({ amount: '5000' })], flat);
    const commit = out.buckets.find((b) => b.category === 'commit')!;
    expect(commit.count).toBe(2);
    expect(commit.oneTimeValue).toBe(5000);
    expect(commit.dealsWithoutAmount).toBe(1);
    expect(out.unbacked.join(' ')).toContain('carry no amount');
  });

  it('treats an unparseable amount as absent, not as zero-by-coercion', () => {
    const out = summarizeForecast([deal({ amount: 'TBD' })], flat);
    expect(out.buckets[0].dealsWithoutAmount).toBe(1);
    expect(out.buckets[0].oneTimeValue).toBe(0);
  });
});

describe('summarizeForecast — weighting sits alongside, not instead', () => {
  it('reports both the category total and the weighted total', () => {
    const out = summarizeForecast([deal({ amount: '100000' })], () => 40);
    const commit = out.buckets.find((b) => b.category === 'commit')!;
    expect(commit.oneTimeValue).toBe(100000);
    expect(commit.weightedOneTimeValue).toBe(40000);
  });

  it('applies the injected probability per deal, not one rate for all', () => {
    const out = summarizeForecast(
      [deal({ id: 'a', amount: '10000' }), deal({ id: 'b', amount: '10000' })],
      (d) => (d.id === 'a' ? 100 : 0),
    );
    expect(out.totals.weightedOneTimeValue).toBe(10000);
  });
});

describe('summarizeForecast — roll-up by rep', () => {
  it('splits commit and best case per owner', () => {
    const out = summarizeForecast(
      [
        deal({ owner_id: 'r1', amount: '10000', forecast_category: 'commit' }),
        deal({ owner_id: 'r1', amount: '4000', forecast_category: 'best_case' }),
        deal({ owner_id: 'r2', amount: '9000', forecast_category: 'commit' }),
      ],
      flat,
    );
    const r1 = out.byOwner.find((o) => o.ownerId === 'r1')!;
    expect(r1.commitOneTimeValue).toBe(10000);
    expect(r1.bestCaseOneTimeValue).toBe(4000);
    expect(out.byOwner.map((o) => o.ownerId)).toEqual(['r1', 'r2']);
  });

  it('keeps an unassigned deal as its own row rather than dropping it', () => {
    const out = summarizeForecast([deal({ owner_id: null })], flat);
    expect(out.byOwner).toHaveLength(1);
    expect(out.byOwner[0].ownerId).toBeNull();
  });

  it('surfaces each rep’s uncategorized count, which is the manager’s worklist', () => {
    const out = summarizeForecast(
      [deal({ owner_id: 'r1', forecast_category: null }), deal({ owner_id: 'r1' })],
      flat,
    );
    expect(out.byOwner[0].uncategorizedCount).toBe(1);
  });
});

describe('summarizeForecast — ordering and empties', () => {
  it('puts commit first, because it is the number that gets quoted', () => {
    const out = summarizeForecast(
      [
        deal({ forecast_category: 'pipeline' }),
        deal({ forecast_category: null }),
        deal({ forecast_category: 'commit' }),
        deal({ forecast_category: 'best_case' }),
      ],
      flat,
    );
    expect(out.buckets.map((b) => b.category)).toEqual([
      'commit',
      'best_case',
      'pipeline',
      UNCATEGORIZED,
    ]);
  });

  it('returns nothing and claims nothing for an empty deal set', () => {
    const out = summarizeForecast([], flat);
    expect(out.buckets).toEqual([]);
    expect(out.totals.count).toBe(0);
    expect(out.unbacked).toEqual([]);
  });
});

describe('summarizeAccuracy — measured, not asserted', () => {
  const snapshot = (over: Record<string, unknown> = {}) => ({
    period_start: '2026-08-01T00:00:00.000Z',
    period_end: '2026-08-31T00:00:00.000Z',
    owner_id: null,
    commit_one_time_value: '100000',
    best_case_one_time_value: '150000',
    captured_at: '2026-08-02T00:00:00.000Z',
    ...over,
  });

  it('compares the commit against what actually closed', () => {
    const actuals = new Map([['2026-08-01T00:00:00.000Z|', 120000]]);
    const [row] = summarizeAccuracy([snapshot()], actuals);
    expect(row.committed).toBe(100000);
    expect(row.actual).toBe(120000);
    expect(row.variance).toBe(20000);
    expect(row.attainment).toBeCloseTo(1.2);
  });

  it('ATTAINMENT IS NULL against a zero commit, not zero and not infinity', () => {
    // A period nobody committed anything for has no attainment. Printing 0%
    // reads as a total miss by somebody who was never asked for a number.
    const [row] = summarizeAccuracy([snapshot({ commit_one_time_value: '0' })], new Map());
    expect(row.committed).toBe(0);
    expect(row.attainment).toBeNull();
  });

  it('does not let a tenant-wide snapshot read a rep’s actuals', () => {
    const actuals = new Map([['2026-08-01T00:00:00.000Z|rep-1', 90000]]);
    const [tenantWide] = summarizeAccuracy([snapshot()], actuals);
    // The tenant-wide key is `...|`, which this map does not have.
    expect(tenantWide.actual).toBe(0);

    const [perRep] = summarizeAccuracy([snapshot({ owner_id: 'rep-1' })], actuals);
    expect(perRep.actual).toBe(90000);
  });

  it('reads a missing actual as zero closed, which is a real answer', () => {
    const [row] = summarizeAccuracy([snapshot()], new Map());
    expect(row.actual).toBe(0);
    expect(row.variance).toBe(-100000);
    expect(row.attainment).toBe(0);
  });

  it('keeps every capture for a period, since a revised commit is the signal', () => {
    const rows = summarizeAccuracy(
      [
        snapshot({ captured_at: '2026-08-02T00:00:00.000Z' }),
        snapshot({ captured_at: '2026-08-25T00:00:00.000Z', commit_one_time_value: '60000' }),
      ],
      new Map(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.committed)).toEqual([100000, 60000]);
  });

  it('drops a snapshot with no period rather than dating it to the epoch', () => {
    expect(summarizeAccuracy([snapshot({ period_start: null })], new Map())).toEqual([]);
  });

  it('orders newest period first', () => {
    const rows = summarizeAccuracy(
      [
        snapshot({ period_start: '2026-06-01T00:00:00.000Z' }),
        snapshot({ period_start: '2026-09-01T00:00:00.000Z' }),
      ],
      new Map(),
    );
    expect(rows[0].periodStart).toBe('2026-09-01T00:00:00.000Z');
  });

  it('has nothing to say with no snapshots at all', () => {
    expect(summarizeAccuracy([], new Map())).toEqual([]);
  });
});
