/**
 * Self-service registration reaches the one handler that provisions (LAUNCH-008)
 * and is rate limited on the way (LAUNCH-010).
 *
 * THREE IMPLEMENTATIONS OF ONE CONCEPT, AND THE LIVE ONE PROVISIONED NOTHING.
 *
 *   supabase.auth.signUp()        what Signup.tsx actually called. Creates a
 *                                 GoTrue account and nothing else: the metadata
 *                                 blob the page assembles lands in
 *                                 `user_metadata`, which resolve-tenant.ts
 *                                 ignores on purpose because the session holder
 *                                 can rewrite it.
 *   supabase/functions/signup/    creates the tenant, resolves COMPANY_ADMIN,
 *                                 writes the `users` row and sets
 *                                 app_metadata.tenantId/roleId - and had NO
 *                                 CALLER in any of the seven client trees.
 *   POST /api/auth/signup         Express, dev-only, a different auth model
 *                                 entirely: bcrypts a password into `users` and
 *                                 creates no GoTrue user, so the account it
 *                                 makes cannot sign in through the client SDK.
 *
 * So every self-service registration produced an account with no tenant, no
 * role and no users row, and every edge function answered "No tenant ID found"
 * for it. The page's metadata object matches the edge function's request
 * interface field for field, which is the tell: it was written for that handler
 * and wired to the other thing.
 *
 * Giving an unreferenced edge function its first caller is what turns a
 * baselined gap into a live surface (COP-B03), and this one is unauthenticated
 * and writes rows and sends email - so the throttle ships in the same commit.
 */
import { describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_SIGNUP_LIMITS,
  firstForwardedAddress,
  identityBucket,
  signupBuckets,
  signupThrottleDecision,
  sourceBucket,
  pageBucket,
  throttleDecision,
  SIGNUP_SURFACE_BUCKET,
} from '@shared/public-throttle';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SIGNUP_FN = read('supabase/functions/signup/index.ts');
const AUTH_HOOK = read('client/src/hooks/useSupabaseAuth.ts');
const PROXY = read('server/middleware/edge-function-proxy.ts');

/**
 * A REAL one-way digest, not a stub that echoes its input.
 *
 * COP-B14 recorded this exact failure once already: "a test stub that ECHOES
 * its input proves nothing about hiding", and the assertion that a bucket never
 * contains the address fails on the stub rather than passing on the code. It
 * cost a second occurrence here before the lesson stuck.
 */
const digest = async (input: string) => createHash('sha256').update(input, 'utf8').digest('hex');

