import { describe, it, expect } from 'vitest';
import {
  calculatePrintCosts,
  type FleetInputs,
  type FleetAge,
} from '../../services/print-cost-calculator-service';

// Minimal valid fleet input; individual tests override fields as needed.
function baseInputs(overrides: Partial<FleetInputs> = {}): FleetInputs {
  return {
    deviceCount: 10,
    deviceTypes: ['mfp_color'],
    fleetAge: 'under_2_years',
    monthlyPageVolume: 50000,
    colorRatio: 30,
    employeeCount: 50,
    industry: 'other',
    painPoints: [],
    ...overrides,
  };
}

describe('calculatePrintCosts (CR-021)', () => {
  it('does not crash on an unknown fleetAge and falls back to a valid multiplier', () => {
    // Simulate untrusted API input that bypasses the enum at runtime.
    const inputs = baseInputs({ fleetAge: 'totally_unknown' as unknown as FleetAge });
    const result = calculatePrintCosts(inputs);
    expect(Number.isFinite(result.annualTCO)).toBe(true);
    expect(result.annualTCO).toBeGreaterThan(0);
  });

  it('honors a legitimate zero cost override instead of discarding it as falsy', () => {
    const withZero = calculatePrintCosts(baseInputs({ monthlySupplieCost: 0 }));
    const withEstimate = calculatePrintCosts(baseInputs());
    // A zero override must actually zero the supply component, so the TCO with a
    // 0 override is strictly lower than the estimated-supply TCO.
    expect(withZero.annualTCO).toBeLessThan(withEstimate.annualTCO);
  });

  it('honors a zero service-cost override', () => {
    const withZero = calculatePrintCosts(baseInputs({ monthlyServiceCost: 0 }));
    const withEstimate = calculatePrintCosts(baseInputs());
    expect(withZero.annualTCO).toBeLessThan(withEstimate.annualTCO);
  });

  it('produces finite results for all known fleetAge values', () => {
    const ages: FleetAge[] = ['under_2_years', '2_4_years', '5_7_years', '8_plus_years'];
    for (const fleetAge of ages) {
      const result = calculatePrintCosts(baseInputs({ fleetAge }));
      expect(Number.isFinite(result.annualTCO)).toBe(true);
    }
  });
});
