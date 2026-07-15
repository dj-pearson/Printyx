/**
 * Pure helpers for collapsing per-row N+1 enrichment (CR-027) into a single
 * batched query followed by an in-memory join. Each route fetches its rows,
 * runs ONE `WHERE key IN (...)` (or grouped) query, indexes the result with
 * these helpers, then maps over the original rows.
 */

/** Distinct, non-null values of `key` across rows — used to build the IN (...) list. */
export function collectIds<T>(rows: T[], key: (row: T) => string | null | undefined): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const id = key(row);
    if (id) set.add(id);
  }
  return Array.from(set);
}

/** Index rows by a string key for O(1) lookup (last row wins on duplicate keys). */
export function indexBy<T>(rows: T[], key: (row: T) => string | null | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    if (id) map.set(id, row);
  }
  return map;
}

/**
 * Turn grouped `{ key, count }` rows into a `key -> number` map. Counts may come
 * back from the driver as strings, so they are coerced to numbers.
 */
export function countMap<T>(
  rows: T[],
  key: (row: T) => string | null | undefined,
  value: (row: T) => number | string | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const raw = value(row);
    const n = typeof raw === 'string' ? Number(raw) : (raw ?? 0);
    map.set(id, n || 0);
  }
  return map;
}
