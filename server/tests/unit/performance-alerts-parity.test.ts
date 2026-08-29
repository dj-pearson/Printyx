/**
 * The alert bell has to see the same problems in both environments.
 *
 * supabase/functions/performance/ read system_alerts, a real table that NOTHING
 * WRITES TO - the only insert in the tree is storage.createSystemAlert and no
 * caller names it. So the bell was permanently empty in production. Meanwhile
 * server/routes-operations-extended.ts DERIVED four alert families from live
 * data (low stock, dispatch delay, billing anomaly, contract expiration) and,
 * because /api/performance was not proxied, served them in dev only. The two
 * environments disagreed about whether the business had any problems.
 *
 * A third implementation, server/routes/performance-routes.ts, invented every
 * number it returned - 99 + random*0.99 uptime, random*500 + 800 throughput, a
 * random error rate, disk usage and active-user count - and is deleted.
 *
 * The derivations now live in the edge function, ALONGSIDE the system_alerts
 * read rather than instead of it, so whatever eventually writes there still
 * shows. Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const edge = read('supabase/functions/performance/index.ts');

describe('derived operational alerts', () => {
  it.each([
    ['low_stock', 'inventory_items'],
    ['dispatch_delay', 'service_tickets'],
    ['billing_anomaly', 'invoices'],
    ['contract_expiration', 'service_contracts'],
  ])('derives %s from %s', (type, table) => {
    expect(edge).toContain(`type: '${type}'`);
    expect(edge).toContain(`.from('${table}')`);
  });

  it('keeps the system_alerts read rather than replacing it', () => {
    expect(edge).toContain(".from('system_alerts')");
    expect(edge).toMatch(/\.\.\.\(alerts \?\? \[\]\)\.map/);
    expect(edge).toMatch(/\.\.\.derived/);
  });

  it('guards each family separately, so one missing table cannot blank the bell', () => {
    const helper = edge.slice(edge.indexOf('async function deriveOperationalAlerts'));
    expect((helper.match(/try \{/g) ?? []).length).toBe(4);
    expect((helper.match(/catch \(err\)/g) ?? []).length).toBe(4);
  });

  it('caps every family, including the one it has to filter in memory', () => {
    const helper = edge.slice(edge.indexOf('async function deriveOperationalAlerts'));
    // PostgREST cannot compare two columns, so low stock is filtered here -
    // which is exactly why it needs a bound on what it fetches.
    expect((helper.match(/\.limit\(/g) ?? []).length).toBe(4);
    expect(helper).toMatch(/\.slice\(0, 20\)/);
  });
});

describe('the surface that reaches it', () => {
  it('is proxied, so dev and prod answer the same thing', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toMatch(
      /'\/api\/performance':\s*'performance'/,
    );
  });

  it('has no Express implementation left', () => {
    expect(existsSync(join(repo, 'server/routes/performance-routes.ts'))).toBe(false);
    expect(read('server/routes-operations-extended.ts')).not.toMatch(/'\/api\/performance/);
  });

  it('dropped the fake test runner that invented its own coverage figure', () => {
    expect(existsSync(join(repo, 'server/run-comprehensive-tests.ts'))).toBe(false);
  });
});
