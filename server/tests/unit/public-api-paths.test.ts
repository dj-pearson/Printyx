/**
 * A path list written with the mount prefix, compared against a path that has
 * it stripped (LAUNCH-008, round 117).
 *
 * Express rewrites `req.url` inside a handler mounted with a path, so under
 * `app.use('/api', mw)` a request for `/api/health` arrives as
 * `req.path === '/health'` with `req.baseUrl === '/api'`. Two middleware in
 * server/routes.ts compared that stripped path against literals written in full
 * `/api/...` form, and the two failures are mirror images:
 *
 *   the auth gate        publicPaths matched NOTHING, so no path was public and
 *                        an unauthenticated caller was 401'd on the health
 *                        probe, the CSRF token and the inbound webhook
 *                        receiver - which is how a signed Stripe delivery gets
 *                        dropped without an error anybody reads.
 *   blockRegistrations   blockedPaths matched NOTHING, so the pre-launch
 *                        registration lock never fired once, on any host, since
 *                        it was written.
 *
 * CLAUDE.md already records this exact mistake one middleware over -
 * "pathRequiresMfa(req.path) can never match, because app.use(path, mw) strips
 * the mount prefix" - where it made a control inert. Here it made a gate refuse
 * everything it was written to let through.
 */
import { describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_API_PATHS, fullApiPath, isPublicApiPath } from '../../lib/public-api-paths';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Express strips the mount prefix, which is the whole defect', () => {
  it('a middleware mounted at /api sees the sub-path, not the full one', async () => {
    // Proven by running Express rather than by remembering. Everything below
    // rests on this, so it is measured once, here.
    const app = express();
    const seen: { path: string; baseUrl: string; originalUrl: string }[] = [];
    app.use('/api', (req, res) => {
      seen.push({ path: req.path, baseUrl: req.baseUrl, originalUrl: req.originalUrl });
      res.json({ ok: true });
    });
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      for (const url of ['/api/health', '/api/webhooks/stripe', '/api/signup']) {
        await fetch(`http://127.0.0.1:${port}${url}`, { method: 'POST' });
      }
    } finally {
      server.close();
    }
    expect(seen.map((s) => s.path)).toEqual(['/health', '/webhooks/stripe', '/signup']);
    expect(seen.every((s) => s.baseUrl === '/api')).toBe(true);
    // And the old comparison, run against those real values, matched nothing.
    for (const s of seen) {
      expect({ path: s.path, matchedOldWay: PUBLIC_API_PATHS.some((p) => s.path === p) }).toEqual({
        path: s.path,
        matchedOldWay: false,
      });
    }
  });

  it('fullApiPath puts the prefix back, and carries no query string', () => {
    expect(fullApiPath({ baseUrl: '/api', path: '/health' })).toBe('/api/health');
    expect(fullApiPath({ baseUrl: '', path: '/api/health' })).toBe('/api/health');
    expect(fullApiPath({})).toBe('');
  });
});

describe('isPublicApiPath', () => {
  it('lets every listed prefix through, exactly and as a sub-path', () => {
    for (const p of PUBLIC_API_PATHS) {
      expect({ p, exact: isPublicApiPath(p) }).toEqual({ p, exact: true });
      expect({ p, sub: isPublicApiPath(`${p}/anything/deeper`) }).toEqual({ p, sub: true });
    }
  });

  it('matches at a segment boundary, so a longer word is not public (CR-014)', () => {
    expect(isPublicApiPath('/api/authx')).toBe(false);
    expect(isPublicApiPath('/api/health-internal')).toBe(false);
    expect(isPublicApiPath('/api/webhooksx')).toBe(false);
  });

  it('refuses everything else', () => {
    for (const p of ['/api/customers', '/api/deals', '/api/admin/audit-logs', '/api', '']) {
      expect({ p, open: isPublicApiPath(p) }).toEqual({ p, open: false });
    }
  });

  it('ignores a query string rather than failing to match on it', () => {
    expect(isPublicApiPath('/api/health?verbose=1')).toBe(true);
    expect(isPublicApiPath('/api/deals?limit=1')).toBe(false);
  });

  it('the inbound webhook receiver is public, or signed deliveries are dropped', () => {
    // INTEG-WEBHOOK-001: a provider sends no JWT, and the proxy falls through
    // only on a network error - never on a 401.
    expect(isPublicApiPath('/api/webhooks/stripe')).toBe(true);
    expect(isPublicApiPath('/api/webhooks/google-calendar')).toBe(true);
  });

  it('self-service signup is public, and does not open the marketing prefix', () => {
    // LAUNCH-008 pointed the signup page at /api/signup; the caller has no
    // account yet by definition. /api/signup-crm is a separate entry, and the
    // boundary rule is what keeps one from covering the other.
    expect(isPublicApiPath('/api/signup')).toBe(true);
    expect(isPublicApiPath('/api/signupx')).toBe(false);
  });
});

