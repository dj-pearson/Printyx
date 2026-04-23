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

const DEFAULT_SET = new Set(DEFAULT_SENSITIVE_KEYS.map((k) => k.toLowerCase()));

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
    return new Set(opts.sensitiveKeys.map((k) => k.toLowerCase()));
  }
  if (opts.extraKeys?.length) {
    const s = new Set(DEFAULT_SET);
    for (const k of opts.extraKeys) s.add(k.toLowerCase());
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
    if (keySet.has(key.toLowerCase())) {
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
    if (value && keySet.has(key.toLowerCase()) && value !== (opts?.mask ?? MASK_VALUE)) {
      return true;
    }
  }
  return false;
}
