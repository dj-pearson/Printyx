/**
 * Pure helpers for the universal-search endpoint (CR-029).
 *
 * The route runs its 6 entity sub-queries in parallel (Promise.all) and caches
 * assembled results per tenant+query; these helpers hold the deterministic,
 * unit-testable pieces: result ranking and the tenant-scoped cache key.
 */

export interface RankedResult {
  relevance: number;
}

/** Sort by descending relevance and cap to `limit` (stable for equal scores). */
export function sortAndLimitResults<T extends RankedResult>(results: T[], limit: number): T[] {
  return [...results].sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

/**
 * Tenant-scoped cache key for a search. Tenant id is the first segment so a
 * query can never read another tenant's cached results; the query is lowercased
 * and trimmed so trivially-different inputs share a cache entry.
 */
export function buildSearchCacheKey(
  tenantId: string | number,
  query: string,
  limit: number,
): string {
  return `usearch:${tenantId}:${limit}:${query.trim().toLowerCase()}`;
}

/**
 * Run an optional sub-search, swallowing errors (some tables may not exist in
 * every deployment) so one missing entity can't fail the whole search. Returns
 * [] and reports the failure via `onError` instead of throwing.
 */
export async function safeSearch<T>(
  fn: () => Promise<T[]>,
  label: string,
  onError: (label: string, error: unknown) => void,
): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    onError(label, error);
    return [];
  }
}
