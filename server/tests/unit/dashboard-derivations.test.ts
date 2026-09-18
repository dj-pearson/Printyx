/**
 * The dashboard derivations, driven against a stub PostgREST client
 * (DASH-METRICS-001).
 *
 * The sibling test asserts that no literal survived. This one asserts the
 * arithmetic, because "not fabricated" and "correct" are different claims and
 * the second is the one a rep acts on. What it pins:
 *
 *   - a month-over-month change computed from real invoice dates, and null -
 *     never 0% - when the prior month has nothing to compare against;
 *   - the low-stock comparison, which PostgREST cannot express and which
 *     therefore has to be right HERE or not at all;
 *   - an empty month appearing in the revenue trend as a zero, because a gap in
 *     a line reads as missing data while a zero is a measurement;
 *   - the leaderboard ranking on revenue that closed, with attainment null.
 */
import { describe, expect, it } from 'vitest';
import { dashboardMetric } from '../../../supabase/functions/dashboard/handlers/metrics.ts';
import { dashboardChart } from '../../../supabase/functions/dashboard/handlers/charts.ts';
import { dashboardTeamPerformance } from '../../../supabase/functions/dashboard/handlers/lists.ts';
import { percentageChange } from '../../../supabase/functions/dashboard/handlers/_context.ts';

type Row = Record<string, unknown>;

/**
 * Enough of the builder for these handlers: every filter returns `this`, and
 * awaiting resolves to { data, count }. The rows are not filtered - each test
 * hands over exactly what its query would have selected - so an assertion here
 * is about the arithmetic, not about the query.
 */
function stub(rows: Row[], count = rows.length) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: { data: Row[]; count: number; error: null }) => unknown) =>
      resolve({ data: rows, count, error: null }),
  };
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'not',
    'gte',
    'lte',
    'lt',
    'gt',
    'order',
    'limit',
  ]) {
    builder[method] = () => builder;
  }
  return { from: () => builder };
}

const iso = (y: number, m: number, d = 15) => new Date(Date.UTC(y, m, d)).toISOString();

describe('revenue', () => {
  const now = new Date();
  const thisMonth = (d = 15) => iso(now.getUTCFullYear(), now.getUTCMonth(), d);
  const lastMonth = (d = 15) => iso(now.getUTCFullYear(), now.getUTCMonth() - 1, d);

  it('sums the current month and compares it against the previous one', async () => {
    const result = await dashboardMetric(
      stub([
        { total_amount: '1000.25', invoice_date: thisMonth(2) },
        { total_amount: '500.25', invoice_date: thisMonth(9) },
        { total_amount: '1200.00', invoice_date: lastMonth() },
      ]),
      't1',
      'revenue',
    );
    expect(result?.value).toBe(1500.5);
    expect(result?.change).toBe(25);
  });

  it('answers null, not 0%, when the previous month has nothing', async () => {
    // A tenant whose first invoice went out this month has no trend, and 0%
    // asserts that nothing changed.
    const result = await dashboardMetric(
      stub([{ total_amount: '900', invoice_date: thisMonth() }]),
      't1',
      'revenue',
    );
    expect(result?.value).toBe(900);
    expect(result?.change).toBeNull();
  });

  it('percentageChange is null for a zero or absent baseline', () => {
    expect(percentageChange(100, 0)).toBeNull();
    expect(percentageChange(100, Number.NaN)).toBeNull();
    expect(percentageChange(50, 100)).toBe(-50);
  });
});

