/**
 * AUDIT-005 — edge-function auth cache.
 *
 * This sits in front of authentication for ~212 edge functions, so the safety
 * invariants are pinned here rather than assumed. Each test maps to an invariant
 * documented in supabase/functions/_shared/auth-cache.ts.
 *
 * The module is import-clean (no supabase-js, no Deno APIs at module scope)
 * specifically so it can be exercised by this runner.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cachedGetUser,
  cachedRoleLookup,
  clearAuthCaches,
  authCacheStats,
  decodeJwtExpMs,
  sha256Hex,
  TtlCache,
  type GetUserCapable,
} from '../../../supabase/functions/_shared/auth-cache';

/** Build an unsigned JWT with a given exp (seconds). Only the payload matters here. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
const inSeconds = (n: number) => Math.floor(Date.now() / 1000) + n;

/** Fake GoTrue that counts round-trips. */
function fakeClient(user: unknown, error: unknown = null) {
  let calls = 0;
  const client: GetUserCapable = {
    auth: {
      getUser: async () => {
        calls++;
        return { data: error ? null : { user }, error };
      },
    },
  };
  return { client, calls: () => calls };
}

beforeEach(() => clearAuthCaches());

describe('AUDIT-005: cachedGetUser', () => {
  it('hits GoTrue once, then serves repeats from cache', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const { client, calls } = fakeClient({ id: 'u1' });

    const first = await cachedGetUser(client, jwt);
    const second = await cachedGetUser(client, jwt);
    const third = await cachedGetUser(client, jwt);

    expect(calls()).toBe(1); // the whole point: 3 requests, 1 round-trip
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(third.cached).toBe(true);
    expect((second.data as any).user).toEqual({ id: 'u1' });
  });

  it('INVARIANT 1: never caches an error (a failure cannot be replayed)', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const { client, calls } = fakeClient(null, { message: 'bad token' });

    const a = await cachedGetUser(client, jwt);
    const b = await cachedGetUser(client, jwt);

    expect(a.error).toBeTruthy();
    expect(b.cached).toBe(false);
    expect(calls()).toBe(2); // re-asked GoTrue rather than trusting a cached failure
    expect(authCacheStats().users).toBe(0);
  });

  it('a transient GoTrue blip does not lock the user out afterwards', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    let fail = true;
    const client: GetUserCapable = {
      auth: {
        getUser: async () =>
          fail
            ? { data: null, error: { message: 'boom' } }
            : { data: { user: { id: 'u1' } }, error: null },
      },
    };
    expect((await cachedGetUser(client, jwt)).error).toBeTruthy();
    fail = false;
    const ok = await cachedGetUser(client, jwt);
    expect(ok.error).toBeNull();
    expect((ok.data as any).user).toEqual({ id: 'u1' });
  });

  it('INVARIANT 2: a cache entry never outlives the token exp', async () => {
    // Token expires in 5s but the TTL is 30s — the cache must NOT keep serving it.
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(5) });
    const { client, calls } = fakeClient({ id: 'u1' });
    let now = Date.now();

    await cachedGetUser(client, jwt, { ttlMs: 30_000, now: () => now });
    expect(calls()).toBe(1);

    now += 10_000; // past exp, still inside the raw TTL window
    const after = await cachedGetUser(client, jwt, { ttlMs: 30_000, now: () => now });
    expect(after.cached).toBe(false); // re-verified rather than served stale
    expect(calls()).toBe(2);
  });

  it('expires entries once the TTL elapses (bounded staleness)', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const { client, calls } = fakeClient({ id: 'u1' });
    let now = Date.now();

    await cachedGetUser(client, jwt, { ttlMs: 30_000, now: () => now });
    now += 29_000;
    expect((await cachedGetUser(client, jwt, { ttlMs: 30_000, now: () => now })).cached).toBe(true);
    now += 2_000; // now past the 30s TTL
    expect((await cachedGetUser(client, jwt, { ttlMs: 30_000, now: () => now })).cached).toBe(
      false,
    );
    expect(calls()).toBe(2);
  });

  it('does not cross-contaminate users: a different token gets its own entry', async () => {
    const jwtA = makeJwt({ sub: 'a', exp: inSeconds(3600) });
    const jwtB = makeJwt({ sub: 'b', exp: inSeconds(3600) });
    const clientA = fakeClient({ id: 'a' });
    const clientB = fakeClient({ id: 'b' });

    const a = await cachedGetUser(clientA.client, jwtA);
    const b = await cachedGetUser(clientB.client, jwtB);
    expect((a.data as any).user.id).toBe('a');
    expect((b.data as any).user.id).toBe('b');

    // Re-reading A must still return A, not B.
    const a2 = await cachedGetUser(clientA.client, jwtA);
    expect((a2.data as any).user.id).toBe('a');
    expect(a2.cached).toBe(true);
  });

  it('ttlMs=0 disables the cache entirely (kill switch)', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const { client, calls } = fakeClient({ id: 'u1' });
    await cachedGetUser(client, jwt, { ttlMs: 0 });
    await cachedGetUser(client, jwt, { ttlMs: 0 });
    expect(calls()).toBe(2);
  });

  it('reads the TTL from AUTH_CACHE_TTL_MS at call time', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const { client, calls } = fakeClient({ id: 'u1' });
    const getEnv = (k: string) => (k === 'AUTH_CACHE_TTL_MS' ? '0' : undefined);
    await cachedGetUser(client, jwt, { getEnv });
    await cachedGetUser(client, jwt, { getEnv });
    expect(calls()).toBe(2); // env kill switch honored
  });

  it('still caches when exp is absent/unparseable (falls back to plain TTL)', async () => {
    const { client, calls } = fakeClient({ id: 'u1' });
    const junk = 'not-a-jwt';
    await cachedGetUser(client, junk);
    const second = await cachedGetUser(client, junk);
    expect(second.cached).toBe(true);
    expect(calls()).toBe(1);
  });

  it('INVARIANT 3: keys are hashes, not raw bearer tokens', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: inSeconds(3600) });
    const hash = await sha256Hex(jwt);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(jwt);
    expect(await sha256Hex(jwt)).toBe(hash); // stable
    expect(await sha256Hex(jwt + 'x')).not.toBe(hash); // collision-free enough
  });
});

