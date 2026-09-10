/**
 * Shared date utility helpers for CRM pages.
 */

/** Returns a human-readable relative date string (e.g. "Today", "3d ago", "2w ago"). */
export function relativeDate(value: string | Date | null | undefined): string {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '--';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays < 0) {
    // Future date
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return 'Tomorrow';
    if (absDays < 7) return `In ${absDays}d`;
    if (absDays < 30) return `In ${Math.floor(absDays / 7)}w`;
    return date.toLocaleDateString();
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString();
}

/** Returns a relative future time string for upcoming events (e.g. "Tomorrow at 2pm", "In 3 days"). */
export function relativeFuture(value: string | Date | null | undefined, time?: string): string {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '--';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const timeSuffix = time ? ` at ${time}` : '';

  if (diffDays === 0) return `Today${timeSuffix}`;
  if (diffDays === 1) return `Tomorrow${timeSuffix}`;
  if (diffDays < 7) return `In ${diffDays} days${timeSuffix}`;
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)}w${timeSuffix}`;
  return date.toLocaleDateString();
}

/** Returns "Expires in X days" for near-expiry, or formatted date otherwise. */
export function expiryDisplay(value: string | Date | null | undefined): {
  text: string;
  urgent: boolean;
} {
  if (!value) return { text: '--', urgent: false };
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return { text: '--', urgent: false };

  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86_400_000);

  if (diffDays < 0) return { text: 'Expired', urgent: true };
  if (diffDays === 0) return { text: 'Expires today', urgent: true };
  if (diffDays <= 7) return { text: `Expires in ${diffDays}d`, urgent: true };
  if (diffDays <= 30) return { text: `Expires in ${diffDays}d`, urgent: false };
  return { text: date.toLocaleDateString(), urgent: false };
}

/**
 * Turn a UI time-range token ('7d' | '30d' | '90d' | '1y' | 'all') into the ISO
 * startDate the platform-analytics endpoints filter on. Returns null for 'all'
 * and for anything unrecognised, meaning "no lower bound".
 *
 * Day arithmetic rather than setMonth/setFullYear: setMonth overflows instead of
 * clamping, so subtracting a year from Feb 29 lands on Mar 1.
 */
export function timeRangeStartDate(range: string): string | null {
  const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const n = days[range];
  if (!n) return null;
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/**
 * Today's date on the USER'S calendar, as yyyy-MM-dd.
 *
 * `new Date().toISOString().split('T')[0]` is today in UTC, which for a dealer
 * anywhere in the US is TOMORROW from late afternoon onward. A technician
 * submitting a meter reading at 5pm Pacific dated it into the next day, and
 * sometimes the next billing period; a payment recorded after 7pm Eastern
 * landed on the wrong day for aging and month-end.
 *
 * A date-only business value is a calendar date, not an instant, so it comes
 * from the local calendar.
 */
export function todayLocalDate(): string {
  return toDateInputValue(new Date())!;
}

/**
 * A Date as yyyy-MM-dd on the local calendar - the value an `<input type="date">`
 * expects, and what a date picker's selection actually means. Going through
 * toISOString here shifts the day in either direction depending on the offset's
 * sign.
 */
export function toDateInputValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
