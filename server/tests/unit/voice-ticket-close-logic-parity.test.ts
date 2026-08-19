// Locks the spoken-part → SKU matcher across both backends.
//
// On confirm, the chosen SKU's quantity is DEDUCTED FROM THE TECHNICIAN'S TRUCK,
// so a drift between server/routes-voice-ticket-close.ts and
// _shared/voice-ticket-close-logic.ts would take the wrong part off the truck —
// or auto-select where the tech should have been asked to disambiguate.
import { describe, it, expect } from 'vitest';
import {
  fuzzyScore as expressScore,
  rankSkuCandidates as expressRank,
} from '../../routes-voice-ticket-close';
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

  it.each(PAIRS)('fuzzyScore(%s, %s) agrees', (a, b) => {
    expect(edgeScore(a, b)).toBe(expressScore(a, b));
  });

  it('scores an exact match at 1 and an unrelated term at 0', () => {
    expect(edgeScore('toner', 'toner')).toBe(1);
    expect(edgeScore('zzz', 'Black Toner TN-514K')).toBe(0);
  });

  it.each(SPOKEN)('rankSkuCandidates agrees for: "%s"', (spoken) => {
    expect(edgeRank(spoken, INVENTORY)).toEqual(expressRank(spoken, INVENTORY));
  });

  it.each([1, 2, 3, 5])('rankSkuCandidates agrees at topN=%i', (topN) => {
    expect(edgeRank('toner', INVENTORY, topN)).toEqual(expressRank('toner', INVENTORY, topN));
  });

  it('skips rows with no part number', () => {
    const { candidates } = edgeRank('no part number', INVENTORY);
    expect(candidates.every((c) => c.sku !== '')).toBe(true);
  });

  it('returns nothing for an empty spoken term', () => {
    expect(edgeRank('', INVENTORY)).toEqual({ candidates: [], chosenSku: null });
    expect(edgeRank('   ', INVENTORY)).toEqual(expressRank('   ', INVENTORY));
  });

  it('auto-selects only above the threshold, and asks otherwise', () => {
    const strong = edgeRank('TN-514K', INVENTORY);
    expect(strong.chosenSku).toBe('TN-514K');
    expect(strong.candidates[0].score).toBeGreaterThanOrEqual(SKU_AUTO_MATCH_THRESHOLD);

    const none = edgeRank('a part we do not stock', INVENTORY);
    expect(none.chosenSku).toBeNull();
    expect(none).toEqual(expressRank('a part we do not stock', INVENTORY));
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
    expect(result).toEqual(expressRank(spoken, INVENTORY));
  });

  it('auto-selects just above the threshold', () => {
    // 0.5 from the substring hit alone — the nearest case above the bound.
    const result = edgeRank('imaging drum replacement part', INVENTORY);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(SKU_AUTO_MATCH_THRESHOLD);
    expect(result.chosenSku).toBe('DR-512');
  });

  // Recorded, not asserted around: a single word that appears in a description
  // scores 1 (0.5 substring + 0.5 full token overlap), so saying just
  // "cartridge" auto-selects the first toner. Shared behaviour on both sides; a
  // fix belongs in both copies at once.
  it('scores a single common word at 1, auto-selecting the first match', () => {
    const result = edgeRank('cartridge', INVENTORY);
    expect(result.candidates[0].score).toBe(1);
    expect(result.chosenSku).toBe('TN-514K');
    expect(result).toEqual(expressRank('cartridge', INVENTORY));
  });

  it('ranks candidates by descending score', () => {
    const { candidates } = edgeRank('toner', INVENTORY);
    const scores = candidates.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('agrees on an empty inventory', () => {
    expect(edgeRank('toner', [])).toEqual(expressRank('toner', []));
    expect(edgeRank('toner', []).chosenSku).toBeNull();
  });
});
