import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PROD-013. The whole billing surface addressed the wrong host in production.
 *
 * Nine bare `fetch('/api/subscriptions/...')` calls with
 * `credentials: 'include'` - the plan list, checkout, the Stripe customer
 * portal, adding a payment method, previewing an upgrade, verifying a completed
 * checkout. A relative fetch skips getApiUrl, so in production it resolves
 * against whatever origin serves the static bundle rather than the API, and it
 * sends cookies where an edge function wants a Bearer JWT.
 *
 * A note in the file argued against converting them, on the grounds that
 * apiRequest routes to the functions host and would take the Stripe paths from
 * "works in dev, 404 in prod" to "404 in both". The premise is wrong, and this
 * test pins the reason: getApiUrl returns a RELATIVE path when apiBaseUrl is
 * empty, and it is empty in development.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('getApiUrl in development', () => {
  const config = read('client/src/lib/config.ts');

  it('returns a relative path when no base URL is configured', () => {
    expect(config).toContain('if (!config.apiBaseUrl) {');
    expect(config).toContain('return `/${cleanPath}`;');
  });

  it('and the base URL is empty in development', () => {
    // No VITE_API_BASE_URL override and import.meta.env.PROD false.
    const base = config.slice(config.indexOf('const getApiBaseUrl'));
    expect(base.slice(0, base.indexOf('};'))).toContain("return '';");
  });
});

describe('useSubscription', () => {
  const hook = read('client/src/hooks/useSubscription.ts');

  it('makes no bare fetch call', () => {
    const code = hook
      .split('\n')
      .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toContain("credentials: 'include'");
  });

  it('routes every billing call through apiRequest', () => {
    for (const path of [
      '/api/subscriptions/plans',
      '/api/subscriptions/usage',
      '/api/subscriptions/stripe/config',
      '/api/subscriptions/checkout',
      '/api/subscriptions/checkout/addon',
      '/api/subscriptions/portal',
      '/api/subscriptions/setup-intent',
    ]) {
      expect(hook).toContain(`apiRequest('${path}'`);
    }
  });
});

describe('the subscriptions edge function', () => {
  const fn = read('supabase/functions/subscriptions/index.ts');

  it('sends the plan list under the keys the hook reads', () => {
    // Was `{ data: plans }`, which the hook does not read - so correcting the
    // URL alone would still have rendered no plans and no feature comparison.
    // The URL and the shape were two separate breakages on the same call.
    expect(fn).toContain('plans: plans || [], features: features || []');
    expect(fn).not.toContain('{ data: plans || [] }');
  });

  it('reads the feature CATALOGUE for that list, not the tenant entitlements', () => {
    const plansBranch = fn.slice(fn.indexOf("secondSegment === 'plans'"));
    expect(plansBranch.slice(0, 2000)).toContain("from('subscription_features')");
  });

  it('has no Stripe branch, which is why PROD-STRIPE-001 exists', () => {
    // If this starts failing, the Stripe paths have been ported and the hook's
    // header note needs correcting with it.
    for (const branch of ["=== 'checkout'", "=== 'portal'", "=== 'setup-intent'"]) {
      expect(fn).not.toContain(branch);
    }
  });
});
