/**
 * Locks the QBR deck assembly ported to Deno in supabase/functions/qbr/content.ts
 * (PROD-010).
 *
 * The edge function is now the ONLY implementation that runs — dev proxies
 * /api/qbr to it and production has no Express at all — so its arithmetic is the
 * product behavior, not a copy. Nothing else in the JS test suite can reach it
 * (there is no Deno in CI), which is exactly why the aggregation is pinned here:
 * the fold over meter readings, tickets and contracts is where a port silently
 * drifts, and a wrong `content` payload renders a plausible-looking deck full of
 * wrong numbers — the failure mode CLAUDE.md calls worse than a 404.
 *
 * Mirrors the precedent set by quote-math.test.ts, which locks the quote math
 * replicated into the Deno proposals function.
 */

import { describe, it, expect } from 'vitest';
import {
  assembleContent,
  renderHtml,
  currentQuarter,
  quarterRange,
  lastFourQuarters,
} from '../../../supabase/functions/qbr/content.ts';

/**
 * Minimal stand-in for the PostgREST query builder: every filter method returns
 * `this`, and awaiting resolves to the rows registered for that table. Enough to
 * exercise the real assembleContent without a database.
 */
function stubClient(tables: Record<string, Record<string, unknown>[]>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

  const makeQuery = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    const rows = tables[table] ?? [];
    const record = { table, filters };
    calls.push(record);

    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit']) {
      q[m] = (...args: unknown[]) => {
        if (m === 'eq' || m === 'in' || m === 'gte') filters.push([String(args[0]), args[1]]);
        return q;
      };
    }
    q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    // Awaiting the builder itself resolves to the row set.
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
    return q;
  };

  return {
    client: { from: (table: string) => makeQuery(table) } as never,
    calls,
  };
}

describe('QBR quarter helpers', () => {
  it('derives the quarter from a date', () => {
    expect(currentQuarter(new Date(2026, 0, 15))).toBe('2026-Q1');
    expect(currentQuarter(new Date(2026, 4, 2))).toBe('2026-Q2');
    expect(currentQuarter(new Date(2026, 11, 31))).toBe('2026-Q4');
  });

  it('produces a half-open quarter range', () => {
    const r = quarterRange('2026-Q2')!;
    expect(r.start).toEqual(new Date(2026, 3, 1));
    expect(r.end).toEqual(new Date(2026, 6, 1));
    expect(quarterRange('nonsense')).toBeNull();
  });

  it('walks back four quarters across a year boundary', () => {
    expect(lastFourQuarters('2026-Q2')).toEqual(['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2']);
  });
});