describe('the signup page reaches the handler that provisions a tenant', () => {
  it('signup() POSTs to /api/signup rather than calling supabase.auth.signUp', () => {
    const bare = stripComments(AUTH_HOOK);
    const at = bare.indexOf('const signup = useCallback');
    expect(at).toBeGreaterThan(-1);
    // Bound to the next declaration, not to a character count.
    const next = bare.indexOf('useCallback', at + 30);
    const body = bare.slice(at, next === -1 ? undefined : next);
    // (url, method, body). The first cut of this file wrote the method first,
    // which sends the request to a URL of "POST"; check:api-request-args caught
    // it, so the assertion pins the argument ORDER and not just the two values.
    expect(body).toMatch(/apiRequest\(\s*'\/api\/signup',\s*'POST'/);
    expect(body).not.toMatch(/supabase\.auth\.signUp/);
  });

  it('nothing in the hook calls supabase.auth.signUp any more', () => {
    // Comment-stripped: the explanation above the callback names the call it
    // replaced, and an absence assertion that matches prose reports its own
    // explanation as the defect.
    expect(stripComments(AUTH_HOOK)).not.toMatch(/supabase\.auth\.signUp\(/);
  });

  it('the body it sends is the shape the handler destructures', () => {
    const bare = stripComments(AUTH_HOOK);
    for (const key of ['email', 'password', 'metadata']) {
      expect({ key, sent: new RegExp(`\\n\\s+${key},`).test(bare) }).toEqual({ key, sent: true });
    }
    expect(stripComments(SIGNUP_FN)).toMatch(
      /const \{ email, password, metadata \}: SignupRequest = await req\.json\(\)/,
    );
  });

  it('the page still assembles every metadata field the handler declares', () => {
    // The contract that proves the page was written for this handler. Derived
    // from the handler's own interface rather than pinned, so a field added
    // there fails here instead of silently never being sent.
    const iface = SIGNUP_FN.slice(
      SIGNUP_FN.indexOf('metadata: {'),
      SIGNUP_FN.indexOf('}\n}', SIGNUP_FN.indexOf('metadata: {')),
    );
    const declared = [...iface.matchAll(/^\s{4}(\w+)\??:/gm)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(10);
    const page = read('client/src/pages/Signup.tsx');
    const missing = declared.filter((f) => !new RegExp(`\\b${f}:`).test(page));
    expect(missing).toEqual([]);
  });

  it('dev runs the same handler: /api/signup is proxied', () => {
    expect(stripComments(PROXY)).toMatch(/'\/api\/signup':\s*'signup'/);
  });

  it('the proxy entry cannot capture /api/signup-crm', async () => {
    // app.use matches on segment boundaries, so '/api/signup' does not mount
    // over '/api/signup-crm'. Proven by RUNNING express rather than by
    // remembering: this is the collision that would take a working prefix off
    // Express, and the first cut of this assertion pinned where the sibling
    // prefix happened to be WRITTEN, which broke the moment that list moved
    // into a module of its own.
    expect(stripComments(PROXY)).not.toMatch(/'\/api\/signup\/'/);

    const app = express();
    app.use('/api/signup', (_req, res) => res.json({ hit: 'signup' }));
    app.use('/api/signup-crm', (_req, res) => res.json({ hit: 'crm' }));
    app.use((_req, res) => res.json({ hit: 'neither' }));
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const hit = async (u: string) =>
        (await (await fetch(`http://127.0.0.1:${port}${u}`, { method: 'POST' })).json()).hit;
      expect(await hit('/api/signup')).toBe('signup');
      expect(await hit('/api/signup-crm')).toBe('crm');
      expect(await hit('/api/signupx')).toBe('neither');
    } finally {
      server.close();
    }
  });
});

describe('the signup surface is rate limited before it writes or emails', () => {
  const fn = stripComments(SIGNUP_FN);

  it('the REFUSAL sits above the first write, not merely the computation', () => {
    // Bound to the gate rather than to the call. A first cut asserted the
    // position of `signupThrottleDecision(`, which a mutant satisfied by
    // computing the decision and then ignoring it - the answer has to be acted
    // on above the writes, and that is the `return` inside the refusal branch.
    const guard = fn.indexOf('if (!decision.allowed)');
    expect(guard).toBeGreaterThan(-1);
    const refuse = fn.indexOf('return createCorsResponse(', guard);
    expect(refuse).toBeGreaterThan(guard);
    // The decision must come from the throttle, not from a constant.
    expect(fn.slice(0, guard)).toMatch(/const decision = signupThrottleDecision\(/);

    for (const [label, marker] of [
      ['tenant insert', "from('tenants').insert("],
      ['auth user', 'auth.admin.createUser'],
      ['verification email', 'auth.admin.generateLink'],
    ] as const) {
      const at = fn.indexOf(marker);
      expect({ label, found: at > -1 }).toEqual({ label, found: true });
      expect({ label, afterRefusal: at > refuse }).toEqual({ label, afterRefusal: true });
    }
  });

  it('a refusal is a 429 that names no bucket', () => {
    const at = fn.indexOf('if (!decision.allowed)');
    expect(at).toBeGreaterThan(-1);
    const block = fn.slice(at, fn.indexOf('await recordAttempt', at + 40));
    expect(block).toMatch(/SIGNUP_RATE_LIMITED/);
    expect(block).toMatch(/\n\s+429,/);
    expect(block).toMatch(/retryAfterSeconds: decision\.retryAfterSeconds/);
    // Saying which of the three buckets was hit tells a caller what to vary.
    for (const leak of ['decision.reason', "'email'", "'surface'"]) {
      expect({ leak, present: block.includes(leak) }).toEqual({ leak, present: false });
    }
  });

  it('an attempt is recorded before the work, so a half-failed one still counts', () => {
    const record = fn.indexOf('await recordAttempt(supabaseAdmin, bucketList, null)');
    expect(record).toBeGreaterThan(-1);
    expect(record).toBeLessThan(fn.indexOf("from('tenants').insert("));
  });

  it('it counts all three buckets, not just the address', () => {
    const at = fn.indexOf('const [sourceAttempts, emailAttempts, surfaceAttempts]');
    expect(at).toBeGreaterThan(-1);
    const block = fn.slice(at, fn.indexOf('const decision', at));
    for (const bucket of ['buckets.source', 'buckets.email', 'buckets.surface']) {
      expect({
        bucket,
        counted: block.includes(`countSince(supabaseAdmin, ${bucket}, since)`),
      }).toEqual({ bucket, counted: true });
    }
  });

  it('it uses the durable counter, not the per-instance one', () => {
    // _shared/rate-limit.ts says in its own header that it is per-Deno-instance
    // and that hard multi-instance limits want a database counter.
    expect(fn).toMatch(/public_booking_attempts/);
    expect(fn).not.toMatch(/_shared\/rate-limit\.ts/);
    expect(read('supabase/functions/_shared/rate-limit.ts')).toMatch(/Per-Deno-instance/);
  });

  it('the prune sweep is prefix-agnostic, so the borrowed table does not fill up', () => {
    const cron = read('drizzle/cron/booking-reminders.sql');
    const at = cron.indexOf('DELETE FROM public_booking_attempts');
    expect(at).toBeGreaterThan(-1);
    const stmt = cron.slice(at, cron.indexOf(';', at));
    expect(stmt).toMatch(/created_at </);
    expect(stmt).not.toMatch(/bucket/);
  });

  it('the honeypot is deliberately not wired, because this form has a website field', () => {
    // public-booking passes b.website to botSignals; copying that here would
    // refuse every company that filled in its own website.
    expect(fn).not.toMatch(/botSignals\(/);
    expect(read('client/src/pages/Signup.tsx')).toMatch(/website:/);
    expect(SIGNUP_FN).toMatch(/HONEYPOT IS DELIBERATELY NOT WIRED/);
  });
});

describe('the throttle arithmetic', () => {
  it('allows a normal registration', () => {
    expect(signupThrottleDecision(0, 0, 0).allowed).toBe(true);
    expect(signupThrottleDecision(2, 2, 29).allowed).toBe(true);
  });

  it('refuses one address hammering, and says source', () => {
    const d = signupThrottleDecision(DEFAULT_SIGNUP_LIMITS.perSource, 0, 0);
    expect(d).toMatchObject({
      allowed: false,
      reason: 'source',
      retryAfterSeconds: DEFAULT_SIGNUP_LIMITS.windowSeconds,
    });
  });

  it('refuses a flood aimed at one inbox from many addresses', () => {
    // The case the per-source limit cannot see: a botnet sending one victim
    // twenty verification emails stays under the surface limit.
    expect(signupThrottleDecision(0, DEFAULT_SIGNUP_LIMITS.perEmail, 0)).toMatchObject({
      allowed: false,
      reason: 'email',
    });
  });

  it('refuses a flood across the whole surface', () => {
    expect(signupThrottleDecision(0, 0, DEFAULT_SIGNUP_LIMITS.perSurface)).toMatchObject({
      allowed: false,
      reason: 'surface',
    });
  });

  it('reports the narrowest exhausted bucket when several are', () => {
    expect(signupThrottleDecision(99, 99, 99).reason).toBe('source');
    expect(signupThrottleDecision(0, 99, 99).reason).toBe('email');
  });

  it('takes explicit limits', () => {
    const limits = { perSource: 1, perEmail: 1, perSurface: 1, windowSeconds: 60 };
    expect(signupThrottleDecision(0, 0, 0, limits).allowed).toBe(true);
    expect(signupThrottleDecision(1, 0, 0, limits)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });
});

describe('bucket keys identify a repeat without recording who', () => {
  it('the email is hashed, never stored', async () => {
    const b = await signupBuckets('203.0.113.7', 'victim@example.com', digest);
    for (const key of Object.values(b)) {
      expect({ key, leaks: key.includes('victim@example.com') }).toEqual({ key, leaks: false });
    }
  });

  it('the address is hashed, never stored', async () => {
    const b = await signupBuckets('203.0.113.7', 'a@b.com', digest);
    expect(b.source).not.toContain('203.0.113.7');
  });

  it('case and whitespace do not make a second bucket', async () => {
    const a = await signupBuckets('203.0.113.7', 'Person@Example.com', digest);
    const b = await signupBuckets('203.0.113.7', ' person@example.com ', digest);
    expect(a.email).toBe(b.email);
  });

  it('different emails get different buckets', async () => {
    const a = await signupBuckets(null, 'a@example.com', digest);
    const b = await signupBuckets(null, 'b@example.com', digest);
    expect(a.email).not.toBe(b.email);
  });

  it('the address and the email cannot collide on one value', async () => {
    const b = await signupBuckets('a@example.com', 'a@example.com', digest);
    expect(b.source).not.toBe(b.email);
  });

  it('an unknown source is throttled, not exempt', async () => {
    const b = await signupBuckets(null, null, digest);
    expect(b.source).toBe('signup:ip:unknown');
    expect(b.email).toBe('signup:email:unknown');
    expect(b.surface).toBe(SIGNUP_SURFACE_BUCKET);
  });

  it('every source shares one surface bucket', async () => {
    const a = await signupBuckets('203.0.113.7', 'a@b.com', digest);
    const b = await signupBuckets('198.51.100.9', 'c@d.com', digest);
    expect(a.surface).toBe(b.surface);
    expect(a.source).not.toBe(b.source);
  });

  it('x-forwarded-for is a list and the client is the first entry', () => {
    expect(firstForwardedAddress('203.0.113.7, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.7');
    expect(firstForwardedAddress('  203.0.113.7  ')).toBe('203.0.113.7');
    expect(firstForwardedAddress(null)).toBe('');
  });

  it('identityBucket namespaces, so one value in two roles is two buckets', async () => {
    expect(await identityBucket('a', 'x', digest)).not.toBe(await identityBucket('b', 'x', digest));
  });
});

describe('the booking surface is unchanged by the generalisation', () => {
  it('its bucket keys are byte-identical to what they were', async () => {
    // Live counters key on these strings. Changing them silently resets every
    // window, which is harmless and is still a behaviour change nobody asked
    // for - so the legacy shape is asserted rather than assumed.
    expect(await sourceBucket('demo', '203.0.113.7', digest)).toBe(
      `booking:demo:${await digest('demo|203.0.113.7')}`,
    );
    expect(await sourceBucket('demo', null, digest)).toBe('booking:demo:unknown');
    expect(pageBucket('demo')).toBe('booking-page:demo');
  });

  it('its two-bucket decision still behaves exactly as before', () => {
    expect(throttleDecision(0, 0).allowed).toBe(true);
    expect(throttleDecision(5, 0)).toMatchObject({ allowed: false, reason: 'source' });
    expect(throttleDecision(0, 60)).toMatchObject({ allowed: false, reason: 'page' });
    expect(throttleDecision(99, 99).reason).toBe('source');
  });
});

describe('what LAUNCH-010 cannot close from this repository', () => {
  /**
   * The story asks for rate limiting on "authentication endpoints". Registration
   * is closed above. LOGIN is not, and cannot be from here: the web app calls
   * supabase.auth.signInWithPassword straight against GoTrue, so there is no
   * handler in this tree on that path and brute-force protection for it is
   * GoTrue's configuration. Saying so beats installing a control that reads
   * nothing (AUDIT-034).
   *
   * These assertions are built to FAIL the day that stops being true.
   */
  it('the web login still goes straight to GoTrue, so there is nothing here to limit', () => {
    expect(read('client/src/hooks/useSupabaseAuth.ts')).toMatch(
      /supabase\.auth\.signInWithPassword/,
    );
    // No edge function directory owns the /api/auth prefix.
    expect(() => read('supabase/functions/auth/index.ts')).toThrow();
  });

  it('the mobile login endpoint, which IS in this tree, is limited', () => {
    const mobileAuth = read('supabase/functions/mobile-auth/index.ts');
    const at = mobileAuth.indexOf('signInWithPassword');
    expect(at).toBeGreaterThan(-1);
    const before = mobileAuth.slice(Math.max(0, at - 1200), at);
    expect(before).toMatch(/rateLimit\(/);
  });
});
