/**
 * The three /reports dashboard aggregations (REPORTS-CHARTS-002).
 *
 * AUDIT-020 deleted what was here: "Performance Trends", "Distribution
 * Analysis" and "Period Comparison" were `generateMockChartData`, which is
 * Math.random() with a hardcoded target of 40000 drawn over it, on a routed
 * page. The values moved on every render, which is what real telemetry does, so
 * refreshing appeared to confirm them.
 *
 * WHAT IS BUILT AND WHAT IS NOT. The page's category list is sales, service,
 * finance, operations, hr, it, compliance and executive. Three of those have
 * tables a dealer actually fills - `deals`, `service_tickets`, `invoices` - and
 * five do not. This module answers the three and REFUSES the five by name,
 * because a trend line drawn over a category with no source is the fabrication
 * that was removed, redrawn from the server instead of the client.
 *
 * NO TARGET LINE. AC3 asks for a real per-tenant goal or none. `sales_goals` is
 * the only goal table and it holds `goal_type` from an ACTIVITY enum (calls,
 * emails, meetings, proposals, demos...) with `target_count` - a count of
 * activities, not a revenue figure - so there is no per-tenant currency target
 * to draw. `target` is null and says so in `unbacked`.
 *
 * FOUR RULES THIS REPO KEEPS RE-LEARNING, encoded here:
 *
 *   - A month inside the requested window with no rows is a ZERO bucket, not a
 *     gap. The rows were looked for. A gap in a chart reads as a month that did
 *     not happen (date-months.ts records the same finding).
 *   - `changePercent` is NULL when the previous period has no value. 0% asserts
 *     that nothing changed, which is a measurement; a tenant with one month of
 *     history has no trend.
 *   - A distribution keeps an EXPLICIT unspecified bucket, because omitting
 *     rows with no category is how a grouped view stops adding up to the total
 *     printed beside it (COP-B10).
 *   - A money total computed over rows where some amounts are null is a FLOOR
 *     and says so, rather than presenting a short number as the answer
 *     (COP-B05).
 */

/** The page's category vocabulary, verbatim from ReportDefinition. */
export type ReportCategory =
  | 'sales'
  | 'service'
  | 'finance'
  | 'operations'
  | 'hr'
  | 'it'
  | 'compliance'
  | 'executive';

/** The three categories with a table behind them, and what they read. */
export const CHARTED_CATEGORIES = {
  sales: { table: 'deals', unit: 'currency' },
  service: { table: 'service_tickets', unit: 'count' },
  finance: { table: 'invoices', unit: 'currency' },
} as const;

export type ChartedCategory = keyof typeof CHARTED_CATEGORIES;

export function isChartedCategory(value: unknown): value is ChartedCategory {
  return typeof value === 'string' && value in CHARTED_CATEGORIES;
}

/**
 * Why a category has no charts, in the words the panel prints.
 *
 * Named per category rather than one generic sentence: "there is no HR data in
 * this product" and "compliance is not modelled" are different facts, and a
 * reader who sees the same line under every category learns nothing from it.
 */
export const UNCHARTED_REASON: Record<Exclude<ReportCategory, ChartedCategory>, string> = {
  operations:
    'Operations reports draw on several tables with no shared measure - a trend over "operations" would have to pick one and present it as the whole.',
  hr: 'Nothing in this product records HR activity; there is no table to trend.',
  it: 'IT reports describe the deployment rather than the tenant, and the application cannot read its own infrastructure.',
  compliance:
    'Compliance is recorded as documents and consents rather than as a measure that moves over time.',
  executive:
    'The executive category is a roll-up of the others, so a chart here would restate the sales, service and finance series rather than add one.',
};

export interface SourceRow {
  /** The instant or calendar date the row is bucketed by. */
  at: string | null | undefined;
  /** The money figure, when the category has one. */
  amount?: number | string | null;
  /** The grouping key for the distribution. */
  key?: string | null;
}

export interface TrendPoint {
  period: string;
  count: number;
  value: number;
}

export interface DistributionSlice {
  key: string;
  count: number;
  value: number;
}

export interface PeriodTotals {
  count: number;
  value: number;
  /** True when at least one row in the period carried no amount. */
  valueIsFloor: boolean;
}

