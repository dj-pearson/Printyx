// Locks the Deno copy of the quote math to the canonical one.
//
// shared/quote-math.ts is the canonical definition and is already covered by
// quote-math.test.ts. This file covers the OTHER copy —
// supabase/functions/_shared/quote-math.ts — which the proposals edge function
// uses, because that is the copy that had drifted.
//
// The drift mattered: the proposals function computed the guardrail's gross as
// `(toNum(quantity) || 1) * toNum(unit_price)`, so a line with quantity 0 or
// null counted as ONE unit. Larger gross means a smaller effective discount
// percentage, which means the max-discount guardrail let through discounts the
// quote builder had already told the rep required approval. The regression test
// for that specific shape is at the bottom.
import { describe, it, expect } from 'vitest';
import * as canonical from '@shared/quote-math';
import * as edge from '../../../supabase/functions/_shared/quote-math';

type Line = canonical.DiscountedLine;

const LINE_SETS: Array<[string, Line[]]> = [
  ['empty', []],
  ['single plain line', [{ quantity: 2, unitPrice: 100 }]],
  ['line discount', [{ quantity: 2, unitPrice: 100, discount: 25 }]],
  [
    'mixed lines',
    [
      { quantity: 1, unitPrice: 1200, discount: 100 },
      { quantity: 10, unitPrice: 35.5 },
      { quantity: 3, unitPrice: 0, discount: 0 },
    ],
  ],
  ['zero quantity', [{ quantity: 0, unitPrice: 500 }]],
  [
    'zero quantity among real lines',
    [
      { quantity: 0, unitPrice: 500 },
      { quantity: 4, unitPrice: 250 },
    ],
  ],
  ['zero unit price', [{ quantity: 5, unitPrice: 0 }]],
  ['discount exceeding the line', [{ quantity: 1, unitPrice: 100, discount: 250 }]],
  ['fractional quantities', [{ quantity: 2.5, unitPrice: 19.99, discount: 4.5 }]],
  ['large fleet', [{ quantity: 250, unitPrice: 8999.95, discount: 125000 }]],
];

const QUOTE_DISCOUNTS = [0, 50, 1000, 999_999];

describe('quote math parity: canonical vs the edge copy', () => {
  const scalars: unknown[] = [null, undefined, '', 0, 42, '19.99', 'nope', NaN, Infinity, '  8 '];

  it.each(scalars.map((v) => [String(v), v]))('toNumber(%s) agrees', (_l, v) => {
    expect(edge.toNumber(v)).toBe(canonical.toNumber(v));
  });

  it.each([0, 1.005, 2.675, -3.14159, 1e6 + 0.555])('round2(%s) agrees', (n) => {
    expect(edge.round2(n)).toBe(canonical.round2(n));
  });

  it.each(LINE_SETS)('sumLineGross agrees: %s', (_l, lines) => {
    expect(edge.sumLineGross(lines)).toBe(canonical.sumLineGross(lines));
  });

  it.each(LINE_SETS)('sumLineNet agrees: %s', (_l, lines) => {
    expect(edge.sumLineNet(lines)).toBe(canonical.sumLineNet(lines));
  });

  it.each(LINE_SETS)('sumLineDiscounts agrees: %s', (_l, lines) => {
    expect(edge.sumLineDiscounts(lines)).toBe(canonical.sumLineDiscounts(lines));
  });

  it('effectiveDiscountPct agrees across every line set and quote discount', () => {
    for (const [, lines] of LINE_SETS) {
      for (const qd of QUOTE_DISCOUNTS) {
        expect(edge.effectiveDiscountPct(lines, qd)).toBe(
          canonical.effectiveDiscountPct(lines, qd),
        );
      }
    }
  });

  it('floors a line at zero rather than letting a discount go negative', () => {
    const over: Line[] = [{ quantity: 1, unitPrice: 100, discount: 250 }];
    expect(edge.lineNetTotal(over[0])).toBe(0);
    expect(edge.sumLineNet(over)).toBe(canonical.sumLineNet(over));
  });

  // Regression for the drift this file exists to prevent.
  it('counts a zero-quantity line as zero gross, not one unit', () => {
    const lines: Line[] = [
      { quantity: 0, unitPrice: 500 },
      { quantity: 1, unitPrice: 500 },
    ];
    expect(edge.sumLineGross(lines)).toBe(500);

    // With the old `|| 1` behaviour gross would have been 1000, halving the
    // reported discount and letting a 40% discount read as 20%.
    const withDiscount = edge.effectiveDiscountPct(lines, 200);
    expect(withDiscount).toBe(40);
    expect(withDiscount).toBe(canonical.effectiveDiscountPct(lines, 200));
  });

  it('maps a raw proposal_line_items row onto the canonical shape', () => {
    const row = { quantity: '3', unit_price: '250.50', discount: '25', unit_cost: '100' };
    expect(edge.lineNetTotal(edge.toDiscountedLine(row))).toBe(
      canonical.lineNetTotal({ quantity: 3, unitPrice: 250.5, discount: 25, unitCost: 100 }),
    );
  });
});