describe('QBR content assembly', () => {
  const tenantId = 'tenant-1';
  const customerId = 'cust-1';
  const quarter = '2026-Q2'; // Apr 1 – Jul 1 2026

  const baseTables = () => ({
    business_records: [{ company_name: 'Acme Print', assigned_sales_rep: 'rep-9' }],
    equipment: [
      { id: 'eq-1', serial_number: 'SN-1', model_number: 'M-1', manufacturer: 'Canon' },
      { id: 'eq-2', serial_number: 'SN-2', model_number: 'M-2', manufacturer: 'Ricoh' },
    ],
    meter_readings: [
      // In-quarter (2026-Q2)
      { reading_date: '2026-04-10T00:00:00Z', black_copies: 100, color_copies: 20 },
      { reading_date: '2026-05-10T00:00:00Z', black_copies: 50, color_copies: 5 },
      // Prior quarter (2026-Q1)
      { reading_date: '2026-02-01T00:00:00Z', black_copies: 30, color_copies: 10 },
    ],
    service_tickets: [
      {
        equipment_id: 'eq-1',
        title: 'Paper jam',
        status: 'closed',
        created_at: '2026-04-05T00:00:00Z',
      },
      {
        equipment_id: 'eq-1',
        title: 'Paper jam',
        status: 'open',
        created_at: '2026-05-05T00:00:00Z',
      },
      {
        equipment_id: 'eq-2',
        title: 'Streaks',
        status: 'resolved',
        created_at: '2026-06-05T00:00:00Z',
      },
      // Outside the quarter — must be excluded by the end-bound filter.
      {
        equipment_id: 'eq-2',
        title: 'Later issue',
        status: 'open',
        created_at: '2026-09-01T00:00:00Z',
      },
    ],
    contracts: [{ monthly_base: 500 }, { monthly_base: '250.50' }],
  });

  it('assembles the shape the page reads, with real aggregates', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);

    expect(c.cover).toEqual({ companyName: 'Acme Print', quarter, assignedSalesRep: 'rep-9' });

    // Fleet is mapped off the REAL columns (serial_number/model_number).
    expect(c.fleet).toHaveLength(2);
    expect(c.fleet[0]).toEqual({
      equipmentId: 'eq-1',
      serial: 'SN-1',
      model: 'M-1',
      manufacturer: 'Canon',
    });

    // Four quarters, oldest first, readings bucketed by their own date.
    expect(c.usageTrend.map((u) => u.quarter)).toEqual([
      '2025-Q3',
      '2025-Q4',
      '2026-Q1',
      '2026-Q2',
    ]);
    const q1 = c.usageTrend.find((u) => u.quarter === '2026-Q1')!;
    const q2 = c.usageTrend.find((u) => u.quarter === '2026-Q2')!;
    expect(q1).toMatchObject({ black: 30, color: 10, total: 40 });
    expect(q2).toMatchObject({ black: 150, color: 25, total: 175 });
  });

  it('counts downtime per machine and splits open vs closed', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);

    // eq-1 has 2 in-quarter tickets, eq-2 has 1 (the September one is excluded).
    expect(c.downtimeByMachine).toHaveLength(2);
    expect(c.downtimeByMachine[0]).toMatchObject({
      equipmentId: 'eq-1',
      ticketCount: 2,
      open: 1,
      closed: 1,
    });
    expect(c.downtimeByMachine[1]).toMatchObject({
      equipmentId: 'eq-2',
      ticketCount: 1,
      closed: 1,
    });
  });

  it('excludes tickets after the quarter end', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);
    // 'Later issue' is dated 2026-09-01, outside 2026-Q2.
    expect(c.topIssues.map((i) => i.title)).not.toContain('Later issue');
    expect(c.topIssues[0]).toEqual({ title: 'Paper jam', count: 2 });
  });

  it('proxies supply cost as sum(monthly_base) x 3, tolerating numeric strings', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);
    // (500 + 250.50) * 3 = 2251.5 -> rounded
    expect(c.supplyCost.estimatedQuarterly).toBe(2252);
    expect(c.supplyCost.note).toMatch(/STUB/);
  });

  it('projects the next quarter from the trend slope and never goes negative', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);

    expect(c.forecast.nextQuarter).toBe('2026-Q3');
    // trend black: [0, 0, 30, 150]; slope = (150-0)/3 = 50 -> 200
    expect(c.forecast.projectedBlack).toBe(200);
    expect(c.forecast.projectedTotal).toBe(c.forecast.projectedBlack + c.forecast.projectedColor);
    expect(c.forecast.projectedBlack).toBeGreaterThanOrEqual(0);
  });

  it('rolls the year over when projecting past Q4', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, '2026-Q4');
    expect(c.forecast.nextQuarter).toBe('2027-Q1');
  });

  it('survives a customer with no equipment, tickets or contracts', async () => {
    const { client } = stubClient({
      business_records: [{ company_name: null, assigned_sales_rep: null }],
      equipment: [],
      meter_readings: [],
      service_tickets: [],
      contracts: [],
    });
    const c = await assembleContent(client, tenantId, customerId, quarter);

    expect(c.fleet).toEqual([]);
    expect(c.downtimeByMachine).toEqual([]);
    expect(c.topIssues).toEqual([]);
    expect(c.supplyCost.estimatedQuarterly).toBe(0);
    expect(c.usageTrend.every((u) => u.total === 0)).toBe(true);
    expect(c.forecast.projectedTotal).toBe(0);
    // Recommendations must still be produced — a deck with no advice is useless.
    expect(c.recommendations.length).toBeGreaterThan(0);
    expect(c.recommendationsSource).toBe('fallback');
  });

  it('falls back to deterministic recommendations without an API key', async () => {
    const { client } = stubClient(baseTables());
    const c = await assembleContent(client, tenantId, customerId, quarter);
    expect(c.recommendationsSource).toBe('fallback');
    expect(c.recommendations.length).toBeGreaterThan(0);
    expect(c.recommendations.length).toBeLessThanOrEqual(5);
  });
});

describe('QBR HTML rendering', () => {
  const content = {
    cover: { companyName: 'Acme & Co', quarter: '2026-Q2', assignedSalesRep: 'rep-9' },
    fleet: [{ equipmentId: 'eq-1', serial: 'SN-1', model: 'M-1', manufacturer: 'Canon' }],
    usageTrend: [{ quarter: '2026-Q2', black: 10, color: 2, total: 12 }],
    downtimeByMachine: [
      { equipmentId: 'eq-1', serial: 'SN-1', model: 'M-1', ticketCount: 2, open: 1, closed: 1 },
    ],
    downtimeNote: 'proxy note',
    topIssues: [{ title: 'Paper jam', count: 2 }],
    supplyCost: { estimatedQuarterly: 1500, note: 'stub note' },
    forecast: {
      nextQuarter: '2026-Q3',
      projectedBlack: 12,
      projectedColor: 3,
      projectedTotal: 15,
      note: 'linear',
    },
    sectionOverrides: {},
    recommendations: ['Do the thing'],
    recommendationsSource: 'fallback',
  };

  it('escapes HTML in customer-controlled values', () => {
    const html = renderHtml({
      ...content,
      cover: { ...content.cover, companyName: '<script>alert(1)</script>' },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    // Ampersands in ordinary names are escaped too.
    expect(renderHtml(content)).toContain('Acme &amp; Co');
  });

  it('replaces a section with its override', () => {
    const html = renderHtml({
      ...content,
      sectionOverrides: { topIssues: 'Nothing notable this quarter.' },
    });
    expect(html).toContain('Nothing notable this quarter.');
    // The generated list for that section is gone.
    expect(html).not.toContain('Paper jam');
    // Untouched sections still render.
    expect(html).toContain('Do the thing');
  });

  it('escapes override text too', () => {
    const html = renderHtml({
      ...content,
      sectionOverrides: { fleet: '<img src=x onerror=alert(1)>' },
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
