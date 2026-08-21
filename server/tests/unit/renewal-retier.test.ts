// Renewal re-tier math: which CPC band a projected monthly volume falls into.
//
// This used to be a PARITY test between two copies - Express's
// server/routes-renewal-autoquote.ts and the Deno
// supabase/functions/_shared/renewal-retier.ts. PROD-008b retired the Express
// routes (they were shadowed by the /api/renewal-autoquote proxy and had not
// run on either host), which leaves one implementation, so comparing it against
// a fossil would prove nothing. The cases below are kept and their expected
// values are now stated OUTRIGHT, derived from the tier bands rather than from
// whatever the code returns - a snapshot of the implementation would happily
// lock in a wrong number.
//
// The stakes are why the coverage stays: this decides the rate on a renewal
// quote, so a wrong band quotes a real customer a wrong price.
import { describe, it, expect } from 'vitest';
import { num, pickTier, type CpcTier } from '../../../supabase/functions/_shared/renewal-retier';

const TIERS: CpcTier[] = [
  { minVolume: 0, maxVolume: 5000, cpc: 0.012 },
  { minVolume: 5001, maxVolume: 20000, cpc: 0.009 },
  { minVolume: 20001, maxVolume: null, cpc: 0.006 },
];

describe('num', () => {
  // Anything that is not a finite number becomes 0. Callers multiply by this,
  // so a NaN leaking through would produce a NaN price on a quote.
  it.each([
    ['null', null, 0],
    ['undefined', undefined, 0],
    ['zero', 0, 0],
    ['a number', 42, 42],
    ['a numeric string', '0.0125', 0.0125],
    ['an empty string', '', 0],
    ['a non-numeric string', 'not-a-number', 0],
    ['NaN', NaN, 0],
    ['Infinity', Infinity, 0],
    ['a padded numeric string', '  7.5  ', 7.5],
  ])('coerces %s', (_label, input, expected) => {
    expect(num(input)).toBe(expected);
  });
});

describe('pickTier', () => {
  // Expected CPC read off the bands above, not off the implementation:
  // 0-5000 -> 0.012, 5001-20000 -> 0.009, 20001+ -> 0.006.
  it.each([
    [0, 0.012],
    [1, 0.012],
    [4999, 0.012],
    [5000, 0.012],
    [5001, 0.009],
    [12000, 0.009],
    [20000, 0.009],
    [20001, 0.006],
    [999999, 0.006],
  ])('volume %i falls in the band charging %f', (volume, cpc) => {
    expect(pickTier(TIERS, volume)?.cpc).toBe(cpc);
  });

  it('treats both band edges as inclusive', () => {
    // 5000 is the top of the first band and 5001 the bottom of the second, so
    // there is no gap between them for a volume to fall through.
    expect(pickTier(TIERS, 5000)?.cpc).toBe(0.012);
    expect(pickTier(TIERS, 5001)?.cpc).toBe(0.009);
  });

  it('uses the highest band for a volume above every range', () => {
    // No open-ended tier here: 10,000 is off the top of a 0-200 ladder. Falling
    // back to the highest band is what keeps a high-volume contract priced at
    // all rather than returning null and silently keeping the old rate.
    const bounded: CpcTier[] = [
      { minVolume: 0, maxVolume: 100, cpc: 0.02 },
      { minVolume: 101, maxVolume: 200, cpc: 0.01 },
    ];
    expect(pickTier(bounded, 10_000)?.cpc).toBe(0.01);
  });

  it('returns null when there are no tiers, so callers keep the current rate', () => {
    expect(pickTier([], 5000)).toBeNull();
  });

  it('is order-independent - unsorted input picks the same band', () => {
    // Tiers arrive from a database with no ORDER BY guarantee.
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]];
    for (const volume of [0, 1, 4999, 5000, 5001, 12000, 20000, 20001, 999999]) {
      expect(pickTier(shuffled, volume)).toEqual(pickTier(TIERS, volume));
    }
  });

  it('reads a null maxVolume as open-ended, not as zero', () => {
    // `maxVolume: null` on the top tier is what makes it catch everything above
    // 20000; treating null as 0 would make that band match nothing.
    expect(pickTier(TIERS, 10_000_000)?.cpc).toBe(0.006);
  });
});
