// Pins the spoken-part → SKU matcher.
//
// On confirm, the chosen SKU's quantity is DEDUCTED FROM THE TECHNICIAN'S TRUCK,
// so a wrong match takes the wrong part off the truck — or auto-selects where the
// tech should have been asked to disambiguate.
//
// PROD-008b: this used to lock _shared/voice-ticket-close-logic.ts against a
// second copy in server/routes-voice-ticket-close.ts. That copy is retired, so
// the cross-backend assertions are gone; what remains pins the surviving matcher's
// behaviour directly, which is what actually protects the truck count.
import { describe, it, expect } from 'vitest';
import {
  fuzzyScore as edgeScore,
  rankSkuCandidates as edgeRank,
  SKU_AUTO_MATCH_THRESHOLD,
} from '../../../supabase/functions/_shared/voice-ticket-close-logic';

const INVENTORY = [
  { partNumber: 'TN-514K', name: 'Black Toner TN-514K', itemDescription: 'Toner cartridge black' },
  { partNumber: 'TN-514C', name: 'Cyan Toner TN-514C', itemDescription: 'Toner cartridge cyan' },
  { partNumber: 'DR-512', name: 'Drum Unit DR-512', itemDescription: 'Imaging drum' },
  { partNumber: 'FK-514', name: 'Fuser Kit', itemDescription: 'Fuser maintenance kit' },
  { partNumber: '', name: 'No part number', itemDescription: 'should be skipped' },
];

const SPOKEN = [
  '',
  '   ',
  'black toner',
  'TN-514K',
  'tn-514k',
  'toner',
  'drum',
  'drum unit',
  'fuser kit',
  'fuser',
  'a part we do not stock',
  'Toner cartridge black',
  'cyan',
];

describe('voice ticket close SKU matcher parity', () => {
  const PAIRS: Array<[string, string]> = [
    ['', 'anything'],
    ['toner', ''],
    ['toner', 'toner'],
    ['black toner', 'Black Toner TN-514K'],
    ['TN-514K', 'tn-514k'],
    ['drum', 'Imaging drum'],
    ['fuser kit maintenance', 'Fuser maintenance kit'],
    ['zzz', 'Black Toner TN-514K'],
  ];

  it.each(PAIRS)('fuzzyScore(%s, %s) is deterministic and within [0, 1]', (a, b) => {
    const score = edgeScore(a, b);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(edgeScore(a, b)).toBe(score);
  });

  it('scores an exact match at 1 and an unrelated term at 0', () => {
    expect(edgeScore('toner', 'toner')).toBe(1);
    expect(edgeScore('zzz', 'Black Toner TN-514K')).toBe(0);
  });

  it.each(SPOKEN)('rankSkuCandidates holds its invariants for: "%s"', (spoken) => {
    const { candidates, chosenSku } = edgeRank(spoken, INVENTORY);
    // Descending by score, every candidate a real SKU.
    expect([...candidates.map((c) => c.score)].sort((a, b) => b - a)).toEqual(
      candidates.map((c) => c.score),
    );
    expect(candidates.every((c) => c.sku !== '')).toBe(true);
    // A chosen SKU is always the top candidate AND always clears the threshold —
    // this is the property that decides what leaves the truck.
    if (chosenSku !== null) {
      expect(chosenSku).toBe(candidates[0].sku);
      expect(candidates[0].score).toBeGreaterThanOrEqual(SKU_AUTO_MATCH_THRESHOLD);
    }
  });

  it.each([1, 2, 3, 5])('rankSkuCandidates returns at most topN=%i candidates', (topN) => {
    expect(edgeRank('toner', INVENTORY, topN).candidates.length).toBeLessThanOrEqual(topN);
  });

  it('skips rows with no part number', () => {
    const { candidates } = edgeRank('no part number', INVENTORY);
    expect(candidates.every((c) => c.sku !== '')).toBe(true);
  });

  it('returns nothing for an empty spoken term', () => {
    expect(edgeRank('', INVENTORY)).toEqual({ candidates: [], chosenSku: null });
    expect(edgeRank('   ', INVENTORY)).toEqual({ candidates: [], chosenSku: null });
  });

  it('auto-selects only above the threshold, and asks otherwise', () => {
    const strong = edgeRank('TN-514K', INVENTORY);
    expect(strong.chosenSku).toBe('TN-514K');
    expect(strong.candidates[0].score).toBeGreaterThanOrEqual(SKU_AUTO_MATCH_THRESHOLD);

    const none = edgeRank('a part we do not stock', INVENTORY);
    expect(none.chosenSku).toBeNull();
  });

  // The threshold is the whole auto-select-vs-ask decision, so it needs cases
  // that land INSIDE the band. Without these, a mutation moving the threshold
  // from 0.45 to 0.3 passed the suite — every other case scored 0, 0.75 or 1.
  const NEAR_THRESHOLD = [
    'toner cartridge for the black one', // 0.333 — below, must stay null
    'black cartridge please', // 0.333 — below
    'maintenance kit for fuser unit', // 0.300 — below, at the mutated bound
  ];

  it.each(NEAR_THRESHOLD)('does not auto-select a sub-threshold match: "%s"', (spoken) => {
    const result = edgeRank(spoken, INVENTORY);
    expect(result.candidates[0].score).toBeLessThan(SKU_AUTO_MATCH_THRESHOLD);
    expect(result.chosenSku).toBeNull();
  });

  it('auto-selects just above the threshold', () => {
    // 0.5 from the substring hit alone — the nearest case above the bound.
    const result = edgeRank('imaging drum replacement part', INVENTORY);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(SKU_AUTO_MATCH_THRESHOLD);
    expect(result.chosenSku).toBe('DR-512');
  });

  // A generic word still scores 1 against every matching part, but a tie no
  // longer auto-selects: it used to silently deduct the FIRST match from the
  // truck (black toner when the tech may have fitted cyan).
  it.each(['cartridge', 'toner'])('does not auto-select an ambiguous tie: "%s"', (spoken) => {
    const result = edgeRank(spoken, INVENTORY);
    expect(result.candidates[0].score).toBe(1);
    expect(result.candidates[1].score).toBe(1);
    expect(result.chosenSku).toBeNull();
  });

  it('still auto-selects when the top score is unambiguous', () => {
    expect(edgeRank('black toner', INVENTORY).chosenSku).toBe('TN-514K');
    expect(edgeRank('TN-514K', INVENTORY).chosenSku).toBe('TN-514K');
    expect(edgeRank('drum unit', INVENTORY).chosenSku).toBe('DR-512');
  });

  it('ranks candidates by descending score', () => {
    const { candidates } = edgeRank('toner', INVENTORY);
    const scores = candidates.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('returns nothing for an empty inventory', () => {
    expect(edgeRank('toner', [])).toEqual({ candidates: [], chosenSku: null });
  });
});
