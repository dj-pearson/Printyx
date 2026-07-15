import { describe, it, expect, vi } from 'vitest';
import { sortAndLimitResults, buildSearchCacheKey, safeSearch } from '../../lib/universal-search';

describe('sortAndLimitResults (CR-029)', () => {
  it('orders by descending relevance and caps to limit', () => {
    const input = [
      { id: 'a', relevance: 5 },
      { id: 'b', relevance: 12 },
      { id: 'c', relevance: 8 },
      { id: 'd', relevance: 1 },
    ];
    const out = sortAndLimitResults(input, 2);
    expect(out.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { id: 'a', relevance: 1 },
      { id: 'b', relevance: 2 },
    ];
    sortAndLimitResults(input, 10);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('buildSearchCacheKey (CR-029/CR-031)', () => {
  it('puts tenant first and normalizes the query', () => {
    expect(buildSearchCacheKey('tenant-1', '  Acme  ', 20)).toBe('usearch:tenant-1:20:acme');
  });

  it('separates tenants so one cannot read anothers cache', () => {
    const a = buildSearchCacheKey('t1', 'acme', 20);
    const b = buildSearchCacheKey('t2', 'acme', 20);
    expect(a).not.toBe(b);
  });

  it('varies by limit', () => {
    expect(buildSearchCacheKey('t1', 'acme', 10)).not.toBe(buildSearchCacheKey('t1', 'acme', 20));
  });
});

describe('safeSearch (CR-029)', () => {
  it('returns the query result on success', async () => {
    const onError = vi.fn();
    const rows = await safeSearch(async () => [{ id: 1 }], 'quotes', onError);
    expect(rows).toEqual([{ id: 1 }]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('degrades to [] and reports on failure (missing table) without throwing', async () => {
    const onError = vi.fn();
    const rows = await safeSearch(
      async () => {
        throw new Error('relation "quotes" does not exist');
      },
      'quotes',
      onError,
    );
    expect(rows).toEqual([]);
    expect(onError).toHaveBeenCalledWith('quotes', expect.any(Error));
  });
});
