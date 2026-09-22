// Date range helpers shared across report handlers.
//
// Most reports accept either a `period` query string (week|month|quarter|year)
// or explicit `dateFrom`/`dateTo` ISO timestamps. This module normalizes both
// shapes to a `{ start, end, period? }` triple so handlers don't repeat the
// branching.

import { subtractUtcMonths, subtractUtcYears } from '../_shared/date-months.ts';

export type Period = 'week' | 'month' | 'quarter' | 'year';

const PERIODS: ReadonlySet<string> = new Set(['week', 'month', 'quarter', 'year']);

export interface DateRange {
  start: Date;
  end: Date;
  period: Period | null;
}

export function parsePeriod(value: string | null | undefined): Period {
  if (value && PERIODS.has(value)) return value as Period;
  return 'month';
}

export function rangeForPeriod(period: Period, now: Date = new Date()): DateRange {
  const end = new Date(now);
  // REPORTS-CHARTS-002. These three cases used setUTCMonth/setUTCFullYear with
  // the overflowing getUTC* idiom, which is the SAME defect DATE-SETMONTH-001
  // closed for setMonth - `check:month-arithmetic` simply did not know about
  // the UTC twin, so the ban had a hole the width of every UTC caller.
  //
  // On 31 March, `period=month` asked for "31 February" and got 3 MARCH, so the
  // window was a 28-day span entirely inside the current month with February
  // excluded. Every handler taking its range from here was wrong together, on
  // the last three days of any long month. `period=year` had the leap-day
  // version: 29 February minus a year resolved to 1 March.
  let start: Date;
  switch (period) {
    case 'week':
      start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'month':
      start = subtractUtcMonths(now, 1);
      break;
    case 'quarter':
      start = subtractUtcMonths(now, 3);
      break;
    case 'year':
      start = subtractUtcYears(now, 1);
      break;
  }
  return { start, end, period };
}

export function rangeFromQuery(url: URL): DateRange {
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  if (dateFrom && dateTo) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      return { start, end, period: null };
    }
  }
  return rangeForPeriod(parsePeriod(url.searchParams.get('period')));
}

export function previousRange(range: DateRange): DateRange {
  const span = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - span),
    end: new Date(range.start.getTime()),
    period: range.period,
  };
}

export function trend(
  current: number,
  previous: number,
  threshold: number,
): 'up' | 'down' | 'stable' {
  if (current > previous + threshold) return 'up';
  if (current < previous - threshold) return 'down';
  return 'stable';
}
