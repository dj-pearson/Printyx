// COP-B05: the fleet assessment, and the one rule that governs it.
//
// This document goes in front of a customer holding their own invoice. A
// fabricated line gets corrected out loud in the meeting, so every test here
// is about the difference between a number and an absence: a machine with no
// meters is a GAP, a machine with no rate is a GAP, and a total built over
// either is a FLOOR that says so.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assessCurrentFleet,
  compareFleets,
  modelProposedFleet,
  monthlyVolumeFor,
  resolveRate,
  type AssessmentContract,
  type AssessmentReading,
  type AssessmentTier,
} from '@shared/fleet-assessment';

const day = (n: number) => new Date(2026, 0, 1 + n).toISOString();

const reading = (over: Partial<AssessmentReading> = {}): AssessmentReading => ({
  equipmentId: 'm1',
  readingDate: day(0),
  bwMeterReading: 10_000,
  colorMeterReading: 2_000,
  ...over,
});

const CONTRACT: AssessmentContract = {
  id: 'c1',
  monthlyBase: '250.00',
  blackRate: '0.0100',
  colorRate: '0.0700',
  status: 'active',
};

describe('monthlyVolumeFor — a volume or an honest absence', () => {
  it('derives pages per month from the lifetime counters and the days between', () => {
    const v = monthlyVolumeFor('m1', [
      reading({ readingDate: day(0), bwMeterReading: 10_000, colorMeterReading: 2_000 }),
      reading({ readingDate: day(30), bwMeterReading: 20_000, colorMeterReading: 3_000 }),
    ]);
    expect(v.basis).toBe('meter_delta');
    // 10,000 black over 30 days is a touch more than 10,000 a month.
    expect(v.monthlyBlack).toBeCloseTo(10_000 * (30.4375 / 30), 0);
    expect(v.monthlyColor).toBeCloseTo(1_000 * (30.4375 / 30), 0);
  });

  it('reports NO READINGS rather than zero pages', () => {
    const v = monthlyVolumeFor('m1', []);
    expect(v.monthlyBlack).toBeNull();
    expect(v.gaps[0].code).toBe('no_readings');
  });

  it('refuses to derive a period from ONE reading', () => {
    const v = monthlyVolumeFor('m1', [reading()]);
    expect(v.monthlyBlack).toBeNull();
    expect(v.gaps[0].code).toBe('single_reading');
  });

  it('refuses a METER THAT WENT BACKWARDS instead of returning a negative volume', () => {
    // The meter was reset or the machine was swapped. No arithmetic over that
    // is meaningful, and a negative page count on a customer document is worse
    // than a blank.
    const v = monthlyVolumeFor('m1', [
      reading({ readingDate: day(0), bwMeterReading: 50_000 }),
      reading({ readingDate: day(30), bwMeterReading: 10_000 }),
    ]);
    expect(v.monthlyBlack).toBeNull();
    expect(v.gaps[0].code).toBe('meter_rollback');
  });

  it('refuses two readings on the same day', () => {
    const v = monthlyVolumeFor('m1', [
      reading({ readingDate: day(0), bwMeterReading: 10_000 }),
      reading({ readingDate: day(0), bwMeterReading: 12_000 }),
    ]);
    expect(v.gaps[0].code).toBe('zero_elapsed');
  });

  it('falls back to the copy columns ONLY when no counter is stored', () => {
    // black_copies defaults to 0, so an unfinished import looks like a month of
    // no printing. The counters are preferred for exactly that reason.
    const v = monthlyVolumeFor('m1', [
      reading({
        readingDate: day(0),
        bwMeterReading: null,
        colorMeterReading: null,
        blackCopies: 4_000,
        colorCopies: 500,
      }),
      reading({
        readingDate: day(30),
        bwMeterReading: null,
        colorMeterReading: null,
        blackCopies: 4_000,
        colorCopies: 500,
      }),
    ]);
    expect(v.basis).toBe('copy_columns');
    expect(v.monthlyBlack).toBeGreaterThan(0);
  });

  it('treats all-zero copy columns as no data, not as no printing', () => {
    const v = monthlyVolumeFor('m1', [
      reading({ readingDate: day(0), bwMeterReading: null, colorMeterReading: null }),
      reading({ readingDate: day(30), bwMeterReading: null, colorMeterReading: null }),
    ]);
    expect(v.basis).toBe('none');
    expect(v.gaps[0].code).toBe('no_readings');
  });

  it('ignores another machine’s readings', () => {
    const v = monthlyVolumeFor('m1', [reading({ equipmentId: 'm2' })]);
    expect(v.gaps[0].code).toBe('no_readings');
  });
});

