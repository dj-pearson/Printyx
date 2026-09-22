/**
 * The CSRF state for an integration OAuth round trip.
 *
 * WHAT THIS REPLACES, AND IT WAS WRONG THREE WAYS AT ONCE (round 129).
 * `IntegrationService.initializeOAuth` built the state as
 * `${tenantId}-${providerId}-${userId}-${Date.now()}` and the callback -
 * `GET /api/integrations/:provider/callback`, necessarily UNAUTHENTICATED,
 * since an OAuth redirect carries no JWT - did this:
 *
 *     // Validate state (you might want to implement more robust state validation)
 *     const [tenantId, providerId] = state.split('-');
 *     if (provider !== providerId) return redirect('...error=invalid_state');
 *     await IntegrationService.handleOAuthCallback(tenantId, provider, code, state);
 *
 * 1. IT NEVER COMPARED THE STATE TO WHAT IT ISSUED. The init handler wrote
 *    `req.session.oauthState` and nothing ever read it, so the one thing a
 *    state parameter exists for was not done. The check present compares two
 *    fields the caller controls against each other.
 *
 * 2. THE TENANT CAME OUT OF THE CALLER'S STRING. `state.split('-')[0]` was
 *    handed straight to the code that stores the resulting OAuth tokens, so
 *    the tenant a connection lands in was a query parameter on an endpoint
 *    with no authentication at all - SEC-EDGE-001's "a caller-supplied id is
 *    an authorization decision wearing a filter's clothes", with nothing in
 *    front of it.
 *
 * 3. AND IT COULD NEVER SUCCEED ANYWAY. A tenant id is a uuid, so
 *    `split('-')[1]` is its second hyphen-delimited group - four hex
 *    characters - never `google-calendar` or `salesforce`. Verified rather
 *    than reasoned: every provider gives `provider !== providerId`, so every
 *    genuine callback redirected with `error=invalid_state`. The feature has
 *    never completed a connection, and the tautological check is the only
 *    reason the unauthenticated write was not reachable.
 *
 * FOUR RULES, and the first is the one the old shape had no way to satisfy.
 *
 * THE STATE CARRIES NO INFORMATION. It is 32 random bytes and nothing else:
 * everything the callback needs - tenant, user, provider - is read from the
 * record stored beside it. A state you can parse is a state an attacker can
 * write.
 *
 * IT IS COMPARED IN CONSTANT TIME, because a string compare that returns on
 * the first differing byte leaks how much of a guess was right.
 *
 * IT IS SINGLE USE. The record is cleared when it is consumed, so a callback
 * replayed from a browser history entry or a proxy log is refused rather than
 * storing a second connection.
 *
 * AND IT EXPIRES. An authorization that sat in a tab for a day is not one the
 * user is still asking for; ten minutes is longer than any provider consent
 * screen and shorter than a walk away from the desk.
 */

/** Ten minutes, in milliseconds. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStateRecord = {
  state: string;
  providerId: string;
  tenantId: string;
  userId: string;
  createdAt: number;
};

export type OAuthStateFailure =
  | 'missing_state'
  | 'no_pending_authorization'
  | 'state_mismatch'
  | 'provider_mismatch'
  | 'state_expired';

export type OAuthStateResult =
  | { ok: true; record: OAuthStateRecord }
  | { ok: false; reason: OAuthStateFailure };

/** Random bytes as lowercase hex, from whichever crypto the host provides. */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  // Node >= 18 and Deno both expose the Web Crypto global.
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createOAuthState(options: {
  providerId: string;
  tenantId: string;
  userId: string;
  now?: number;
}): OAuthStateRecord {
  return {
    state: randomHex(32),
    providerId: options.providerId,
    tenantId: options.tenantId,
    userId: options.userId,
    createdAt: options.now ?? Date.now(),
  };
}

/** Length-independent, early-return-free comparison. */
export function constantTimeEquals(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  // Compare over the longer of the two so the loop count does not depend on
  // where they diverge; a length difference is folded into the result.
  const length = Math.max(a.length, b.length);
  let diff = lengthMismatch;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Decide whether a callback may proceed.
 *
 * `provider` is the URL segment the provider redirected to; it is checked
 * against the STORED provider, never against a field of `returnedState`.
 */
export function verifyOAuthState(options: {
  returnedState: string | null | undefined;
  provider: string | null | undefined;
  stored: OAuthStateRecord | null | undefined;
  now?: number;
}): OAuthStateResult {
  const { returnedState, provider, stored } = options;
  const now = options.now ?? Date.now();

  if (!returnedState) return { ok: false, reason: 'missing_state' };
  if (!stored || !stored.state) return { ok: false, reason: 'no_pending_authorization' };
  if (!constantTimeEquals(returnedState, stored.state)) {
    return { ok: false, reason: 'state_mismatch' };
  }
  if (!provider || provider !== stored.providerId) {
    return { ok: false, reason: 'provider_mismatch' };
  }
  if (now - stored.createdAt > OAUTH_STATE_TTL_MS) {
    return { ok: false, reason: 'state_expired' };
  }
  return { ok: true, record: stored };
}
