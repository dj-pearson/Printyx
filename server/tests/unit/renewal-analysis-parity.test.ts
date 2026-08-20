// EDGE-002g parity lock.
//
// /api/contract-renewal/analyze-all runs on Express in dev and is moving to the
// contract-renewal edge function for production, so the analysis prompt and the
// deterministic fallback exist twice:
//
//   server/services/contract-renewal-service.ts
//   supabase/functions/_shared/renewal-analysis.ts
//
// Node and Deno cannot import each other, so this suite imports both and
// asserts identical output. An edit to the prompt, a changed threshold or a
// reworded risk factor that lands in only one file fails here.
//
// The fallback matters more than the prompt: with no CLAUDE_API_KEY configured
// it is the only path that ever runs, so these numbers are what the renewal
// dashboard actually shows.
import { describe, it, expect } from 'vitest';

import * as node from '../../services/contract-renewal-service';
import * as edge from '../../../supabase/functions/_shared/renewal-analysis';

type Contract = edge.RenewalAnalysisInput;

// Fixtures chosen to cross every branch and both sides of every threshold.
const CONTRACTS: Array<{ name: string; contract: Contract }> = [
  {
    name: 'healthy - high satisfaction, quiet support, large fleet',
    contract: {
      contractType: 'service',
      customerName: 'Northgate Dental',
      daysUntilExpiration: 45,
      monthlyRecurringRevenue: '2400.00',
      annualContractValue: '28800.00',
      npsScore: 9,
      satisfactionScore: 5,
      lastInteractionDate: '2026-07-02T00:00:00.000Z',
      interactionFrequency: 4,
      supportTicketsLast90Days: 2,
      escalationsLast90Days: 0,
      equipmentCount: 12,
      averageUptime: '99.1',
      serviceCallsLast90Days: 3,
      averageResponseTime: '2.5',
      firstTimeFixRate: '92',
    },
  },
  {
    name: 'at risk - low satisfaction, heavy tickets, escalations, poor fix rate',
    contract: {
      contractType: 'maintenance',
      customerName: 'Bellweather Legal',
      daysUntilExpiration: 12,
      monthlyRecurringRevenue: '900',
      annualContractValue: '10800',
      npsScore: 2,
      satisfactionScore: 1,
      lastInteractionDate: '2026-01-09T00:00:00.000Z',
      interactionFrequency: 1,
      supportTicketsLast90Days: 22,
      escalationsLast90Days: 5,
      equipmentCount: 3,
      averageUptime: '86.4',
      serviceCallsLast90Days: 19,
      averageResponseTime: '9',
      firstTimeFixRate: '61',
    },
  },
  {
    name: 'exactly on every threshold - satisfaction 4, tickets 10, escalations 2, fix rate 80',
    contract: {
      contractType: 'service',
      customerName: 'Edge Case Industries',
      daysUntilExpiration: 90,
      monthlyRecurringRevenue: 1500,
      annualContractValue: 18000,
      npsScore: 7,
      satisfactionScore: 4,
      supportTicketsLast90Days: 10,
      escalationsLast90Days: 2,
      equipmentCount: 5,
      firstTimeFixRate: '80',
    },
  },
  {
    name: 'just past every threshold - satisfaction 2, tickets 11, escalations 3, fix rate 79',
    contract: {
      contractType: 'service',
      customerName: 'Just Over Ltd',
      daysUntilExpiration: 30,
      monthlyRecurringRevenue: 1500,
      annualContractValue: 18000,
      npsScore: 3,
      satisfactionScore: 2,
      supportTicketsLast90Days: 11,
      escalationsLast90Days: 3,
      equipmentCount: 6,
      firstTimeFixRate: '79',
    },
  },
  {
    name: 'sparse - nulls and undefined everywhere',
    contract: {
      contractType: null,
      customerName: null,
      daysUntilExpiration: null,
      monthlyRecurringRevenue: null,
      annualContractValue: null,
      npsScore: null,
      satisfactionScore: null,
      lastInteractionDate: null,
      interactionFrequency: null,
      supportTicketsLast90Days: null,
      escalationsLast90Days: null,
      equipmentCount: null,
      averageUptime: null,
      serviceCallsLast90Days: null,
      averageResponseTime: null,
      firstTimeFixRate: null,
    },
  },
  {
    name: 'empty object - every field absent',
    contract: {},
  },
];

describe('renewal analysis parity (Express service vs edge _shared)', () => {
  describe('buildRenewalAnalysisPrompt', () => {
    for (const { name, contract } of CONTRACTS) {
      it(`renders identical prompt text: ${name}`, () => {
        expect(edge.buildRenewalAnalysisPrompt(contract)).toBe(
          node.buildRenewalAnalysisPrompt(contract),
        );
      });
    }
  });

  describe('heuristicRenewalAnalysis', () => {
    for (const { name, contract } of CONTRACTS) {
      it(`returns an identical result: ${name}`, () => {
        expect(edge.heuristicRenewalAnalysis(contract)).toEqual(
          node.heuristicRenewalAnalysis(contract),
        );
      });
    }
  });

  describe('risk banding', () => {
    // Every boundary, plus one either side, so an off-by-one in either copy
    // shows up rather than hiding between fixtures.
    const probabilities = [-5, 0, 29, 30, 31, 49, 50, 51, 69, 70, 71, 89, 90, 91, 100, 105];
    for (const p of probabilities) {
      it(`agrees on the band at ${p}`, () => {
        expect(edge.renewalRiskFor(p)).toBe(node.renewalRiskFor(p));
      });
    }

    const bands = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
    for (const band of bands) {
      it(`agrees on the action for ${band}`, () => {
        expect(edge.recommendedActionFor(band)).toBe(node.recommendedActionFor(band));
      });
    }
  });

  it('the fallback stays deterministic — same input, same output', () => {
    const contract = CONTRACTS[1].contract;
    expect(edge.heuristicRenewalAnalysis(contract)).toEqual(
      edge.heuristicRenewalAnalysis(contract),
    );
  });
});
