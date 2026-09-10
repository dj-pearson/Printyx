import { describe, expect, it } from 'vitest';
import {
  chunk,
  fetchInBatches,
  groupBy,
  ID_BATCH,
  PAGE_SIZE,
} from '../../../supabase/functions/_shared/batch-fetch.ts';

/**
 * The shape this replaces: predictive-failure issued one meter_readings query
 * and one service_tickets query PER MACHINE. A dealer with 800 active machines
 * made 1,600 sequential round trips in one invocation. It passed testing
 * because a seeded tenant has a dozen machines.
 */

/** A minimal stand-in for the PostgREST builder, recording what it was asked. */
function fakeTable(rowsFor: (ids: readonly string[], offset: number) => unknown[]) {
  const calls: Array<{ ids: readonly string[]; from: number; to: number }> = [];
  const build = () => {
    let captured: readonly string[] = [];
    const builder = {
      in(_col: string, values: readonly string[]) {
        captured = values;
        return builder;
      },
      range(from: number, to: number) {
        calls.push({ ids: captured, from, to });
        return Promise.resolve({ data: rowsFor(captured, from), error: null });
      },
    };
    return builder;
  };
  return { build, calls };
}

describe('fetchInBatches', () => {
  it('makes no request when there are no ids', async () => {
    const t = fakeTable(() => []);
    expect(await fetchInBatches([], 'equipment_id', t.build)).toEqual([]);
    expect(t.calls).toHaveLength(0);
  });

  it('sends ids in chunks rather than one long .in() list', async () => {
    const ids = Array.from({ length: ID_BATCH * 2 + 5 }, (_, i) => `m${i}`);
    const t = fakeTable(() => []);
    await fetchInBatches(ids, 'equipment_id', t.build);
    expect(t.calls).toHaveLength(3);
    expect(t.calls[0].ids).toHaveLength(ID_BATCH);
    expect(t.calls[2].ids).toHaveLength(5);
  });

  it('de-duplicates ids', async () => {
    const t = fakeTable(() => []);
    await fetchInBatches(['a', 'a', 'b', 'a'], 'equipment_id', t.build);
    expect(t.calls[0].ids).toEqual(['a', 'b']);
  });

  it('pages past PostgREST’s silent row cap', async () => {
    // A full page means there may be more; PostgREST truncates without erroring.
    const t = fakeTable((_ids, offset) =>
      offset === 0 ? Array.from({ length: PAGE_SIZE }, (_, i) => ({ i })) : [{ i: PAGE_SIZE }],
    );
    const rows = await fetchInBatches(['a'], 'equipment_id', t.build);
    expect(rows).toHaveLength(PAGE_SIZE + 1);
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].from).toBe(PAGE_SIZE);
  });

  it('stops after a short page', async () => {
    const t = fakeTable(() => [{ i: 1 }]);
    await fetchInBatches(['a'], 'equipment_id', t.build);
    expect(t.calls).toHaveLength(1);
  });

  it('builds a fresh query per chunk, so filters do not accumulate', async () => {
    const ids = Array.from({ length: ID_BATCH + 1 }, (_, i) => `m${i}`);
    const t = fakeTable(() => []);
    await fetchInBatches(ids, 'equipment_id', t.build);
    // The second chunk carries only its own ids, not the first chunk's too.
    expect(t.calls[1].ids).toHaveLength(1);
  });

  it('propagates a query error rather than returning a short result', async () => {
    const build = () => {
      const b = {
        in: () => b,
        range: () => Promise.resolve({ data: null, error: new Error('42703') }),
      };
      return b as never;
    };
    await expect(fetchInBatches(['a'], 'equipment_id', build)).rejects.toThrow('42703');
  });
});

describe('groupBy', () => {
  it('buckets rows and preserves arrival order within each bucket', () => {
    const rows = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'a', n: 3 },
    ];
    const g = groupBy(rows, (r) => r.id);
    expect(g.get('a')?.map((r) => r.n)).toEqual([1, 3]);
    expect(g.get('b')?.map((r) => r.n)).toEqual([2]);
  });

  it('drops rows with no key rather than bucketing them under one', () => {
    const g = groupBy([{ id: null }, { id: 'a' }], (r) => r.id);
    expect(g.size).toBe(1);
  });
});

describe('chunk', () => {
  it('splits without losing or duplicating items', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
