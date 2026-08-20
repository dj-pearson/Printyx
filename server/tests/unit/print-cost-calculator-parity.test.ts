// Locks the two copies of the print-cost calculator together.
//
// server/services/print-cost-calculator-service.ts (Express) and
// supabase/functions/_shared/print-cost-calculator.ts (Deno) are near-verbatim
// duplicates, kept in sync by hand per CLAUDE.md. They power the PUBLIC,
// unauthenticated marketing calculator, so a divergence shows a prospect one
// cost estimate on the site and a different one inside the product — and
// feeds a different lead score to sales.
//
// Every case runs through both implementations and asserts they agree, so the
// "keep in sync" note is enforced rather than hoped for.
import { describe, it, expect } from 'vitest';
import {
  calculatePrintCosts as expressCalc,
  calculateLeadScore as expressScore,
  determineLeadTemperature as expressTemp,
  generateRecommendations as expressRecs,
  type FleetInputs,
} from '../../services/print-cost-calculator-service';
import {
  calculatePrintCosts as edgeCalc,
  calculateLeadScore as edgeScore,
  determineLeadTemperature as edgeTemp,
  generateRecommendations as edgeRecs,
} from '../../../supabase/functions/_shared/print-cost-calculator';

const base: FleetInputs = {
  deviceCount: 12,
  deviceTypes: ['mfp', 'printer'],
  fleetAge: '5_7_years',
  monthlyPageVolume: 40_000,
  colorRatio: 30,
  employeeCount: 85,
  industry: 'legal',
  painPoints: ['downtime', 'cost'],
};

// Deliberately spans the branch points: fleet-age bands, colour ratio extremes,
// tiny and large fleets, supplied vs derived costs, and empty collections.
const CASES: Array<[string, FleetInputs]> = [
  ['baseline mid-size fleet', base],
  ['single device', { ...base, deviceCount: 1, monthlyPageVolume: 500 }],
  ['large fleet', { ...base, deviceCount: 250, monthlyPageVolume: 2_000_000 }],
  ['brand new fleet', { ...base, fleetAge: 'under_2_years' }],
  ['2-4 year fleet', { ...base, fleetAge: '2_4_years' }],
  ['ageing fleet', { ...base, fleetAge: '8_plus_years' }],
  ['all mono', { ...base, colorRatio: 0 }],
  ['all colour', { ...base, colorRatio: 100 }],
  ['zero volume', { ...base, monthlyPageVolume: 0 }],
  ['no device types', { ...base, deviceTypes: [] }],
  ['no pain points', { ...base, painPoints: [] }],
  ['many pain points', { ...base, painPoints: ['downtime', 'cost', 'security', 'support', 'age'] }],
  [
    'user-supplied costs',
    {
      ...base,
      monthlySupplieCost: 1800,
      monthlyServiceCost: 950,
      monthlyDowntimeHours: 14,
      monthlyEnergyCost: 260,
    },
  ],
  ['tiny team', { ...base, employeeCount: 1 }],
  ['unknown industry', { ...base, industry: 'not-a-real-industry' }],
];

describe('print-cost calculator parity across backends', () => {
  it.each(CASES)('calculatePrintCosts agrees: %s', (_label, inputs) => {
    expect(edgeCalc(inputs)).toEqual(expressCalc(inputs));
  });

  it.each(CASES)('calculateLeadScore agrees: %s', (_label, inputs) => {
    const results = expressCalc(inputs);
    expect(edgeScore(inputs, results)).toBe(expressScore(inputs, results));
  });

  it.each(CASES)('generateRecommendations agrees: %s', (_label, inputs) => {
    const results = expressCalc(inputs);
    expect(edgeRecs(inputs, results)).toEqual(expressRecs(inputs, results));
  });

  it('determineLeadTemperature agrees across the score range', () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(edgeTemp(score)).toBe(expressTemp(score));
    }
  });

  it('produces a usable estimate for the baseline fleet', () => {
    const results = edgeCalc(base);
    expect(results).toBeTruthy();
    expect(edgeTemp(edgeScore(base, results))).toMatch(/^(hot|warm|cold)$/);
  });
});
