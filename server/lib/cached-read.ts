/**
 * Small get-or-compute wrapper around a CacheService with hit/miss metrics and
 * logging (CR-031). Centralizes the "check cache → compute → store" pattern so
 * expensive read endpoints get consistent, observable caching.
 */
import type { CacheService } from '../cache-service';
import { createModuleLogger } from './logger';

const log = createModuleLogger('cached-read');

interface CacheMetric {
  hits: number;
  misses: number;
}

const metrics = new Map<string, CacheMetric>();

function record(namespace: string, hit: boolean): void {
  const m = metrics.get(namespace) ?? { hits: 0, misses: 0 };
  if (hit) m.hits += 1;
  else m.misses += 1;
  metrics.set(namespace, m);
}

/** Snapshot of hit/miss counts per namespace (for a metrics endpoint or tests). */
export function getCacheMetrics(): Record<string, CacheMetric & { hitRate: number }> {
  const out: Record<string, CacheMetric & { hitRate: number }> = {};
  for (const [ns, m] of metrics.entries()) {
    const total = m.hits + m.misses;
    out[ns] = { ...m, hitRate: total > 0 ? m.hits / total : 0 };
  }
  return out;
}

/** Reset metrics (test helper). */
export function resetCacheMetrics(): void {
  metrics.clear();
}

/**
 * Return the cached value for `key` if present, otherwise run `compute`, store
 * the result under `key` with `ttlSeconds`, and return it. `namespace` groups
 * hit/miss metrics (e.g. 'universal-search'); `onOutcome` lets the caller set a
 * response header (X-Cache) without importing this module's internals.
 */
export async function cachedRead<T>(
  cache: CacheService,
  namespace: string,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  onOutcome?: (outcome: 'HIT' | 'MISS') => void,
): Promise<T> {
  const cached = (await cache.get(key)) as T | null;
  if (cached !== null && cached !== undefined) {
    record(namespace, true);
    log.debug('cache hit', { namespace, key });
    onOutcome?.('HIT');
    return cached;
  }

  record(namespace, false);
  log.debug('cache miss', { namespace, key });
  onOutcome?.('MISS');
  const value = await compute();
  await cache.set(key, value, ttlSeconds);
  return value;
}
