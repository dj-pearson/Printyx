// Signed OAuth state for the calendar consent flow.
//
// PA-056: `state` carries the tenant id, the user id and the provider across a
// round trip through Google or Microsoft, and the callback has no JWT to check
// them against - it is a redirect the provider makes, not a request the app
// makes. An unsigned state would let anyone mint a callback that attaches a
// calendar connection to any tenant they can name.
//
// HMAC-SHA256 over the payload, with the same secret the function runs with.
// Not encryption: the payload is not secret, it just must not be forgeable or
// replayable past its window.

const STATE_TTL_MS = 10 * 60 * 1000; // ten minutes to complete a consent screen

export interface CalendarOAuthState {
  tenantId: string;
  userId: string;
  provider: 'google' | 'microsoft';
  redirectTo: string;
  issuedAt: number;
}

function secret(): string {
  const value =
    Deno.env.get('CALENDAR_OAUTH_STATE_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!value) {
    // Fail closed. Signing with a constant would be indistinguishable from not
    // signing at all.
    throw new Error('CALENDAR_OAUTH_STATE_SECRET is required to sign the OAuth state');
  }
  return value;
}

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return b64url(new Uint8Array(mac));
}

export async function encodeState(state: Omit<CalendarOAuthState, 'issuedAt'>): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify({ ...state, issuedAt: Date.now() })));
  return `${payload}.${await sign(payload)}`;
}

/** Returns null for anything unsigned, tampered with, or older than the window. */
export async function decodeState(raw: string | null): Promise<CalendarOAuthState | null> {
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  // Constant-time compare: a length check plus an XOR fold, so a forged
  // signature cannot be discovered a byte at a time.
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff !== 0) return null;

  let decoded: CalendarOAuthState;
  try {
    decoded = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    return null;
  }

  if (!decoded.tenantId || !decoded.userId || !decoded.provider) return null;
  if (Date.now() - decoded.issuedAt > STATE_TTL_MS) return null;

  return decoded;
}
