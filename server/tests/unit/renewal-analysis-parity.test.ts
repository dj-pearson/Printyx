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

// ─── Pricing half (proposal slice) ───────────────────────────────────────────
//
// These decide MONEY - the MRR a customer is quoted, the discount, the term and
// the proposal's dates. A drift here does not misreport a dashboard; it sends a
// customer the wrong price.

const NOW = Date.parse('2026-08-20T12:00:00.000Z');

const RULES = [
  {
    name: 'schema defaults',
    rules: {
      maxDiscountPercent: '15.00',
      minPriceIncreasePercent: '2.00',
      maxPriceIncreasePercent: '10.00',
    },
  },
  {
    name: 'tenant caps BELOW the hardcoded clamps - 5% discount, 1% increase',
    rules: {
      maxDiscountPercent: '5',
      minPriceIncreasePercent: '0.5',
      maxPriceIncreasePercent: '1',
    },
  },
  {
    name: 'all null - falls back to 15 and 5',
    rules: {
      maxDiscountPercent: null,
      minPriceIncreasePercent: null,
      maxPriceIncreasePercent: null,
    },
  },
  { name: 'empty rules object', rules: {} },
];

const MRRS = [0, 1, 1234.56, 98765.43];

describe('renewal pricing parity (Express service vs edge _shared)', () => {
  // One analysis per risk band, since pricing branches on it.
  const analyses = ([10, 40, 60, 80, 95] as const).map((p) => {
    const risk = edge.renewalRiskFor(p);
    return {
      risk,
      analysis: {
        renewalProbability: p,
        churnRiskScore: 100 - p,
        renewalRisk: risk,
        recommendedAction: edge.recommendedActionFor(risk),
        aiAnalysis: {
          summary: 'summary',
          strengths: ['s1', 's2'],
          concerns: ['c1'],
          opportunities: ['o1', 'o2'],
          recommendedStrategy: 'strategy',
        },
        riskFactors: ['c1'],
        opportunityFactors: ['o1', 'o2'],
        confidenceScore: 70,
      } as edge.RenewalAnalysisResult,
    };
  });

  describe('buildRenewalPricingPrompt', () => {
    for (const { risk, analysis } of analyses) {
      for (const { name, rules } of RULES) {
        it(`renders identical prompt text: ${risk} / ${name}`, () => {
          expect(edge.buildRenewalPricingPrompt(analysis, 2400, 28800, rules)).toBe(
            node.buildRenewalPricingPrompt(analysis, 2400, 28800, rules),
          );
        });
      }
    }
  });

  describe('heuristicRenewalPricing', () => {
    for (const { risk, analysis } of analyses) {
      for (const { name, rules } of RULES) {
        for (const mrr of MRRS) {
          it(`prices identically: ${risk} / ${name} / mrr ${mrr}`, () => {
            expect(edge.heuristicRenewalPricing(analysis, mrr, rules)).toEqual(
              node.heuristicRenewalPricing(analysis, mrr, rules),
            );
          });
        }
      }
    }
  });

  describe('buildRenewalProposalRow', () => {
    const CONTRACTS: Array<{ name: string; contract: edge.ProposalContractInput }> = [
      {
        name: 'full contract',
        contract: {
          contractType: 'service',
          customerName: 'Northgate Dental',
          contractId: 'ct-1',
          customerId: 'cu-1',
          startDate: '2024-09-01T00:00:00.000Z',
          endDate: '2026-09-01T00:00:00.000Z',
          monthlyRecurringRevenue: '2400.00',
          annualContractValue: '28800.00',
        },
      },
      {
        name: 'no dates - term and proposed window unknown',
        contract: {
          contractType: 'maintenance',
          customerName: 'No Dates Ltd',
          contractId: 'ct-2',
          customerId: 'cu-2',
          startDate: null,
          endDate: null,
          monthlyRecurringRevenue: '900',
          annualContractValue: null,
        },
      },
      {
        name: 'no MRR - discount amount must be 0, not NaN',
        contract: {
          contractType: 'service',
          customerName: 'Zero MRR Inc',
          contractId: 'ct-3',
          customerId: 'cu-3',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
          monthlyRecurringRevenue: null,
          annualContractValue: null,
        },
      },
      { name: 'empty contract', contract: {} },
    ];

    for (const { risk, analysis } of analyses) {
      for (const { name, contract } of CONTRACTS) {
        it(`builds an identical row: ${risk} / ${name}`, () => {
          const recs = edge.heuristicRenewalPricing(analysis, 2400, RULES[0].rules);
          expect(
            edge.buildRenewalProposalRow(contract, analysis, recs, 'REN-FIXED-1', NOW),
          ).toEqual(node.buildRenewalProposalRow(contract, analysis, recs, 'REN-FIXED-1', NOW));
        });
      }
    }

    it('never produces NaN in a money field', () => {
      const { analysis } = analyses[0];
      const recs = edge.heuristicRenewalPricing(analysis, 0, RULES[0].rules);
      const row = edge.buildRenewalProposalRow(CONTRACTS[2].contract, analysis, recs, 'X', NOW);
      for (const key of [
        'proposed_mrr',
        'proposed_acv',
        'discount_percentage',
        'discount_amount',
        'incentive_value',
        'upsell_value',
      ]) {
        expect(String(row[key])).not.toContain('NaN');
      }
    });
  });
});
