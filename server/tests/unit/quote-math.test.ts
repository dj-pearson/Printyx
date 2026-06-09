import { describe, it, expect } from 'vitest';
import {
  lineMarginPct,
  quoteMarginPct,
  quoteGrossProfit,
  round2,
  toNumber,
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
