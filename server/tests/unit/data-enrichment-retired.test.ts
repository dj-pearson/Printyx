/**
 * One edge function per job (WF-S-10).
 *
 * supabase/functions/data-enrichment was a full duplicate of
 * supabase/functions/enrichment with no caller in any of the eight client
 * trees, no alias in server.ts, no crmProxies entry and no cron post. The only
 * page on this domain, DataEnrichment.tsx, calls /api/enrichment exclusively.
 *
 * Read with comments stripped - the proxy entry's note names the deleted
 * endpoints.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('the duplicate is gone', () => {
  it('supabase/functions/data-enrichment no longer exists', () => {
    expect(existsSync(join(repo, 'supabase/functions/data-enrichment'))).toBe(false);
  });

  it('and the survivor still serves the four endpoints the page calls', () => {
    const fn = code('supabase/functions/enrichment/index.ts');
    for (const r of ['contacts', 'companies', 'campaigns', 'analytics']) {
      expect(fn, r).toContain(`resource === '${r}'`);
    }
  });

  it('including the import branches that write enriched_contacts', () => {
    // This is what makes dropping Express's POST /contacts safe: rows still
    // have a writer.
    const fn = code('supabase/functions/enrichment/index.ts');
    expect(fn).toContain("resource === 'import'");
    expect(fn).toContain("resourceId === 'zoominfo'");
    expect(fn).toContain("resourceId === 'apollo'");
  });
});

describe('the Express router went with it', () => {
  it('the file is deleted and nothing imports it', () => {
    expect(existsSync(join(repo, 'server/routes-data-enrichment.ts'))).toBe(false);
    expect(code('server/routes-registry.ts')).not.toContain('registerDataEnrichmentRoutes');
    expect(code('server/domains/products.ts')).not.toContain('registerDataEnrichmentRoutes');
  });

  it('and /api/enrichment is proxied, so dev and prod answer the same handler', () => {
    expect(code('server/middleware/edge-function-proxy.ts')).toContain(
      "'/api/enrichment': 'enrichment'",
    );
  });
});

describe('the page is unaffected', () => {
  it('it calls /api/enrichment and never /api/data-enrichment', () => {
    const page = code('client/src/pages/DataEnrichment.tsx');
    expect(page).toContain('/api/enrichment/');
    expect(page).not.toContain('/api/data-enrichment');
  });
});

/**
 * Deleting an unreferenced edge function made a NEIGHBOUR reachable, and that
 * exposed a live 42703 (WF-S-10).
 *
 * check:unreferenced-edge-fns reported manufacturer-orders as "now called", so
 * its baselined phantom column stopped being a defect nobody could reach and
 * became one anybody could: the analytics handler selected actual_delivery_date
 * from manufacturer_orders, and that column lives on
 * manufacturer_order_shipments. PostgREST fails the WHOLE select on an unknown
 * column, so ordersRecent.data was null and the 30-day count, total value,
 * acknowledgement latency and on-time rate all read as zero together.
 */
describe('the manufacturer-orders analytics select', () => {
  const fn = code('supabase/functions/manufacturer-orders/handlers/analytics.ts');

  it('no longer asks manufacturer_orders for a shipments column', () => {
    const ordersSelect = fn.slice(fn.indexOf("from('manufacturer_orders')"));
    expect(ordersSelect.slice(0, 700)).not.toContain('actual_delivery_date');
  });

  it('gets the delivery date from the shipments query instead', () => {
    expect(fn).toContain("'shipment_status, order_id, actual_delivery_date'");
    expect(fn).toContain('deliveredAt');
  });

  it('takes the EARLIEST shipment per order, because an order can ship in parts', () => {
    expect(fn).toContain('if (seen === undefined || at < seen)');
  });

  it('and reports null rather than 0% when nothing has been delivered', () => {
    // 0% on-time is a claim about performance; "no deliveries yet" is not that
    // claim (AUDIT-028).
    expect(fn).toContain(': null,');
    expect(fn).toContain('deliveredCount > 0');
  });
});
