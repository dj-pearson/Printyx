import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '../../../supabase/functions/_shared/paged-select.ts';

/**
 * PostgREST truncates a response at db-max-rows (1000) WITHOUT erroring and
 * with no marker in the payload. financial/'s metrics, expenses, forecasts,
 * profit-loss and mrr-analysis endpoints each summed a plain .select(), so a
 * dealer past a thousand invoices in the period got a revenue total that
 * stopped counting partway - quietly, and always downward.
 */
function pager(total: number, pageSize = 1000) {
  const calls: Array<[number, number]> = [];
  const build = () => ({
    range(from: number, to: number) {
      calls.push([from, to]);
      const rows = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ i });
      return Promise.resolve({ data: rows, error: null });
    },
  });
  return { build, calls, pageSize };
}

describe('fetchAllRows', () => {
  it('returns everything when the set is smaller than a page', async () => {
    const p = pager(42);
    expect(await fetchAllRows(p.build)).toHaveLength(42);
    expect(p.calls).toHaveLength(1);
  });

  it('keeps reading past the silent 1000-row cap', async () => {
    const p = pager(2500);
    const rows = await fetchAllRows(p.build);
    expect(rows).toHaveLength(2500);
    expect(p.calls.map(([from]) => from)).toEqual([0, 1000, 2000]);
  });

  it('makes one extra request when the total is an exact multiple of the page', async () => {
    // A full last page is indistinguishable from "there may be more", so it
    // must ask again rather than assume.
    const p = pager(2000);
    const rows = await fetchAllRows(p.build);
    expect(rows).toHaveLength(2000);
    expect(p.calls).toHaveLength(3);
  });

  it('handles an empty set without looping', async () => {
    const p = pager(0);
    expect(await fetchAllRows(p.build)).toEqual([]);
    expect(p.calls).toHaveLength(1);
  });

  it('propagates an error instead of returning a short result that looks complete', async () => {
    const build = () => ({
      range: () => Promise.resolve({ data: null, error: new Error('57014 statement timeout') }),
    });
    await expect(fetchAllRows(build)).rejects.toThrow('57014');
  });

  it('builds a fresh query per page, so filters do not accumulate', async () => {
    let built = 0;
    const build = () => {
      built++;
      return {
        range: (from: number) =>
          Promise.resolve({ data: from === 0 ? new Array(1000).fill({}) : [], error: null }),
      };
    };
    await fetchAllRows(build);
    expect(built).toBe(2);
  });

  it('honours a custom page size', async () => {
    const p = pager(250);
    await fetchAllRows(p.build, 100);
    expect(p.calls.map(([from]) => from)).toEqual([0, 100, 200]);
  });
});
