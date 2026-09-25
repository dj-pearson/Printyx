/**
 * Round 156: usePricingVisibility() gets a per-caller answer on both hosts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  pricingVisibilityFor,
  PRICING_COST_LEVEL,
  PRICING_MARGIN_LEVEL,
} from '../../../shared/pricing-visibility';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('pricingVisibilityFor', () => {
  it('answers every key the client hook reads', () => {
    const hook = readFileSync('client/src/hooks/usePricingVisibility.ts', 'utf8');
    const iface = hook.slice(
      hook.indexOf('export interface PricingVisibility'),
      hook.indexOf('}', hook.indexOf('export interface PricingVisibility')),
    );
    const keys = [...iface.matchAll(/^\s+([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys.length).toBe(9);
    expect(Object.keys(pricingVisibilityFor(1, null)).sort()).toEqual([...keys].sort());
  });

  it('a rep sees rep cost only, by default', () => {
    const v = pricingVisibilityFor(1, null);
    expect(v).toMatchObject({
      showDealerCost: false,
      showRepCost: true,
      showMargin: false,
      canEditDealerCost: false,
      canEditCustomerPrice: false,
    });
  });

  it('dealer cost from the pricing-management level, margins from manager', () => {
    expect(pricingVisibilityFor(PRICING_COST_LEVEL, null)).toMatchObject({
      showDealerCost: true,
      canEditDealerCost: true,
      showMargin: false,
    });
    expect(pricingVisibilityFor(PRICING_MARGIN_LEVEL, null)).toMatchObject({
      showMargin: true,
      canEditCustomerPrice: true,
    });
    expect(PRICING_COST_LEVEL).toBe(3);
    expect(PRICING_MARGIN_LEVEL).toBe(4);
  });

  it('the policy row can open margins and price edits to reps, in either casing', () => {
    expect(pricingVisibilityFor(1, { show_margin_to_reps: true }).showMargin).toBe(true);
    expect(pricingVisibilityFor(1, { allowRepPriceEdit: true }).canEditCustomerPrice).toBe(true);
    expect(pricingVisibilityFor(1, { show_margin_to_reps: 'yes' }).showMargin).toBe(false);
  });

  it('reads numeric strings and falls back to the column defaults', () => {
    const v = pricingVisibilityFor(1, {
      max_discount_percentage: '12.50',
      min_margin_percentage: null,
    });
    expect(v.maxDiscountPercentage).toBe(12.5);
    expect(v.minMarginPercentage).toBe(5);
    expect(pricingVisibilityFor(1, null).maxDiscountPercentage).toBe(20);
  });

  it('agrees with the levels the pricing function enforces', () => {
    const fn = stripComments(readFileSync('supabase/functions/pricing/index.ts', 'utf8'));
    expect(fn).toMatch(/mayViewCost = pricingLevel >= ROLE_LEVEL\.SUPERVISOR/);
    expect(fn).toMatch(/mayViewMargins = pricingLevel >= ROLE_LEVEL\.MANAGER/);
  });
});

describe('pricing-settings /visibility', () => {
  const fn = stripComments(readFileSync('supabase/functions/pricing-settings/index.ts', 'utf8'));
  const at = fn.indexOf("resource === 'visibility'");
  const branch = fn.slice(at, fn.indexOf("req.method === 'PUT' && resource === 'visibility'"));

  it('computes the answer for the caller rather than returning a stored row', () => {
    expect(branch).toMatch(/resolveRoleLevel\(admin, user\)/);
    expect(branch).toMatch(
      /return createCorsResponse\(pricingVisibilityFor\(level, policy \?\? null\), 200, req\)/,
    );
    expect(branch).not.toMatch(/from\('pricing_visibility'\)/);
  });

  it('dev reaches it through the proxy', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/pricing-settings': 'pricing-settings'/);
  });
});
