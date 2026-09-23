// UI-DEAD-BUTTONS-001 (round 202). ExecutiveDashboard drew Export Report and
// Schedule buttons with no handler, a period select the queries never sent,
// and figures the reports endpoints do not return. The server half counted
// only three of the seven open ticket statuses, reported every territory at
// $0 revenue, and called completed/all tickets a "first time fix rate".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const stripComments = (s: string) =>
  s.replace(/(?<![:/'"`])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const PAGE = readFileSync('client/src/pages/ExecutiveDashboard.tsx', 'utf8');
const PAGE_CODE = stripComments(PAGE);
const SERVER = stripComments(
  readFileSync('supabase/functions/reports/handlers/dashboards.ts', 'utf8'),
);
const DATE = readFileSync('supabase/functions/reports/_date.ts', 'utf8');

describe('ExecutiveDashboard page', () => {
  it('sends the selected period on every query, in the server vocabulary', async () => {
    const keys = [...PAGE_CODE.matchAll(/queryKey:\s*\[`([^`]+)`\]/g)].map((m) => m[1]);
    expect(keys.length).toBe(6);
    for (const k of keys) expect(k).toMatch(/\$\{q\}$/);
    expect(PAGE_CODE).toMatch(/const q = `\?period=\$\{period\}`/);
    const values = [...PAGE_CODE.matchAll(/\{ value: '([a-z]+)', label:/g)].map((m) => m[1]);
    expect(values).toEqual(['week', 'month', 'quarter', 'year']);
    for (const v of values) expect(DATE).toContain(`'${v}'`);
  });

  it('wires Export Report to the KPI rows and Schedule to the scheduled reports page', () => {
    expect(PAGE_CODE).toMatch(/const rows = kpiRows\(/);
    expect(PAGE_CODE).toMatch(/exportToCSV\(rows, KPI_EXPORT_COLUMNS,/);
    expect(PAGE_CODE).toMatch(/<Link href="\/scheduled-reports">/);
  });

  it('names what it does not measure, including where revenue comes from', () => {
    expect(PAGE_CODE).toMatch(/UNMEASURED_EXECUTIVE\.map\(/);
    expect(PAGE).toMatch(/quotes/);
  });

  it('flattens the KPI response into exportable rows', async () => {
    const { kpiRows } = await import('../../../client/src/pages/ExecutiveDashboard');
    expect(kpiRows(undefined)).toEqual([]);
    const rows = kpiRows({
      sales: { winRate: 40, totalQuotes: 10, wonQuotes: 4, avgDealSize: 2500 },
      service: { totalTickets: 7, resolvedTickets: 5, avgResolutionHours: 12, openTickets: 2 },
      customers: { newCustomers: 3, newLeads: 9, conversionRate: 33 },
    });
    expect(rows).toHaveLength(11);
    expect(rows.find((r) => r.measure === 'Tickets still open')?.value).toBe(2);
    expect(rows.find((r) => r.measure === 'Average deal size')?.unit).toBe('$');
  });
});

describe('reports dashboards handler', () => {
  it('counts every open ticket status and none of the retired hyphenated one', () => {
    const m = SERVER.match(/const OPEN_TICKET_STATUSES = \[([\s\S]*?)\];/);
    expect(m).not.toBeNull();
    const statuses = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(statuses).toEqual(
      ['assigned', 'en_route', 'on_hold', 'on_site', 'open', 'in_progress', 'scheduled'].sort(),
    );
    expect(SERVER).not.toContain("'in-progress'");
    // Both open-ticket counts go through the list.
    expect(SERVER.match(/OPEN_TICKET_STATUSES\.includes\(t\.status\)/g)).toHaveLength(2);
    // Every status is in the migration 0078 vocabulary.
    const mig = readFileSync('drizzle/migrations/0078_wf_v05_ticket_vocabulary.sql', 'utf8');
    for (const s of statuses) expect(mig).toContain(`'${s}'`);
  });

  it('reports no territory revenue rather than zero, and says so', () => {
    // Bound to the territory mapper: the other `revenue: 0` lines are
    // accumulator seeds that are added to.
    const start = SERVER.indexOf('async function territoryPerformance(');
    const body = SERVER.slice(start, SERVER.indexOf('\nasync function ', start + 10));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('customerCount:');
    expect(body).not.toMatch(/^\s*revenue:/m);
    expect(SERVER).toMatch(/unbacked: \['territory revenue:/);
  });

  it('does not call completed-over-all tickets a first time fix rate', () => {
    expect(SERVER).not.toContain('firstTimeFixRate');
    expect(SERVER).toContain('ticketCompletionRate:');
  });

  it('counts products with a head count instead of fetching every line item', () => {
    const at = SERVER.indexOf(".from('quote_line_items')");
    expect(at).toBeGreaterThan(-1);
    expect(SERVER.slice(at, SERVER.indexOf(')', SERVER.indexOf('.select(', at)) + 1)).toContain(
      'head: true',
    );
    expect(SERVER).toMatch(/totalProducts: productPerformance\.count \?\? null/);
  });
});