export interface ChartSeries {
  trend: TrendPoint[];
  distribution: DistributionSlice[];
  comparison: {
    current: PeriodTotals;
    previous: PeriodTotals;
    countChangePercent: number | null;
    valueChangePercent: number | null;
  };
  /** Rows whose `at` could not be read, counted rather than dropped in silence. */
  undated: number;
  unbacked: string[];
}

/** The bucket a row with no grouping key falls into. Shown, never omitted. */
export const UNSPECIFIED = 'unspecified';

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** `YYYY-MM` in UTC, or null when the value is not a readable date. */
export function monthKey(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Every `YYYY-MM` from `start` to `end` inclusive, in order.
 *
 * Stepped from the first of the month in UTC so it cannot skip - the overflow
 * `date-months.ts` exists to prevent, and the reason a month never goes missing
 * from the middle of a series.
 */
export function monthKeysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return out;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    // The explicit day argument is BELT AND BRACES, not load-bearing: the
    // cursor is built at day 1 and a day-1 date cannot overflow, which a mutant
    // removing it proved by surviving. It stays so that a future edit to the
    // cursor's construction cannot reintroduce the skip silently.
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }
  return out;
}

/**
 * Percentage change, or null when the base cannot support one.
 *
 * A previous value of zero has no percentage change - "up 100%" from nothing is
 * a statement about division, not about the business - and a tenant whose first
 * month this is gets null rather than a number that reads as growth.
 */
export function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function totalsFor(rows: SourceRow[]): PeriodTotals {
  let value = 0;
  let missing = 0;
  for (const row of rows) {
    const n = toNumber(row.amount);
    if (n === null) missing++;
    else value += n;
  }
  return {
    count: rows.length,
    value: Number(value.toFixed(2)),
    valueIsFloor: missing > 0,
  };
}

export interface BuildInput {
  /** Rows in the CURRENT window. */
  current: SourceRow[];
  /** Rows in the immediately preceding window of the same length. */
  previous: SourceRow[];
  /** Window bounds, used to emit a zero bucket for every month in range. */
  start: Date;
  end: Date;
}

export function buildChartSeries(input: BuildInput): ChartSeries {
  const { current, previous, start, end } = input;

  const byMonth = new Map<string, { count: number; value: number }>();
  for (const key of monthKeysBetween(start, end)) byMonth.set(key, { count: 0, value: 0 });

  let undated = 0;
  for (const row of current) {
    const key = monthKey(row.at);
    if (key === null) {
      undated++;
      continue;
    }
    // A row outside the emitted range still counts: the window is the query's
    // and a boundary row is real data, not a bucket to invent.
    const bucket = byMonth.get(key) ?? { count: 0, value: 0 };
    bucket.count++;
    bucket.value += toNumber(row.amount) ?? 0;
    byMonth.set(key, bucket);
  }

  const trend: TrendPoint[] = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, b]) => ({ period, count: b.count, value: Number(b.value.toFixed(2)) }));

  const byKey = new Map<string, { count: number; value: number }>();
  for (const row of current) {
    const key = typeof row.key === 'string' && row.key.trim() !== '' ? row.key : UNSPECIFIED;
    const bucket = byKey.get(key) ?? { count: 0, value: 0 };
    bucket.count++;
    bucket.value += toNumber(row.amount) ?? 0;
    byKey.set(key, bucket);
  }

  const distribution: DistributionSlice[] = [...byKey.entries()]
    .map(([key, b]) => ({ key, count: b.count, value: Number(b.value.toFixed(2)) }))
    // Largest first, then by key so two equal slices keep a stable order
    // across requests rather than following the database's row order.
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const currentTotals = totalsFor(current);
  const previousTotals = totalsFor(previous);

  const unbacked: string[] = [
    'No per-tenant revenue target exists: sales_goals holds activity counts (calls, emails, meetings), not a currency goal, so no target line is drawn.',
  ];
  if (currentTotals.valueIsFloor || previousTotals.valueIsFloor) {
    unbacked.push('Some rows carry no amount, so the money totals are a floor rather than a sum.');
  }
  if (undated > 0) {
    unbacked.push(`${undated} row(s) had no readable date and are absent from the trend.`);
  }

  return {
    trend,
    distribution,
    comparison: {
      current: currentTotals,
      previous: previousTotals,
      countChangePercent: percentageChange(currentTotals.count, previousTotals.count),
      valueChangePercent: percentageChange(currentTotals.value, previousTotals.value),
    },
    undated,
    unbacked,
  };
}
