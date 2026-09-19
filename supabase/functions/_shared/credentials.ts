/**
 * Credential redaction helpers for edge functions.
 *
 * Domains that store sensitive third-party credentials (manufacturer connections,
 * signature provider integrations, SSO providers, calendar OAuth tokens) MUST
 * redact those fields on every SELECT response so credentials never reach the
 * frontend.
 *
 * Usage:
 *   import { redactCredentials, DEFAULT_SENSITIVE_KEYS } from '../_shared/credentials.ts';
 *
 *   // Single row
 *   const safe = redactCredentials(row);
 *
 *   // Array of rows
 *   const safeRows = rows.map(redactCredentials);
 *
 *   // Custom field list (per-domain override)
 *   const safe = redactCredentials(row, { sensitiveKeys: [...DEFAULT_SENSITIVE_KEYS, 'pemPrivateKey'] });
 *
 * Rules:
 *   - Field presence (non-null/non-empty) becomes MASK_VALUE ('••••••••').
 *   - Absent/null fields stay absent/null (so the frontend can show an "unset" state).
 *   - Case-insensitive key matching; the original key name is preserved in output.
 *   - Nested objects are redacted recursively (but arrays of strings are left alone).
 *
 * Never log, never return to frontend, never include in error details — only
 * write back to the DB row via the INSERT/UPDATE path.
 */

const MASK_VALUE = '••••••••';

/**
 * Canonical sensitive-key list covering the patterns in current code.
 * Extend per-domain via the `sensitiveKeys` option rather than mutating this.
 */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
  // API credentials
  'apiKey',
  'apiSecret',
  'clientId',
  'clientSecret',
  'accessToken',
  'refreshToken',
  'bearerToken',
  'sessionToken',

  // Webhook + integration
  'webhookSecret',
  'webhookToken',
  'integrationKey',
  'accountId',

  // EDI / portal
  'ediPassword',
  'portalUsername',
  'portalPassword',

  // Keys + certificates
  'privateKey',
  'pemPrivateKey',
  'signingKey',
  'encryptionKey',
  'samlCertificate',
  'oidcClientSecret',

  // Auth / password-like
  'password',
  'passphrase',
  'secret',
  'token',
];

/**
 * Key names are compared with separators removed, so `api_key`, `apiKey` and
 * `API-KEY` all match the same entry.
 *
 * This was a lowercase-only comparison until SEC-CRED-VAULT-001, and the only
 * caller in the tree - signatures/handlers/credentials.ts - hands it rows that
 * PostgREST returns in snake_case. `'apiKey'.toLowerCase()` is `apikey`, the
 * row's key is `api_key`, so the list, get, create and update responses all
 * returned every credential column in full while looking redacted. Nothing
 * reported it because the masking is invisible on a screen that never had a
 * real key in it.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const DEFAULT_SET = new Set(DEFAULT_SENSITIVE_KEYS.map(normalizeKey));

export interface RedactOptions {
  /** Override the sensitive key list entirely. Case-insensitive. */
  sensitiveKeys?: readonly string[];
  /** Add extra sensitive keys on top of the default list. Case-insensitive. */
  extraKeys?: readonly string[];
  /** Custom mask value (default: bullet characters). */
  mask?: string;
}

function resolveSet(opts: RedactOptions | undefined): Set<string> {
  if (!opts) return DEFAULT_SET;
  if (opts.sensitiveKeys) {
    return new Set(opts.sensitiveKeys.map(normalizeKey));
  }
  if (opts.extraKeys?.length) {
    const s = new Set(DEFAULT_SET);
    for (const k of opts.extraKeys) s.add(normalizeKey(k));
    return s;
  }
  return DEFAULT_SET;
}

/**
 * Redact sensitive fields in a single object. Returns a shallow copy with
 * masked values — never mutates the input.
 */
export function redactCredentials<T>(row: T, opts?: RedactOptions): T {
  if (row === null || row === undefined || typeof row !== 'object') {
    return row;
  }
  if (Array.isArray(row)) {
    return row.map((r) => redactCredentials(r, opts)) as unknown as T;
  }

  const keySet = resolveSet(opts);
  const mask = opts?.mask ?? MASK_VALUE;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (keySet.has(normalizeKey(key))) {
      // Mask only when there's something to hide; preserve null/undefined/empty.
      if (value === null || value === undefined || value === '') {
        out[key] = value;
      } else {
        out[key] = mask;
      }
      continue;
    }

    // Recurse into nested objects, but not into arrays of primitives
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactCredentials(value, opts);
    } else if (Array.isArray(value) && value.some((v) => v && typeof v === 'object')) {
      out[key] = value.map((v) => redactCredentials(v, opts));
    } else {
      out[key] = value;
    }
  }

  return out as T;
}

/**
 * Convenience: redact an array of rows.
 */
export function redactCredentialsAll<T>(rows: T[], opts?: RedactOptions): T[] {
  return rows.map((r) => redactCredentials(r, opts));
}

/**
 * Sanity check for audit logging — returns true if any field in `row` matches
 * the sensitive key list AND has a non-empty value. Useful as a pre-commit
 * assertion that a redaction path was taken.
 */
export function hasUnredactedCredentials(row: unknown, opts?: RedactOptions): boolean {
  if (!row || typeof row !== 'object') return false;
  const keySet = resolveSet(opts);
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (value && keySet.has(normalizeKey(key)) && value !== (opts?.mask ?? MASK_VALUE)) {
      return true;
    }
  }
  return false;
}
