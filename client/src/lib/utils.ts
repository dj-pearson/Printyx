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

/**
 * A percentage, or null when the question has no answer (PRICING-MARGIN-002).
 *
 * `(a / b) * 100` written inline is fine until b is zero, and b is usually a
 * total that a new tenant, a first-month customer or an empty pipeline has none
 * of. JavaScript then yields Infinity (or NaN when both sides are zero), and
 * because these figures land in a template string or a bar width, what ships is
 * "Infinity% of target" or a bar a thousand screens wide - not an error, not a
 * crash, just a number nobody can act on.
 *
 * NULL IS NOT ZERO here, for the AUDIT-028 reason: 0% of target is a specific
 * and quite bad claim, and asserting it about a tenant who has set no target is
 * worse than saying nothing. Render the null as an absence - formatPercent does.
 *
 * Returns null when the divisor is zero or either side is not a finite number.
 */
export function percentOf(part: number | null | undefined, whole: number | null | undefined) {
  if (part === null || part === undefined || whole === null || whole === undefined) return null;
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return (part / whole) * 100;
}

/**
 * The same ratio as a plain number, with a fallback instead of null.
 *
 * This is the exact equivalent of the guarded inline form it replaces -
 * `whole > 0 ? (part / whole) * 100 : 0` - and it does NOT clamp, because a
 * percentage over 100 is often the real answer: usage over a limit, a value
 * over target, a negative margin. Use it where the result is stored or fed to
 * arithmetic rather than shown as a bare figure.
 */
export function percentOfOr(
  part: number | null | undefined,
  whole: number | null | undefined,
  fallback = 0,
): number {
  const pct = percentOf(part, whole);
  return pct === null ? fallback : pct;
}

/**
 * A ratio clamped to 0-100, for BAR GEOMETRY only - a width, a Progress value,
 * a bar height.
 *
 * Clamping belongs here and not in percentOfOr: a bar wider than its track
 * overflows its container, and several of these sites were already clamping by
 * hand. A zero fallback is defensible precisely because nothing is printed -
 * a bar measuring a ratio with no denominator should be empty, and an empty bar
 * makes no claim about a quantity. Do not reach for this to fill a text slot;
 * use percentOf and render the absence.
 */
export function percentBar(
  part: number | null | undefined,
  whole: number | null | undefined,
): number {
  return Math.min(Math.max(percentOfOr(part, whole), 0), 100);
}

/**
 * Render a percentage, or an em dash when there is none.
 *
 * Takes a ready-made percentage (0-100), not a ratio - pass percentOf's result
 * straight in. Never prints "NaN%" or "Infinity%", which is the whole point.
 */
export function formatPercent(
  value: number | null | undefined,
  options: { digits?: number; absent?: string; sign?: boolean } = {},
): string {
  const { digits = 0, absent = '—', sign = false } = options;
  if (value === null || value === undefined || !Number.isFinite(value)) return absent;
  const body = `${value.toFixed(digits)}%`;
  return sign && value > 0 ? `+${body}` : body;
}