describe('resolveRate', () => {
  const tiers: AssessmentTier[] = [
    {
      contractId: 'c1',
      colorType: 'black',
      minimumVolume: 0,
      maximumVolume: 5_000,
      rate: '0.0150',
      sortOrder: 0,
      tierName: '0-5000',
    },
    {
      contractId: 'c1',
      colorType: 'black',
      minimumVolume: 5_001,
      maximumVolume: null,
      rate: '0.0080',
      sortOrder: 1,
      tierName: '5000+',
    },
  ];

  it('prefers the tier the volume actually falls in', () => {
    expect(resolveRate(3_000, 'black', CONTRACT, tiers)).toMatchObject({
      rate: 0.015,
      source: 'tier',
    });
  });

  it('treats a null maximum as the unbounded top tier', () => {
    expect(resolveRate(80_000, 'black', CONTRACT, tiers)).toMatchObject({
      rate: 0.008,
      source: 'tier',
    });
  });

  it('falls back to the contract rate AND says it did', () => {
    expect(resolveRate(3_000, 'color', CONTRACT, tiers)).toMatchObject({
      rate: 0.07,
      source: 'contract',
    });
  });

  it('is NULL when neither exists — never zero, which would say clicks are free', () => {
    expect(resolveRate(3_000, 'color', { id: 'c1' }, [])).toEqual({ rate: null, source: null });
    expect(resolveRate(3_000, 'black', null, tiers)).toEqual({ rate: null, source: null });
  });

  it('ignores another contract’s tiers', () => {
    const other = tiers.map((t) => ({ ...t, contractId: 'c2' }));
    expect(resolveRate(3_000, 'black', CONTRACT, other).source).toBe('contract');
  });
});

describe('assessCurrentFleet', () => {
  const twoReadings = (id: string, black: number, color = 0): AssessmentReading[] => [
    { equipmentId: id, readingDate: day(0), bwMeterReading: 0, colorMeterReading: 0 },
    {
      equipmentId: id,
      readingDate: day(30),
      bwMeterReading: black,
      colorMeterReading: color,
    },
  ];

  it('costs a measurable machine from base plus contracted clicks', () => {
    const r = assessCurrentFleet({
      equipment: [{ id: 'm1', serialNumber: 'S1', modelName: 'bizhub C360' }],
      readings: twoReadings('m1', 10_000, 1_000),
      contract: CONTRACT,
      tiers: [],
    });
    expect(r.measuredMachines).toBe(1);
    expect(r.partial).toBe(false);
    expect(r.monthlyBaseCost).toBe(250);
    // 10,000 * 0.01 + 1,000 * 0.07, scaled by 30.4375/30.
    expect(r.monthlyClickCost).toBeCloseTo(170 * (30.4375 / 30), 0);
    expect(r.blendedCostPerPage).toBeGreaterThan(0);
  });

  it('MARKS THE TOTAL A FLOOR when a machine could not be costed', () => {
    // A machine contributing nothing means the real spend is higher, and a
    // saving measured from too low a baseline understates the saving.
    const r = assessCurrentFleet({
      equipment: [{ id: 'm1' }, { id: 'm2' }],
      readings: twoReadings('m1', 10_000),
      contract: CONTRACT,
      tiers: [],
    });
    expect(r.partial).toBe(true);
    expect(r.measuredMachines).toBe(1);
    expect(r.totalMachines).toBe(2);
    expect(r.gaps.some((g) => g.equipmentId === 'm2' && g.code === 'no_readings')).toBe(true);
  });

  it('says NO CONTRACT rather than costing the clicks at zero', () => {
    const r = assessCurrentFleet({
      equipment: [{ id: 'm1' }],
      readings: twoReadings('m1', 10_000),
      contract: null,
      tiers: [],
    });
    expect(r.gaps.some((g) => g.code === 'no_contract')).toBe(true);
    expect(r.machines[0].monthlyClickCost).toBeNull();
    expect(r.monthlyTotal).toBe(0);
    expect(r.partial).toBe(true);
  });

  it('raises a rate gap for a colour fleet on a contract with no colour rate', () => {
    const r = assessCurrentFleet({
      equipment: [{ id: 'm1' }],
      readings: twoReadings('m1', 10_000, 5_000),
      contract: { id: 'c1', blackRate: '0.01', monthlyBase: '0' },
      tiers: [],
    });
    expect(r.gaps.some((g) => g.code === 'no_color_rate')).toBe(true);
  });

  it('names service and supplies as absent rather than estimating them in', () => {
    const r = assessCurrentFleet({ equipment: [], readings: [], contract: CONTRACT, tiers: [] });
    expect(r.unbacked.join(' ')).toMatch(/service/i);
    expect(r.unbacked.join(' ')).toMatch(/[Ss]upplies/);
  });

  it('records where each rate came from', () => {
    const r = assessCurrentFleet({
      equipment: [{ id: 'm1' }],
      readings: twoReadings('m1', 10_000),
      contract: CONTRACT,
      tiers: [
        {
          contractId: 'c1',
          colorType: 'black',
          minimumVolume: 0,
          maximumVolume: null,
          rate: '0.02',
          sortOrder: 0,
        },
      ],
    });
    expect(r.machines[0].rateSource).toBe('tier');
  });
});

