/**
 * A lease payment schedule bills once per month (iteration 15).
 *
 * supabase/functions/leases/handlers/leases.ts writes one lease_payments row per
 * month of the term, and it stepped with `d.setMonth(start.getMonth() + i)`.
 * setMonth OVERFLOWS rather than clamping, so from a first payment on 31 January
 * a twelve-month lease produced payments in only SEVEN distinct months: March,
 * May, July, October and December each got two, and February, April, June,
 * September and November got none.
 *
 * These are rows in a table, not a chart. A customer was scheduled to be billed
 * twice in some months and not at all in others, and the term still had the right
 * number of rows, so nothing downstream could notice.
 *
 * The old behaviour is demonstrated here alongside the new, because "a schedule
 * that skips five months" is the part a reader will not take on faith.
 */
import { describe, it, expect } from 'vitest';
import { addMonths, daysInMonth } from '../../../supabase/functions/_shared/date-months.ts';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthOf = (s: string) => s.slice(0, 7);

const schedule = (first: Date, term: number) =>
  Array.from({ length: term }, (_, i) => ymd(addMonths(first, i)));

const oldSchedule = (first: Date, term: number) =>
  Array.from({ length: term }, (_, i) => {
    const d = new Date(first);
    d.setMonth(first.getMonth() + i);
    return ymd(d);
  });

describe('one payment per calendar month, from any start day', () => {
  it('a 12-month lease first paid on 31 January covers 12 distinct months', () => {
    const months = schedule(new Date(2025, 0, 31), 12).map(monthOf);
    expect(new Set(months).size).toBe(12);
    expect(months[1]).toBe('2025-02');
  });

  it('holds for every start day and a 36-month term', () => {
    for (let day = 1; day <= 31; day++) {
      const first = new Date(2025, 0, Math.min(day, daysInMonth(2025, 0)));
      const months = schedule(first, 36).map(monthOf);
      expect(new Set(months).size, `start day ${day}`).toBe(36);
    }
  });

  it('clamps the day rather than rolling into the next month', () => {
    expect(schedule(new Date(2025, 0, 31), 3)).toEqual(['2025-01-31', '2025-02-28', '2025-03-31']);
  });

  it('a leap February gets the 29th', () => {
    expect(schedule(new Date(2024, 0, 31), 2)).toEqual(['2024-01-31', '2024-02-29']);
  });
});

describe('what the old stepping actually produced', () => {
  it('billed five months twice and five not at all', () => {
    const months = oldSchedule(new Date(2025, 0, 31), 12).map(monthOf);
    expect(new Set(months).size).toBe(7);

    const counts = new Map<string, number>();
    months.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1));
    const doubled = [...counts.entries()].filter(([, n]) => n > 1).map(([m]) => m);
    expect(doubled).toEqual(['2025-03', '2025-05', '2025-07', '2025-10', '2025-12']);

    for (const missing of ['2025-02', '2025-04', '2025-06', '2025-09', '2025-11']) {
      expect(months, `${missing} should have been skipped`).not.toContain(missing);
    }
  });

  it('still produced the right ROW COUNT, which is why nothing downstream noticed', () => {
    expect(oldSchedule(new Date(2025, 0, 31), 12)).toHaveLength(12);
  });
});
