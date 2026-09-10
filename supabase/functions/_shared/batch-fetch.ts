// Batched reads for the "one query per row" shape.
//
// PostgREST has no correlated subquery, so the obvious way to gather a child
// set for each parent is a loop - and predictive-failure ran two of them per
// machine. A dealer with 800 active machines made 1,600 SEQUENTIAL round trips
// inside one edge-function invocation, which at even 15ms each is 24 seconds:
// past the timeout, so the feature simply did not complete for anyone with a
// real fleet. It worked in testing because a seeded tenant has a dozen machines.
//
// Two constraints shape what is here. PostgREST caps a response at db-max-rows
// (1000) WITHOUT erroring, so a plain select silently truncates - fetchInBatches
// pages explicitly. And a long `.in()` list becomes a long URL, so ids are sent
// in chunks.

/** Split an array into fixed-size chunks. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Ids per `.in(...)` request. Keeps the URL well inside proxy limits. */
export const ID_BATCH = 200;

/** Rows per page. PostgREST's own cap is 1000; staying under it is deliberate. */
export const PAGE_SIZE = 1000;

type Builder = {
  in: (column: string, values: readonly string[]) => Builder;
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: unknown }>;
};

/**
 * Run `build()` once per id-chunk, paging each until it stops returning a full
 * page, and return every row across all of them.
 *
 * `build` receives a fresh query builder per chunk - reusing one PostgREST
 * builder across calls accumulates filters and silently narrows the result.
 */
export async function fetchInBatches<T = Record<string, unknown>>(
  ids: readonly string[],
  column: string,
  build: () => Builder,
): Promise<T[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];

  const rows: T[] = [];
  for (const idChunk of chunk([...unique], ID_BATCH)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await build()
        .in(column, idChunk)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

/** Group rows by a key, preserving the order they arrived in. */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k === null) continue;
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}
