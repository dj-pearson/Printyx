import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedRead, getCacheMetrics, resetCacheMetrics } from '../../lib/cached-read';
import type { CacheService } from '../../cache-service';

/** Minimal in-memory CacheService double (no TTL expiry needed for these tests). */
function makeCache(): CacheService & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    async get(key: string) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key: string, value: any) {
      store.set(key, value);
    },
    async del(key: string) {
      store.delete(key);
    },
    async clear() {
      store.clear();
    },
    generateKey(...parts: string[]) {
      return parts.join(':');
    },
  };
}

describe('cachedRead (CR-031)', () => {
  beforeEach(() => resetCacheMetrics());

  it('computes and stores on a miss, then serves from cache on a hit', async () => {
    const cache = makeCache();
    const compute = vi.fn(async () => ({ value: 42 }));
    const outcomes: string[] = [];

    const first = await cachedRead(cache, 'ns', 'k1', 30, compute, (o) => outcomes.push(o));
    const second = await cachedRead(cache, 'ns', 'k1', 30, compute, (o) => outcomes.push(o));

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(compute).toHaveBeenCalledTimes(1); // second served from cache
    expect(outcomes).toEqual(['MISS', 'HIT']);
  });

  it('tracks hit/miss metrics per namespace with a hit rate', async () => {
    const cache = makeCache();
    const compute = vi.fn(async () => 'x');
    await cachedRead(cache, 'search', 'a', 30, compute); // miss
    await cachedRead(cache, 'search', 'a', 30, compute); // hit
    await cachedRead(cache, 'search', 'b', 30, compute); // miss

    const m = getCacheMetrics().search;
    expect(m.hits).toBe(1);
    expect(m.misses).toBe(2);
    expect(m.hitRate).toBeCloseTo(1 / 3);
  });

  it('recomputes when the cached value is null-equivalent absent', async () => {
    const cache = makeCache();
    let n = 0;
    const compute = vi.fn(async () => ++n);
    const a = await cachedRead(cache, 'ns', 'k', 30, compute);
    cache.store.delete('k'); // simulate TTL expiry
    const b = await cachedRead(cache, 'ns', 'k', 30, compute);
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
