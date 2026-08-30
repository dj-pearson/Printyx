/**
 * /api/customers resolves to the same backend in dev and prod (PA-021).
 *
 * It used to resolve to two DIFFERENT edge functions depending on the
 * environment. Dev special-cased the bare list to `companies` with
 * recordType=Customer; production has no way to reach `companies` under this
 * prefix, because getApiUrl rewrites /api/customers straight to
 * functions.printyx.net/customers. The two disagreed on shape as well -
 * `companies` answers { data, total, page, limit } and `customers` answers a
 * bare array, which the iOS client decodes as [BusinessRecord]. Both read the
 * same `companies` table, so the redirect bought nothing.
 *
 * Three defects the convergence exposed, each fixed here:
 *
 *  1. POST /customers/:id/supply-orders fell into the create-CUSTOMER branch
 *     of the edge function, wrote a junk companies row from the order payload
 *     and answered 201 while the UI said "Supply order created successfully".
 *     Nothing in Express served that path, so production was the only host
 *     where the button did anything.
 *  2. The dev sub-resource forward matched exactly three segments, so
 *     /customers/:id/metrics/history fell through to Express while
 *     /customers/:id/devices did not - two tabs of one page on two backends.
 *  3. Both Express handlers behind those paths filtered device_registrations
 *     by tenant_id only, despite device_registrations.customer_id existing, so
 *     every customer's meter-readings tab showed the whole tenant's fleet.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const proxy = read('server/middleware/edge-function-proxy.ts');
const edge = read('supabase/functions/customers/index.ts');

describe('one backend, both environments', () => {
  it('proxies the whole prefix to the customers function', () => {
    expect(proxy).toMatch(/'\/api\/customers':\s*'customers'/);
  });

  it('no longer redirects the bare list to companies', () => {
    expect(proxy).not.toMatch(/recordType=Customer/);
    expect(proxy).not.toMatch(/\$\{EDGE_FUNCTIONS_URL\}\/companies/);
  });

  it('no longer forwards sub-resources through a route of its own', () => {
    // That route matched exactly three segments, which is what split
    // /metrics/history from /devices across two backends.
    expect(proxy).not.toMatch(/'\/api\/customers\/:id\/:sub'/);
  });

  it('drops the hand-maintained PROXIED_PREFIXES entry the special case needed', () => {
    expect(proxy).not.toMatch(/PROXIED_PREFIXES\.add\('customers'\)/);
  });
});

describe('sub-resources are routed for every method', () => {
  it('dispatches on customerId and sub-segment without checking the method first', () => {
    // A GET-only guard here is what let a POST fall through to the
    // create-customer branch below it.
    expect(edge).toMatch(/if \(customerId && subResource\) \{\s*return await handleSubResource/);
  });

  it('answers 501 for a supply-order create rather than writing something', () => {
    const from = edge.indexOf('async function handleSubResource');
    const block = edge.slice(from, from + 2000);
    expect(block).toMatch(/req\.method === 'POST' && subResource === 'supply-orders'/);
    expect(block).toMatch(/501/);
    expect(block).toMatch(/'Method not allowed' \}, 405/);
  });

  it('takes the whole tail so a two-segment sub-resource can be matched', () => {
    expect(edge).toMatch(
      /handleSubResource\(req, admin, tenantId, customerId, parts\.slice\(1\), url\)/,
    );
    expect(edge).toMatch(/subResource === 'metrics' && segments\[1\] === 'history'/);
  });
});

describe('meter readings belong to one customer', () => {
  const from = edge.indexOf("subResource === 'metrics'");
  const block = edge.slice(from, edge.indexOf('Unknown customer sub-resource', from));

  it('filters device_registrations by customer_id, not just tenant_id', () => {
    expect(block).toMatch(/\.from\('device_registrations'\)/);
    expect(block).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(block).toMatch(/\.eq\('customer_id', customerId\)/);
  });

  it('scopes the metrics to the devices of that customer', () => {
    expect(block).toMatch(/\.in\(\s*'device_id',/);
  });

  it('returns early rather than sending PostgREST an empty in() list', () => {
    expect(block).toMatch(/deviceRows\.length === 0/);
  });

  it('converts metric rows shallowly, because three columns are jsonb', () => {
    // toner_levels, paper_levels and raw_data hold arbitrary shapes; a deep
    // converter rewrites keys inside them.
    expect(block).toMatch(/toCamelShallow/);
    expect(block).not.toMatch(/toCamel\(metric/);
  });
});

describe('the Express duplicates are gone', () => {
  it('deleted the single-handler router', () => {
    expect(existsSync(join(repo, 'server/routes-customers.ts'))).toBe(false);
    expect(read('server/routes-registry.ts')).not.toMatch(/registerCustomerRoutes/);
    expect(read('server/domains/crm.ts')).not.toMatch(/routes-customers/);
  });

  it.each([
    'server/routes-crm-core.ts',
    'server/routes-business-records.ts',
    'server/routes-enhanced-service.ts',
    'server/routes-workflow-mobile.ts',
    'server/routes-client-monitoring.ts',
  ])('%s registers no /api/customers route', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/['"`]\/api\/customers/);
    // routes-enhanced-service mounts at the /api root, so its paths are bare.
    expect(src).not.toMatch(/router\.(get|post|put|patch|delete)\(\s*'\/customers/);
  });
});

describe('the client stopped asking for things nothing serves', () => {
  const meter = read('client/src/components/customer/CustomerMeterReadings.tsx');
  const supplies = read('client/src/components/customer/CustomerSupplies.tsx');

  it('CustomerMeterReadings no longer fetches a device list it discarded', () => {
    expect(meter).not.toMatch(/'devices'/);
    expect(meter).toMatch(/'metrics\/history'/);
  });

  it('CustomerSupplies no longer offers an order it cannot place', () => {
    expect(supplies).not.toMatch(/useMutation/);
    expect(supplies).not.toMatch(/SupplyOrderForm/);
    expect(supplies).not.toMatch(/'POST'/);
  });
});
