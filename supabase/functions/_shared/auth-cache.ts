/**
 * Short-TTL auth caches for edge functions (AUDIT-005).
 *
 * THE PROBLEM
 * Every authenticated request paid an HTTP round-trip to GoTrue via
 * `supabase.auth.getUser(jwt)` — 214 of the 255 function directories call it
 * directly, and 52 more reach it through _shared/auth.ts `requireAuth`. Root-admin
 * endpoints then paid a SECOND serialized hop: a users->roles lookup. Both happen
 * before any real work, on every request, so they are pure added latency.
 *
 * THE APPROACH — cache, don't re-implement verification.
 * The AC offered two options: verify the JWT signature locally (jose + JWKS), or
 * cache getUser by token hash. This takes the caching route deliberately:
 *   - GoTrue stays the single source of truth for validity and revocation.
 *   - Staleness is bounded by a short TTL instead of being unbounded until `exp`
 *     (local signature verification cannot see a revoked/signed-out session at all,
 *     so a stolen token would stay valid for the token's whole lifetime).
 *   - The blast radius is a cache lookup, not a hand-rolled crypto path in front of
 *     ~212 functions.
 *
 * THE TRADEOFF (documented per the story's note)
 * A token that is revoked (sign-out, password change, role change) keeps working for
 * up to AUTH_CACHE_TTL_MS. Default 30s, tunable via the AUTH_CACHE_TTL_MS env var and
 * settable to 0 to disable caching entirely. Role changes are likewise visible within
 * ROLE_CACHE_TTL_MS. This is the price of removing the round-trip; 30s is short enough
 * that it is comparable to normal JWT propagation delay, and the cache is per-isolate
 * (an instance restart clears it).
 *
 * SAFETY INVARIANTS (each pinned by a test):
 *   1. Only SUCCESSFUL verifications are cached — never errors, so a failure can't
 *      be replayed and a transient GoTrue blip can't lock a user out.
 *   2. An entry never outlives the token: TTL is capped at the JWT's own `exp`, so an
 *      expired token is never served from cache. (Without this, a token expiring 1s
 *      from now would stay accepted for the full TTL.)
 *   3. Keys are SHA-256 hashes, so raw bearer tokens are not held as map keys.
 *   4. The cache is bounded; it cannot grow without limit on a long-lived isolate.
 *
 * This module deliberately has NO imports (no supabase-js, no Deno APIs at module
 * scope) so it is unit-testable under the repo's vitest runner.
 */

/** Minimal structural type — avoids importing supabase-js just for a signature. */
export interface GetUserCapable {
  auth: {
    getUser(jwt?: string): Promise<{ data: { user: unknown } | null; error: unknown }>;
  };
}

export const DEFAULT_AUTH_CACHE_TTL_MS = 30_000;
export const DEFAULT_ROLE_CACHE_TTL_MS = 30_000;
/** Bounded so a long-lived isolate can't accumulate entries indefinitely. */
export const MAX_CACHE_ENTRIES = 5_000;

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/** Tiny TTL map with a hard size ceiling. Not LRU — see evict(). */
export class TtlCache<V> {
  private map = new Map<string, Entry<V>>();
  constructor(private max: number = MAX_CACHE_ENTRIES) {}

  get(key: string, now: number = Date.now()): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, expiresAt: number): void {
    if (expiresAt <= Date.now()) return; // never store something already stale
    if (this.map.size >= this.max && !this.map.has(key)) this.evict();
    this.map.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Drop expired entries; if that frees nothing, drop the oldest insertion. */
  private evict(): void {
    const now = Date.now();
    let freed = false;
    for (const [k, v] of this.map) {
      if (v.expiresAt <= now) {
        this.map.delete(k);
        freed = true;
      }
    }
    if (!freed) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
  }
}

/** SHA-256 hex. Uses the Web Crypto API (present in both Deno and Node 18+). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const out = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * Read `exp` (ms) from a JWT WITHOUT verifying it.
 *
 * This is only ever used to SHORTEN a cache lifetime, never to grant access — the
 * value comes from an unverified payload, so it must never be trusted for anything
 * else. Returns null when the token is unparseable (then the caller falls back to
 * the plain TTL, and GoTrue still rejects a bad token on the next miss).
 */