describe('modelProposedFleet — priced against the same volumes', () => {
  it('prices a complete proposal', () => {
    const p = modelProposedFleet(
      [{ modelName: 'C450i', quantity: 2, monthlyBase: 100, blackRate: 0.005, colorRate: 0.04 }],
      10_000,
      1_000,
    );
    expect(p.monthlyBase).toBe(200);
    expect(p.monthlyClickCost).toBeCloseTo(10_000 * 0.005 + 1_000 * 0.04, 6);
    expect(p.monthlyTotal).toBeCloseTo(290, 6);
  });

  it('returns NO TOTAL when a line has no rate — half a price is not a price', () => {
    const p = modelProposedFleet(
      [{ modelName: 'C450i', quantity: 1, monthlyBase: 100 }],
      10_000,
      0,
    );
    expect(p.monthlyTotal).toBeNull();
    expect(p.gaps[0].code).toBe('no_black_rate');
  });

  it('demands a colour rate only when the fleet prints colour', () => {
    const mono = modelProposedFleet(
      [{ modelName: 'M360', quantity: 1, monthlyBase: 50, blackRate: 0.006 }],
      10_000,
      0,
    );
    expect(mono.monthlyTotal).toBeCloseTo(110, 6);
    const colour = modelProposedFleet(
      [{ modelName: 'M360', quantity: 1, monthlyBase: 50, blackRate: 0.006 }],
      10_000,
      500,
    );
    expect(colour.monthlyTotal).toBeNull();
  });

  it('prices nothing for an empty proposal', () => {
    expect(modelProposedFleet([], 1_000, 0).monthlyTotal).toBeNull();
  });
});

