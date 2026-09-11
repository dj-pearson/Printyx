import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The one currency formatter.
 *
 * There were 53 local copies of this across client/src in six different
 * behaviours, and the differences were not stylistic. Thirteen dropped cents
 * entirely, including the three that render dealer cost, rep cost, suggested
 * retail and MSRP - so a copier costing $3,499.50 displayed as $3,500 to the rep
 * quoting from it. Thirty-five did not coerce a string, which matters because a
 * Drizzle `decimal` column arrives from Express as a string and from PostgREST
 * as a number, so the same field is both depending on which backend answered.
 * Thirty-two had no null handling and rendered "$NaN".
 *
 * Cents by default, because this is a money field and money has cents. Pass
 * `{ cents: false }` where whole dollars is a deliberate choice - an aggregate
 * on a dashboard, an annual total - not to make a number shorter.
 *
 * Returns the `absent` string (an em dash by default) for null, undefined,
 * empty, or unparseable input. A missing price is not zero.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: { cents?: boolean; currency?: string; absent?: string } = {},
): string {
  const { cents = true, currency = 'USD', absent = '—' } = options;
  if (value === null || value === undefined || value === '') return absent;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return absent;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(num);
}

/**
 * Whole dollars, for a figure where cents are noise rather than information -
 * an annual total, a dashboard aggregate, a cost-per-employee benchmark.
 *
 * A named export rather than `formatCurrency(v, { cents: false })` at the call
 * site, because these are usually passed BY REFERENCE - to a recharts
 * `formatter`, to metricOrDash - where there is no call site to add an option
 * to. It also puts the decision in the import line, where a reviewer sees it.
 *
 * Do not reach for this to make a number shorter. A price, a line total, a
 * margin and anything a rep quotes from keeps its cents: MONEY-FORMAT-001 found
 * a copier costing $3,499.50 displayed as $3,500.
 */
export function formatCurrencyWhole(value: number | string | null | undefined): string {
  return formatCurrency(value, { cents: false });
}

/**
 * Compact currency for an axis label, a leaderboard cell or a KPI tile, where
 * the full figure would not fit and its cents would not be read: $1.2M, $45K.
 *
 * This is the seventh behaviour the MONEY-FORMAT-001 sweep found, and the one
 * that is NOT a defect - ten components wrote their own because the shared
 * formatter had no compact mode, and replacing them with full currency would
 * have blown out every table column. They differed anyway: some rounded
 * millions to one decimal and some to two, none coerced a string, none handled
 * null. Intl's own compact notation does all three consistently.
 *
 * Never for a figure someone quotes from. $45K is a range, not a price.
 */
export function formatCurrencyCompact(
  value: number | string | null | undefined,
  options: { currency?: string; absent?: string } = {},
): string {
  const { currency = 'USD', absent = '—' } = options;
  if (value === null || value === undefined || value === '') return absent;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return absent;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    // Both, deliberately: with currency style the minimum defaults to 2, so
    // maximumFractionDigits alone yields "$45.0K".
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
