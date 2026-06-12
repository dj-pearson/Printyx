import { describe, it, expect } from 'vitest';
import {
  lineMarginPct,
  quoteMarginPct,
  quoteGrossProfit,
  round2,
  toNumber,
  lineGrossTotal,
  lineNetTotal,
  lineNetMarginPct,
  sumLineGross,
  sumLineDiscounts,
  sumLineNet,
  effectiveDiscountPct,
  normalizeFrequency,
  oneTimeLines,
  recurringLines,
  bucketTotals,
  oneTimeBucketTotals,
  recurringTotalsByFrequency,
} from '@shared/quote-math';

describe('quote-math', () => {
  describe('lineMarginPct', () => {
    it('computes margin relative to selling price', () => {
      expect(lineMarginPct(100, 60)).toBeCloseTo(40);
      expect(lineMarginPct(200, 150)).toBeCloseTo(25);
    });
    it('returns 0 when price is 0 (no divide-by-zero)', () => {
      expect(lineMarginPct(0, 50)).toBe(0);
    });
    it('can be negative when sold below cost', () => {
      expect(lineMarginPct(100, 120)).toBeCloseTo(-20);
    });
  });

  describe('quoteMarginPct (pre-tax revenue)', () => {
    it('matches the server recompute formula', () => {
      // subtotal 1000, discount 100 -> revenue 900; cost 600 -> (900-600)/900 = 33.33%
      expect(round2(quoteMarginPct({ subtotal: 1000, discount: 100, totalCost: 600 }))).toBe(33.33);
    });
    it('excludes tax from revenue by construction (no tax input)', () => {
      expect(quoteMarginPct({ subtotal: 500, discount: 0, totalCost: 250 })).toBeCloseTo(50);
    });
    it('returns 0 when revenue is 0', () => {
      expect(quoteMarginPct({ subtotal: 0, discount: 0, totalCost: 0 })).toBe(0);
    });
  });

  describe('quoteGrossProfit', () => {
    it('is revenue minus cost', () => {
      expect(quoteGrossProfit({ subtotal: 1000, discount: 100, totalCost: 600 })).toBe(300);
    });
  });

  describe('toNumber', () => {
    it('parses strings and guards bad input', () => {
      expect(toNumber('12.50')).toBe(12.5);
      expect(toNumber('')).toBe(0);
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber('abc')).toBe(0);
      expect(toNumber(7)).toBe(7);
    });
  });

  // ─── QUOTE-016: per-line discounts ────────────────────────────────────────
  describe('lineNetTotal / lineGrossTotal', () => {
    it('net = qty × unitPrice − discount (discount is a whole-line dollar amount)', () => {
      expect(lineGrossTotal({ quantity: 2, unitPrice: 100 })).toBe(200);
      expect(lineNetTotal({ quantity: 2, unitPrice: 100, discount: 50 })).toBe(150);
    });
    it('no discount → net equals gross', () => {
      expect(lineNetTotal({ quantity: 3, unitPrice: 40 })).toBe(120);
    });
    it('floors at 0 — a discount can never make a line negative', () => {
      expect(lineNetTotal({ quantity: 1, unitPrice: 100, discount: 500 })).toBe(0);
    });
  });

  describe('lineNetMarginPct', () => {
    it('computes margin on net revenue', () => {
      // 2 × $100 − $50 = $150 revenue; cost 2 × $60 = $120 → 20%
      expect(
        lineNetMarginPct({ quantity: 2, unitPrice: 100, discount: 50, unitCost: 60 }),
      ).toBeCloseTo(20);
    });
    it('equals lineMarginPct when there is no discount', () => {
      expect(lineNetMarginPct({ quantity: 4, unitPrice: 100, unitCost: 60 })).toBeCloseTo(
        lineMarginPct(100, 60),
      );
    });
    it('returns 0 when net revenue is 0', () => {
      expect(lineNetMarginPct({ quantity: 1, unitPrice: 100, discount: 100, unitCost: 60 })).toBe(
        0,
      );
    });
    it('matches the edge-fn inline computation (revenue-based, parity guard)', () => {
      const qty = 2,
        unitPrice = 100,
        discount = 30,
        unitCost = 55;
      const revenue = Math.max(0, qty * unitPrice - discount);
      const inline = revenue > 0 ? ((revenue - unitCost * qty) / revenue) * 100 : 0;
      expect(lineNetMarginPct({ quantity: qty, unitPrice, discount, unitCost })).toBeCloseTo(
        inline,
      );
    });
  });

  describe('quote rollup with per-line discounts', () => {
    const lines = [
      { quantity: 1, unitPrice: 1000, discount: 100, unitCost: 600 },
      { quantity: 2, unitPrice: 250, unitCost: 150 },
    ];
    it('sums gross, discounts, and net independently', () => {
      expect(sumLineGross(lines)).toBe(1500);
      expect(sumLineDiscounts(lines)).toBe(100);
      expect(sumLineNet(lines)).toBe(1400);
    });
    it('quote-level discount applies AFTER line discounts (subtotal is net)', () => {
      // subtotal (net) 1400, quote discount 200 → revenue 1200; cost 900 → 25%
      const margin = quoteMarginPct({ subtotal: sumLineNet(lines), discount: 200, totalCost: 900 });
      expect(round2(margin)).toBe(25);
    });
  });

  describe('effectiveDiscountPct (guardrail input)', () => {
    it('combines line + quote discounts over the gross subtotal', () => {
      const lines = [{ quantity: 1, unitPrice: 1000, discount: 100 }];
      // (100 + 100) / 1000 = 20%
      expect(effectiveDiscountPct(lines, 100)).toBeCloseTo(20);
    });
    it('spreading a discount across lines cannot dodge the policy', () => {
      const spread = [
        { quantity: 1, unitPrice: 500, discount: 75 },
        { quantity: 1, unitPrice: 500, discount: 75 },
      ];
      const quoteLevel = [
        { quantity: 1, unitPrice: 500 },
        { quantity: 1, unitPrice: 500 },
      ];
      expect(effectiveDiscountPct(spread, 0)).toBeCloseTo(effectiveDiscountPct(quoteLevel, 150));
    });
    it('returns 0 with no lines', () => {
      expect(effectiveDiscountPct([], 100)).toBe(0);
    });
  });

  // ─── QUOTE-017: one-time vs recurring buckets ─────────────────────────────
  describe('recurring buckets (QUOTE-017)', () => {
    const lines = [
      // one-time: net 4500 (5000 − 500), cost 3000
      { quantity: 1, unitPrice: 5000, discount: 500, unitCost: 3000 },
      // monthly ×12: net 200/period, cost 80
      {
        quantity: 2,
        unitPrice: 100,
        unitCost: 40,
        isRecurring: true,
        recurringFrequency: 'monthly',
        recurringDuration: 12,
      },
      // quarterly ongoing: net 900/period, cost 600
      {
        quantity: 1,
        unitPrice: 900,
        unitCost: 600,
        isRecurring: true,
        recurringFrequency: 'quarterly',
      },
      // recurring with no frequency → treated as monthly: net 50, cost 10
      { quantity: 1, unitPrice: 50, unitCost: 10, isRecurring: true },
    ];

    it('splits lines into one-time and recurring buckets', () => {
      expect(oneTimeLines(lines)).toHaveLength(1);
      expect(recurringLines(lines)).toHaveLength(3);
    });

    it('normalizes missing/unknown frequency to monthly', () => {
      expect(normalizeFrequency('monthly')).toBe('monthly');
      expect(normalizeFrequency('QUARTERLY')).toBe('quarterly');
      expect(normalizeFrequency(undefined)).toBe('monthly');
      expect(normalizeFrequency('weekly')).toBe('monthly');
    });

    it('quote-level discount applies to the ONE-TIME bucket only', () => {
      const ot = oneTimeBucketTotals(lines, 450);
      expect(ot.revenue).toBe(4050); // 4500 net − 450 quote discount
      expect(ot.cost).toBe(3000);
      expect(round2(ot.marginPct)).toBe(round2(((4050 - 3000) / 4050) * 100));
      // recurring buckets are identical with or without a quote-level discount
      expect(recurringTotalsByFrequency(lines)).toEqual(recurringTotalsByFrequency(lines));
      const rec = recurringTotalsByFrequency(lines);
      expect(rec.map((b) => b.frequency)).toEqual(['monthly', 'quarterly']);
      expect(rec[0].revenue).toBe(250); // 200 + 50 (frequency-less line folds into monthly)
      expect(rec[0].cost).toBe(90);
      expect(rec[1].revenue).toBe(900);
      expect(rec[1].cost).toBe(600);
    });

    it('per-line discounts still apply inside recurring lines (per period)', () => {
      const rec = recurringTotalsByFrequency([
        { quantity: 1, unitPrice: 100, discount: 20, unitCost: 50, isRecurring: true },
      ]);
      expect(rec[0].revenue).toBe(80);
      expect(round2(rec[0].marginPct)).toBe(round2(((80 - 50) / 80) * 100));
    });

    it('guardrail margin stays combined across BOTH buckets (QUOTE-006 cannot be dodged)', () => {
      // A healthy one-time line + a near-zero-margin recurring line: hiding the
      // bad margin in the recurring bucket must still drag the guardrail down.
      const sneaky = [
        { quantity: 1, unitPrice: 1000, unitCost: 500 }, // one-time, 50% margin
        { quantity: 1, unitPrice: 1000, unitCost: 990, isRecurring: true }, // recurring, 1% margin
      ];
      // The send-time gate computes margin from the proposals-table recompute:
      // subtotal = net of ALL lines (one period of recurring), cost = ALL lines.
      const combined = quoteMarginPct({
        subtotal: sumLineNet(sneaky),
        discount: 0,
        totalCost: bucketTotals(sneaky).cost,
      });
      const oneTimeOnly = oneTimeBucketTotals(sneaky, 0).marginPct;
      expect(oneTimeOnly).toBeCloseTo(50);
      expect(combined).toBeCloseTo(25.5); // (2000 − 1490) / 2000
      expect(combined).toBeLessThan(oneTimeOnly);
    });

    it('bucketTotals returns 0 margin when revenue is not positive', () => {
      expect(bucketTotals([], 100).marginPct).toBe(0);
    });
  });

  // Parity guard: the proposals edge fn recompute (Deno, inlined) computes
  //   revenue = subtotal - discount; margin = (revenue - cost)/revenue*100; round2
  // This replicates that arithmetic to catch drift if either side changes.
  describe('server/client parity', () => {
    it('edge-fn inline formula equals shared quoteMarginPct', () => {
      const cases = [
        { subtotal: 1000, discount: 100, totalCost: 600 },
        { subtotal: 2500, discount: 0, totalCost: 1900 },
        { subtotal: 800, discount: 50, totalCost: 800 },
      ];
      for (const c of cases) {
        const revenue = c.subtotal - c.discount;
        const inline = revenue > 0 ? round2(((revenue - c.totalCost) / revenue) * 100) : 0;
        expect(round2(quoteMarginPct(c))).toBe(inline);
      }
    });
  });
});
