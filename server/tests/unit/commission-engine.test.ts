/**
 * What a rep is owed, worked out from the plan they are on (WF-C-07).
 *
 * POST /commission/calculate answered 501 and said so honestly: no handler
 * existed on Express either, so the Calculate button on CommissionManagement.tsx
 * had never worked on any host. The schema was already complete - plans, tiers,
 * product rates, assignments - and what was missing was the arithmetic.
 *
 * AC2 asks for one assertion above all: a won deal matched to a tiered plan
 * produces the TIER rate, not five percent. That number has a history here.
 * CR-017 found GET /calculations recomputing pay at "a simplified 5% base rate
 * plus a $2,500 bonus over $100,000" and answering 200 with it - invented pay
 * is harder to spot when it reads real deals to get there. The same flat five
 * percent was still in my-earnings when this story opened, which is why the
 * engine is a pure function: every figure is somebody's pay, and a function
 * that takes rows and returns numbers can be checked at every tier boundary.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calculateCommission,
  selectTier,
  type PlanTier,
} from '../../../supabase/functions/_shared/commission-engine';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** Three bands: 0-50k at 4%, 50k-100k at 6%, 100k+ at 8% with a bonus. */
const TIERS: PlanTier[] = [
  { tier_level: 1, tier_name: 'Base', minimum_sales: 0, maximum_sales: 50000, commission_rate: 4 },
  {
    tier_level: 2,
    tier_name: 'Target',
    minimum_sales: 50000.01,
    maximum_sales: 100000,
    commission_rate: 6,
  },
  {
    tier_level: 3,
    tier_name: 'Accelerator',
    minimum_sales: 100000.01,
    maximum_sales: null,
    commission_rate: 8,
    bonus_threshold: 150000,
    bonus_amount: 2500,
  },
];

const sale = (id: string, amount: number, category?: string) => ({ id, amount, category });

describe('AC2: a won deal on a tiered plan pays the TIER rate, not five percent', () => {
  it('pays 6% in the target band, where a flat 5% would have paid less', () => {
    const r = calculateCommission({ sales: [sale('d1', 80000)], tiers: TIERS });
    expect(r.tier?.name).toBe('Target');
    expect(r.tier?.rate).toBe(6);
    expect(r.grossCommission).toBe(4800);
    // The number CR-017 removed from the read path.
    expect(r.grossCommission).not.toBe(80000 * 0.05);
  });

  it('pays 4% in the base band, where a flat 5% would have paid MORE', () => {
    // Both directions, so the assertion is about the tier and not about 5%
    // happening to be low.
    const r = calculateCommission({ sales: [sale('d1', 40000)], tiers: TIERS });
    expect(r.tier?.name).toBe('Base');
    expect(r.grossCommission).toBe(1600);
    expect(r.grossCommission).toBeLessThan(40000 * 0.05);
  });
});

describe('the tier is a bracket, not a ladder', () => {
  it('pays the whole total at the band it falls into', () => {
    // Not marginal: 120000 at 8% is 9600, NOT 50000*4% + 50000*6% + 20000*8%.
    const r = calculateCommission({ sales: [sale('d1', 120000)], tiers: TIERS });
    expect(r.grossCommission).toBe(9600);
    expect(r.grossCommission).not.toBe(50000 * 0.04 + 50000 * 0.06 + 20000 * 0.08);
  });

  it('picks the right band at each boundary', () => {
    expect(selectTier(TIERS, 0)?.tier_name).toBe('Base');
    expect(selectTier(TIERS, 50000)?.tier_name).toBe('Base');
    expect(selectTier(TIERS, 50000.01)?.tier_name).toBe('Target');
    expect(selectTier(TIERS, 100000)?.tier_name).toBe('Target');
    expect(selectTier(TIERS, 100000.01)?.tier_name).toBe('Accelerator');
    // A null maximum is the open top band.
    expect(selectTier(TIERS, 9_000_000)?.tier_name).toBe('Accelerator');
  });

  it('reports a plan whose bands leave a gap rather than guessing', () => {
    const gapped: PlanTier[] = [
      { tier_name: 'Low', minimum_sales: 0, maximum_sales: 1000, commission_rate: 5 },
      { tier_name: 'High', minimum_sales: 5000, maximum_sales: null, commission_rate: 9 },
    ];
    const r = calculateCommission({ sales: [sale('d1', 3000)], tiers: gapped });
    expect(r.tier).toBeNull();
    expect(r.grossCommission).toBe(0);
    expect(r.unbacked.join(' ')).toMatch(/no plan tier covers/i);
  });

  it('skips an inactive tier', () => {
    const withDead = [{ ...TIERS[1], is_active: false }, TIERS[0], TIERS[2]];
    expect(selectTier(withDead, 80000)).toBeNull();
  });
});

