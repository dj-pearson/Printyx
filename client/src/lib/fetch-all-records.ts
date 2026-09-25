/**
 * Every row of a paginated list endpoint, for a page that aggregates.
 *
 * A report that sums one page of a paginated list presents a truncated total
 * as the whole: /api/contracts answers 50 rows by default, invoices and
 * tickets 100 (COP-I01's shape, on the client). This pages through until a
 * page comes back EMPTY, advancing by the rows actually received - an endpoint
 * that clamps the page size below what was asked for returns a short page that
 * is not the last one, so "short page means done" would stop early.
 *
 * Two paging styles exist in this tree: `?page=N` (contracts, meter-readings)
 * and `?offset=N` (customers, service-tickets, billing invoices). A cap stops
 * a runaway tenant; hitting it is reported as `truncated`, never hidden.
 */
import { apiRequest, extractPagination, extractRecords } from '@/lib/queryClient';

export type PagingStyle = 'page' | 'offset';

export interface AllRecords<T> {
  rows: T[];
  truncated: boolean;
}

export async function fetchAllRecords<T>(
  path: string,
  style: PagingStyle,
  opts: { pageSize?: number; maxRows?: number; get?: (url: string) => Promise<unknown> } = {},
): Promise<AllRecords<T>> {
  const pageSize = opts.pageSize ?? 200;
  const maxRows = opts.maxRows ?? 5000;
  const get = opts.get ?? ((url: string) => apiRequest(url, 'GET'));
  const sep = path.includes('?') ? '&' : '?';
  const rows: T[] = [];
  for (let page = 1; rows.length < maxRows; page++) {
    const cursor = style === 'page' ? `page=${page}` : `offset=${rows.length}`;
    const response = await get(`${path}${sep}${cursor}&limit=${pageSize}`);
    const batch = extractRecords(response) as T[];
    if (batch.length === 0) return { rows, truncated: false };
    rows.push(...batch);
    if (style === 'page' && batch.length < pageSize) {
      // A short page is the last one UNLESS the endpoint clamped the page
      // size: asking for page N+1 at our size would then skip rows. Its own
      // total says which; when it claims more than we hold, report the gap
      // rather than a partial set that reads as complete.
      const total = Number(extractPagination(response).total) || 0;
      return { rows, truncated: total > rows.length };
    }
  }
  return { rows: rows.slice(0, maxRows), truncated: true };
}
