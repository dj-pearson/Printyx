/**
 * The financial reporting window covers the months it claims to (iteration 13).
 *
 * Date.setMonth OVERFLOWS rather than clamping, and supabase/functions/financial/
 * leaned on it twice. Both defects are date-dependent: they look correct on about
 * twenty-seven days of each month, which is why they survived.
 *
 * 1. THE RANGE. `startDate.setMonth(now.getMonth() - 1)` on 31 March asks for
 *    "31 February", which resolves to 3 March. So `period=month` returned
 *    3 March to 31 March - a 28-day window entirely inside the CURRENT month,
 *    with February excluded completely. Every endpoint in the function takes its
 *    range from that one calculation: metrics, cash-flow, profitability, kpis and
 *    mrr-analysis all reported on the wrong window together.
 *
 * 2. THE TREND. The MRR series stepped a cursor carrying today's day-of-month, so
 *    from 31 January it jumped straight to 3 March and February was simply absent
 *    from the series. A gap in a chart reads as a month that did not happen.
 *
 * These exercise the exported helpers rather than asserting on source, because
 * the defect is arithmetic and arithmetic can be run.
 */
import { describe, it, expect } from 'vitest';
import { subtractMonths, monthsBetween } from '../../../supabase/functions/financial/_period.ts';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('subtractMonths clamps instead of overflowing', () => {
  it('31 March minus one month is 28 February, not 3 March', () => {
    expect(ymd(subtractMonths(new Date(2025, 2, 31), 1))).toBe('2025-02-28');
  });

  it('handles a leap February', () => {
    expect(ymd(subtractMonths(new Date(2024, 2, 31), 1))).toBe('2024-02-29');
  });

  it('never lands in the same month it started in', () => {
    // The original bug's signature: a "last month" window whose start was in the
    // current month, so the period being reported on was excluded entirely.
    for (let day = 28; day <= 31; day++) {
      for (let month = 0; month < 12; month++) {
        const from = new Date(2025, month, 1);
        const daysInMonth = new Date(2025, month + 1, 0).getDate();
        if (day > daysInMonth) continue;
        from.setDate(day);
        const back = subtractMonths(from, 1);
        expect(back.getMonth(), `${ymd(from)} minus 1 month`).not.toBe(from.getMonth());
      }
    }
  });

  it('crosses a year boundary', () => {
    expect(ymd(subtractMonths(new Date(2025, 0, 31), 1))).toBe('2024-12-31');
    expect(ymd(subtractMonths(new Date(2025, 0, 15), 12))).toBe('2024-01-15');
  });

  it('quarter from 31 May reaches February, not March', () => {
    expect(ymd(subtractMonths(new Date(2025, 4, 31), 3))).toBe('2025-02-28');
  });
});

describe('monthsBetween skips nothing', () => {
  it('includes February when starting on 31 January', () => {
    const keys = monthsBetween(new Date(2025, 0, 31), new Date(2025, 5, 30)).map((m) => m.key);
    expect(keys).toEqual(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']);
  });

  it('produces a contiguous series from any start day', () => {
    for (const startDay of [1, 15, 28, 29, 30, 31]) {
      const start = new Date(2025, 0, Math.min(startDay, 31));
      const keys = monthsBetween(start, new Date(2025, 11, 31)).map((m) => m.key);
      expect(keys.length, `start day ${startDay}`).toBe(12);
      // No duplicates and no gaps.
      expect(new Set(keys).size).toBe(12);
    }
  });

  it('measures each month at its last day, so a mid-month start counts that month', () => {
    const [jan] = monthsBetween(new Date(2025, 0, 1), new Date(2025, 0, 31));
    expect(ymd(jan.at)).toBe('2025-01-31');
  });

  it('a single-month window yields exactly one point', () => {
    expect(monthsBetween(new Date(2025, 5, 3), new Date(2025, 5, 28))).toHaveLength(1);
  });
});

describe('the old arithmetic is what these replace', () => {
  it('setMonth really does overflow and skip', () => {
    // Demonstrated, not asserted from memory: this is the whole premise.
    const d = new Date(2025, 2, 31);
    d.setMonth(d.getMonth() - 1);
    expect(ymd(d)).toBe('2025-03-03');

    const cursor = new Date(2025, 0, 31);
    const stepped: number[] = [];
    for (let i = 0; i < 3; i++) {
      stepped.push(cursor.getMonth());
      cursor.setMonth(cursor.getMonth() + 1);
    }
    expect(stepped).toEqual([0, 2, 3]); // January, March, April - February skipped
  });
});

describe('adding months (a negative count) clamps too', () => {
  it('31 March plus one month is 30 April, not 1 May', () => {
    expect(ymd(subtractMonths(new Date(2025, 2, 31), -1))).toBe('2025-04-30');
  });

  it('a forecast horizon produces distinct consecutive months from any start day', () => {
    // The old `forecastDate.setMonth(currentDate.getMonth() + i)` on 31 March put
    // both i=1 and i=2 in May, so a six-month forecast silently had five distinct
    // periods with one repeated.
    for (const startDay of [15, 29, 30, 31]) {
      const from = new Date(2025, 0, Math.min(startDay, 31));
      const keys = [];
      for (let i = 1; i <= 6; i++) {
        const d = subtractMonths(from, -i);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      expect(new Set(keys).size, `start day ${startDay}: ${keys.join(' ')}`).toBe(6);
    }
  });

  it('the old forecast stepping really did duplicate a period', () => {
    const from = new Date(2025, 2, 31);
    const keys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(from);
      d.setMonth(from.getMonth() + i);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    expect(keys).toEqual(['2025-05', '2025-05', '2025-07']); // April absent, May twice
  });
});
