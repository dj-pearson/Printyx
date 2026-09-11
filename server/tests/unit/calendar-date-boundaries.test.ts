import { describe, expect, it } from 'vitest';
import {
  startOfNextUtcDay,
  startOfUtcDay,
  utcDateOnly,
} from '../../../supabase/functions/_shared/date-months.ts';

/**
 * DATE-LOCAL-002. DATE-LOCAL-001 fixed the client, which was writing UTC dates
 * for local calendar days. The question it left open was what the OTHER side
 * does with the same values, and the answer is that it compared them to
 * instants.
 *
 * Several columns here are `timestamp` in the schema but hold a calendar date -
 * meter_readings.reading_date, time_entries.entry_date, tasks.due_date,
 * invoices.paid_date and invoice_date. The client writes `yyyy-MM-dd`, so
 * Postgres stores midnight. A boundary built from `new Date()` carries a time
 * of day, and the comparison then lands half a day off.
 *
 * These tests demonstrate the failures with arithmetic rather than asserting
 * them from memory, the style server/tests/unit/financial-period-months.test.ts
 * established - the premise is the thing people doubt.
 *
 * WHOSE MIDNIGHT: `tenants` has no timezone column. That was checked, not
 * assumed, and it is what makes UTC the right answer today - the stored values
 * are UTC midnight, so a UTC boundary is exact rather than approximately right.
 */

const READING_AT_MIDNIGHT = new Date('2026-08-12T00:00:00.000Z');

describe('the failure these helpers exist to fix', () => {
  it('a mid-day lower bound excludes every row dated ON the boundary day', () => {
    const now = new Date('2026-09-11T14:00:00.000Z');
    const naive = new Date(now.getTime() - 30 * 86_400_000); // 2026-08-12T14:00Z

    // The reading is dated 12 August. The window is meant to start on 12 August.
    expect(utcDateOnly(naive)).toBe(utcDateOnly(READING_AT_MIDNIGHT));
    // And it is excluded anyway, because midnight is before two in the afternoon.
    expect(READING_AT_MIDNIGHT >= naive).toBe(false);

    expect(READING_AT_MIDNIGHT >= startOfUtcDay(naive)).toBe(true);
  });

  it('a mid-day upper bound on "overdue" swallows everything due today', () => {
    const now = new Date('2026-09-11T14:00:00.000Z');
    const dueToday = new Date('2026-09-11T00:00:00.000Z');

    // `.lt('due_date', now)` counts a task due TODAY as already overdue, from
    // midnight onward - and the "due today" count on the same dashboard counts
    // it again, so the two figures overlap.
    expect(dueToday < now).toBe(true);
    expect(dueToday < startOfUtcDay(now)).toBe(false);
  });

  it('splitting two periods on a mid-day boundary puts a day in the wrong half', () => {
    const now = new Date('2026-09-11T14:00:00.000Z');
    const naiveStart = new Date(now.getTime() - 30 * 86_400_000);
    const naivePrevStart = new Date(naiveStart.getTime() - 30 * 86_400_000);

    // Not merely missing from this period - counted in the PREVIOUS one, on both
    // sides of the comparison the usage-analytics page is built on.
    expect(READING_AT_MIDNIGHT >= naiveStart).toBe(false);
    expect(READING_AT_MIDNIGHT >= naivePrevStart).toBe(true);
  });
});

describe('startOfUtcDay', () => {
  it('drops the time of day and nothing else', () => {
    expect(startOfUtcDay(new Date('2026-09-11T23:59:59.999Z')).toISOString()).toBe(
      '2026-09-11T00:00:00.000Z',
    );
    expect(startOfUtcDay(new Date('2026-09-11T00:00:00.000Z')).toISOString()).toBe(
      '2026-09-11T00:00:00.000Z',
    );
  });

  it('does not move a date that is already midnight', () => {
    const midnight = new Date('2026-01-01T00:00:00.000Z');
    expect(startOfUtcDay(midnight).getTime()).toBe(midnight.getTime());
  });
});

describe('startOfNextUtcDay', () => {
  it('is an exclusive upper bound with no sub-millisecond gap', () => {
    // The alternative, an inclusive 23:59:59.999, is a real timestamp a row can
    // exceed - the kind of thing that shows up once a year in a report nobody
    // can reproduce.
    expect(startOfNextUtcDay(new Date('2026-09-11T14:00:00.000Z')).toISOString()).toBe(
      '2026-09-12T00:00:00.000Z',
    );
    const lastInstant = new Date('2026-09-11T23:59:59.999Z');
    expect(lastInstant < startOfNextUtcDay(lastInstant)).toBe(true);
  });

  it('rolls the month, and the year', () => {
    expect(startOfNextUtcDay(new Date('2026-01-31T08:00:00.000Z')).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    expect(startOfNextUtcDay(new Date('2026-12-31T08:00:00.000Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('handles a leap day, which is where day arithmetic usually breaks', () => {
    expect(startOfNextUtcDay(new Date('2028-02-28T12:00:00.000Z')).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(startOfNextUtcDay(new Date('2028-02-29T12:00:00.000Z')).toISOString()).toBe(
      '2028-03-01T00:00:00.000Z',
    );
  });
});

describe('utcDateOnly', () => {
  it('is the string a calendar-date column actually holds', () => {
    expect(utcDateOnly(new Date('2026-09-11T14:00:00.000Z'))).toBe('2026-09-11');
  });
});
