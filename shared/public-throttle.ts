/**
 * Abuse controls for unauthenticated public surfaces (COP-B14 AC4).
 *
 * Pure. A public booking page is an endpoint that writes rows, sends email and
 * puts events on a rep's calendar, with no JWT in front of it. Left open it is
 * a way to fill a sales team's week with fake meetings from a script.
 *
 * WHAT EACH CONTROL IS ACTUALLY WORTH, stated rather than implied, because a
 * control whose strength nobody wrote down gets trusted for more than it does:
 *
 *  - THE RATE LIMIT IS THE REAL ONE. It is enforced server-side against
 *    attempts already recorded, so a client cannot talk its way past it.
 *  - THE HONEYPOT AND THE FILL TIMER STOP COMMODITY BOTS AND NOTHING ELSE.
 *    Both are client-supplied: a form field a real person never sees, and how
 *    long the form was open before it was submitted. Anyone writing a script
 *    against this specific page defeats both in a minute. They are cheap and
 *    they catch the indiscriminate traffic that finds a public URL, which is
 *    most of it - they are not a security boundary and must never be counted
 *    as one.
 *
 * IP IS HASHED, NEVER STORED. The bucket key is a digest of the address and
 * the page slug. Throttling needs to know "the same source again", not who,
 * and a table of visitor IPs on a marketing surface is a liability nobody
 * asked for.
 */

export interface ThrottleLimits {
  /** Attempts allowed from one source within the window. */
  perSource: number;
  /** Attempts allowed against one page from ALL sources within the window. */
  perPage: number;
  windowSeconds: number;
}

/**
 * Deliberately generous for a human and hopeless for a script. A prospect
 * books once, occasionally twice after a mistake; nobody books six times in
 * ten minutes.
 */
export const DEFAULT_BOOKING_LIMITS: ThrottleLimits = {
  perSource: 5,
  perPage: 60,
  windowSeconds: 600,
};

export interface ThrottleDecision {
  allowed: boolean;
  /** 'source' when one client is hammering, 'page' when the page is flooded. */
  reason: 'source' | 'page' | null;
  retryAfterSeconds: number;
}

/**
 * Both limits, evaluated against counts already recorded.
 *
 * The per-page limit exists because the per-source one is defeated by a
 * handful of addresses, and a page that can be flooded from a botnet is a
 * calendar nobody can use. It is set high enough that a real sales page never
 * reaches it.
 */
export function throttleDecision(
  sourceAttempts: number,
  pageAttempts: number,
  limits: ThrottleLimits = DEFAULT_BOOKING_LIMITS,
): ThrottleDecision {
  if (sourceAttempts >= limits.perSource) {
    return { allowed: false, reason: 'source', retryAfterSeconds: limits.windowSeconds };
  }
  if (pageAttempts >= limits.perPage) {
    return { allowed: false, reason: 'page', retryAfterSeconds: limits.windowSeconds };
  }
  return { allowed: true, reason: null, retryAfterSeconds: 0 };
}

export interface BotSignalInput {
  /** A field styled out of sight. A person leaves it empty; a form-filler does not. */
  honeypot?: unknown;
  /** When the client says the form was opened. Client-supplied, so advisory. */
  formOpenedAt?: string | number | null;
  now: Date;
  /** Below this, a submission was not typed by a person. */
  minFillMs?: number;
}

export interface BotSignalResult {
  suspicious: boolean;
  reason: 'honeypot' | 'too_fast' | null;
}

const DEFAULT_MIN_FILL_MS = 3_000;

/**
 * Commodity-bot signals. See the header for what these are and are not.
 *
 * A MISSING `formOpenedAt` IS NOT SUSPICIOUS. An older client, a page restored
 * from bfcache or a prospect on a flaky connection can all omit it, and
 * refusing a real booking is a worse outcome than accepting a fake one. A
 * timestamp in the FUTURE is treated as absent for the same reason - a client
 * clock is not evidence about anything.
 */
export function botSignals(input: BotSignalInput): BotSignalResult {
  const honeypot = input.honeypot;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { suspicious: true, reason: 'honeypot' };
  }

  const opened = input.formOpenedAt;
  if (opened == null || opened === '') return { suspicious: false, reason: null };
  const openedMs = typeof opened === 'number' ? opened : Date.parse(String(opened));
  if (!Number.isFinite(openedMs)) return { suspicious: false, reason: null };

  const elapsed = input.now.getTime() - openedMs;
  if (elapsed < 0) return { suspicious: false, reason: null };
  return elapsed < (input.minFillMs ?? DEFAULT_MIN_FILL_MS)
    ? { suspicious: true, reason: 'too_fast' }
    : { suspicious: false, reason: null };
}

/**
 * The window a count is taken over. Exclusive lower bound, so a request is
 * measured against the last N seconds and not against all of history.
 */
export function windowStart(now: Date, windowSeconds: number): Date {
  return new Date(now.getTime() - windowSeconds * 1000);
}

/**
 * A stable, non-identifying bucket key.
 *
 * `digest` is injected rather than imported so this stays pure and testable;
 * the edge function passes a SHA-256. An absent address still gets a bucket -
 * one shared by every caller we cannot distinguish - which is the safe way
 * round: an unknown source is throttled together with all the other unknown
 * ones rather than being exempt.
 */
export async function sourceBucket(
  slug: string,
  ipHeader: string | null | undefined,
  digest: (input: string) => Promise<string>,
): Promise<string> {
  // x-forwarded-for is a list; the client is the first entry.
  const ip = String(ipHeader ?? '')
    .split(',')[0]
    .trim();
  if (!ip) return `booking:${slug}:unknown`;
  return `booking:${slug}:${await digest(`${slug}|${ip}`)}`;
}

/** Every attempt against one page, whatever the source. */
export function pageBucket(slug: string): string {
  return `booking-page:${slug}`;
}
