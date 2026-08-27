// COP-M07 AC3: the forecast weights a deal by its stage, not by a column that
// defaults to 0.
//
// The bug this pins: `d.probability ?? stage.prob ?? 50` never fell through,
// because deals.probability DEFAULTS TO 0 rather than null. The stage's
// default_probability was fetched, mapped, and never used. On the demo tenant
// that made a $158,000 pipeline weight to $0.
import { describe, it, expect } from 'vitest';

import {
  DEAL_FALLBACK_PROBABILITY,
  resolveDealProbability,
} from '../../../supabase/functions/_shared/deal-probability';

const open = { prob: 50, isClosedWon: false, isClosedLost: false };

describe('resolveDealProbability', () => {
  it('uses the stage default when the deal column is the 0 default', () => {
    expect(resolveDealProbability(0, open)).toBe(50);
  });

  it('reproduces the exact case that weighted the demo pipeline to zero', () => {
    const deals = [45000, 85000, 28000];
    const weighted = deals.reduce(
      (sum, amount) => sum + amount * (resolveDealProbability(0, open) / 100),
      0,
    );
    expect(weighted).toBe(79000); // was 0
  });

  it('lets a rep override win when they actually set one', () => {
    expect(resolveDealProbability(85, open)).toBe(85);
    expect(resolveDealProbability(10, open)).toBe(10);
  });

  it('falls back to the stage when the deal has no value at all', () => {
    expect(resolveDealProbability(null, open)).toBe(50);
    expect(resolveDealProbability(undefined, open)).toBe(50);
  });

  it('forecasts a won stage at 100 regardless of a stale deal column', () => {
    expect(resolveDealProbability(30, { prob: 50, isClosedWon: true })).toBe(100);
    expect(resolveDealProbability(0, { prob: 50, isClosedWon: true })).toBe(100);
  });

  it('forecasts a lost stage at 0 regardless of an optimistic deal column', () => {
    expect(resolveDealProbability(90, { prob: 50, isClosedLost: true })).toBe(0);
  });

  it('clamps a nonsense value rather than forecasting at 250%', () => {
    expect(resolveDealProbability(250, open)).toBe(100);
    expect(resolveDealProbability(-40, open)).toBe(50); // negative reads as unset
  });

  it('uses the fallback only when the stage carries no weighting either', () => {
    expect(resolveDealProbability(0, undefined)).toBe(DEAL_FALLBACK_PROBABILITY);
    expect(resolveDealProbability(0, { prob: null })).toBe(DEAL_FALLBACK_PROBABILITY);
    expect(resolveDealProbability(0, undefined, 70)).toBe(70);
  });

  it('clamps a stage default that is itself out of range', () => {
    expect(resolveDealProbability(0, { prob: 300 })).toBe(100);
  });

  it('ignores a non-numeric deal value instead of producing NaN', () => {
    expect(resolveDealProbability(Number.NaN, open)).toBe(50);
  });
});