describe('per-product rates beat the tier rate', () => {
  const rates = [
    { category: 'service', category_name: 'Service contracts', commission_rate: 12 },
    { category: 'hardware', category_name: 'Hardware', commission_rate: 3, is_active: false },
  ];

  it('uses the product rate where the plan names the category', () => {
    const r = calculateCommission({
      sales: [sale('d1', 40000, 'service'), sale('d2', 40000, 'supplies')],
      tiers: TIERS,
      productRates: rates,
    });
    // 80k total puts the tier at 6%. Service overrides to 12%; supplies does not.
    const service = r.lines.find((l) => l.category === 'service')!;
    const supplies = r.lines.find((l) => l.category === 'supplies')!;
    expect(service.commissionRate).toBe(12);
    expect(supplies.commissionRate).toBe(6);
    expect(r.grossCommission).toBe(40000 * 0.12 + 40000 * 0.06);
  });

  it('ignores an inactive product rate', () => {
    const r = calculateCommission({
      sales: [sale('d1', 40000, 'hardware')],
      tiers: TIERS,
      productRates: rates,
    });
    expect(r.lines[0].commissionRate).toBe(4);
  });

  it('groups several sales of one category into one line', () => {
    const r = calculateCommission({
      sales: [sale('a', 10000, 'service'), sale('b', 15000, 'service')],
      tiers: TIERS,
      productRates: rates,
    });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].salesAmount).toBe(25000);
  });
});

describe('bonuses and the plan floor', () => {
  it('pays the tier bonus only when the threshold is met', () => {
    const under = calculateCommission({ sales: [sale('d1', 120000)], tiers: TIERS });
    expect(under.bonuses[0].eligibilityMet).toBe(false);
    expect(under.totalBonuses).toBe(0);

    const over = calculateCommission({ sales: [sale('d1', 160000)], tiers: TIERS });
    expect(over.bonuses[0].eligibilityMet).toBe(true);
    expect(over.totalBonuses).toBe(2500);
    expect(over.netCommission).toBe(160000 * 0.08 + 2500);
  });

  it('suppresses a payout under the plan minimum, and says why', () => {
    const r = calculateCommission({
      sales: [sale('d1', 1000)],
      tiers: TIERS,
      minimumPayment: 100,
    });
    expect(r.grossCommission).toBe(40);
    expect(r.belowMinimum).toBe(true);
    expect(r.netCommission).toBe(0);
    expect(r.unbacked.join(' ')).toMatch(/under the plan's minimum/i);
  });
});

describe('quota attainment is null without a quota, not zero', () => {
  it('computes a percentage when a target is set', () => {
    const r = calculateCommission({
      sales: [sale('d1', 75000)],
      tiers: TIERS,
      assignment: { quota_target: 100000 },
    });
    expect(r.quotaAchievement).toBe(75);
  });

  it('is null when no quota is assigned', () => {
    // 0% reads as total failure on a screen where the number is about a person.
    const r = calculateCommission({ sales: [sale('d1', 75000)], tiers: TIERS });
    expect(r.quotaTarget).toBeNull();
    expect(r.quotaAchievement).toBeNull();
  });

  it('is null for a zero quota rather than dividing by it', () => {
    const r = calculateCommission({
      sales: [sale('d1', 75000)],
      tiers: TIERS,
      assignment: { quota_target: 0 },
    });
    expect(r.quotaAchievement).toBeNull();
  });
});

describe('the flat five percent is gone from the edge function', () => {
  const edge = code('supabase/functions/commission/index.ts');

  it('my-earnings is deleted, not left computing 0.05', () => {
    // AC3. It had no caller in any client tree, and it was the twin of the
    // invention CR-017 removed from the read path.
    expect(edge).not.toContain("endpoint === 'my-earnings'");
    expect(edge).not.toMatch(/totalSales \* 0\.05/);
    expect(edge).not.toContain('baseCommission');
  });

  it('calculate runs the shared engine rather than a 501', () => {
    expect(edge).not.toContain('COMMISSION_ENGINE_NOT_BUILT');
    expect(edge).toContain('calculateCommission({');
  });

  it('writes a DRAFT, so the approve action is not decorative', () => {
    const branch = edge.slice(edge.indexOf("endpoint === 'calculate'"));
    expect(branch.slice(0, 6000)).toMatch(/status: 'draft'/);
  });

  it('reads actual_close_date, the column deals actually has', () => {
    expect(edge).toContain('actual_close_date');
    expect(edge).not.toContain("gte('closed_at'");
  });
});

describe('AC4: approval is gated, and not by the person being paid', () => {
  const edge = code('supabase/functions/commission/index.ts');

  it('names sales.commission.approve', () => {
    expect(edge).toContain('sales.commission.approve');
  });

  it('gates on a code the derivation actually grants', () => {
    // SEC-EDGE-002: 77 route gates name codes no seeder creates, so they deny
    // everyone below platform admin. This one is emitted by both sides of the
    // module-and-level expansion, checked rather than assumed.
    expect(read('client/src/lib/navigation-permissions.ts')).toContain(
      "perms.add('sales.commission.approve')",
    );
    expect(read('supabase/functions/_shared/permission-expansion.ts')).toContain(
      "perms.add('sales.commission.approve')",
    );
  });

  it('refuses the employee the calculation pays', () => {
    expect(edge).toMatch(/existing\.employee_id === user\.id/);
  });

  it('refuses a second approval', () => {
    expect(edge).toMatch(/status === 'approved'/);
  });
});
