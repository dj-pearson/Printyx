// EDGE-002g parity lock, supply side.
//
// /api/auto-supply-replenishment/analyze-all runs on Express in dev and on the
// auto-supply-replenishment edge function in production, so the analysis prompt
// and the deterministic fallback exist twice:
//
//   server/services/auto-supply-replenishment-service.ts
//   supabase/functions/_shared/supply-analysis.ts
//
// Node and Deno cannot import each other, so this suite imports both and
// asserts identical output.
//
// The fallback is what matters: with no CLAUDE_API_KEY configured it is the
// only path that runs, and it decides whether a supply gets AUTO-ORDERED. A
// drift here does not just misreport - it buys toner.
import { describe, it, expect } from 'vitest';

import * as node from '../../services/auto-supply-replenishment-service';
import * as edge from '../../../supabase/functions/_shared/supply-analysis';

// Fixed instant so the depletion date is deterministic on both sides.
const NOW = Date.parse('2026-08-20T12:00:00.000Z');

type Supply = edge.SupplyAnalysisInput;

const SUPPLIES: Array<{ name: string; supply: Supply; dailyUsage: number }> = [
  {
    name: 'healthy - full toner, light usage',
    supply: {
      supplyType: 'toner',
      supplyName: 'Black Toner TK-8store',
      currentLevel: 82,
      capacityPages: 20000,
      model: 'TASKalfa 3554ci',
      location: 'Floor 2 copy room',
      dailyUsageAverage: '120',
      weeklyUsageAverage: '840',
      monthlyUsageAverage: '3600',
      usageTrend: 'stable',
      reorderThreshold: 20,
    },
    dailyUsage: 120,
  },
  {
    name: 'critical - nearly empty, heavy usage',
    supply: {
      supplyType: 'toner',
      supplyName: 'Cyan Toner',
      currentLevel: 4,
      capacityPages: 6000,
      model: 'VersaLink C7000',
      location: null,
      dailyUsageAverage: '300',
      usageTrend: 'increasing',
      reorderThreshold: 15,
    },
    dailyUsage: 300,
  },
  {
    name: 'no usage data - cannot predict depletion',
    supply: {
      supplyType: 'drum',
      supplyName: 'Drum Unit',
      currentLevel: 55,
      capacityPages: 100000,
      model: 'iR-ADV C5535',
      usageTrend: null,
      reorderThreshold: null,
    },
    dailyUsage: 0,
  },
  {
    name: 'no capacity recorded - depletion unknown but order still triggers',
    supply: {
      supplyType: 'toner',
      supplyName: 'Magenta Toner',
      currentLevel: 8,
      capacityPages: null,
      model: 'bizhub C360i',
      reorderThreshold: 20,
    },
    dailyUsage: 90,
  },
  {
    name: 'exactly on the reorder threshold',
    supply: {
      supplyType: 'toner',
      supplyName: 'Yellow Toner',
      currentLevel: 20,
      capacityPages: 8000,
      model: 'bizhub C360i',
      reorderThreshold: 20,
    },
    dailyUsage: 50,
  },
  {
    name: 'empty object - every field absent',
    supply: {},
    dailyUsage: 0,
  },
];

// Newest-first, matching the service's orderBy desc(dateRecorded).
const HISTORY: edge.SupplyUsageReading[] = [
  { dateRecorded: '2026-08-19T00:00:00.000Z', pagesSinceLastReading: 140 },
  { dateRecorded: '2026-08-12T00:00:00.000Z', pagesSinceLastReading: 980 },
  { dateRecorded: '2026-08-05T00:00:00.000Z', pagesSinceLastReading: 0 },
  { dateRecorded: '2026-07-21T00:00:00.000Z', pagesSinceLastReading: 1220 },
];

describe('supply analysis parity (Express service vs edge _shared)', () => {
  describe('buildSupplyAnalysisPrompt', () => {
    for (const { name, supply } of SUPPLIES) {
      it(`renders identical prompt text: ${name}`, () => {
        expect(edge.buildSupplyAnalysisPrompt(supply, HISTORY, NOW)).toBe(
          node.buildSupplyAnalysisPrompt(supply, HISTORY, NOW),
        );
      });

      it(`renders identical prompt text with no history: ${name}`, () => {
        expect(edge.buildSupplyAnalysisPrompt(supply, [], NOW)).toBe(
          node.buildSupplyAnalysisPrompt(supply, [], NOW),
        );
      });
    }
  });

  describe('heuristicSupplyAnalysis', () => {
    for (const { name, supply, dailyUsage } of SUPPLIES) {
      it(`returns an identical result: ${name}`, () => {
        expect(edge.heuristicSupplyAnalysis(supply, dailyUsage, NOW)).toEqual(
          node.heuristicSupplyAnalysis(supply, dailyUsage, NOW),
        );
      });
    }
  });

  describe('priority banding', () => {
    // Every boundary and one either side: this decides order urgency.
    const days = [null, 0, 1, 3, 4, 7, 8, 14, 15, 30, 31, 400];
    for (const d of days) {
      it(`agrees on the band at ${d === null ? 'null' : d} days`, () => {
        expect(edge.supplyPriorityFor(d)).toBe(node.supplyPriorityFor(d));
      });
    }
  });

  describe('calculateAverageUsage', () => {
    const cases: Array<{ name: string; history: edge.SupplyUsageReading[] }> = [
      { name: 'typical history', history: HISTORY },
      { name: 'single reading', history: [HISTORY[0]] },
      { name: 'empty', history: [] },
      {
        name: 'all zero readings',
        history: [
          { dateRecorded: '2026-08-19T00:00:00.000Z', pagesSinceLastReading: 0 },
          { dateRecorded: '2026-08-01T00:00:00.000Z', pagesSinceLastReading: 0 },
        ],
      },
      {
        name: 'same-day readings - zero days covered',
        history: [
          { dateRecorded: '2026-08-19T00:00:00.000Z', pagesSinceLastReading: 10 },
          { dateRecorded: '2026-08-19T00:00:00.000Z', pagesSinceLastReading: 20 },
        ],
      },
    ];
    for (const { name, history } of cases) {
      it(`agrees: ${name}`, () => {
        expect(edge.calculateAverageUsage(history)).toBe(node.calculateAverageUsage(history));
      });
    }
  });
});