export function decodeJwtExpMs(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const json = JSON.parse(atob(b64));
    const exp = json?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

const userCache = new TtlCache<unknown>();
const roleCache = new TtlCache<unknown>();

/** Test/ops hook — drops every cached verification and role row. */
export function clearAuthCaches(): void {
  userCache.clear();
  roleCache.clear();
}

export function authCacheStats(): { users: number; roles: number } {
  return { users: userCache.size, roles: roleCache.size };
}

function ttlFrom(envValue: string | undefined, fallback: number): number {
  if (envValue === undefined) return fallback;
  const n = Number(envValue);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Resolve the TTL at call time so tests/ops can tune it without a redeploy. */
function authTtl(getEnv?: (k: string) => string | undefined): number {
  return ttlFrom(getEnv?.('AUTH_CACHE_TTL_MS'), DEFAULT_AUTH_CACHE_TTL_MS);
}

export interface CachedGetUserResult {
  data: { user: unknown } | null;
  error: unknown;
  /** True when served from cache (no GoTrue round-trip). Handy for tests/metrics. */
  cached: boolean;
}

/**
 * `client.auth.getUser(jwt)` with a short-TTL, token-hash-keyed cache.
 * Errors are passed straight through and never cached.
 */
export async function cachedGetUser(
  client: GetUserCapable,
  jwt: string,
  opts?: { ttlMs?: number; getEnv?: (k: string) => string | undefined; now?: () => number },
): Promise<CachedGetUserResult> {
  const now = opts?.now ?? Date.now;
  const ttl = opts?.ttlMs ?? authTtl(opts?.getEnv);

  // TTL 0 disables caching entirely (kill switch).
  if (ttl <= 0) {
    const fresh = await client.auth.getUser(jwt);
    return { ...fresh, cached: false };
  }

  const key = await sha256Hex(jwt);
  const hit = userCache.get(key, now());
  if (hit !== undefined) return { data: { user: hit }, error: null, cached: true };

  const fresh = await client.auth.getUser(jwt);
  // INVARIANT 1: only cache successes.
  if (!fresh.error && fresh.data?.user) {
    // INVARIANT 2: never let a cache entry outlive the token itself.
    const expMs = decodeJwtExpMs(jwt);
    const until = expMs === null ? now() + ttl : Math.min(now() + ttl, expMs);
    if (until > now()) userCache.set(key, fresh.data.user, until);
  }
  return { ...fresh, cached: false };
}

/**
 * Cache the users->roles gate row by user id (AUDIT-005 bullet 2) — the SECOND
 * serialized hop on root-admin endpoints. `fetchRole` runs only on a miss.
 */
export async function cachedRoleLookup<T>(
  userId: string,
  // PromiseLike, not Promise: supabase's PostgrestBuilder is a THENABLE (no
  // .catch/.finally), so `() => Promise<T>` rejects a bare `admin.from(...).single()`
  // and breaks T inference at every call site.
  fetchRole: () => T | PromiseLike<T>,
  opts?: { ttlMs?: number; getEnv?: (k: string) => string | undefined; now?: () => number },
): Promise<T> {
  const now = opts?.now ?? Date.now;
  const ttl =
    opts?.ttlMs ?? ttlFrom(opts?.getEnv?.('ROLE_CACHE_TTL_MS'), DEFAULT_ROLE_CACHE_TTL_MS);
  if (ttl <= 0) return await fetchRole();

  const key = `role:${userId}`;
  const hit = roleCache.get(key, now()) as T | undefined;
  if (hit !== undefined) return hit;

  const fresh = await fetchRole();
  // Don't cache a null/undefined row: a missing role must re-check rather than
  // pin a user out (or in) for the whole TTL on a transient DB blip.
  if (fresh !== null && fresh !== undefined) roleCache.set(key, fresh, now() + ttl);
  return fresh;
}
