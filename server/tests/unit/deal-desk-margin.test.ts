import { describe, it, expect } from 'vitest';
import {
  computeQuoteCost,
  computeMargin,
  headcountBand,
  machineClassOf,
  dealMatches,
  DEFAULT_SERVICE_COST_RATIO,
  DEFAULT_FINANCING_COST_RATIO,
  type CostLine,
} from '@shared/deal-desk-margin';

describe('computeQuoteCost (US-SUPER-008 service-cost + financing modeling)', () => {
  const line = (p: Partial<CostLine>): CostLine => ({
    itemType: 'equipment',
    unitCost: 0,
    unitPrice: 0,
    quantity: 1,
    ...p,
  });

  it('sums hardware/parts cost from non-service lines', () => {
    const cost = computeQuoteCost(
      [
        line({ itemType: 'equipment', unitCost: 1000, quantity: 2 }),
        line({ itemType: 'supply', unitCost: 50, quantity: 4 }),
      ],
      { revenue: 5000 },
    );
    expect(cost.partsCost).toBe(2000 + 200);
    expect(cost.serviceCost).toBe(0);
    expect(cost.financingCost).toBe(0);
    expect(cost.totalCost).toBe(2200);
  });

  it('uses catalog cost for service lines when present', () => {
    const cost = computeQuoteCost(
      [line({ itemType: 'service', unitCost: 300, unitPrice: 1000, quantity: 1 })],
      { revenue: 1000 },
    );
    expect(cost.serviceCost).toBe(300);
    expect(cost.partsCost).toBe(0);
  });

  it('estimates service cost from revenue when a service line has no catalog cost', () => {
    const cost = computeQuoteCost(
      [line({ itemType: 'service', unitCost: 0, unitPrice: 1000, quantity: 2 })],
      { revenue: 2000, serviceCostRatio: 0.6 },
    );
    // 0.6 * 1000 * 2
    expect(cost.serviceCost).toBeCloseTo(1200);
  });

  it('uses DEFAULT_SERVICE_COST_RATIO when no ratio is passed', () => {
    const cost = computeQuoteCost(
      [line({ itemType: 'service', unitCost: 0, unitPrice: 100, quantity: 1 })],
      { revenue: 100 },
    );
    expect(cost.serviceCost).toBeCloseTo(DEFAULT_SERVICE_COST_RATIO * 100);
  });

  it('applies financing carry only when financed', () => {
    const lines = [line({ itemType: 'equipment', unitCost: 1000, quantity: 1 })];
    const notFinanced = computeQuoteCost(lines, { revenue: 5000, financed: false });
    const financed = computeQuoteCost(lines, {
      revenue: 5000,
      financed: true,
      financingCostRatio: 0.02,
    });
    expect(notFinanced.financingCost).toBe(0);
    expect(financed.financingCost).toBeCloseTo(0.02 * 5000);
    expect(financed.totalCost).toBeCloseTo(1000 + 100);
  });

  it('financing default ratio is exported and applied when financed', () => {
    const cost = computeQuoteCost([], { revenue: 1000, financed: true });
    expect(cost.financingCost).toBeCloseTo(DEFAULT_FINANCING_COST_RATIO * 1000);
  });
});

describe('computeMargin', () => {
  it('computes GP$/GP% and floor breach', () => {
    const cost = { partsCost: 700, serviceCost: 0, financingCost: 0, totalCost: 700 };
    const m = computeMargin({ revenue: 1000, cost, gpFloorPct: 30 });
    expect(m.grossProfit).toBe(300);
    expect(m.gpPercent).toBe(30);
    expect(m.belowFloor).toBe(false); // exactly at floor is not below
  });

  it('flags below-floor margins', () => {
    const cost = { partsCost: 800, serviceCost: 50, financingCost: 0, totalCost: 850 };
    const m = computeMargin({ revenue: 1000, cost, gpFloorPct: 30 });
    expect(m.gpPercent).toBe(15);
    expect(m.belowFloor).toBe(true);
  });

  it('zero revenue yields 0% and no floor breach', () => {
    const cost = { partsCost: 0, serviceCost: 0, financingCost: 0, totalCost: 0 };
    const m = computeMargin({ revenue: 0, cost, gpFloorPct: 30 });
    expect(m.gpPercent).toBe(0);
    expect(m.belowFloor).toBe(false);
  });
});

describe('headcountBand', () => {
  it('bands by employee count', () => {
    expect(headcountBand(null)).toBe('unknown');
    expect(headcountBand(0)).toBe('unknown');
    expect(headcountBand(5)).toBe('micro');
    expect(headcountBand(50)).toBe('small');
    expect(headcountBand(250)).toBe('mid');
    expect(headcountBand(900)).toBe('enterprise');
  });
});

describe('machineClassOf', () => {
  const l = (itemType: string, productName: string) => ({ itemType, productName });
  it('classifies production presses', () => {
    expect(machineClassOf([l('equipment', 'Versant 280 Press')], 'equipment_lease')).toBe(
      'production',
    );
  });
  it('classifies wide-format', () => {
    expect(machineClassOf([l('equipment', 'Wide Format Plotter')], null)).toBe('wide-format');
  });
  it('classifies color vs mono MFP', () => {
    expect(machineClassOf([l('equipment', 'Color MFP C5535')], null)).toBe('color-mfp');
    expect(machineClassOf([l('equipment', 'Mono Printer B&W')], null)).toBe('mono-mfp');
  });
  it('defaults equipment-present-but-unclassified to color-mfp', () => {
    expect(machineClassOf([l('equipment', 'Acme 9000')], null)).toBe('color-mfp');
  });
  it('falls back to proposalType when no equipment line', () => {
    expect(machineClassOf([l('service', 'Maintenance Plan')], 'service_contract')).toBe(
      'service_contract',
    );
    expect(machineClassOf([], null)).toBe('other');
  });
});

describe('dealMatches', () => {
  const profile = (machineClass: string, hb: string, territory: string | null) => ({
    machineClass,
    headcountBand: hb,
    territory,
  });

  it('matches on all known dimensions', () => {
    const quote = profile('color-mfp', 'small', 'West');
    expect(dealMatches(quote, profile('color-mfp', 'small', 'West'))).toBe(true);
  });

  it('rejects on territory mismatch', () => {
    const quote = profile('color-mfp', 'small', 'West');
    expect(dealMatches(quote, profile('color-mfp', 'small', 'East'))).toBe(false);
  });

  it('rejects on machine-class mismatch', () => {
    const quote = profile('production', 'mid', 'West');
    expect(dealMatches(quote, profile('color-mfp', 'mid', 'West'))).toBe(false);
  });

  it('rejects on headcount-band mismatch', () => {
    const quote = profile('color-mfp', 'enterprise', 'West');
    expect(dealMatches(quote, profile('color-mfp', 'small', 'West'))).toBe(false);
  });

  it('skips dimensions the quote does not know (sparse account)', () => {
    const quote = profile('other', 'unknown', null);
    expect(dealMatches(quote, profile('color-mfp', 'enterprise', 'East'))).toBe(true);
  });
});
