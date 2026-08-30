/**
 * /api/commission had two Express routers and an invented pay rate (CR-017).
 *
 * DEV RAN TWO ROUTERS ON ONE PREFIX. routes-operations-extended mounted at
 * routes-registry:359 and routes-commission at :844, so the first won
 * /calculations and /disputes and the second's copies of them never ran. The
 * winning twelve handlers were raw SQL strings naming commission_payments,
 * commission_structures, commission_transactions, sales_quotas and
 * sales_representatives - five tables in no Drizzle schema and no migration, so
 * every one was a permanent 500. A table name inside a template literal is
 * invisible to tsc and to check:phantom-cols, which reads edge functions only.
 * routes-commission's own four handlers returned a hardcoded "Sales Rep
 * Standard" plan with 5%/6.5%/8% tiers.
 *
 * PRODUCTION NEVER RAN EITHER. getApiUrl sends /api/commission straight to the
 * commission edge function, which covers every path the page calls. Both
 * routers are deleted and the prefix is proxied, so dev runs it too.
 *
 * THE WORSE HALF WAS IN THE EDGE FUNCTION. Its GET /calculations recomputed
 * commission from won deals at a flat "simplified - 5% base rate" plus a $2,500
 * bonus over $100,000, and returned it at 200 - a rep reading invented numbers
 * as their own pay, harder to spot than the Express fixture because it read
 * real deals to get there. No plan, tier or product rate was consulted, and
 * POST /calculate three hundred lines below answers 501 saying the engine that
 * would write commission_calculations does not exist. The branch now reads that
 * table, so the two agree and an unbuilt engine shows an empty list.
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

const edge = read('supabase/functions/commission/index.ts');
const proxy = read('server/middleware/edge-function-proxy.ts');
const registry = read('server/routes-registry.ts');
const opsExtended = read('server/routes-operations-extended.ts');
const page = read('client/src/pages/CommissionManagement.tsx');

describe('the Express routers are gone', () => {
  it('deletes routes-commission.ts', () => {
    expect(existsSync(join(repo, 'server/routes-commission.ts'))).toBe(false);
  });

  it('leaves no commission handler in routes-operations-extended', () => {
    expect(opsExtended).not.toMatch(/'\/api\/commission/);
  });

  it('leaves no /api/monitoring handler either', () => {
    // Seven handlers over iot_devices, predictive_alerts,
    // equipment_status_monitoring and device_performance_trends - four more
    // tables that do not exist - and no client tree named the prefix.
    expect(opsExtended).not.toMatch(/'\/api\/monitoring/);
  });

  it('names none of the nine phantom tables anywhere in the file', () => {
    for (const table of [
      'commission_payments',
      'commission_structures',
      'commission_transactions',
      'sales_quotas',
      'sales_representatives',
      'iot_devices',
      'predictive_alerts',
      'equipment_status_monitoring',
      'device_performance_trends',
    ]) {
      expect(opsExtended).not.toContain(table);
    }
  });

  it('unregisters the commission router', () => {
    expect(registry).not.toMatch(/registerCommissionRoutes\(app\)/);
    expect(read('server/domains/billing.ts')).not.toContain('routes-commission');
  });

  it('keeps the phone-ticket handlers, which query real tables', () => {
    // Unreachable from a browser, but real and complete - the PROD-008c shape,
    // where deleting is a decision rather than cleanup.
    expect(opsExtended).toContain("'/api/phone-tickets/search-companies'");
  });
});

describe('dev and production run the same handler', () => {
  it('proxies /api/commission', () => {
    expect(proxy).toMatch(/'\/api\/commission':\s*'commission'/);
  });

  it('serves every path the page calls', () => {
    const called = [...page.matchAll(/\/api\/commission\/([a-z-]+)/g)].map((m) => m[1]);
    expect(new Set(called).size).toBeGreaterThanOrEqual(5);
    for (const endpoint of new Set(called)) {
      expect(edge).toContain(`endpoint === '${endpoint}'`);
    }
  });
});

describe('GET /calculations reads what was calculated', () => {
  const branch = edge.slice(
    edge.indexOf("endpoint === 'calculations'"),
    edge.indexOf("endpoint === 'statements'"),
  );

  it('reads commission_calculations, not deals', () => {
    expect(branch).toContain("from('commission_calculations')");
    expect(branch).not.toContain("from('deals')");
  });

  it('invents no rate and no bonus threshold', () => {
    // The exact literals that were here: a 5% rate and a $2,500 bonus above
    // $100,000, applied to every employee regardless of their plan.
    expect(branch).not.toContain('0.05');
    expect(branch).not.toContain('2500');
    expect(branch).not.toContain('100000');
  });

  it('joins the three detail tables by calculation id, not by tenant', () => {
    // commission_calculation_details and commission_bonuses have NO tenant_id -
    // they hang off calculation_id - so filtering them by tenant would be a
    // phantom column, and filtering them by nothing would leak across tenants.
    for (const table of ['commission_calculation_details', 'commission_bonuses']) {
      expect(branch).toContain(`from('${table}')`);
    }
    expect(branch).toMatch(/\.in\('calculation_id', ids\)/);
  });

  it('scopes the tenant-scoped tables to the tenant', () => {
    for (const table of ['commission_calculations', 'commission_adjustments']) {
      const at = branch.indexOf(`from('${table}')`);
      expect(at).toBeGreaterThan(-1);
      expect(branch.slice(at, at + 400)).toContain(".eq('tenant_id', tenantId)");
    }
  });

  it('reads users by first_name/last_name, which is what that table has', () => {
    expect(branch).toContain('first_name, last_name');
    expect(branch).not.toMatch(/select\('id, name'/);
  });

  it('returns an array, which is what the page maps over', () => {
    expect(branch).toMatch(/createCorsResponse\(calculations, 200, req\)/);
    expect(branch).toMatch(/createCorsResponse\(\[\], 200, req\)/);
  });

  it('leaves POST /calculate answering 501 rather than writing invented pay', () => {
    expect(edge).toContain('COMMISSION_ENGINE_NOT_BUILT');
  });
});

describe('the page', () => {
  it('no longer guards against a second response shape', () => {
    expect(page).not.toMatch(/Array\.isArray\(data\)/);
    expect(page).not.toContain('data?.calculations');
  });

  it('treats the two nullable timestamps as nullable', () => {
    // commission_calculations.payout_date and calculated_at are both nullable,
    // and format(undefined) throws.
    expect(page).toMatch(/payoutDate\?: Date/);
    expect(page).toMatch(/calculatedAt\?: Date/);
    expect(page).toMatch(/calc\.summary\.payoutDate &&/);
  });
});