describe('AUDIT-005: cachedRoleLookup (the second serialized hop)', () => {
  it('queries once per user, then serves from cache', async () => {
    let calls = 0;
    const fetchRole = async () => {
      calls++;
      return { data: { role_id: 'r1', roles: { level: 8, can_access_all_tenants: true } } };
    };
    const a = await cachedRoleLookup('u1', fetchRole);
    const b = await cachedRoleLookup('u1', fetchRole);
    expect(calls).toBe(1);
    expect(b).toEqual(a);
  });

  it("keys by user id — one user cannot inherit another's role", async () => {
    const roleFor = (lvl: number) => async () => ({ roles: { level: lvl } });
    const admin = await cachedRoleLookup('root', roleFor(8));
    const peon = await cachedRoleLookup('peon', roleFor(1));
    expect((admin as any).roles.level).toBe(8);
    expect((peon as any).roles.level).toBe(1);
    // The gate must still deny the low-privilege user on a cache hit.
    expect(((await cachedRoleLookup('peon', roleFor(8))) as any).roles.level).toBe(1);
  });

  it('does not cache a null row (missing role re-checks instead of pinning)', async () => {
    let calls = 0;
    const fetchRole = async () => {
      calls++;
      return null;
    };
    await cachedRoleLookup('u1', fetchRole);
    await cachedRoleLookup('u1', fetchRole);
    expect(calls).toBe(2);
  });

  it('expires after the role TTL so a role change takes effect', async () => {
    let level = 1;
    const fetchRole = async () => ({ roles: { level } });
    let now = Date.now();
    expect(
      ((await cachedRoleLookup('u1', fetchRole, { ttlMs: 30_000, now: () => now })) as any).roles
        .level,
    ).toBe(1);
    level = 8; // promoted
    expect(
      ((await cachedRoleLookup('u1', fetchRole, { ttlMs: 30_000, now: () => now })) as any).roles
        .level,
    ).toBe(1); // still cached
    now += 31_000;
    expect(
      ((await cachedRoleLookup('u1', fetchRole, { ttlMs: 30_000, now: () => now })) as any).roles
        .level,
    ).toBe(8); // refreshed
  });
});

describe('AUDIT-005: supporting pieces', () => {
  it('decodeJwtExpMs reads exp without verifying, and is null-safe on junk', () => {
    const exp = inSeconds(120);
    expect(decodeJwtExpMs(makeJwt({ exp }))).toBe(exp * 1000);
    expect(decodeJwtExpMs('garbage')).toBeNull();
    expect(decodeJwtExpMs('a.b')).toBeNull();
    expect(decodeJwtExpMs(makeJwt({ sub: 'no-exp' }))).toBeNull();
  });

  it('INVARIANT 4: the cache is bounded', () => {
    const c = new TtlCache<number>(10);
    for (let i = 0; i < 100; i++) c.set(`k${i}`, i, Date.now() + 60_000);
    expect(c.size).toBeLessThanOrEqual(10);
  });

  it('TtlCache does not return expired values', () => {
    const c = new TtlCache<string>();
    const now = Date.now();
    c.set('k', 'v', now + 1000);
    expect(c.get('k', now)).toBe('v');
    expect(c.get('k', now + 2000)).toBeUndefined();
  });
});
