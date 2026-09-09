/**
 * Calendar arithmetic for the financial reporting window.
 *
 * Pure and Deno-import-free on purpose, so vitest can exercise it directly -
 * index.ts pulls https: specifiers and cannot be imported from a Node test. Same
 * reasoning as _shared/erp-integration-dashboard.ts.
 *
 * WHAT THIS EXISTS TO FIX. Date.setMonth OVERFLOWS rather than clamping, and
 * index.ts leaned on it in two places. Both defects were date-dependent - correct
 * on about twenty-seven days of each month, wrong on the rest - which is why they
 * survived.
 *
 *   1. The range: `startDate.setMonth(now.getMonth() - 1)` on 31 March asks for
 *      "31 February", which resolves to 3 March. `period=month` therefore returned
 *      3 March to 31 March: a 28-day window entirely inside the CURRENT month,
 *      with February excluded completely. Every endpoint in the function takes its
 *      range from that one calculation - metrics, cash-flow, profitability, kpis
 *      and mrr-analysis all reported on the wrong window together.
 *
 *   2. The MRR trend stepped a cursor carrying today's day-of-month, so from
 *      31 January it jumped to 3 March and February was absent from the series.
 *      A gap in a chart reads as a month that did not happen.
 */

/**
 * Subtract whole months, clamping the day to the target month's length.
 * 31 March minus one month is 28 February, not 3 March.
 */
export function subtractMonths(from: Date, months: number): Date {
  const target = new Date(from.getFullYear(), from.getMonth() - months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), daysInTargetMonth));
  target.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
  return target;
}

/**
 * Every calendar month touched by [start, end], as YYYY-MM, in order.
 *
 * Anchoring each step to the first of the month cannot skip. Each month is
 * measured at its LAST day, so a contract starting mid-month counts in the month
 * it started rather than the one after.
 */
export function monthsBetween(start: Date, end: Date): Array<{ key: string; at: Date }> {
  const out: Array<{ key: string; at: Date }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const at = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    out.push({ key, at });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