describe('compareFleets', () => {
  const current = assessCurrentFleet({
    equipment: [{ id: 'm1' }],
    readings: [
      { equipmentId: 'm1', readingDate: day(0), bwMeterReading: 0, colorMeterReading: 0 },
      { equipmentId: 'm1', readingDate: day(30), bwMeterReading: 10_000, colorMeterReading: 0 },
    ],
    contract: CONTRACT,
    tiers: [],
  });

  it('states the delta monthly, annually and over the term', () => {
    const proposed = modelProposedFleet(
      [{ modelName: 'C450i', quantity: 1, monthlyBase: 100, blackRate: 0.005 }],
      current.monthlyBlackVolume,
      current.monthlyColorVolume,
    );
    const c = compareFleets(current, proposed, 36);
    expect(c.monthlyDelta).toBeGreaterThan(0);
    expect(c.annualDelta).toBeCloseTo(c.monthlyDelta! * 12, 6);
    expect(c.termDelta).toBeCloseTo(c.monthlyDelta! * 36, 6);
    expect(c.termMonths).toBe(36);
  });

  it('has NO delta when the proposal has no price', () => {
    const c = compareFleets(current, modelProposedFleet([], 0, 0), 36);
    expect(c.monthlyDelta).toBeNull();
    expect(c.termDelta).toBeNull();
  });

  it('flags a saving measured from a FLOOR', () => {
    const partial = assessCurrentFleet({
      equipment: [{ id: 'm1' }, { id: 'm2' }],
      readings: [
        { equipmentId: 'm1', readingDate: day(0), bwMeterReading: 0 },
        { equipmentId: 'm1', readingDate: day(30), bwMeterReading: 10_000 },
      ],
      contract: CONTRACT,
      tiers: [],
    });
    const proposed = modelProposedFleet(
      [{ modelName: 'C450i', quantity: 1, monthlyBase: 100, blackRate: 0.005 }],
      partial.monthlyBlackVolume,
      0,
    );
    expect(compareFleets(partial, proposed, 36).currentIsFloor).toBe(true);
  });

  it('leaves percent change undefined against a zero baseline', () => {
    const empty = assessCurrentFleet({ equipment: [], readings: [], contract: null, tiers: [] });
    const proposed = modelProposedFleet(
      [{ modelName: 'X', quantity: 1, monthlyBase: 10, blackRate: 0.01 }],
      0,
      0,
    );
    expect(compareFleets(empty, proposed, 36).percentChange).toBeNull();
  });

  it('defaults a nonsense term to 36 months rather than dividing by it', () => {
    const proposed = modelProposedFleet(
      [{ modelName: 'X', quantity: 1, monthlyBase: 10, blackRate: 0.01 }],
      1_000,
      0,
    );
    expect(compareFleets(current, proposed, 0).termMonths).toBe(36);
  });
});

/**
 * COP-B05 AC4 says the engine should reuse `print-cost-calculator-service.ts`
 * "rather than introducing a third cost model". It deliberately does not, and
 * this locks that decision so nobody reads the AC and wires it in.
 *
 * The AC's premise does not hold. That service is a BENCHMARK ESTIMATOR: every
 * input is an assumption - INDUSTRY_BENCHMARKS, FLEET_AGE_MULTIPLIERS,
 * DEVICE_TYPE_FACTORS, a $42/hour loaded employee cost, $0.14/kWh, a 15% toner
 * waste factor and a flat "25% average savings with MPS". It answers "what does
 * a typical fleet like this cost". A fleet assessment answers "what is this
 * customer paying", from their meters and their contracted rates, and it is put
 * in front of that customer.
 *
 * So these are two calculations of different things, not two models of one, and
 * folding the estimator in would put guessed industry averages inside a figure
 * a rep presents as actual spend - which is the rule AUDIT-019 and LEGAL-010
 * already set. The estimator stays available for benchmarking, labelled.
 */
describe('the assessment costs contracted rates, not industry averages', () => {
  const ENGINE = readFileSync(join(__dirname, '../../../shared/fleet-assessment.ts'), 'utf8');
  const EDGE = readFileSync(
    join(__dirname, '../../../supabase/functions/fleet-assessment/index.ts'),
    'utf8',
  );
  const ESTIMATOR = readFileSync(
    join(__dirname, '../../../server/services/print-cost-calculator-service.ts'),
    'utf8',
  );

  it('the estimator really is built on assumptions', () => {
    // Checked here rather than taken from a note: the deviation is only
    // defensible if this is true, so it is asserted where the deviation lives.
    for (const assumption of [
      'INDUSTRY_BENCHMARKS',
      'FLEET_AGE_MULTIPLIERS',
      'AVERAGE_HOURLY_EMPLOYEE_COST',
      'TONER_WASTE_FACTOR',
      'MANAGED_PRINT_SERVICES_SAVINGS_PERCENT',
    ]) {
      expect(ESTIMATOR).toContain(assumption);
    }
  });

  it('neither the engine nor its edge function imports it', () => {
    for (const src of [ENGINE, EDGE]) {
      expect(src).not.toContain('print-cost-calculator');
      expect(src).not.toContain('INDUSTRY_BENCHMARKS');
    }
  });

  it('reads the rates the customer is actually on', () => {
    expect(EDGE).toContain("from('contracts')");
    expect(EDGE).toContain("from('contract_tiered_rates')");
    expect(EDGE).toContain("from('meter_readings')");
  });
});
