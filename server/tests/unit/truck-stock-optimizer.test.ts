/**
 * PROD-011 — pure logic behind the truck-stock edge function
 * (supabase/functions/truck-stock/optimizer.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  CSV_HEADER,
  DEFAULT_MAX_DISTINCT_SKUS,
  DEFAULT_MAX_TOTAL_QUANTITY,
  buildCostMap,
  buildPickListCsv,
  computeStats,
  countRecommendedAdditions,
  csvEscape,
  fillRate,
  latestPerTech,
  num,
  parseCallback,
  parseGenerate,
  parseSettingsInput,
  resolveTechNames,
  selectRecommendedItems,
  tallyUsage,
  techDisplayName,
  toCamelInventory,
  toCamelRecommendation,
  toCamelSettings,
} from '../../../supabase/functions/truck-stock/optimizer';

const stock = (entries: Array<[string, number]>) => new Map(entries);

describe('num', () => {
  it('passes numbers through and parses numeric strings', () => {
    expect(num(12)).toBe(12);
    // Numeric columns arrive as strings over PostgREST.
    expect(num('12.5')).toBe(12.5);
  });

  it('maps null, undefined and garbage to 0', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num({})).toBe(0);
  });
});

describe('tallyUsage', () => {
  it('counts each SKU occurrence across tickets', () => {
    const { usage } = tallyUsage([{ parts_used: ['FK-1', 'DR-2'] }, { parts_used: ['FK-1'] }]);
    expect(usage.get('FK-1')).toBe(2);
    expect(usage.get('DR-2')).toBe(1);
  });

  it('counts a SKU used twice in ONE job twice, and records the per-job count', () => {
    // Two of the same part on one job means the truck needs two, not one.
    const { usage, partsJobs } = tallyUsage([{ parts_used: ['FK-1', 'FK-1'] }]);
    expect(usage.get('FK-1')).toBe(2);
    expect(partsJobs[0].get('FK-1')).toBe(2);
  });

  it('SKIPS tickets that used no parts', () => {
    // Counting them as trivially covered would push the fill rate toward 100%
    // for a tech who mostly does no-part visits.
    const { partsJobs } = tallyUsage([
      { parts_used: [] },
      { parts_used: null },
      { parts_used: ['FK-1'] },
    ]);
    expect(partsJobs).toHaveLength(1);
  });

  it('trims SKUs and drops blank or non-string entries', () => {
    const { usage } = tallyUsage([{ parts_used: ['  FK-1  ', '   ', 42, null, 'FK-1'] }]);
    expect(usage.get('FK-1')).toBe(2);
    expect(usage.size).toBe(1);
  });

  it('tolerates parts_used that is not an array', () => {
    expect(tallyUsage([{ parts_used: 'FK-1' }]).partsJobs).toEqual([]);
  });
});

describe('fillRate', () => {
  const jobA = new Map([['FK-1', 1]]);
  const jobB = new Map([
    ['FK-1', 1],
    ['DR-2', 1],
  ]);

  it('is the percentage of fully covered jobs, to one decimal', () => {
    expect(fillRate([jobA, jobB], stock([['FK-1', 5]]))).toBe(50);
    expect(
      fillRate(
        [jobA, jobB],
        stock([
          ['FK-1', 5],
          ['DR-2', 5],
        ]),
      ),
    ).toBe(100);
  });

  it('gives NO partial credit — a job missing one part is not covered', () => {
    // The tech still drove back to base, so 3-of-4 parts is not 75% avoided.
    expect(fillRate([jobB], stock([['FK-1', 99]]))).toBe(0);
  });

  it('requires enough QUANTITY, not just presence', () => {
    const twoOfOne = new Map([['FK-1', 2]]);
    expect(fillRate([twoOfOne], stock([['FK-1', 1]]))).toBe(0);
    expect(fillRate([twoOfOne], stock([['FK-1', 2]]))).toBe(100);
  });

  it('is 0 with no parts jobs — an empty history is not evidence of coverage', () => {
    expect(fillRate([], stock([['FK-1', 99]]))).toBe(0);
  });

  it('rounds to one decimal', () => {
    const jobs = [jobA, jobA, jobB];
    expect(fillRate(jobs, stock([['FK-1', 9]]))).toBe(66.7);
  });
});

describe('selectRecommendedItems', () => {
  const costMap = new Map([['FK-1', { unitCost: 12.5, description: 'Fuser kit' }]]);

  it('takes the most-used SKUs first', () => {
    const { items } = selectRecommendedItems({
      usage: new Map([
        ['RARE', 1],
        ['COMMON', 9],
        ['MID', 4],
      ]),
      currentStock: new Map(),
      costMap: new Map(),
      capacityTotal: 100,
      capacityDistinct: 10,
    });
    expect(items.map((i) => i.sku)).toEqual(['COMMON', 'MID', 'RARE']);
  });

  it('recommends the 90-day usage count as the quantity', () => {
    const { items } = selectRecommendedItems({
      usage: new Map([['FK-1', 6]]),
      currentStock: new Map(),
      costMap,
      capacityTotal: 100,
      capacityDistinct: 10,
    });
    expect(items[0]).toMatchObject({
      sku: 'FK-1',
      recommendedQty: 6,
      usage90d: 6,
      unitCost: 12.5,
      description: 'Fuser kit',
    });
  });

  it('falls back to the SKU as its own description and cost 0 when unmatched', () => {
    // An unknown part is still worth stocking.
    const { items } = selectRecommendedItems({
      usage: new Map([['MYSTERY', 3]]),
      currentStock: new Map(),
      costMap,
      capacityTotal: 100,
      capacityDistinct: 10,
    });
    expect(items[0].description).toBe('MYSTERY');
    expect(items[0].unitCost).toBe(0);
  });

  it('reports a SIGNED delta so overstock shows up too', () => {
    const { items } = selectRecommendedItems({
      usage: new Map([['FK-1', 2]]),
      currentStock: new Map([['FK-1', 5]]),
      costMap,
      capacityTotal: 100,
      capacityDistinct: 10,
    });
    expect(items[0].currentQty).toBe(5);
    expect(items[0].delta).toBe(-3);
  });

  it('stops at the distinct-SKU cap', () => {
    const { items } = selectRecommendedItems({
      usage: new Map([
        ['A', 5],
        ['B', 4],
        ['C', 3],
      ]),
      currentStock: new Map(),
      costMap: new Map(),
      capacityTotal: 1000,
      capacityDistinct: 2,
    });
    expect(items.map((i) => i.sku)).toEqual(['A', 'B']);
  });

  it('TRUNCATES the last SKU to the remaining space rather than dropping it', () => {
    // Filling the truck beats leaving an unusable gap.
    const { items } = selectRecommendedItems({
      usage: new Map([
        ['A', 8],
        ['B', 8],
      ]),
      currentStock: new Map(),
      costMap: new Map(),
      capacityTotal: 10,
      capacityDistinct: 10,
    });
    expect(items.map((i) => [i.sku, i.recommendedQty])).toEqual([
      ['A', 8],
      ['B', 2],
    ]);
  });

  it('returns nothing for zero capacity', () => {
    const { items } = selectRecommendedItems({
      usage: new Map([['A', 5]]),
      currentStock: new Map(),
      costMap: new Map(),
      capacityTotal: 0,
      capacityDistinct: 10,
    });
    expect(items).toEqual([]);
  });

  it('returns a recommendedStock map matching the items', () => {
    const { recommendedStock } = selectRecommendedItems({
      usage: new Map([['A', 5]]),
      currentStock: new Map(),
      costMap: new Map(),
      capacityTotal: 100,
      capacityDistinct: 10,
    });
    expect(recommendedStock.get('A')).toBe(5);
  });
});

describe('buildCostMap', () => {
  const items = [
    { part_number: 'FK-1', name: 'Fuser', item_description: 'Fuser kit', unit_cost: '12.50' },
    { part_number: 'ZZ-9', name: 'DR-2', item_description: null, unit_cost: 3 },
  ];

  it('matches on part_number OR name', () => {
    const map = buildCostMap(items, ['FK-1', 'DR-2']);
    expect(map.get('FK-1')?.unitCost).toBe(12.5);
    expect(map.get('DR-2')?.unitCost).toBe(3);
  });

  it('falls back to name, then the SKU, for the description', () => {
    expect(buildCostMap(items, ['FK-1']).get('FK-1')?.description).toBe('Fuser kit');
    // No item_description, so the name is used.
    expect(buildCostMap(items, ['DR-2']).get('DR-2')?.description).toBe('DR-2');
  });

  it('keeps the FIRST match, so a later row cannot overwrite it', () => {
    const dupes = [
      { part_number: 'FK-1', name: 'A', item_description: 'first', unit_cost: 1 },
      { part_number: 'FK-1', name: 'B', item_description: 'second', unit_cost: 999 },
    ];
    expect(buildCostMap(dupes, ['FK-1'])).toEqual(
      new Map([['FK-1', { unitCost: 1, description: 'first' }]]),
    );
  });

  it('omits SKUs that were not asked for or did not match', () => {
    const map = buildCostMap(items, ['FK-1']);
    expect(map.has('DR-2')).toBe(false);
    expect(buildCostMap(items, ['NOPE']).size).toBe(0);
  });
});

describe('latestPerTech', () => {
  it('keeps the FIRST row per tech, so rows must be newest-first', () => {
    // A wrong sort silently surfaces a stale recommendation as the current one.
    const rows = [
      { tech_user_id: 't1', generated_at: '2026-08-07' },
      { tech_user_id: 't1', generated_at: '2026-07-01' },
      { tech_user_id: 't2', generated_at: '2026-08-01' },
    ];
    expect(latestPerTech(rows).map((r) => r.generated_at)).toEqual(['2026-08-07', '2026-08-01']);
  });

  it('is empty for no rows', () => {
    expect(latestPerTech([])).toEqual([]);
  });
});

describe('techDisplayName / resolveTechNames', () => {
  it('joins the name parts and tolerates a missing one', () => {
    expect(techDisplayName({ first_name: 'Ada', last_name: 'Lovelace' })).toBe('Ada Lovelace');
    expect(techDisplayName({ first_name: 'Ada', last_name: null })).toBe('Ada');
  });

  it('is null when neither part is present, not an empty string', () => {
    expect(techDisplayName({})).toBeNull();
    expect(techDisplayName({ first_name: '  ', last_name: null })).toBeNull();
  });

  it('indexes by BOTH technicians.id and technicians.user_id', () => {
    // techUserId may be either — a documented stub in the original.
    const techs = [{ id: 'tech-1', user_id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' }];
    expect(resolveTechNames(techs, ['tech-1']).get('tech-1')).toBe('Ada Lovelace');
    expect(resolveTechNames(techs, ['user-1']).get('user-1')).toBe('Ada Lovelace');
  });

  it('omits techs with no usable name rather than mapping them to blank', () => {
    const techs = [{ id: 'tech-1', user_id: null, first_name: null, last_name: null }];
    expect(resolveTechNames(techs, ['tech-1']).size).toBe(0);
  });

  it('ignores techs that were not asked for', () => {
    const techs = [{ id: 'other', user_id: null, first_name: 'X', last_name: 'Y' }];
    expect(resolveTechNames(techs, ['tech-1']).size).toBe(0);
  });
});

describe('camelCase mappers', () => {
  it('maps a recommendation to the keys the page reads', () => {
    const out = toCamelRecommendation({
      id: 'r1',
      tenant_id: 't1',
      tech_user_id: 'tech-1',
      generated_at: '2026-08-07T00:00:00.000Z',
      current_fill_rate: '42.5',
      projected_fill_rate: '81',
      capacity_total: '120',
      capacity_distinct: '40',
      recommended_items: [{ sku: 'FK-1', delta: 2 }],
      status: 'draft',
      picked_at: null,
      received_at: null,
    });
    expect(out.currentFillRate).toBe(42.5);
    expect(out.projectedFillRate).toBe(81);
    expect(out.capacityTotal).toBe(120);
    expect(out.generatedAt).toBe('2026-08-07T00:00:00.000Z');
    expect(out.status).toBe('draft');
  });

  it('emits no snake_case keys', () => {
    for (const key of Object.keys(toCamelRecommendation({ id: 'r1' }))) {
      expect(key).not.toContain('_');
    }
  });

  it('leaves recommended_items jsonb untouched', () => {
    const items = [{ sku: 'FK-1', recommendedQty: 3, unitCost: 1.5 }];
    expect(toCamelRecommendation({ id: 'r1', recommended_items: items }).recommendedItems).toEqual(
      items,
    );
  });

  it('keeps a null fill rate null rather than coercing it to 0', () => {
    // 0% coverage and "not measured" are different claims.
    const out = toCamelRecommendation({ id: 'r1', current_fill_rate: null });
    expect(out.currentFillRate).toBeNull();
  });

  it('maps truck inventory rows', () => {
    const out = toCamelInventory({
      id: 'i1',
      tenant_id: 't1',
      tech_user_id: 'tech-1',
      part_sku: 'FK-1',
      quantity_on_truck: '7',
      last_audited_at: '2026-08-07T00:00:00.000Z',
    });
    expect(out.partSku).toBe('FK-1');
    expect(out.quantityOnTruck).toBe(7);
    expect(out.capacityConstraint).toBeNull();
  });

  it('maps settings and substitutes the capacity defaults when unset', () => {
    const out = toCamelSettings({ id: 's1', tenant_id: 't1', tech_user_id: 'tech-1' });
    expect(out.maxTotalQuantity).toBe(DEFAULT_MAX_TOTAL_QUANTITY);
    expect(out.maxDistinctSkus).toBe(DEFAULT_MAX_DISTINCT_SKUS);
    expect(toCamelSettings({ id: 's1', max_total_quantity: '55' }).maxTotalQuantity).toBe(55);
  });
});

describe('countRecommendedAdditions', () => {
  it('counts only the SKUs needing MORE', () => {
    expect(
      countRecommendedAdditions([{ delta: 3 }, { delta: 0 }, { delta: -2 }, { delta: 1 }]),
    ).toBe(2);
  });

  it('is 0 for a non-array or empty items blob', () => {
    expect(countRecommendedAdditions(null)).toBe(0);
    expect(countRecommendedAdditions('nope')).toBe(0);
    expect(countRecommendedAdditions([])).toBe(0);
  });

  it('tolerates a malformed item without throwing', () => {
    expect(countRecommendedAdditions([null, { delta: '4' }, {}])).toBe(1);
  });
});

describe('csvEscape / buildPickListCsv', () => {
  it('leaves plain values alone', () => {
    expect(csvEscape('FK-1')).toBe('FK-1');
  });

  it('quotes values containing a comma, quote or newline', () => {
    // A description with a comma would otherwise shift every later column of
    // the warehouse's pick list.
    expect(csvEscape('Fuser kit, 220V')).toBe('"Fuser kit, 220V"');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('doubles embedded quotes', () => {
    expect(csvEscape('Roller 3" wide')).toBe('"Roller 3"" wide"');
  });

  it('maps null and undefined to an empty field', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('emits the header even with no items', () => {
    expect(buildPickListCsv([])).toBe(CSV_HEADER.join(','));
    expect(buildPickListCsv(null)).toBe(CSV_HEADER.join(','));
  });

  it('writes one row per item with the cost to 2dp', () => {
    const csv = buildPickListCsv([
      {
        sku: 'FK-1',
        description: 'Fuser kit, 220V',
        currentQty: 1,
        recommendedQty: 4,
        delta: 3,
        unitCost: 12.5,
        usage90d: 4,
      },
    ]);
    expect(csv.split('\n')).toEqual([CSV_HEADER.join(','), 'FK-1,"Fuser kit, 220V",1,4,3,12.50']);
  });

  it('coerces missing numerics to 0 rather than writing undefined', () => {
    const csv = buildPickListCsv([{ sku: 'X' }]);
    expect(csv.split('\n')[1]).toBe('X,,0,0,0,0.00');
  });
});

describe('computeStats', () => {
  it('totals callbacks and groups them by tech', () => {
    const out = computeStats({
      callbacks: [
        { tech_user_id: 't1' },
        { tech_user_id: 't1' },
        { tech_user_id: 't2' },
        { tech_user_id: null },
      ],
      latestRecs: [],
    });
    expect(out.totalCallbacks).toBe(4);
    expect(out.callbacksByTech).toEqual([
      { techUserId: 't1', count: 2 },
      { techUserId: 't2', count: 1 },
      { techUserId: 'unassigned', count: 1 },
    ]);
  });

  it('averages the fill rates and reports the lift', () => {
    const out = computeStats({
      callbacks: [],
      latestRecs: [
        { current_fill_rate: 40, projected_fill_rate: 80 },
        { current_fill_rate: 60, projected_fill_rate: 90 },
      ],
    });
    expect(out.avgCurrentFillRate).toBe(50);
    expect(out.avgProjectedFillRate).toBe(85);
    expect(out.fillRateLift).toBe(35);
  });

  it('reports NULL averages with no recommendations, not 0', () => {
    // 0% coverage and "not measured" are different claims, and the dashboard
    // renders the former as a red number.
    const out = computeStats({ callbacks: [{ tech_user_id: 't1' }], latestRecs: [] });
    expect(out.avgCurrentFillRate).toBeNull();
    expect(out.avgProjectedFillRate).toBeNull();
    expect(out.fillRateLift).toBeNull();
    expect(out.recommendationCount).toBe(0);
  });

  it('handles a NEGATIVE lift — the optimizer can recommend worse coverage', () => {
    const out = computeStats({
      callbacks: [],
      latestRecs: [{ current_fill_rate: 80, projected_fill_rate: 60 }],
    });
    expect(out.fillRateLift).toBe(-20);
  });

  it('coerces string fill rates from PostgREST', () => {
    const out = computeStats({
      callbacks: [],
      latestRecs: [{ current_fill_rate: '33.3', projected_fill_rate: '66.6' }],
    });
    expect(out.avgCurrentFillRate).toBe(33.3);
    expect(out.fillRateLift).toBe(33.3);
  });
});

describe('parseGenerate', () => {
  it('accepts an empty body — that means "every tech"', () => {
    expect(parseGenerate({})).toEqual({ ok: true, value: {} });
  });

  it('carries a single tech through', () => {
    expect(parseGenerate({ techUserId: 't1' })).toEqual({ ok: true, value: { techUserId: 't1' } });
  });

  it('rejects an empty or non-string tech id', () => {
    expect(parseGenerate({ techUserId: '' }).ok).toBe(false);
    expect(parseGenerate({ techUserId: 7 }).ok).toBe(false);
  });
});

describe('parseSettingsInput', () => {
  it('requires techUserId', () => {
    expect(parseSettingsInput({}).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: '' }).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: 't1' }).ok).toBe(true);
  });

  it('bounds the capacities', () => {
    expect(parseSettingsInput({ techUserId: 't1', maxTotalQuantity: 0 }).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: 't1', maxTotalQuantity: 100_001 }).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: 't1', maxTotalQuantity: 1 }).ok).toBe(true);
    expect(parseSettingsInput({ techUserId: 't1', maxDistinctSkus: 10_001 }).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: 't1', maxDistinctSkus: 10_000 }).ok).toBe(true);
  });

  it('rejects a fractional or string capacity', () => {
    expect(parseSettingsInput({ techUserId: 't1', maxDistinctSkus: 2.5 }).ok).toBe(false);
    expect(parseSettingsInput({ techUserId: 't1', maxDistinctSkus: '10' }).ok).toBe(false);
  });

  it('omits an unset capacity so the stored value is left alone', () => {
    const out = parseSettingsInput({ techUserId: 't1' });
    expect(out.ok && 'maxTotalQuantity' in out.value).toBe(false);
  });
});

describe('parseCallback', () => {
  it('accepts an empty body — every field is optional', () => {
    expect(parseCallback({})).toEqual({ ok: true, value: {} });
  });

  it('carries the fields through', () => {
    expect(parseCallback({ techUserId: 't1', missingPartSku: 'FK-1' })).toEqual({
      ok: true,
      value: { techUserId: 't1', missingPartSku: 'FK-1' },
    });
  });

  it('rejects an empty string rather than storing it', () => {
    expect(parseCallback({ missingPartSku: '' }).ok).toBe(false);
    expect(parseCallback({ ticketId: 5 }).ok).toBe(false);
  });

  it('caps the note at 1000 characters', () => {
    expect(parseCallback({ note: 'x'.repeat(1000) }).ok).toBe(true);
    expect(parseCallback({ note: 'x'.repeat(1001) }).ok).toBe(false);
  });

  it('allows an EMPTY note, unlike the id fields', () => {
    expect(parseCallback({ note: '' })).toEqual({ ok: true, value: { note: '' } });
  });
});
