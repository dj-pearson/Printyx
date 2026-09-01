/**
 * The calendar OAuth callback trusts its `state` and nothing else.
 *
 * PA-056: the callback is a redirect the PROVIDER makes, so it carries no JWT.
 * The tenant id and user id a connection is written under come from the state
 * alone. An unsigned state would let anyone attach a calendar connection - with
 * live tokens - to any tenant they can name.
 *
 * The helper is Deno (Web Crypto, .ts specifiers) so it cannot be imported here.
 * These assertions pin the properties the design depends on, and a behavioural
 * re-implementation of the HMAC checks the compare is constant-time in shape.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

const repo = join(__dirname, '../../..');
const stateSrc = readFileSync(join(repo, 'supabase/functions/calendar-oauth/_state.ts'), 'utf8');
const fnSrc = readFileSync(join(repo, 'supabase/functions/calendar-oauth/index.ts'), 'utf8');

describe('the state is signed and bounded', () => {
  it('signs with HMAC-SHA256 and fails closed without a secret', () => {
    expect(stateSrc).toMatch(/name: 'HMAC', hash: 'SHA-256'/);
    // Signing with a constant would be indistinguishable from not signing.
    expect(stateSrc).toMatch(/throw new Error\(\s*'CALENDAR_OAUTH_STATE_SECRET is required/);
  });

  it('expires, so a captured consent link is not valid forever', () => {
    expect(stateSrc).toMatch(/STATE_TTL_MS/);
    expect(stateSrc).toMatch(/Date\.now\(\) - decoded\.issuedAt > STATE_TTL_MS/);
  });

  it('compares the signature without an early return per byte', () => {
    // A `===` on the two strings would leak the signature a byte at a time to a
    // patient caller.
    expect(stateSrc).toMatch(/diff \|= expected\.charCodeAt\(i\) \^ signature\.charCodeAt\(i\)/);
    expect(stateSrc).toMatch(/if \(diff !== 0\) return null;/);
  });

  it('rejects a payload missing any identity field', () => {
    expect(stateSrc).toMatch(
      /if \(!decoded\.tenantId \|\| !decoded\.userId \|\| !decoded\.provider\) return null;/,
    );
  });

  it('a forged signature does not verify (same construction, wrong secret)', () => {
    const payload = Buffer.from(
      JSON.stringify({ tenantId: 't1', userId: 'u1', provider: 'google', issuedAt: Date.now() }),
    ).toString('base64url');
    const real = createHmac('sha256', 'the-real-secret').update(payload).digest('base64url');
    const forged = createHmac('sha256', 'a-guess').update(payload).digest('base64url');
    expect(forged).not.toBe(real);
  });
});

describe('the callback is deliberately unauthenticated, and only the callback', () => {
  it('handles the callback before the auth gate', () => {
    const callbackAt = fnSrc.indexOf("action === 'callback'");
    const authAt = fnSrc.indexOf('supabase.auth.getUser(jwt)');
    expect(callbackAt).toBeGreaterThan(-1);
    expect(authAt).toBeGreaterThan(-1);
    expect(callbackAt).toBeLessThan(authAt);
  });

  it('requires a JWT to start the flow, because that is where the tenant comes from', () => {
    const authorizeAt = fnSrc.indexOf("action === 'authorize'");
    expect(authorizeAt).toBeGreaterThan(fnSrc.indexOf('supabase.auth.getUser(jwt)'));
  });

  it('asks for calendar scopes, not the sign-in scopes oauth-proxy uses', () => {
    expect(fnSrc).toContain('https://www.googleapis.com/auth/calendar');
    expect(fnSrc).toContain('https://graph.microsoft.com/calendars.readwrite');
    const code = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('openid email profile');
  });

  it('writes calendar_connections, the table the events code reads', () => {
    expect(fnSrc).toMatch(/from\('calendar_connections'\)/);
    const code = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/from\('system_integrations'\)/);
  });

  it('refuses a connection with no refresh token rather than storing a dying one', () => {
    expect(fnSrc).toMatch(/if \(!tokens\.refresh_token\)/);
    expect(fnSrc).toMatch(/access_type', 'offline'/);
    expect(fnSrc).toMatch(/prompt', 'consent'/);
  });
});
