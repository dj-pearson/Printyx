// Locks the two copies of the renewal re-tier math together.
//
// server/routes-renewal-autoquote.ts (Express) and
// supabase/functions/_shared/renewal-retier.ts (Deno) each own a copy of
// num()/pickTier(). They decide which CPC band a projected monthly volume falls
// into, so a divergence would quote DIFFERENT RATES for the same contract
// depending on which backend served the request — a wrong number presented as a
// real one, which is worse than an outage.
//
// Every case runs through both implementations and asserts they agree.
import { describe, it, expect } from 'vitest';
import { num as expressNum, pickTier as expressPickTier } from '../../routes-renewal-autoquote';
import {
  num as edgeNum,
  pickTier as edgePickTier,
  type CpcTier,
} from '../../../supabase/functions/_shared/renewal-retier';

const TIERS: CpcTier[] = [
  { minVolume: 0, maxVolume: 5000, cpc: 0.012 },
  { minVolume: 5001, maxVolume: 20000, cpc: 0.009 },
  { minVolume: 20001, maxVolume: null, cpc: 0.006 },
];

describe('renewal re-tier math parity', () => {
  const numCases: unknown[] = [
    null,
    undefined,
    0,
    42,
    '0.0125',
    '',
    'not-a-number',
    NaN,
    Infinity,
    '  7.5  ',
  ];

  it.each(numCases.map((v) => [JSON.stringify(v) ?? String(v), v]))(
    'num(%s) agrees across backends',
    (_label, value) => {
      expect(edgeNum(value)).toBe(expressNum(value));
    },
  );

  it('num coerces the way both callers depend on', () => {
    expect(edgeNum(null)).toBe(0);
    expect(edgeNum('not-a-number')).toBe(0);
    expect(edgeNum(Infinity)).toBe(0);
    expect(edgeNum('0.0125')).toBe(0.0125);
  });

  const volumes = [0, 1, 4999, 5000, 5001, 12000, 20000, 20001, 999999];

  it.each(volumes)('pickTier at volume %i agrees across backends', (vol) => {
    expect(edgePickTier(TIERS, vol)).toEqual(expressPickTier(TIERS, vol));
  });

  it('selects the band containing the volume', () => {
    expect(edgePickTier(TIERS, 3000)?.cpc).toBe(0.012);
    expect(edgePickTier(TIERS, 10000)?.cpc).toBe(0.009);
    expect(edgePickTier(TIERS, 50000)?.cpc).toBe(0.006);
  });

  it('falls back to the highest band above every range', () => {
    const bounded: CpcTier[] = [
      { minVolume: 0, maxVolume: 100, cpc: 0.02 },
      { minVolume: 101, maxVolume: 200, cpc: 0.01 },
    ];
    expect(edgePickTier(bounded, 10_000)).toEqual(expressPickTier(bounded, 10_000));
    expect(edgePickTier(bounded, 10_000)?.cpc).toBe(0.01);
  });

  it('returns null when there are no tiers, so callers keep the current rate', () => {
    expect(edgePickTier([], 5000)).toBeNull();
    expect(expressPickTier([], 5000)).toBeNull();
  });

  it('is order-independent — unsorted input picks the same band', () => {
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]];
    for (const vol of volumes) {
      expect(edgePickTier(shuffled, vol)).toEqual(edgePickTier(TIERS, vol));
    }
  });
});
