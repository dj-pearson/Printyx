/**
 * Node half of the one credential envelope (SEC-CRED-VAULT-001).
 *
 * Mirrors supabase/functions/_shared/credential-envelope.ts byte for byte: the
 * stored value is `pvc1:` + base64(iv || ciphertext || authTag), AES-256-GCM
 * with a 12-byte IV. Web Crypto appends the tag to the ciphertext, so this side
 * concatenates its separate `getAuthTag()` to land on the same layout, and
 * server/tests/unit/credential-envelope-parity.test.ts decrypts each runtime's
 * output with the other rather than asserting that they look similar.
 *
 * KEY: PRINTYX_CREDENTIAL_VAULT_KEY, falling back to ADDRESS_BOOK_MASTER_KEY -
 * the same order the Deno vault already used. This does NOT share state with
 * server/services/address-book/credential-vault.ts, which keeps its own
 * three-column format for SMB passwords; one env var can feed both, and if an
 * operator sets both names to different keys the two features stay independent.
 *
 * A write with no key configured THROWS. Storing plaintext and saying nothing
 * is what this story exists to end.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const ENVELOPE_PREFIX = 'pvc1:';

/** The columns of `integration_credentials` that hold a secret. */
export const CREDENTIAL_COLUMNS = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'webhook_secret',
] as const;

/** The same five columns as the camelCase Drizzle properties. */
export const CREDENTIAL_FIELDS = [
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'webhookSecret',
] as const;

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number];

export class CredentialVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialVaultError';
  }
}

let cachedKey: Buffer | null = null;

function loadMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PRINTYX_CREDENTIAL_VAULT_KEY ?? process.env.ADDRESS_BOOK_MASTER_KEY ?? '';
  if (!raw.trim()) {
    throw new CredentialVaultError(
      'PRINTYX_CREDENTIAL_VAULT_KEY (or legacy ADDRESS_BOOK_MASTER_KEY) is not set; refusing to store a credential in plaintext',
    );
  }
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new CredentialVaultError(
      `Master key must decode to exactly ${KEY_BYTES} bytes (got ${key.length})`,
    );
  }
  cachedKey = key;
  return key;
}

/** Tests only — clears the cached key so an env change is picked up. */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new CredentialVaultError('encryptSecret requires a string');
  }
  const key = loadMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ENVELOPE_PREFIX + Buffer.concat([iv, ct, cipher.getAuthTag()]).toString('base64');
}

/**
 * Read a stored secret. A value with no envelope prefix is a legacy plaintext
 * row and comes back unchanged, so an integration configured before this story
 * keeps working; the next write re-encrypts it.
 */
export function readSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isEncryptedSecret(stored)) return stored;

  const key = loadMasterKey();
  const bytes = Buffer.from(stored.slice(ENVELOPE_PREFIX.length), 'base64');
  if (bytes.length <= IV_BYTES + TAG_BYTES) {
    throw new CredentialVaultError('Encrypted blob is too short to contain iv + auth tag');
  }
  const iv = bytes.subarray(0, IV_BYTES);
  const tag = bytes.subarray(bytes.length - TAG_BYTES);
  const ct = bytes.subarray(IV_BYTES, bytes.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new CredentialVaultError('Decryption failed (auth tag mismatch or wrong key)');
  }
}

/** True when a master key is present and usable. Never throws. */
export function vaultKeyConfigured(): boolean {
  try {
    loadMasterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt every secret field present on a camelCase payload, leaving the rest
 * alone. A null or empty value stays as it is - ciphertext of the empty string
 * would make "not configured" indistinguishable from "configured blank".
 */
export function encryptCredentialFields<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const field of CREDENTIAL_FIELDS) {
    const value = out[field];
    if (typeof value !== 'string' || value === '') continue;
    if (isEncryptedSecret(value)) continue;
    out[field] = encryptSecret(value);
  }
  return out as T;
}