describe('inventory alerts', () => {
  it('counts only the items at or below their reorder point', async () => {
    const result = await dashboardMetric(
      stub([
        { id: 'a', quantity_on_hand: 2, reorder_point: 5 },
        { id: 'b', quantity_on_hand: 5, reorder_point: 5 },
        { id: 'c', quantity_on_hand: 9, reorder_point: 5 },
      ]),
      't1',
      'inventory-alerts',
    );
    expect(result?.value).toBe(2);
  });

  it('ignores an item whose reorder point is not a number', async () => {
    const result = await dashboardMetric(
      stub([{ id: 'a', quantity_on_hand: 0, reorder_point: null }]),
      't1',
      'inventory-alerts',
    );
    expect(result?.value).toBe(0);
  });

  it('names `change` unbacked rather than returning one', async () => {
    const result = await dashboardMetric(stub([]), 't1', 'inventory-alerts');
    expect(result?.change).toBeNull();
    expect(result?.unbacked).toEqual(['change']);
    expect(String(result?.reason)).toContain('nothing versions it');
  });
});

describe('an unknown type is a 404, not an empty card', () => {
  it('returns null so the caller can answer 404', async () => {
    expect(await dashboardMetric(stub([]), 't1', 'made-up')).toBeNull();
    expect(await dashboardChart(stub([]), 't1', 'made-up')).toBeNull();
  });
});

describe('charts', () => {
  it('the revenue trend carries every month in the window, empty ones as zero', async () => {
    const result = await dashboardChart(stub([]), 't1', 'revenue-trend');
    expect(result?.data).toHaveLength(6);
    expect(result?.data.every((p) => p.value === 0)).toBe(true);
    // Oldest first, so a line reads left to right.
    const names = result!.data.map((p) => String(p.name));
    expect([...names].sort()).toEqual(names);
  });

  it('buckets an invoice into the month its date names', async () => {
    const now = new Date();
    const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 7);
    const result = await dashboardChart(
      stub([
        { total_amount: '100', invoice_date: `${key}-03` },
        { total_amount: '250', invoice_date: `${key}-27` },
      ]),
      't1',
      'revenue-trend',
    );
    expect(result?.data.find((p) => p.name === key)?.value).toBe(350);
  });

  it('groups the pipeline by stage and sums the amounts', async () => {
    const result = await dashboardChart(
      stub([
        { stage_name: 'Qualify', amount: '100' },
        { stage_name: 'Qualify', amount: '50' },
        { stage_name: 'Propose', amount: '400' },
        { stage_name: null, amount: '10' },
      ]),
      't1',
      'pipeline',
    );
    expect(result?.data).toContainEqual({ name: 'Qualify', value: 150, count: 2 });
    // A null stage is named rather than dropped: those rows are real deals.
    expect(result?.data).toContainEqual({ name: 'Unstaged', value: 10, count: 1 });
  });

  it('labels an unset industry rather than discarding the customer', async () => {
    const result = await dashboardChart(
      stub([{ industry: null }, { industry: 'Legal' }, { industry: 'Legal' }]),
      't1',
      'customer-distribution',
    );
    expect(result?.data[0]).toEqual({ name: 'Legal', value: 2 });
    expect(result?.data).toContainEqual({ name: 'Unspecified', value: 1 });
  });
});

describe('team performance', () => {
  it('ranks on revenue that closed and leaves attainment unbacked', async () => {
    const result = await dashboardTeamPerformance(
      stub([
        { owner_id: 'u1', owner_name: 'A', amount: '100', is_won: true },
        { owner_id: 'u2', owner_name: 'B', amount: '900', is_won: true },
        { owner_id: 'u1', owner_name: 'A', amount: '50', is_won: true },
      ]),
      't1',
    );
    expect(result.items.map((i) => i.ownerId)).toEqual(['u2', 'u1']);
    expect(result.items[1]).toMatchObject({ wonCount: 2, wonRevenue: 150, quotaAttainment: null });
    expect(result.unbacked).toEqual(['quotaAttainment']);
  });

  it('drops a row with no owner rather than inventing one', async () => {
    const result = await dashboardTeamPerformance(
      stub([{ owner_id: null, owner_name: null, amount: '100', is_won: true }]),
      't1',
    );
    expect(result.items).toEqual([]);
  });
});