describe('the gate uses it, on the full path', () => {
  const ROUTES = stripComments(read('server/routes.ts'));

  it('compares the full path, never the stripped one', () => {
    const at = ROUTES.indexOf('Require authentication');
    const gate = ROUTES.indexOf('isPublicApiPath(', at === -1 ? 0 : at);
    expect(gate).toBeGreaterThan(-1);
    expect(ROUTES).toMatch(/isPublicApiPath\(fullApiPath\(req\)\)/);
    // The inline array is gone, so there is one list.
    expect(ROUTES).not.toMatch(/const publicPaths = \[/);
  });

  it('still 401s a caller with no user on a non-public path', () => {
    const at = ROUTES.indexOf('isPublicApiPath(fullApiPath(req))');
    const block = ROUTES.slice(at, ROUTES.indexOf('});', at));
    expect(block).toMatch(/getUserId\(req\)/);
    expect(block).toMatch(/401/);
    expect(block).toMatch(/UNAUTHORIZED/);
  });
});

describe('what unmounting the registration lock leaves open', () => {
  /**
   * `blockRegistrations` 503'd a list of registration paths with a hardcoded
   * "launching October 1st, 2025" message. It never fired - its literals
   * carried the `/api` prefix the mount had already stripped - so deleting it
   * opens nothing that was closed.
   *
   * IT WAS NOT REPAIRED, and that is a decision rather than an omission.
   * Production never runs this middleware: /api/signup resolves to the edge
   * function on the functions host, so a lock here would have closed
   * registration on developer machines only, while the deployed product stayed
   * open - two hosts disagreeing about whether the business accepts customers.
   * A real kill switch belongs in supabase/functions/signup/, which is what
   * production runs.
   *
   * These assertions FAIL the day somebody reintroduces an Express-only lock,
   * so the gap is work rather than a note that goes stale.
   */
  it('the middleware is gone and nothing imports it', () => {
    expect(existsSync(join(repo, 'server/middleware/registration-lock.ts'))).toBe(false);
    expect(stripComments(read('server/routes.ts'))).not.toMatch(/blockRegistrations/);
  });

  it('the unmount site says why, for the next reader', () => {
    // Checked against RAW source: here the comment IS the property.
    expect(read('server/routes.ts')).toMatch(/blockRegistrations was unmounted here/);
  });

  it('there is still no registration kill switch on the host that serves it', () => {
    const fn = read('supabase/functions/signup/index.ts');
    expect(fn).not.toMatch(/SIGNUPS_DISABLED|REGISTRATIONS_DISABLED|registrationsClosed/);
    // The rate limit is what the surface has instead, and it is not a switch.
    expect(fn).toMatch(/signupThrottleDecision\(/);
  });
});

describe('the billing rate-limit tier could never be selected', () => {
  const RL = stripComments(read('server/middleware/user-rate-limit.ts'));

  it('classifies on the full path now', () => {
    const at = RL.indexOf('export function globalTieredRateLimit');
    expect(at).toBeGreaterThan(-1);
    const body = RL.slice(at, RL.indexOf('\n}', at));
    expect(body).toMatch(/const path = fullApiPath\(req\)\.toLowerCase\(\);/);
    expect(body).not.toMatch(/const path = req\.path\.toLowerCase\(\);/);
  });

  it('the billing literals it tests are ones a full path can carry', () => {
    // Configured at 20/min, mounted, and documented in its own comment - and
    // every startsWith('/api/billing') was false, because the mount had taken
    // the prefix off. Billing traffic fell through to mutation (100/min) and
    // read (200/min).
    const at = RL.indexOf('export function globalTieredRateLimit');
    const body = RL.slice(at, RL.indexOf('\n}', at));
    const billing = body.slice(
      body.indexOf('billingLimiter') - 600,
      body.indexOf('billingLimiter'),
    );
    let checked = 0;
    for (const lit of [
      '/api/billing',
      '/api/stripe',
      '/api/subscriptions',
      '/api/invoices',
      '/api/payments',
    ]) {
      expect({ lit, tested: billing.includes(`startsWith('${lit}')`) }).toEqual({
        lit,
        tested: true,
      });
      // The property: the string the classifier sees must be able to contain it.
      expect({
        lit,
        reachable: fullApiPath({ baseUrl: '/api', path: lit.slice(4) }) === lit,
      }).toEqual({
        lit,
        reachable: true,
      });
      checked += 1;
    }
    expect(checked).toBe(5);
  });

  it('the auth branch survived only because it uses includes, not startsWith', () => {
    // Worth recording: `/auth/login` contains `/auth/` whichever end the prefix
    // is on, so the strictest tier kept working by luck rather than by design.
    const at = RL.indexOf('export function globalTieredRateLimit');
    const body = RL.slice(at, RL.indexOf('authLimiter(req, res, next)', at));
    expect(body).toMatch(/path\.includes\('\/auth\/'\)/);
    expect(body).not.toMatch(/path\.startsWith\('\/api\/auth/);
  });
});

describe('the guard that would have caught all three', () => {
  it('reports a literal that can never match under its mount', async () => {
    const { findings } = await import('../../../scripts/check-mounted-path-lists.mjs');
    const found = findings();
    // Only the deliberate api-versioning entries remain, and they are baselined
    // with a reason rather than silenced.
    const baseline = JSON.parse(read('docs/mounted-path-lists-baseline.json'));
    expect(found.map((f) => f.key).sort()).toEqual([...baseline.entries].sort());
    expect(baseline.entries.length).toBeGreaterThan(0);
    expect(new Set(baseline.entries).size).toBe(baseline.entries.length);
  });

  it('the walk resolves real mounts, so a parser that stops matching fails here', async () => {
    // The CLI carries a floor for this, and a floor inside main() is not
    // exercised by importing the module - so the property is asserted where the
    // test can see it. A mount table that resolves nothing reports nothing, and
    // reporting nothing is what a clean run looks like.
    const { mountedBodies } = await import('../../../scripts/check-mounted-path-lists.mjs');
    const mounts = mountedBodies();
    expect(mounts.length).toBeGreaterThanOrEqual(20);
    // Both shapes the resolver has to handle are present: an inline arrow, and
    // an identifier resolved through this file's imports.
    expect(mounts.some((m: { label: string }) => m.label.includes('(inline at '))).toBe(true);
    expect(mounts.some((m: { label: string }) => m.label.includes(' -> server/'))).toBe(true);
    // And the gate this story fixed is one of them.
    expect(mounts.some((m: { prefix: string }) => m.prefix === '/api')).toBe(true);
  });

  it('every baselined entry is explained, not just listed', () => {
    const baseline = JSON.parse(read('docs/mounted-path-lists-baseline.json'));
    expect(baseline.note).toMatch(/DELIBERATELY NOT REPAIRED/);
    expect(baseline.note).toMatch(/api-versioning/);
    for (const entry of baseline.entries) {
      expect({ entry, explained: baseline.note.includes('api-versioning') }).toEqual({
        entry,
        explained: true,
      });
    }
  });

  it('it exempts the sanctioned spelling, or it argues for the broken one', async () => {
    // Plain substrings, not a regex escaped through two layers: the thing under
    // test IS a regex, and asserting one with another is how an assertion ends
    // up passing for a reason nobody can read.
    const src = read('scripts/check-mounted-path-lists.mjs');
    expect(src).toContain('const USES_UNSTRIPPED =');
    expect(src).toContain('fullApiPath\\(');
    expect(src).toContain('req\\.(originalUrl|baseUrl)');
  });

  it('it is wired into CI, not merely runnable', () => {
    expect(read('package.json')).toMatch(/"check:mounted-path-lists"/);
    expect(read('.github/workflows/ci.yml')).toMatch(/npm run check:mounted-path-lists/);
  });
});

describe('the same mistake, still present and deliberately not changed', () => {
  it('legacyRouteSupport is inert for exactly this reason', () => {
    // Mounted at `app.use('/api', legacyRouteSupport(...))`, it bails on
    // `if (!req.path.startsWith('/api/')) return next()` - always true once the
    // prefix is stripped - so it never rewrites a path. Left alone on purpose:
    // repairing it would START rewriting every unversioned API path into
    // /api/v1/..., which is a routing change nobody asked for, not a bug fix.
    const src = stripComments(read('server/middleware/api-versioning.ts'));
    expect(src).toMatch(/if \(!req\.path\.startsWith\('\/api\/'\)\) \{/);
    expect(stripComments(read('server/routes.ts'))).toMatch(
      /app\.use\(\s*'\/api',\s*\n?\s*legacyRouteSupport\(/,
    );
  });
});
