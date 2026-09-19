// Shared shapes for the dashboard handlers (DASH-METRICS-001).
//
// WHAT AN `unbacked` ENTRY MEANS HERE. Ten of these widgets answered with
// typed-in values - $125,432 revenue at 12.5% growth, 23 tickets at -3.1%, a
// six-month revenue line, a five-person sales leaderboard - and were emptied
// rather than corrected, because a number nothing measures is worse than a
// blank. This story is the derivation. What is still not derivable says so by
// name, because an absence must not read as a zero.
//
// The recurring one is `change`. A percentage change needs a PRIOR PERIOD, and
// most of these metrics are a count of current state: how many tickets are open
// now, how many items sit below their reorder point. Nothing versions those, so
// last month's figure is not recoverable and a change is an invention, not a
// degraded measurement. Revenue is the exception - invoices carry a date, so
// month over month is real arithmetic - and it is the only one that returns a
// change.

// deno-lint-ignore no-explicit-any
export type Admin = any;

export interface MetricResult {
  value: number | string | null;
  change: number | null;
  /** Field names this response cannot answer. Never omitted when non-empty. */
  unbacked?: string[];
  /** One sentence saying why, for the fields named above. */
  reason?: string;
  [key: string]: unknown;
}

/** Rows a widget will return at most. A dashboard card is not a report. */
export const WIDGET_LIMIT = 20;

/** numeric arrives from PostgREST as a string. */
export function sumNumericField(rows: Array<Record<string, unknown>>, field: string): number {
  let total = 0;
  for (const row of rows) {
    const n = Number(row[field]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Percentage change, or null when the prior period has nothing to compare to.
 *
 * Zero is not the answer for an empty prior period: a tenant whose first
 * invoice went out this month has no trend, and 0% asserts that nothing
 * changed. Same rule the customer portal's usage analytics settled on
 * (AUDIT-021).
 */
export function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** First instant of the month `back` months before `from`, in UTC. */
export function monthStart(from: Date, back = 0): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - back, 1));
}
