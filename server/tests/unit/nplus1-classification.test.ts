/**
 * A hundred loops, and most of them must not be "fixed" (PERF-NPLUS1-002).
 *
 * scripts/report-nplus1-loops.mjs matches a loop containing an awaited
 * PostgREST call - the one-query-per-row shape. It found predictive-failure,
 * which ran two queries per active machine, so a dealer with 800 machines made
 * 1,600 sequential round trips in one invocation and the endpoint timed out for
 * precisely the customers the feature exists for. It passed testing because a
 * seeded tenant has a dozen machines.
 *
 * But a pagination loop, a chunked insert and a retry loop all have exactly
 * that shape, and the first version reported 99 of them undifferentiated. A
 * reading list where two thirds of the entries are correct code is a list
 * nobody reads - the same failure a baseline full of non-defects has. So the
 * script classifies each hit and reports only the ones whose row count is the
 * customer's business.
 *
 * These tests drive the classifier directly, because the risk in a rule like
 * this runs one way: a paging loop wrongly called TENANT costs a wasted read,
 * while a TENANT loop wrongly called deliberate is a defect the report has
 * stopped mentioning.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { classify } from '../../../scripts/lib/nplus1-classify.mjs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const script = join(repo, 'scripts/report-nplus1-loops.mjs');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const output = execFileSync('node', [script, '--all'], { cwd: repo, encoding: 'utf8' });

describe('the classifier separates deliberate loops from tenant-scale ones', () => {
  it('calls an explicit pagination loop paging', () => {
    expect(classify('for (let offset = 0; ; offset += 1000) {', '')).not.toBe('TENANT');
    expect(classify('while (hasMore) {', '')).toBe('paging');
  });

  it('calls a chunked insert batching, by literal size or by named constant', () => {
    expect(classify('for (const batch of chunk(rows, 500)) {', '')).toBe('batching');
    expect(classify('for (let i = 0; i < ids.length; i += 200) {', '')).toBe('batching');
    // `i += METRICS_CONCURRENCY` is the same shape with the size hoisted.
    expect(classify('for (let i = 0; i < serials.length; i += METRICS_CONCURRENCY) {', '')).toBe(
      'batching',
    );
  });

  it('calls a numerically bounded loop bounded', () => {
    expect(classify('for (let i = 0; i < 10; i++) {', '')).toBe('bounded');
    expect(classify('for (let i = 0; i < 6 && frontier.length > 0; i++) {', '')).toBe('bounded');
  });

  it('calls a loop over a literal or a constant bounded', () => {
    expect(classify("for (const t of ['a', 'b']) {", '')).toBe('bounded');
    expect(classify('for (const t of GOAL_TYPES) {', '')).toBe('bounded');
  });

  it('calls a loop over rows read from the database TENANT', () => {
    // The shape that matters: the count is the customer's business.
    expect(classify('for (const machine of machines) {', '')).toBe('TENANT');
    expect(classify('for (const customerId of targetIds) {', '')).toBe('TENANT');
  });

  it('recognises paging from the BODY when the header does not say so', () => {
    expect(classify('for (const idChunk of chunks) {', 'await fetchAllRows(q)')).toBe('paging');
  });
});

describe('the report shows its classification rather than silently dropping hits', () => {
  it('prints a summary naming each deliberate kind and its count', () => {
    // A rule that quietly removes two thirds of the findings is
    // indistinguishable from a rule that is broken.
    expect(output).toMatch(/deliberate by shape, not reported: .*paging/);
    expect(output).toMatch(/loops over tenant rows \(candidates\): \d+/);
  });

  it('--all labels every serial loop with its kind', () => {
    expect(output).toMatch(/\[(TENANT|paging|batching|bounded|retry)\]/);
  });

  it('still reports a real tenant-scale loop', () => {
    // The guard must not have classified its way to zero.
    expect(output).toMatch(/\[TENANT\]/);
    const candidates = Number(/candidates\): (\d+)/.exec(output)?.[1] ?? '0');
    expect(candidates).toBeGreaterThan(10);
  });
});

describe('the converted loops', () => {
  it('voice-ticket-close reads truck stock once for every part, not once per part', () => {
    const src = read('supabase/functions/voice-ticket-close/index.ts');
    expect(src).toContain('fetchInBatches<Row>(skus, ');
    // The per-part SELECT that was there.
    expect(src).not.toMatch(/\.eq\('part_sku', sku\)\s*\n\s*\.maybeSingle\(\)/);
    // The UPDATE stays per row, and the comment says why: PostgREST cannot
    // express `quantity_on_truck - qty` and each part deducts a different
    // amount.
    expect(src).toMatch(/quantity_on_truck: Number\(stock\.quantity_on_truck \?\? 0\) - qty/);
  });

  it('truck-stock writes one insert per batch, not one per technician', () => {
    const src = read('supabase/functions/truck-stock/index.ts');
    expect(src).toMatch(/for \(const batch of chunk\(rows, 200\)\)/);
    expect(src).toContain('.insert(batch)');
  });

  it('truck-stock still counts what it actually wrote', () => {
    // generated++ per row became generated += batch.length; a batch that throws
    // must not be counted.
    const src = read('supabase/functions/truck-stock/index.ts');
    expect(src).toMatch(/if \(error\) throw error;\s*\n\s*generated \+= batch\.length;/);
  });
});

describe('the converted write loops', () => {
  it('printer-monitoring batches both agent submissions', () => {
    const src = read('supabase/functions/printer-monitoring/index.ts');
    expect(src).toContain('writeInBatches(deviceRows, (rows)');
    expect(src).toContain('writeInBatches(metricRows, (rows)');
    // The per-device upsert and per-metric insert that were there.
    expect(src).not.toMatch(/for \(const device of devices\)/);
    expect(src).not.toMatch(/for \(const metric of metrics\)/);
  });

  it('purchase-orders keeps per-serial failure reasons through the batch', () => {
    const src = read('supabase/functions/purchase-orders/index.ts');
    // A duplicate serial is the commonest outcome on a re-submitted receipt and
    // the caller is told which one. Batching without the row-by-row retry would
    // turn one duplicate into "nothing received".
    expect(src).toContain('that serial number is already registered');
    expect(src).toContain('const { data: batch, error: batchError } = await insertEquipment(');
  });

  it('purchase-orders reads inventory levels once per receipt', () => {
    const src = read('supabase/functions/purchase-orders/index.ts');
    expect(src).toMatch(/\.in\('id', \[\.\.\.new Set\(movements\.map\(/);
  });

  it('qbr checks the requested contract once, outside the loop', () => {
    const src = read('supabase/functions/qbr/index.ts');
    const loop = src.slice(src.indexOf('for (const customerId of targetIds)'));
    expect(loop).not.toContain("from('contracts')");
  });
});

describe('writeInBatches, measured', () => {
  // AC4 asks for a representative large-tenant case measured rather than
  // assumed. What is measured here is ROUND TRIPS, not milliseconds: there is
  // no PostgREST in this container, and in this architecture the wall clock is
  // the round trips - each one is a hop to the pooler, which is exactly why
  // predictive-failure timed out at 1,600 of them.
  const fleet = () =>
    Array.from({ length: 800 }, (_, i) => ({
      tenant_id: 't',
      device_serial: `SN-${i}`,
      page_count_total: i,
    }));

  it('turns 800 sequential writes into 4', async () => {
    const { writeInBatches } = await import('../../../supabase/functions/_shared/batch-fetch.ts');
    let calls = 0;
    const written = await writeInBatches(fleet(), (rows) => {
      calls += 1;
      return Promise.resolve({ data: rows, error: null });
    });
    expect(calls).toBe(4);
    expect(written).toHaveLength(800);
  });

  it('pays the per-row retry only for the batch that failed', async () => {
    const { writeInBatches } = await import('../../../supabase/functions/_shared/batch-fetch.ts');
    let calls = 0;
    const bad = 'SN-500';
    const written = await writeInBatches(fleet(), (rows) => {
      calls += 1;
      const carriesBad = rows.some((r) => r.device_serial === bad);
      if (carriesBad) return Promise.resolve({ data: null, error: { code: '23505' } });
      return Promise.resolve({ data: rows, error: null });
    });
    // 4 batches, plus 200 single-row retries for the one that failed.
    expect(calls).toBe(204);
    // Every row but the bad one still landed - which is what the per-row loop
    // it replaces did, and what a bare batch would have lost.
    expect(written).toHaveLength(799);
  });
});
