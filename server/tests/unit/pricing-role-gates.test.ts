/**
 * Round 155: the production `pricing` function.
 *
 * Its gates asked pricing-math's legacy name map ('admin', 'manager',
 * 'standard') about `app_metadata.role`, which role-claims.ts fills with role
 * CODES (COMPANY_ADMIN, SALES_MANAGER). Every current user resolved to 999, so
 * approvals, the margin report and the company pricing settings were refused
 * to everybody - while product pricing reads handed dealer cost to every
 * member and product pricing writes had no gate at all.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  canEditDealerCost,
  canSeeDealerCost,
} from '../../../supabase/functions/_shared/pricing-math';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = stripComments(readFileSync('supabase/functions/pricing/index.ts', 'utf8'));

function branch(head: string): string {
  const at = fn.indexOf(head);
  expect(at, head).toBeGreaterThan(-1);
  return fn.slice(at, fn.indexOf('\n    if (', at + head.length));
}

describe('the legacy name map cannot place a real role code', () => {
  it('is why the old gates denied everyone', () => {
    for (const code of ['COMPANY_ADMIN', 'SALES_MANAGER', 'PLATFORM_ADMIN']) {
      expect(canSeeDealerCost(code)).toBe(false);
      expect(canEditDealerCost(code)).toBe(false);
    }
  });
});

describe('gates read the numeric level', () => {
  it('resolves the level once, from the claim or roles.level', () => {
    expect(fn).toMatch(/const pricingLevel = await resolveRoleLevel\(admin, user\)/);
    expect(fn).toMatch(/const mayViewCost = pricingLevel >= ROLE_LEVEL\.SUPERVISOR/);
    expect(fn).toMatch(/const mayEditProductPricing =\s*pricingLevel >= ROLE_LEVEL\.SUPERVISOR/);
    expect(fn).toMatch(/const mayManagePricingPolicy =\s*pricingLevel >= ROLE_LEVEL\.MANAGER/);
    expect(fn).toMatch(/const mayViewMargins = pricingLevel >= ROLE_LEVEL\.MANAGER/);
  });

  it('no branch gates on the bare legacy map any more', () => {
    expect(fn).not.toMatch(/if \(!can(See|Edit)DealerCost\(userRole\)\)/);
  });

  for (const head of [
    "req.method === 'POST' && resource === 'products' && !action",
    "req.method === 'POST' && resource === 'products' && resourceId === 'bulk-update'",
    "(req.method === 'PATCH' || req.method === 'PUT') && resource === 'products' && resourceId",
    "req.method === 'DELETE' && resource === 'products' && resourceId",
  ]) {
    it(`product pricing write is gated: ${head}`, () => {
      const body = branch(head);
      const gate = body.indexOf('if (!mayEditProductPricing)');
      expect(gate).toBeGreaterThan(-1);
      const work = body.search(/req\.json\(|\.from\(/);
      expect(work === -1 || gate < work).toBe(true);
    });
  }
});

describe('product pricing reads withhold dealer cost below the pricing-management level', () => {
  it('list and item go through redactProductCost', () => {
    expect(fn).toMatch(/redactProductCost\(row, mayViewCost\)/);
    expect(fn).toMatch(/redactProductCost\(pricing, mayViewCost\)/);
    expect(fn).toMatch(/costRedacted: !mayViewCost/);
  });

  it('redacts the cost and the markup that would derive it', () => {
    const helper = fn.slice(
      fn.indexOf('export function redactProductCost('),
      fn.indexOf('export default async function handler'),
    );
    expect(helper).toMatch(/dealer_cost: null/);
    expect(helper).toMatch(/company_markup_percentage: null/);
    expect(helper).toMatch(/if \(!row \|\| mayViewCost\) return row;/);
  });
});
