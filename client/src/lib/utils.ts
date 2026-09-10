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

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
