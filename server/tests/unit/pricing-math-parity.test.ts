// PROD-014 parity lock.
//
// /api/pricing/{calculate-rep-cost,margin-report,approvals/pending,approval/:id}
// were Express-only, so in production the rep-cost preview, the margin widget
// and the approvals badge all 404'd. Both backends serve them now, which puts
// the markup arithmetic and the role gate in two places.
//
// The role map is the part worth pinning hardest: its keys are hyphenated
// ('platform-admin', 'super-admin') and are compared against role names already
// stored. "Tidying" them to underscores drops every manager to level 999 and
// hides dealer cost from the people the feature exists for.
import { describe, it, expect } from 'vitest';

import * as shared from '@shared/pricing-math';
import * as edge from '../../../supabase/functions/_shared/pricing-math';
import { lineMarginPct } from '@shared/quote-math';
import {
  calculateRepCost,
  calculateMarginPercentage,
  calculateMarkupPercentage,
  validateMinimumMargin,
  canSeeDealerCost,
} from '../../services/pricing-service';

describe('the two copies agree', () => {
  it('on the role map', () => {
    expect(edge.PRICING_ROLE_LEVELS).toEqual(shared.PRICING_ROLE_LEVELS);
  });

  it('keeps the hyphenated keys the stored role names use', () => {
    expect(shared.PRICING_ROLE_LEVELS['platform-admin']).toBe(1);
    expect(shared.PRICING_ROLE_LEVELS['super-admin']).toBe(2);
    expect(shared.PRICING_ROLE_LEVELS['read-only']).toBe(7);
    // An underscored spelling must NOT resolve, or the map has been "tidied".
    expect(shared.PRICING_ROLE_LEVELS['platform_admin']).toBeUndefined();
  });

  it.each([
    ['platform-admin', true],
    ['admin', true],
    ['manager', true],
    ['Manager', true],
    ['standard', false],
    ['guest', false],
    ['not-a-role', false],
    ['', false],
  ])('canSeeDealerCost(%s) === %s on both sides and on Express', (role, expected) => {
    expect(shared.canSeeDealerCost(role)).toBe(expected);
    expect(edge.canSeeDealerCost(role)).toBe(expected);
    expect(canSeeDealerCost(role)).toBe(expected);
  });

  it('agrees on rep cost across the markup precedence', () => {
    const settings = {
      defaultMarkupPercentage: '13',
      categoryMarkupOverrides: { MFP: 20 },
    };
    const cases: Array<[number, number | null, string | undefined]> = [
      [1000, 25, 'MFP'],
      [1000, null, 'MFP'],
      [1000, null, 'Supplies'],
      [1000, null, undefined],
      [0, null, 'MFP'],
    ];
    for (const [cost, markup, category] of cases) {
      expect(edge.calculateRepCost(cost, markup, settings, category)).toBe(
        shared.calculateRepCost(cost, markup, settings, category),
      );
      expect(calculateRepCost(cost, markup, settings as never, category)).toBe(
        shared.calculateRepCost(cost, markup, settings, category),
      );
    }
  });

  it('applies product markup, then category, then default — in that order', () => {
    const settings = { defaultMarkupPercentage: '13', categoryMarkupOverrides: { MFP: 20 } };
    expect(shared.calculateRepCost(1000, 25, settings, 'MFP')).toBe(1250);
    expect(shared.calculateRepCost(1000, null, settings, 'MFP')).toBe(1200);
    expect(shared.calculateRepCost(1000, null, settings, 'Other')).toBe(1130);
    expect(shared.calculateRepCost(1000, null, null, 'MFP')).toBe(1130);
  });

  it('reads the snake_case settings row PostgREST returns', () => {
    const snake = { default_markup_percentage: '13', category_markup_overrides: { MFP: 20 } };
    expect(edge.calculateRepCost(1000, null, snake, 'MFP')).toBe(1200);
    expect(edge.calculateRepCost(1000, null, snake, 'Other')).toBe(1130);
  });
});

describe('margin means margin', () => {
  it('matches the canonical formula in quote-math', () => {
    // shared/quote-math.ts is what the quote builder, the proposals edge
    // function and both PDFs use. A second definition that disagrees is how a
    // minimum-margin floor ends up enforcing something else.
    for (const [price, cost] of [
      [110, 100],
      [200, 50],
      [100, 100],
      [0, 50],
    ]) {
      expect(shared.grossMarginPct(price, cost)).toBeCloseTo(lineMarginPct(price, cost), 10);
      expect(edge.grossMarginPct(price, cost)).toBeCloseTo(lineMarginPct(price, cost), 10);
    }
  });

  it('is measured on the price, and markup on the cost', () => {
    // $110 against $100: 9.09% margin, 10% markup. The old function returned
    // the second and was named the first.
    expect(shared.grossMarginPct(110, 100)).toBeCloseTo(9.0909, 3);
    expect(shared.markupPct(110, 100)).toBeCloseTo(10, 10);
    expect(calculateMarginPercentage(110, 100)).toBeCloseTo(9.0909, 3);
    expect(calculateMarkupPercentage(110, 100)).toBeCloseTo(10, 10);
  });

  it('validates the floor against margin, not markup', () => {
    // A 10% floor: $110/$100 is 9.09% margin and must FAIL, though it is 10%
    // markup and used to pass.
    const settings = { minMarginPercentage: '10' };
    const check = validateMinimumMargin(110, 100, settings as never);
    expect(check.valid).toBe(false);
    expect(check.actualMargin).toBeCloseTo(9.0909, 3);
    expect(check.requiredMargin).toBe(10);
    expect(edge.validateMinimumMargin(110, 100, settings)).toEqual(
      shared.validateMinimumMargin(110, 100, settings),
    );
  });

  it('defaults the floor to 5 when the tenant has recorded none', () => {
    expect(shared.validateMinimumMargin(110, 100, null).requiredMargin).toBe(
      shared.DEFAULT_MIN_MARGIN_PERCENTAGE,
    );
    expect(shared.validateMinimumMargin(110, 100, null).valid).toBe(true);
  });

  it('returns 0 rather than dividing by zero', () => {
    expect(shared.grossMarginPct(0, 50)).toBe(0);
    expect(shared.markupPct(50, 0)).toBe(0);
    expect(shared.discountPct(0, 10)).toBe(0);
  });
});
