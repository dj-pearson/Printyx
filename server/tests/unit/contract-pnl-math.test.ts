import { describe, it, expect } from 'vitest';
import {
  CONTRACT_PNL_DEFAULTS,
  num,
  ratesFrom,
  computePnl,
  computeMonthly,
} from '@shared/contract-pnl-math';

/**
 * EDGE-023. These formulas are money — they drive the Contract Profitability
 * page's margin, the GP% sort, and the below-threshold alert. They exist in TWO
 * runtimes: shared/contract-pnl-math.ts (imported by
 * server/routes-contract-pnl.ts) and an inline replica in
 * supabase/functions/contract-pnl/. This suite pins the arithmetic so a Node-side
 * drift fails CI, and so the Deno replica has an exact specification to match
 * rather than a second reading of the same prose.
 */
describe('contract-pnl-math', () => {
  const rates = { burdenedRate: 100, avgPartCost: 50, financingRate: 0.1, gpAlertThreshold: 20 };

  describe('num', () => {
    it('coerces the STRING numerics Postgres actually returns', () => {
      // Load-bearing: numeric columns arrive as strings, and without this every
      // downstream multiplication is NaN or string concatenation.
      expect(num('123.45')).toBe(123.45);
      expect(num(7)).toBe(7);
    });

    it('treats null/undefined/garbage as 0 rather than NaN', () => {
      expect(num(null)).toBe(0);
      expect(num(undefined)).toBe(0);
      expect(num('not-a-number')).toBe(0);
      expect(num(Infinity)).toBe(0);
    });
  });

  describe('ratesFrom', () => {
    it('falls back to the documented defaults when a tenant has no settings', () => {
      expect(ratesFrom({})).toEqual({
        burdenedRate: CONTRACT_PNL_DEFAULTS.techBurdenedRate,
        avgPartCost: CONTRACT_PNL_DEFAULTS.avgPartCost,
        financingRate: CONTRACT_PNL_DEFAULTS.financingRate,
        gpAlertThreshold: CONTRACT_PNL_DEFAULTS.gpAlertThreshold,
      });
    });

    it('honours an explicit ZERO instead of treating it as unset', () => {
      // The guard is `!= null`, not truthiness — a tenant that deliberately sets
      // a 0 rate must get 0, not the default. Getting this wrong would silently
      // re-introduce cost into a contract the dealer zeroed out.
      const r = ratesFrom({ techBurdenedRate: 0, avgPartCost: 0, gpAlertThreshold: 0 });
      expect(r.burdenedRate).toBe(0);
      expect(r.avgPartCost).toBe(0);
      expect(r.gpAlertThreshold).toBe(0);
    });

    it('parses string-typed decimal columns', () => {
      expect(ratesFrom({ techBurdenedRate: '82.50', avgPartCost: '39.99' })).toMatchObject({
        burdenedRate: 82.5,
        avgPartCost: 39.99,
      });
    });
  });

  describe('computePnl', () => {
    it('computes revenue, cost and margin from raw 12-month aggregates', () => {
      const p = computePnl(
        {
          copies_revenue_12mo: '10000',
          base_revenue_12mo: '2000',
          labor_hours_12mo: '20',
          parts_count_12mo: '10',
          supplies_cost_12mo: '500',
        },
        rates,
      );

      expect(p.copiesRevenue).toBe(10000);
      expect(p.baseRevenue).toBe(2000);
      expect(p.revenue12).toBe(12000);

      expect(p.laborCost).toBe(2000); // 20h * 100
      expect(p.partsCost).toBe(500); // 10 * 50
      expect(p.suppliesCost).toBe(500);
      expect(p.financingCost).toBe(200); // 10% of BASE revenue only
      expect(p.cost12).toBe(3200);

      expect(p.grossProfit).toBe(8800);
      expect(p.gpPercent).toBeCloseTo(73.333, 3);
      expect(p.monthlyRevenue).toBe(1000);
      expect(p.monthlyCost).toBeCloseTo(266.667, 3);
    });

    it('charges financing on BASE revenue only, never on clicks', () => {
      const p = computePnl(
        { copies_revenue_12mo: 10_000, base_revenue_12mo: 0, supplies_cost_12mo: 0 },
        rates,
      );
      expect(p.financingCost).toBe(0);
    });

    it('reports gpPercent as null (not 0) when there is no revenue', () => {
      // A contract with no revenue has an UNDEFINED margin. Returning 0 would
      // sort it in with genuinely break-even contracts and trip the
      // below-threshold alert for a contract that simply has no data.
      const p = computePnl({ supplies_cost_12mo: 100 }, rates);
      expect(p.revenue12).toBe(0);
      expect(p.gpPercent).toBeNull();
      expect(p.grossProfit).toBe(-100);
    });

    it('yields a negative margin when cost exceeds revenue', () => {
      const p = computePnl(
        { copies_revenue_12mo: 1000, labor_hours_12mo: 20, supplies_cost_12mo: 0 },
        rates,
      );
      expect(p.grossProfit).toBe(-1000); // 1000 - 2000
      expect(p.gpPercent).toBe(-100);
    });

    it('treats missing columns as zero rather than NaN', () => {
      const p = computePnl({}, rates);
      expect(p.revenue12).toBe(0);
      expect(p.cost12).toBe(0);
      expect(p.grossProfit).toBe(0);
      expect(p.gpPercent).toBeNull();
    });
  });

  describe('computeMonthly', () => {
    it('applies the same formula to a single month row', () => {
      const m = computeMonthly(
        {
          copies_revenue: 1000,
          base_revenue: 200,
          labor_hours: 2,
          parts_count: 1,
          supplies_cost: 50,
        },
        rates,
      );
      expect(m.revenue).toBe(1200);
      expect(m.laborCost).toBe(200);
      expect(m.partsCost).toBe(50);
      expect(m.financingCost).toBe(20);
      expect(m.cost).toBe(320);
      expect(m.grossProfit).toBe(880);
      expect(m.gpPercent).toBeCloseTo(73.333, 3);
    });

    it('returns null gpPercent for a month with no revenue', () => {
      expect(computeMonthly({ supplies_cost: 10 }, rates).gpPercent).toBeNull();
    });

    it('agrees with computePnl when a year is one month repeated', () => {
      // Guards the two functions against drifting apart: they are the same
      // formula over differently-named columns, so 12 identical months must
      // produce the annual figures exactly.
      const month = {
        copies_revenue: 1000,
        base_revenue: 200,
        labor_hours: 2,
        parts_count: 1,
        supplies_cost: 50,
      };
      const m = computeMonthly(month, rates);
      const p = computePnl(
        {
          copies_revenue_12mo: 1000 * 12,
          base_revenue_12mo: 200 * 12,
          labor_hours_12mo: 2 * 12,
          parts_count_12mo: 1 * 12,
          supplies_cost_12mo: 50 * 12,
        },
        rates,
      );
      expect(p.revenue12).toBe(m.revenue * 12);
      expect(p.cost12).toBeCloseTo(m.cost * 12, 6);
      expect(p.gpPercent).toBeCloseTo(m.gpPercent!, 6);
      expect(p.monthlyRevenue).toBeCloseTo(m.revenue, 6);
      expect(p.monthlyCost).toBeCloseTo(m.cost, 6);
    });
  });
});
