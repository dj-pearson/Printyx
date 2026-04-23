/**
 * In-memory rate limiter for edge functions.
 *
 * Uses a token-bucket algorithm keyed by an arbitrary string (typically tenantId
 * or `${tenantId}:${userId}`). Each bucket refills at a steady rate up to a
 * configured capacity.
 *
 * Scope:
 *   - **Per-Deno-instance.** Edge functions run in short-lived isolates, so
 *     limits are per-process, not cluster-wide. For most abuse-protection use
 *     cases this is adequate — a runaway tenant pummeling one instance gets
 *     throttled even if another instance is spun up.
 *   - For HARD multi-instance limits, use a DB-backed counter with a composite
 *     primary key (tenant_id, window_start). Out of scope here.
 *
 * Usage:
 *   import { rateLimit, RateLimitError } from '../_shared/rate-limit.ts';
 *
 *   const result = rateLimit(`claude:${ctx.tenantId}`, {
 *     capacity: 100,          // max 100 requests
 *     refillPerSecond: 100 / 3600,  // over an hour (= 100/hr)
 *   });
 *   if (!result.allowed) {
 *     throw new RateLimitError(result.retryAfterSeconds);
 *   }
 *
 * Recommended presets in `PRESETS` below.
 */

export interface RateLimitOptions {
  /** Max tokens in the bucket (burst limit). */
  capacity: number;
  /** Tokens added per second (steady-state rate). */
  refillPerSecond: number;
  /** Tokens to consume per request. Default 1. */
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining after this request. */
  remaining: number;
  /** If !allowed, seconds until enough tokens will be available. */
  retryAfterSeconds: number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // prevent unbounded memory growth

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterSeconds}s.`);
    this.name = 'RateLimitError';
  }
}

/**
 * Check + consume tokens. Returns allowed=false and retryAfterSeconds when
 * the bucket is empty.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const cost = opts.cost ?? 1;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    // LRU-ish cleanup: if we're at the cap, drop the oldest-untouched bucket.
    if (buckets.size >= MAX_BUCKETS) {
      let oldestKey: string | undefined;
      let oldestMs = Infinity;
      for (const [k, b] of buckets) {
        if (b.lastRefillMs < oldestMs) {
          oldestMs = b.lastRefillMs;
          oldestKey = k;
        }
      }
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { tokens: opts.capacity, lastRefillMs: now };
    buckets.set(key, bucket);
  }

  // Refill based on elapsed time
  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  const refill = elapsedSec * opts.refillPerSecond;
  if (refill > 0) {
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + refill);
    bucket.lastRefillMs = now;
  }

  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  const deficit = cost - bucket.tokens;
  const retryAfterSeconds = Math.ceil(deficit / opts.refillPerSecond);
  return {
    allowed: false,
    remaining: Math.floor(bucket.tokens),
    retryAfterSeconds,
  };
}

/**
 * Convenience: throws RateLimitError on deny.
 */
export function requireRateLimit(key: string, opts: RateLimitOptions): void {
  const result = rateLimit(key, opts);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
}

/**
 * Recommended presets. Tune per domain — these are defensive defaults.
 */
export const PRESETS = {
  /** Expensive AI generation — 100 calls/hour per tenant */
  aiGenerationPerTenant: { capacity: 100, refillPerSecond: 100 / 3600 },
  /** Claude document-level ops — 20 calls/hour per user */
  aiHeavyPerUser: { capacity: 20, refillPerSecond: 20 / 3600 },
  /** OpenAI embeddings — 1000/hour per tenant (cheap) */
  embeddingsPerTenant: { capacity: 1000, refillPerSecond: 1000 / 3600 },
  /** Whisper transcription — 10/hour per tenant (slow + size-limited) */
  transcriptionPerTenant: { capacity: 10, refillPerSecond: 10 / 3600 },
  /** SendGrid transactional — 1000/hour per tenant */
  emailSendPerTenant: { capacity: 1000, refillPerSecond: 1000 / 3600 },
  /** Auth probe / validate endpoints — 60/min per user */
  authProbePerUser: { capacity: 60, refillPerSecond: 1 },
  /** Webhook ingest (public path) — 60/min per IP */
  webhookPerIp: { capacity: 60, refillPerSecond: 1 },
} as const;

/**
 * Test-seam: clear all buckets.
 */
export function _clearRateLimitBuckets(): void {
  buckets.clear();
}
