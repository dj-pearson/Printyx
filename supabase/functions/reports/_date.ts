// Date range helpers shared across report handlers.
//
// Most reports accept either a `period` query string (week|month|quarter|year)
// or explicit `dateFrom`/`dateTo` ISO timestamps. This module normalizes both
// shapes to a `{ start, end, period? }` triple so handlers don't repeat the
// branching.

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
  const start = new Date(now);
  switch (period) {
    case 'week':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'month':
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case 'quarter':
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case 'year':
      start.setUTCFullYear(start.getUTCFullYear() - 1);
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
