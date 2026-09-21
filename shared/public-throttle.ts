/**
 * Abuse controls for unauthenticated public surfaces (COP-B14 AC4, LAUNCH-010).
 *
 * Pure. TWO SURFACES USE IT. A public booking page writes rows, sends email and
 * puts events on a rep's calendar, with no JWT in front of it - left open it is
 * a way to fill a sales team's week with fake meetings from a script. Self-
 * service SIGNUP is the same shape and costs more: it creates a tenant, a
 * GoTrue user and a `users` row, and asks GoTrue to send a verification email
 * to whatever address it was handed, so an open one is both a way to fill the
 * tenants table and a way to send mail from this product's domain to anybody.
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

/**
 * Which bucket ran out. An explicit union rather than a bare string, so a
 * caller reading the reason cannot be handed a value no surface emits.
 */
export type ThrottleReason = 'source' | 'page' | 'email' | 'surface';

export interface ThrottleDecision {
  allowed: boolean;
  /** 'source' when one client is hammering, 'page' when the page is flooded. */
  reason: ThrottleReason | null;
  retryAfterSeconds: number;
}

export interface BucketCheck {
  reason: ThrottleReason;
  attempts: number;
  limit: number;
}

/**
 * The first bucket that is out, in the order given.
 *
 * ORDER IS THE CALLER'S DECISION and it decides what the refusal says: the
 * narrowest bucket goes first, so one client hammering is reported as that
 * rather than as the whole surface being busy. A ladder rather than two
 * hand-written ifs, because signup has three buckets and booking has two and
 * neither should get its own copy of the comparison.
 */
export function firstExceeded(
  checks: readonly BucketCheck[],
  windowSeconds: number,
): ThrottleDecision {
  for (const check of checks) {
    if (check.attempts >= check.limit) {
      return { allowed: false, reason: check.reason, retryAfterSeconds: windowSeconds };
    }
  }
  return { allowed: true, reason: null, retryAfterSeconds: 0 };
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
  return firstExceeded(
    [
      { reason: 'source', attempts: sourceAttempts, limit: limits.perSource },
      { reason: 'page', attempts: pageAttempts, limit: limits.perPage },
    ],
    limits.windowSeconds,
  );
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
  const ip = firstForwardedAddress(ipHeader);
  if (!ip) return `booking:${slug}:unknown`;
  return `booking:${slug}:${await digest(`${slug}|${ip}`)}`;
}

/**
 * The calling client's address out of an `x-forwarded-for` header.
 *
 * The header is a LIST and the client is the FIRST entry; every later one is a
 * proxy. Taking the wrong end buckets every caller behind one proxy together,
 * which turns a per-source limit into a per-datacentre one. One definition,
 * because both surfaces need it and it is easy to get backwards.
 */
export function firstForwardedAddress(ipHeader: string | null | undefined): string {
  return String(ipHeader ?? '')
    .split(',')[0]
    .trim();
}

/** Every attempt against one page, whatever the source. */
export function pageBucket(slug: string): string {
  return `booking-page:${slug}`;
}

// ─────────────────────────── self-service signup ───────────────────────────
//
// LAUNCH-010. Signup has no slug, so it has no per-page bucket the way booking
// does; what it has instead is a THIRD dimension booking does not need.

/**
 * Deliberately generous for a company registering once and hopeless for a
 * script. A person signs up for a dealer product one time; nobody does it four
 * times in an hour.
 *
 * THE SURFACE LIMIT IS A DELIBERATE TRADE AND IT CUTS BOTH WAYS. It is the only
 * control a botnet cannot walk around, and an attacker can also trip it on
 * purpose and stop real registrations for the rest of the window. Thirty an
 * hour is far above any organic rate for this product and far below what a
 * script does, and an hour of refused signups is recoverable where thousands of
 * junk tenants and a burnt sending domain are not.
 */
export const DEFAULT_SIGNUP_LIMITS = {
  /** Attempts from one address. */
  perSource: 3,
  /** Attempts naming one email address, from any source. */
  perEmail: 3,
  /** Attempts against the whole signup surface, from all sources. */
  perSurface: 30,
  windowSeconds: 3600,
} as const;

export interface SignupThrottleLimits {
  perSource: number;
  perEmail: number;
  perSurface: number;
  windowSeconds: number;
}

export interface SignupBuckets {
  source: string;
  email: string;
  surface: string;
}

/** Every attempt at signing up, whatever the source and whatever the address. */
export const SIGNUP_SURFACE_BUCKET = 'signup:surface';

/**
 * A stable, non-identifying bucket key for one identity.
 *
 * THE IDENTITY IS HASHED, NEVER STORED, for the same reason the booking bucket
 * hashes an address: throttling needs to know "this one again", not who, and an
 * attempts table holding the email of everybody who tried to register is a
 * liability nobody asked for - it is a list of people interested in the product,
 * sitting in a table with no tenant and a two-day retention sweep.
 *
 * AN ABSENT IDENTITY STILL GETS A BUCKET, shared by every caller we cannot
 * distinguish, which is the safe way round: unknown sources are throttled
 * together rather than exempted.
 */
export async function identityBucket(
  namespace: string,
  identity: string | null | undefined,
  digest: (input: string) => Promise<string>,
): Promise<string> {
  const value = String(identity ?? '').trim();
  if (!value) return `${namespace}:unknown`;
  return `${namespace}:${await digest(`${namespace}|${value}`)}`;
}

/**
 * The three buckets a signup attempt counts against.
 *
 * THE EMAIL BUCKET IS THE ONE BOOKING DOES NOT HAVE, and it is here for a
 * specific harm rather than for symmetry: the per-source limit is defeated by a
 * handful of addresses, and a botnet aiming twenty registration attempts at one
 * victim's inbox stays well under the surface limit while sending that person
 * twenty "verify your account" emails from this domain. Counting by address is
 * what sees that.
 *
 * The email is lower-cased and trimmed first, so `A@B.com ` and `a@b.com` are
 * one bucket - otherwise the control is defeated by the shift key.
 */
export async function signupBuckets(
  ipHeader: string | null | undefined,
  email: string | null | undefined,
  digest: (input: string) => Promise<string>,
): Promise<SignupBuckets> {
  const [source, emailBucket] = await Promise.all([
    identityBucket('signup:ip', firstForwardedAddress(ipHeader), digest),
    identityBucket('signup:email', String(email ?? '').toLowerCase(), digest),
  ]);
  return { source, email: emailBucket, surface: SIGNUP_SURFACE_BUCKET };
}

/**
 * Narrowest bucket first, so the refusal names the client rather than the
 * surface whenever one client is the cause.
 */
export function signupThrottleDecision(
  sourceAttempts: number,
  emailAttempts: number,
  surfaceAttempts: number,
  limits: SignupThrottleLimits = DEFAULT_SIGNUP_LIMITS,
): ThrottleDecision {
  return firstExceeded(
    [
      { reason: 'source', attempts: sourceAttempts, limit: limits.perSource },
      { reason: 'email', attempts: emailAttempts, limit: limits.perEmail },
      { reason: 'surface', attempts: surfaceAttempts, limit: limits.perSurface },
    ],
    limits.windowSeconds,
  );
}
