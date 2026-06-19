// Deno test for the ported calculator engine (EDGE-005f).
//
// Expected values are taken from running the canonical Node service
// (server/services/print-cost-calculator-service.ts) with the same input — this
// guards the verbatim port in _shared/print-cost-calculator/calculator.ts against
// drift. Run: deno test supabase/functions/print-cost-calculator/calculator.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  calculatePrintCosts,
  calculateLeadScore,
  determineLeadTemperature,
  generateRecommendations,
  type FleetInputs,
} from '../_shared/print-cost-calculator/calculator.ts';

const SAMPLE: FleetInputs = {
  deviceCount: 12,
  deviceTypes: ['mfp', 'copier'],
  fleetAge: '5_7_years',
  monthlyPageVolume: 40000,
  colorRatio: 30,
  employeeCount: 80,
  industry: 'legal',
  painPoints: ['high_costs', 'frequent_breakdowns'],
};

Deno.test('calculatePrintCosts matches the canonical Node service output', () => {
  const r = calculatePrintCosts(SAMPLE);
  assertEquals(r.annualTCO, 357531);
  assertEquals(r.costPerPageBW, 0.633);
  assertEquals(r.costPerPageColor, 1.452);
  assertEquals(r.benchmarking.utilizationScore, 42);
  assertEquals(r.savingsOpportunities.total, 20791);
});

Deno.test('lead scoring + temperature + recommendations match the canonical service', () => {
  const r = calculatePrintCosts(SAMPLE);
  const score = calculateLeadScore(SAMPLE, r);
  assertEquals(score, 95);
  assertEquals(determineLeadTemperature(score), 'hot');
  assertEquals(generateRecommendations(SAMPLE, r).length, 4);
});

Deno.test('unknown industry falls back to the "other" benchmark without throwing', () => {
  const r = calculatePrintCosts({ ...SAMPLE, industry: 'does_not_exist' });
  assertEquals(Number.isFinite(r.annualTCO), true);
});
