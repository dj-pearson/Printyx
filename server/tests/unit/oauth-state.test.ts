/**
 * The integration OAuth callback took its tenant out of the caller's own
 * string, on an endpoint with no authentication (round 129).
 *
 * `GET /api/integrations/:provider/callback` is necessarily unauthenticated -
 * an OAuth redirect carries no JWT - and it did this:
 *
 *     const [tenantId, providerId] = state.split('-');
 *     if (provider !== providerId) return redirect('...invalid_state');
 *     await IntegrationService.handleOAuthCallback(tenantId, provider, code, state);
 *
 * Three defects at once: it never compared the state to the one it issued
 * (the init handler wrote req.session.oauthState and nothing read it), it
 * took the tenant a connection is stored against from a query parameter, and
 * its one check could never pass - a tenant id is a uuid, so split('-')[1] is
 * four hex characters and never a provider name.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OAUTH_STATE_TTL_MS,
  constantTimeEquals,
  createOAuthState,
  verifyOAuthState,
} from '@shared/oauth-state';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const ROUTES = read('server/integrations/routes.ts');
const ROUTES_CODE = stripComments(ROUTES);
const EDGE_CODE = stripComments(read('supabase/functions/integrations/index.ts'));
const PAGE_CODE = stripComments(read('client/src/pages/IntegrationHub.tsx'));

const PROVIDERS = ['google-calendar', 'microsoft-calendar', 'salesforce', 'quickbooks', 'stripe'];
const TENANT = '550e8400-e29b-41d4-a716-446655440000';

describe('the old state could not have worked', () => {
  it('splitting a uuid tenant never yields a provider name', () => {
    // Not reasoned - run it. This is why every genuine callback redirected
    // with error=invalid_state, and the only reason the unauthenticated write
    // below was unreachable.
    for (const providerId of PROVIDERS) {
      const legacyState = `${TENANT}-${providerId}-user-1-${Date.now()}`;
      const [, parsedProvider] = legacyState.split('-');
      expect({ providerId, parsedProvider, matches: parsedProvider === providerId }).toEqual({
        providerId,
        parsedProvider,
        matches: false,
      });
    }
  });

  it('and the tenant it produced was eight characters of one', () => {
    const [parsedTenant] = `${TENANT}-salesforce-u-1`.split('-');
    expect(parsedTenant).toBe('550e8400');
    expect(parsedTenant).not.toBe(TENANT);
  });
});

describe('the state carries nothing', () => {
  const record = createOAuthState({ providerId: 'salesforce', tenantId: TENANT, userId: 'u-1' });

  it('is random hex of a useful length', () => {
    expect(record.state).toMatch(/^[0-9a-f]{64}$/);
  });

  it('contains no tenant, user or provider', () => {
    // A state you can parse is a state an attacker can write.
    for (const secret of [TENANT, '550e8400', 'u-1', 'salesforce']) {
      expect({ secret, leaked: record.state.includes(secret) }).toEqual({ secret, leaked: false });
    }
  });

  it('two calls do not collide', () => {
    const other = createOAuthState({ providerId: 'salesforce', tenantId: TENANT, userId: 'u-1' });
    expect(other.state).not.toBe(record.state);
  });
});

describe('verification', () => {
  const base = () =>
    createOAuthState({
      providerId: 'salesforce',
      tenantId: TENANT,
      userId: 'u-1',
      now: 1_000_000,
    });

  it('accepts the state it issued, and returns the STORED identity', () => {
    const stored = base();
    const result = verifyOAuthState({
      returnedState: stored.state,
      provider: 'salesforce',
      stored,
      now: 1_000_000 + 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    // The whole point: the tenant comes from here, never from the string.
    expect(result.record.tenantId).toBe(TENANT);
    expect(result.record.userId).toBe('u-1');
  });

  it('refuses a state the server never issued', () => {
    const stored = base();
    const result = verifyOAuthState({
      returnedState: 'f'.repeat(64),
      provider: 'salesforce',
      stored,
      now: 1_000_000,
    });
    expect(result).toEqual({ ok: false, reason: 'state_mismatch' });
  });

  it('refuses when nothing is pending, rather than trusting the caller', () => {
    expect(
      verifyOAuthState({ returnedState: 'a'.repeat(64), provider: 'salesforce', stored: null }),
    ).toEqual({ ok: false, reason: 'no_pending_authorization' });
  });

  it('refuses a missing state', () => {
    const stored = base();
    expect(verifyOAuthState({ returnedState: '', provider: 'salesforce', stored })).toEqual({
      ok: false,
      reason: 'missing_state',
    });
  });

  it('checks the provider against the STORED one, not against the string', () => {
    const stored = base();
    const result = verifyOAuthState({
      returnedState: stored.state,
      provider: 'quickbooks',
      stored,
      now: 1_000_000,
    });
    expect(result).toEqual({ ok: false, reason: 'provider_mismatch' });
  });

  it('expires', () => {
    const stored = base();
    expect(
      verifyOAuthState({
        returnedState: stored.state,
        provider: 'salesforce',
        stored,
        now: 1_000_000 + OAUTH_STATE_TTL_MS + 1,
      }),
    ).toEqual({ ok: false, reason: 'state_expired' });
    // And a request just inside the window is still fine.
    expect(
      verifyOAuthState({
        returnedState: stored.state,
        provider: 'salesforce',
        stored,
        now: 1_000_000 + OAUTH_STATE_TTL_MS,
      }).ok,
    ).toBe(true);
  });

  it('the window is long enough for a consent screen and short enough to matter', () => {
    expect(OAUTH_STATE_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(OAUTH_STATE_TTL_MS).toBeLessThanOrEqual(30 * 60 * 1000);
  });
});

describe('the comparison does not return early', () => {
  it('agrees with === on every case that matters', () => {
    const a = 'a'.repeat(64);
    expect(constantTimeEquals(a, a)).toBe(true);
    expect(constantTimeEquals(a, `b${a.slice(1)}`)).toBe(false);
    expect(constantTimeEquals(a, `${a.slice(0, 63)}b`)).toBe(false);
    expect(constantTimeEquals(a, a.slice(0, 63))).toBe(false);
    expect(constantTimeEquals('', '')).toBe(true);
    expect(constantTimeEquals('', a)).toBe(false);
  });

  it('has no early return in its loop', () => {
    const src = stripComments(read('shared/oauth-state.ts'));
    const at = src.indexOf('export function constantTimeEquals');
    const body = src.slice(at, src.indexOf('\n}', at));
    expect(body).toMatch(/for \(/);
    // A `return` inside the loop is the defect this function exists to avoid.
    // Bounded by the function's own final return - a marker, not a guess about
    // where the loop's closing brace is indented.
    const loopAt = body.indexOf('for (');
    const finalReturn = body.indexOf('return diff === 0');
    expect({ loopAt: loopAt > -1, finalReturn: finalReturn > loopAt }).toEqual({
      loopAt: true,
      finalReturn: true,
    });
    expect(body.slice(loopAt, finalReturn)).not.toMatch(/\breturn\b/);
  });
});

describe('the handlers use it', () => {
  it('init issues a random state and stores the whole record', () => {
    const at = ROUTES_CODE.indexOf("'/api/integrations/oauth/init'");
    expect(at).toBeGreaterThan(-1);
    const body = ROUTES_CODE.slice(at, ROUTES_CODE.indexOf("router.get('/api/integrations", at));
    expect(body).toMatch(/createOAuthState\(/);
    expect(body).toMatch(/req\.session\.oauthState = record/);
    // The derived state is gone.
    expect(body).not.toMatch(/initializeOAuth\(/);
  });

  it('the callback verifies, and takes the tenant from the record', () => {
    const at = ROUTES_CODE.indexOf("'/api/integrations/:provider/callback'");
    expect(at).toBeGreaterThan(-1);
    const body = ROUTES_CODE.slice(at, ROUTES_CODE.indexOf('/api/integrations/:integrationId', at));
    expect(body).toMatch(/verifyOAuthState\(/);
    expect(body).toMatch(/handleOAuthCallback\(\s*verdict\.record\.tenantId/);
    // The two lines that made it an unauthenticated tenant-named write.
    expect(body).not.toMatch(/state\.split\('-'\)/);
    expect(body).not.toMatch(/provider !== providerId/);
  });

  it('the state is single use, and cleared before the write', () => {
    const at = ROUTES_CODE.indexOf("'/api/integrations/:provider/callback'");
    const body = ROUTES_CODE.slice(at, ROUTES_CODE.indexOf('/api/integrations/:integrationId', at));
    const cleared = body.indexOf('delete req.session.oauthState');
    const write = body.indexOf('handleOAuthCallback(');
    expect({ cleared: cleared > -1 }).toEqual({ cleared: true });
    expect({ order: cleared < write }).toEqual({ order: true });
  });

  it('a failed verification redirects instead of proceeding', () => {
    const at = ROUTES_CODE.indexOf('verifyOAuthState(');
    const body = ROUTES_CODE.slice(at, at + 500);
    expect(body).toMatch(/if \(!verdict\.ok\)/);
    expect(body).toMatch(/return res\.redirect/);
  });
});

describe('production says why rather than 404ing', () => {
  it('the edge function refuses both halves with a named prerequisite', () => {
    expect(EDGE_CODE).toMatch(/OAUTH_STATE_IS_SESSION_BOUND/);
    expect(EDGE_CODE).toMatch(/segment1 === 'oauth' \|\| segment2 === 'callback'/);
    const at = EDGE_CODE.indexOf('OAUTH_STATE_IS_SESSION_BOUND');
    expect(EDGE_CODE.slice(at, at + 700)).toMatch(/\b501\b/);
  });

  it('and the branch sits above the trailing 405, or it never runs', () => {
    expect(EDGE_CODE.indexOf('OAUTH_STATE_IS_SESSION_BOUND')).toBeLessThan(
      EDGE_CODE.indexOf("error: 'Method not allowed'"),
    );
  });

  it('the page reaches it through apiRequest and tells the user', () => {
    expect(PAGE_CODE).not.toMatch(/fetch\('\/api\/integrations\/oauth\/init'/);
    expect(PAGE_CODE).toMatch(/apiRequest<\{ authUrl: string \}>\(/);
    // It used to swallow the failure into console.error, so the button did
    // nothing visible.
    const at = PAGE_CODE.indexOf('apiRequest<{ authUrl: string }>(');
    expect(PAGE_CODE.slice(at, at + 900)).toMatch(/toast\(/);
  });

  it('and it is off the raw-fetch baseline', () => {
    const baseline = JSON.parse(read('docs/raw-api-fetch-baseline.json'));
    const stillListed = (baseline.allowed as string[]).some((k) =>
      k.startsWith('client/src/pages/IntegrationHub.tsx:'),
    );
    expect(stillListed).toBe(false);
    expect(
      baseline.reasons['client/src/pages/IntegrationHub.tsx:/api/integrations/oauth/init'],
    ).toBeUndefined();
  });
});
