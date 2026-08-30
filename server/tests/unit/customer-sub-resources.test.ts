/**
 * Every Customer Detail tab got the customer object back (PA-020).
 *
 * The tabs each fetch /api/customers/:id/<thing>. The customers edge function
 * read the id and dropped the sub-segment, so /invoices, /equipment,
 * /service-tickets, /financial-summary and the rest all fell into the
 * single-customer branch and answered 200 with the customer. A component that
 * maps over an object renders an empty list and reports nothing wrong, which is
 * why this survived: there is no error to see.
 *
 * Dev was no better. Express covered five of them (equipment, invoices,
 * service-tickets, contracts, meter-readings) and had no route at all for
 * financial-summary, payments, aging, supply-orders or activities - and nine of
 * the calls were RAW fetch(), which never passes through getApiUrl, so in
 * production they hit the Cloudflare Pages origin, got index.html at 200, and
 * threw in .json() (PROD-013).
 *
 * Comments are stripped: the handler names every table and sub-resource in its
 * own notes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const handler = read('supabase/functions/customers/index.ts');
const proxy = read('server/middleware/edge-function-proxy.ts');

const COMPONENTS = [
  'client/src/components/customer/CustomerInvoices.tsx',
  'client/src/components/customer/CustomerFinancials.tsx',
  'client/src/components/customer/CustomerEquipment.tsx',
  'client/src/components/customer/CustomerServiceHistory.tsx',
  'client/src/components/customer/CustomerSupplies.tsx',
];

/** Every sub-resource the Customer Detail tabs actually request. */
const requested = new Set<string>();
for (const file of COMPONENTS) {
  for (const m of read(file).matchAll(/\/api\/customers\/\$\{customerId\}\/([a-z-]+)/g)) {
    requested.add(m[1]);
  }
}

describe('the sub-segment is routed', () => {
  it('reads it instead of dropping it', () => {
    expect(handler).toContain('const subResource = parts[1]');
    expect(handler).toMatch(/customerId && subResource/);
  });

  it('uses normalizePath rather than indexing the raw split', () => {
    // pathParts[0] === 'customers' ? pathParts[1] : pathParts[0] is the shape
    // the dispatcher makes wrong, and it is what was here.
    expect(handler).toContain("normalizePath(url.pathname, 'customers')");
    expect(handler).not.toContain("pathParts[0] === 'customers'");
  });

  it('serves every sub-resource the tabs request', () => {
    expect(requested.size).toBeGreaterThanOrEqual(8);
    for (const sub of requested) {
      expect(handler).toContain(`'${sub}'`);
    }
  });

  it('answers 404 for a sub-resource it does not serve', () => {
    // Not the customer object, which is what made the original defect silent.
    expect(handler).toMatch(/Unknown customer sub-resource/);
  });
});

describe('every query is scoped to both tenant and customer', () => {
  const block = handler.slice(handler.indexOf('async function handleSubResource'));

  it('filters on tenant_id as many times as it selects', () => {
    // .from( not .from(' - the generic branch passes the table as a variable,
    // and counting only quoted literals silently excused it.
    const froms = block.match(/\.from\(/g) ?? [];
    const tenantScoped = block.match(/\.eq\('tenant_id', tenantId\)/g) ?? [];
    expect(froms.length).toBeGreaterThan(0);
    expect(tenantScoped.length).toBe(froms.length);
  });

  it('filters on the customer as well', () => {
    // One query scopes TRANSITIVELY rather than directly: device_metrics has
    // no customer_id, so the metrics/history branch added by PA-021 restricts
    // it to the ids of that customer's device_registrations. Counting only
    // .eq(customerId) would report it as unscoped; counting .from() against
    // both forms keeps the "every select is customer-scoped" invariant exact.
    const direct = block.match(/\.eq\('(customer_id|business_record_id|id)', customerId\)/g) ?? [];
    const transitive = block.match(/\.in\(\s*'device_id',/g) ?? [];
    const froms = block.match(/\.from\(/g) ?? [];
    expect(direct.length + transitive.length).toBe(froms.length);
  });
});

describe('what is derived, and what is admitted', () => {
  it('computes aging in the handler, because PostgREST has no SUM', () => {
    expect(handler).toContain("subResource === 'aging'");
    expect(handler).toMatch(/thirtyDays/);
    expect(handler).toMatch(/overNinety/);
  });

  it('says there is no payments table rather than showing blank columns', () => {
    expect(handler).toContain('unbacked');
    expect(handler).toContain('there is no payments table');
    expect(read('client/src/components/customer/CustomerFinancials.tsx')).toContain(
      'paymentResponse?.payments',
    );
  });

  it('answers null for an average that has no settled invoice behind it', () => {
    // 0 days would read as a customer who pays instantly.
    expect(handler).toMatch(/averagePaymentDays:\s*\n?\s*paymentLags\.length > 0/);
  });

  it('answers null for a credit limit the record does not carry', () => {
    expect(handler).toMatch(/creditLimit = record\?\.credit_limit == null \? null : num/);
    const financials = read('client/src/components/customer/CustomerFinancials.tsx');
    expect(financials).toContain("'Not set'");
    expect(financials).toContain('No credit limit on this account.');
  });
});

describe('dev and production run the same handler', () => {
  // CORRECTED (PA-021). This block used to assert the two special cases
  // PA-020 left in place: an explicit /api/customers/:id/:sub forward, and a
  // bare list still redirected to the `companies` function. Both are gone.
  //
  // The redirect was the weaker half of PA-020's reasoning. It said adding
  // /api/customers to crmProxies "would have sent the list to a function that
  // answers a different shape" - true, and the reason that mattered is that
  // PRODUCTION ALREADY SENT IT THERE and could not do otherwise, so what the
  // special case preserved was a dev-only shape no deployed client ever saw.
  // The :id/:sub forward had its own defect: three segments exactly, so
  // /metrics/history fell through to Express while /devices did not.
  it('proxies the whole prefix, which is what production does', () => {
    expect(proxy).toMatch(/'\/api\/customers':\s*'customers'/);
  });

  it('keeps no special case of its own', () => {
    expect(proxy).not.toContain("'/api/customers/:id/:sub'");
    expect(proxy).not.toMatch(/\$\{EDGE_FUNCTIONS_URL\}\/companies/);
    expect(proxy).not.toMatch(/recordType=Customer/);
  });
});

describe('the tabs no longer use raw fetch', () => {
  it.each(COMPONENTS)('%s calls apiRequest', (file) => {
    const source = read(file);
    expect(source).not.toMatch(/await fetch\(`\/api\/customers/);
    expect(source).toContain('apiRequest(`/api/customers/${customerId}/');
  });
});
