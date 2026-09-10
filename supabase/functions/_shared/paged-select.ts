// Paging past PostgREST's silent row cap.
//
// PostgREST truncates a response at db-max-rows (1000 here) WITHOUT erroring
// and without any marker in the payload. A plain `.select()` that is then summed
// therefore produces a total that is simply WRONG once the tenant passes that
// line - and it is wrong quietly, in the direction of "business is smaller than
// it is". A dealer billing more than a thousand invoices in a quarter got a P&L
// that stopped counting partway through.
//
// This is the shape platform-analytics already fixed for itself under AUDIT-006
// with a local fetchAllRows. It is here because the same defect was live in
// financial/'s expenses, profit-loss and mrr-analysis endpoints, and a helper
// that lives inside one function cannot be reused by the next one that needs it.
//
// Prefer a HEAD count (`{ count: 'exact', head: true }`) when you only need how
// many - that transfers no rows at all. Use this when you need the values.

const DEFAULT_PAGE = 1000;

type PagedBuilder<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

/**
 * Read every matching row, a page at a time.
 *
 * `build()` must return a FRESH query each call - a PostgREST builder
 * accumulates the filters applied to it, so reusing one across pages narrows
 * the result silently, which is the same class of bug this exists to prevent.
 *
 * An error propagates rather than yielding the rows collected so far: a short
 * result that looks complete is exactly what makes the original defect
 * invisible.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  build: () => PagedBuilder<T>,
  pageSize: number = DEFAULT_PAGE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await build().range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
