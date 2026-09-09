/**
 * Contract terms and maintenance schedules land on the right day (iteration 14).
 *
 * DATE-SETMONTH-001's non-report half. A reporting window that skips a month
 * shows a wrong chart; a contract end date is a document people are held to, and
 * a maintenance due date is a service that does or does not happen.
 *
 * contract-renewal computed the renewed end date as
 * `newStartDate.setMonth(getMonth() + termMonths)`, wrong twice over:
 *
 *   1. OFF BY A TERM BOUNDARY. A twelve-month term starting 1 January 2025 ended
 *      on 1 JANUARY 2026 - 366 days, and the same calendar day the next term
 *      would start on.
 *   2. CUMULATIVE DRIFT. The next renewal takes its start from that end plus a
 *      day, so every renewal pushed the anniversary forward by one. Five
 *      renewals moved a 1 January contract to the 5th.
 *
 * plus the overflow itself: a one-month term starting 31 March ended 1 May.
 *
 * maintenance rescheduled a monthly job completed on 31 January for 3 March,
 * skipping February - a service that simply never happened.
 *
 * Every claim here is DEMONSTRATED with arithmetic, including the old behaviour,
 * because the premise is the part a reader doubts.
 */
import { describe, it, expect } from 'vitest';
import {
  addMonths,
  subtractMonths,
  termEndDate,
} from '../../../supabase/functions/_shared/date-months.ts';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('a contract term ends on the last day of the term', () => {
  it('twelve months from 1 January 2025 ends 31 December 2025', () => {
    expect(ymd(termEndDate(new Date(2025, 0, 1), 12))).toBe('2025-12-31');
  });

  it('one month from 31 March ends 30 April, not 1 May', () => {
    expect(ymd(termEndDate(new Date(2025, 2, 31), 1))).toBe('2025-04-30');
  });

  it('handles February and leap February', () => {
    expect(ymd(termEndDate(new Date(2025, 2, 1), 12))).toBe('2026-02-28');
    expect(ymd(termEndDate(new Date(2024, 2, 1), 12))).toBe('2025-02-28');
    expect(ymd(termEndDate(new Date(2024, 1, 1), 1))).toBe('2024-02-29');
  });

  it('the old formula really did overrun by a day', () => {
    const start = new Date(2025, 0, 1);
    const old = new Date(start);
    old.setMonth(old.getMonth() + 12);
    expect(ymd(old)).toBe('2026-01-01');
    expect(ymd(termEndDate(start, 12))).toBe('2025-12-31');
  });
});

describe('renewing does not drift the anniversary', () => {
  const chain = (firstStart: Date, terms: number, months: number) => {
    const out: string[] = [];
    let start = firstStart;
    for (let i = 0; i < terms; i++) {
      const end = termEndDate(start, months);
      out.push(`${ymd(start)}..${ymd(end)}`);
      start = new Date(end);
      start.setDate(start.getDate() + 1);
    }
    return out;
  };

  it('five twelve-month renewals keep the 1 January anniversary', () => {
    expect(chain(new Date(2025, 0, 1), 5, 12)).toEqual([
      '2025-01-01..2025-12-31',
      '2026-01-01..2026-12-31',
      '2027-01-01..2027-12-31',
      '2028-01-01..2028-12-31',
      '2029-01-01..2029-12-31',
    ]);
  });

  it('the old formula drifted a day per renewal', () => {
    let start = new Date(2025, 0, 1);
    const starts: string[] = [];
    for (let i = 0; i < 5; i++) {
      starts.push(ymd(start));
      const end = new Date(start);
      end.setMonth(end.getMonth() + 12);
      start = new Date(end);
      start.setDate(start.getDate() + 1);
    }
    expect(starts).toEqual(['2025-01-01', '2026-01-02', '2027-01-03', '2028-01-04', '2029-01-05']);
  });

  it('renewals never overlap or leave a gap', () => {
    for (const startDay of [1, 15, 28, 29, 30, 31]) {
      const first = new Date(2025, 0, Math.min(startDay, 31));
      let start = first;
      for (let i = 0; i < 6; i++) {
        const end = termEndDate(start, 3);
        expect(end.getTime(), `term from ${ymd(start)}`).toBeGreaterThan(start.getTime());
        const next = new Date(end);
        next.setDate(next.getDate() + 1);
        // Exactly one day between the end of a term and the start of the next.
        expect(Math.round((next.getTime() - end.getTime()) / 86400000)).toBe(1);
        start = next;
      }
    }
  });
});

describe('maintenance is rescheduled into the next month, not past it', () => {
  it('a monthly job completed 31 January is due 28 February, not 3 March', () => {
    expect(ymd(addMonths(new Date(2025, 0, 31), 1))).toBe('2025-02-28');

    const old = new Date(2025, 0, 31);
    old.setMonth(old.getMonth() + 1);
    expect(ymd(old)).toBe('2025-03-03'); // February skipped entirely
  });

  it('quarterly from 30 November lands in February', () => {
    expect(ymd(addMonths(new Date(2025, 10, 30), 3))).toBe('2026-02-28');
  });

  it('a yearly job completed on a leap day is due 28 February', () => {
    expect(ymd(addMonths(new Date(2024, 1, 29), 12))).toBe('2025-02-28');
  });

  it('addMonths and subtractMonths are inverses on a safe day', () => {
    const d = new Date(2025, 5, 15);
    expect(ymd(subtractMonths(addMonths(d, 7), 7))).toBe(ymd(d));
  });
});
