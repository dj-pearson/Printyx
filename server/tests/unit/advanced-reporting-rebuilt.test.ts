// UI-DEAD-BUTTONS-001 (round 208). AdvancedReporting's revenue read fields its
// own normaliser never produced (so revenue was always $0), drew revenue x 1.1
// as a "target", priced service at an invented $75/hour, ranked the first ten
// customers returned, summed meter copy columns that default to 0, computed
// everything over one page of each list, and its Customer filter, More Filters
// and Export did nothing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchAllRecords } from '../../../client/src/lib/fetch-all-records';
import {
  contractVolumes,
  revenueByCustomer,
  revenueByMonth,
  serviceMetrics,
} from '../../../client/src/lib/advanced-reporting';

const range = { from: new Date('2026-07-01'), to: new Date('2026-09-30') };

describe('fetchAllRecords', () => {
  it('pages an offset endpoint until an empty page, even when the server clamps', async () => {
    const all = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    const urls: string[] = [];
    // The server clamps every page to 100 rows whatever limit was asked for.
    const get = async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url, 'https://x').searchParams.get('offset'));
      return all.slice(offset, offset + 100);
    };
    const out = await fetchAllRecords('/api/x', 'offset', { pageSize: 200, get });
    expect(out.rows).toHaveLength(250);
    expect(out.truncated).toBe(false);
    expect(urls[1]).toContain('offset=100');
  });

  it('pages a page-numbered endpoint and stops on a short page', async () => {
    const all = Array.from({ length: 450 }, (_, i) => ({ id: i }));
    const get = async (url: string) => {
      const p = Number(new URL(url, 'https://x').searchParams.get('page'));
      return { data: all.slice((p - 1) * 200, p * 200), total: 450 };
    };
    const out = await fetchAllRecords('/api/y', 'page', { pageSize: 200, get });
    expect(out.rows).toHaveLength(450);
    expect(out.truncated).toBe(false);
  });

  it('reports a page-numbered endpoint that clamped as truncated, not complete', async () => {
    const get = async () => ({
      data: Array.from({ length: 50 }, (_, i) => ({ id: i })),
      total: 300,
    });
    const out = await fetchAllRecords('/api/z', 'page', { pageSize: 200, get });
    expect(out.truncated).toBe(true);
  });

  it('caps a runaway list and says so', async () => {
    const get = async () => Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const out = await fetchAllRecords('/api/w', 'offset', { pageSize: 100, maxRows: 300, get });
    expect(out.rows).toHaveLength(300);
    expect(out.truncated).toBe(true);
  });
});

describe('advanced-reporting figures', () => {
  const invoices = [
    { customer_id: 'a', invoice_date: '2026-07-10', total_amount: '100', balance_due: '100' },
    { customer_id: 'a', invoice_date: '2026-08-10', total_amount: '50', balance_due: '0' },
    { customer_id: 'b', invoice_date: '2026-08-12', total_amount: '400', balance_due: '0' },
    { customer_id: null, invoice_date: '2026-08-15', total_amount: '5', balance_due: '5' },
    { customer_id: 'a', invoice_date: '2025-01-01', total_amount: '999', balance_due: '0' },
  ];
  const customers = [
    { id: 'a', company_name: 'Acme' },
    { id: 'b', company_name: 'Beta' },
  ];

  it('revenue by month reads the real columns, stays in range, and has no target', () => {
    const rows = revenueByMonth(invoices, range);
    expect(rows).toEqual([
      { month: '2026-07', revenue: 100, invoices: 1 },
      { month: '2026-08', revenue: 455, invoices: 3 },
    ]);
    expect(rows.some((r) => 'target' in r)).toBe(false);
  });

  it('revenue by customer uses invoices.customer_id, ranks by revenue, keeps orphans', () => {
    const rows = revenueByCustomer(invoices, customers, range);
    expect(rows.map((r) => r.customer)).toEqual(['Beta', 'Acme', 'No customer']);
    expect(rows[1]).toMatchObject({ revenue: 150, unpaid: 100, invoices: 2 });
    expect(rows.some((r) => 'profit' in r || 'serviceCost' in r || 'margin' in r)).toBe(false);
  });

  it('service metrics normalise statuses and give no average when nothing resolved', () => {
    const tickets = [
      {
        created_at: '2026-08-01T00:00:00Z',
        status: 'completed',
        resolved_at: '2026-08-01T10:00:00Z',
        priority: 'critical',
      },
      {
        created_at: '2026-08-02T00:00:00Z',
        status: 'closed',
        resolved_at: '2026-08-02T02:00:00Z',
        priority: 'low',
      },
      { created_at: '2026-08-03T00:00:00Z', status: 'in-progress', priority: 'medium' },
    ];
    const m = serviceMetrics(tickets, range);
    expect(m.totalTickets).toBe(3);
    expect(m.completedTickets).toBe(2);
    expect(m.averageResolutionHours).toBe(6);
    expect(m.byPriority.find((p) => p.priority === 'Urgent')?.count).toBe(1);
    expect(serviceMetrics([tickets[2]], range).averageResolutionHours).toBeNull();
  });

  it('contract volume comes from lifetime counters, and is null without two readings', () => {
    const contracts = [
      { id: 'c1', contract_number: 'K-1', customer_id: 'a', monthly_base: '300' },
      { id: 'c2', contract_number: 'K-2', customer_id: 'b', monthly_base: '100' },
    ];
    const readings = [
      {
        contract_id: 'c1',
        equipment_id: 'e1',
        reading_date: '2026-06-01',
        bw_meter_reading: 1000,
        color_meter_reading: 0,
        black_copies: 0,
      },
      {
        contract_id: 'c1',
        equipment_id: 'e1',
        reading_date: '2026-07-01',
        bw_meter_reading: 4000,
        color_meter_reading: 0,
        black_copies: 0,
      },
      { contract_id: 'c2', equipment_id: 'e2', reading_date: '2026-07-01', bw_meter_reading: 50 },
    ];
    const [k1, k2] = contractVolumes(contracts, readings, customers);
    expect(k1.monthlyPages).toBeGreaterThan(2900);
    expect(k1.basePerPage).toBeCloseTo(300 / k1.monthlyPages!, 3);
    expect(k2.monthlyPages).toBeNull();
    expect(k2.basePerPage).toBeNull();
    expect(k2.customer).toBe('Beta');
  });
});

describe('page', () => {
  const src = readFileSync('client/src/pages/AdvancedReporting.tsx', 'utf8');

  it('loads every page of every list and warns when truncated', () => {
    for (const q of ['customers', 'contracts', 'tickets', 'invoices', 'readings']) {
      expect(src).toContain(`useAllRecords('${q}')`);
    }
    expect(src).toMatch(/fetchAllRecords<Row>\(path, style\)/);
    expect(src).toMatch(/\{truncated && \(/);
  });

  it('filters by the selected customer and exports the tab in view', () => {
    expect(src).toMatch(/selectedCustomer === 'all' \|\|/);
    expect(src).toMatch(/<Tabs value=\{tab\} onValueChange=\{setTab\}/);
    expect(src).toMatch(/onClick=\{exportTab\}/);
    expect(src).not.toMatch(/More Filters|dataKey="target"|serviceCost|\* 75/);
  });
});
