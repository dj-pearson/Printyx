// COP-B09: territory resolution over a free-text column, and roll-ups that add up.
//
// The failures this prevents are quiet ones: two spellings of one territory
// reported as two, an account silently swept into Unassigned when it actually
// names a territory nobody defined, and a roll-up that omits unassigned rows so
// it stops matching the totals a manager sees everywhere else.
import { describe, it, expect } from 'vitest';

import {
  UNASSIGNED_TERRITORY,
  buildTerritoryIndex,
  normalizeTerritoryKey,
  resolveTerritory,
  rollupByTerritory,
  territoryCoverage,
  type TerritoryLike,
} from '../../../supabase/functions/_shared/territory';

const TERRITORIES: TerritoryLike[] = [
  { id: 't-north', territory_name: 'North Region', territory_code: 'NR', is_active: true },
  { id: 't-south', territory_name: 'South Region', territory_code: 'SR', is_active: true },
];
const INDEX = buildTerritoryIndex(TERRITORIES);

describe('normalizeTerritoryKey', () => {
  it('folds the spellings an import and a rep produce', () => {
    const key = normalizeTerritoryKey('North Region');
    for (const s of [
      'north region',
      'NORTH REGION',
      'North-Region',
      ' north  region ',
      'N.orthRegion',
    ]) {
      expect(normalizeTerritoryKey(s)).toBe(key);
    }
  });

  it('does NOT merge two territories that differ by a word', () => {
    // A dealer may genuinely run both. Merging them is the mistake this file
    // exists to avoid, and an alias is the explicit escape hatch.
    expect(normalizeTerritoryKey('North')).not.toBe(normalizeTerritoryKey('North Region'));
  });

  it('is empty for text with nothing to match on', () => {
    expect(normalizeTerritoryKey('')).toBe('');
    expect(normalizeTerritoryKey('  -- ')).toBe('');
    expect(normalizeTerritoryKey(null)).toBe('');
  });
});

describe('resolveTerritory', () => {
  it('matches on the name or the code', () => {
    expect(resolveTerritory('North Region', INDEX)?.territory?.id).toBe('t-north');
    expect(resolveTerritory('nr', INDEX)?.territory?.id).toBe('t-north');
  });

  it('KEEPS THE ACCOUNT’S OWN TEXT when nothing is defined for it', () => {
    const r = resolveTerritory('Mountain West', INDEX);
    expect(r?.territory).toBeNull();
    expect(r?.displayName).toBe('Mountain West');
  });

  it('is null for an account carrying no territory', () => {
    expect(resolveTerritory(null, INDEX)).toBeNull();
    expect(resolveTerritory('   ', INDEX)).toBeNull();
  });

  it('lets a CODE win over another territory’s name', () => {
    // A code is the deliberate identifier; a name collision must not shadow it.
    const odd: TerritoryLike[] = [
      { id: 't-a', territory_name: 'SR', territory_code: 'AA' },
      { id: 't-b', territory_name: 'South Region', territory_code: 'SR' },
    ];
    expect(resolveTerritory('SR', buildTerritoryIndex(odd))?.territory?.id).toBe('t-b');
  });
});

describe('territoryCoverage — a model that covers half the book should say so', () => {
  it('counts resolved, unmatched and unassigned SEPARATELY', () => {
    const coverage = territoryCoverage(
      [
        { territory: 'North Region' },
        { territory: 'NR' },
        { territory: 'Mountain West' },
        { territory: 'mountain west' },
        { territory: null },
        { territory: '' },
      ],
      INDEX,
    );
    expect(coverage.resolved).toBe(2);
    // Names a territory nobody defined: a definition or an alias fixes it.
    expect(coverage.unmatched).toEqual([{ key: 'mountainwest', name: 'Mountain West', count: 2 }]);
    // Names nothing at all: data entry fixes it. A different problem.
    expect(coverage.unassigned).toBe(2);
    expect(coverage.total).toBe(6);
  });

  it('reports full coverage as empty unmatched rather than silence', () => {
    const coverage = territoryCoverage([{ territory: 'NR' }, { territory: 'SR' }], INDEX);
    expect(coverage.unmatched).toEqual([]);
    expect(coverage.resolved).toBe(2);
  });

  it('claims nothing for an empty book', () => {
    expect(territoryCoverage([], INDEX)).toMatchObject({ resolved: 0, unassigned: 0, total: 0 });
  });
});

describe('rollupByTerritory', () => {
  const rows = [
    { id: 1, territory: 'North Region' },
    { id: 2, territory: 'NR' },
    { id: 3, territory: 'South Region' },
    { id: 4, territory: null },
    { id: 5, territory: 'Mountain West' },
  ];
  const rollup = () => rollupByTerritory(rows, (r) => r.territory, INDEX);

  it('groups two spellings of one territory into one row', () => {
    const north = rollup().find((g) => g.territoryId === 't-north');
    expect(north?.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('KEEPS AN EXPLICIT UNASSIGNED ROW rather than dropping those items', () => {
    // Omitting them is how a territory roll-up stops adding up to the total a
    // manager sees everywhere else, with nothing saying why.
    const unassigned = rollup().find((g) => g.territoryId === UNASSIGNED_TERRITORY);
    expect(unassigned?.items.map((i) => i.id)).toEqual([4]);
  });

  it('keeps an undefined territory under its own name, not in Unassigned', () => {
    const groups = rollup();
    const mountain = groups.find((g) => g.territoryName === 'Mountain West');
    expect(mountain?.items.map((i) => i.id)).toEqual([5]);
    expect(mountain?.territoryId).toBe(UNASSIGNED_TERRITORY);
  });

  it('accounts for every input row exactly once', () => {
    const total = rollup().reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(rows.length);
  });

  it('sorts Unassigned last — it is a data-quality row, not a territory', () => {
    const groups = rollup();
    expect(groups[groups.length - 1].territoryId).toBe(UNASSIGNED_TERRITORY);
  });

  it('handles an empty set without inventing a bucket', () => {
    expect(rollupByTerritory([], () => null, INDEX)).toEqual([]);
  });
});
