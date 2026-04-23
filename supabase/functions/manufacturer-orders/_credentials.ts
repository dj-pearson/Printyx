// Credential redaction — ported verbatim from Express route L33-42.
//
// Every SELECT response that returns connection data MUST pass through
// redactConnection() before serialization. Plaintext encryption-at-rest is a
// cross-domain follow-up (see tasks/followup-credentials-encryption.md).
//
// The broader _shared/credentials.ts handles the general case; this module
// enumerates the exact sensitive keys the manufacturer-orders domain uses so
// we match Express's behavior 1:1.

const SENSITIVE_KEYS = [
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'clientId',
  'client_id',
  'clientSecret',
  'client_secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'webhookSecret',
  'webhook_secret',
  'ediPassword',
  'edi_password',
  'portalUsername',
  'portal_username',
  'portalPassword',
  'portal_password',
] as const;

const MASK = '••••••••';

export function redactConnection<T extends Record<string, unknown>>(conn: T): T {
  const out = { ...conn };
  for (const key of SENSITIVE_KEYS) {
    if (out[key] !== undefined && out[key] !== null && out[key] !== '') {
      (out as Record<string, unknown>)[key] = MASK;
    }
  }
  return out;
}

export function redactConnections<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(redactConnection);
}
