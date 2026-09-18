// One envelope for a secret stored in a TEXT column, readable from both runtimes.
//
// SEC-CRED-VAULT-001. `integration_credentials` has five secret columns
// (api_key, api_secret, access_token, refresh_token, webhook_secret) whose
// schema comment has said "encrypted at application level" since migration
// 0000 while nothing encrypted them. Two AES-256-GCM vaults already existed
// here and could not read each other: the Deno one returns { blob, v }, the
// Node one three separate Buffers, and they resolved different env vars. A
// credential written by the apollo edge function is read by Express through
// server/apollo-client.ts, so one format is not a tidiness argument - it is the
// difference between the feature working and not.
//
// FORMAT: `pvc1:` + base64(iv || ciphertext || authTag). The prefix is
// load-bearing. A column may still hold a legacy plaintext key, and an API key
// can itself be valid base64, so length and alphabet cannot tell the two apart;
// the prefix can. Anything without it is plaintext by definition.
//
// Web Crypto appends the 16-byte GCM tag to the ciphertext, so iv || ct+tag is
// what the Deno vault already writes. The Node counterpart
// (server/services/credential-envelope.ts) concatenates its separate authTag to
// match, and server/tests/unit/credential-envelope-parity.test.ts decrypts each
// runtime's output with the other.

import { CredentialVaultError, decryptCredential, encryptCredential } from './credential-vault.ts';

export { CredentialVaultError };

export const ENVELOPE_PREFIX = 'pvc1:';

/** The columns of `integration_credentials` that hold a secret. */
export const CREDENTIAL_COLUMNS = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'webhook_secret',
] as const;

export type CredentialColumn = (typeof CREDENTIAL_COLUMNS)[number];

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

/**
 * Encrypt a secret for storage. Throws CredentialVaultError when no master key
 * is configured - a write that cannot encrypt fails, it does not fall back to
 * plaintext (SEC-CRED-VAULT-001 AC4).
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const { blob } = await encryptCredential(plaintext);
  return ENVELOPE_PREFIX + blob;
}

/**
 * Read a stored secret. A value with no envelope prefix is a legacy plaintext
 * row and is returned as-is, so nobody's integration stops working on the
 * deploy that turns this on; the next write re-encrypts it.
 */
export async function readSecret(stored: string | null | undefined): Promise<string | null> {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isEncryptedSecret(stored)) return stored;
  return await decryptCredential({ blob: stored.slice(ENVELOPE_PREFIX.length), v: 1 });
}

/** True when a master key is present and usable. Never throws. */
export async function vaultKeyConfigured(): Promise<boolean> {
  try {
    await encryptCredential('probe');
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt every secret column present on a row payload, leaving everything else
 * alone. A null or empty value stays as it is - storing ciphertext of the empty
 * string would make "not configured" indistinguishable from "configured blank".
 */
export async function encryptCredentialColumns<T extends Record<string, unknown>>(
  row: T,
): Promise<T> {
  const out: Record<string, unknown> = { ...row };
  for (const col of CREDENTIAL_COLUMNS) {
    const value = out[col];
    if (typeof value !== 'string' || value === '') continue;
    if (isEncryptedSecret(value)) continue;
    out[col] = await encryptSecret(value);
  }
  return out as T;
}
