import { describe, expect, it } from 'vitest';
import { toDateInputValue } from '@/lib/date-utils';

/**
 * `new Date().toISOString().split('T')[0]` is today in UTC, not today where the
 * user is. For a US dealer that is TOMORROW from late afternoon onward, and for
 * a European user a calendar-picked date saved as YESTERDAY.
 *
 * The values this was reaching were not cosmetic: meter reading dates (which
 * decide a billing period), payment dates (aging and month-end), journal entry
 * dates (the accounting period), billing-rule effective dates and task due
 * dates.
 */
describe('toDateInputValue', () => {
  it('keeps the local calendar date for a late-evening instant in a negative offset', () => {
    // 23:30 on the 10th in UTC-07:00 is already the 11th in UTC.
    const instant = new Date('2026-09-10T23:30:00-07:00');
    expect(instant.toISOString().split('T')[0]).toBe('2026-09-11'); // the old behaviour
    // The helper reports whatever the host calendar says, which is the point:
    // it never reaches through to UTC.
    const local = toDateInputValue(instant)!;
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(local).toBe(
      `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
    );
  });

  it('formats a calendar-picked local midnight as that same day', () => {
    const picked = new Date(2026, 8, 10, 0, 0, 0); // local midnight, Sep 10
    expect(toDateInputValue(picked)).toBe('2026-09-10');
  });

  it('pads month and day', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('returns null rather than a bogus date for empty or invalid input', () => {
    expect(toDateInputValue(null)).toBeNull();
    expect(toDateInputValue(undefined)).toBeNull();
    expect(toDateInputValue('')).toBeNull();
    expect(toDateInputValue('not a date')).toBeNull();
  });
});
