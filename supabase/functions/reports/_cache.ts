// In-memory TTL cache for report results.
//
// Per the master PRD: dashboards re-fetch the same reports frequently (page
// nav, tab switch). A naive no-cache path hammers Postgres. Edge instances
// are short-lived, so this is effectively per-instance memoization — no need
// to reach for Redis.
//
// Key format: `${tenantId}:${reportName}:${hashOfParams}`. Caller is
// responsible for the hash; `paramKey()` is a tiny helper for the common
// "stable JSON.stringify of an object" case.
//
// Eviction:
//   - TTL-based on read; expired entries are dropped lazily
//   - Hard cap (100 entries) with simple FIFO eviction so a runaway loop
//     can't blow out the heap on a long-lived isolate

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  insertedAt: number;
}

const MAX_ENTRIES = 100;

const store = new Map<string, CacheEntry<unknown>>();

export function get<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function set<T>(key: string, data: T, ttlSeconds: number): void {
  if (store.size >= MAX_ENTRIES) {
    // FIFO: drop the oldest entry. Iteration order on Map is insertion order.
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    insertedAt: Date.now(),
  });
}

export function clear(pattern?: string): number {
  if (!pattern) {
    const size = store.size;
    store.clear();
    return size;
  }
  let removed = 0;
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = get<T>(key);
  if (hit !== null) return hit;
  const data = await loader();
  set(key, data, ttlSeconds);
  return data;
}

export function paramKey(params: Record<string, unknown>): string {
  // Stable serialization — sort keys so { a: 1, b: 2 } and { b: 2, a: 1 }
  // produce the same cache key.
  const sortedKeys = Object.keys(params).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of sortedKeys) ordered[k] = params[k];
  return JSON.stringify(ordered);
}

export function snapshot(): { size: number; keys: string[] } {
  return { size: store.size, keys: [...store.keys()] };
}
