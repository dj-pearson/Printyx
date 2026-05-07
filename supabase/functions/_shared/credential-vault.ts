// Edge Function Credential Vault — Deno Web Crypto AES-256-GCM
//
// Deno-compatible mirror of server/services/address-book/credential-vault.ts
// (the Node crypto version used by ABK-002). Used by every edge function that
// needs to persist a third-party credential at rest (CMS API tokens, social
// platform OAuth tokens, keyword adapter keys, etc.).
//
// Env var: PRINTYX_CREDENTIAL_VAULT_KEY — preferred. Falls back to
//          ADDRESS_BOOK_MASTER_KEY for backward compatibility while ABK-002's
//          original name is still in deployed environments. Once every env is
//          rotated to the new name, drop the alias.
//
// Both must decode to a 32-byte key (base64-encoded). Generate once per env:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Storage layout: each encrypted payload is { iv (12 bytes), ciphertext+tag }
// concatenated and base64-encoded. The 16-byte GCM auth tag is appended to the
// ciphertext by Web Crypto so the on-disk format is iv || ct+tag.
//
// Plaintext is never logged or returned alongside ciphertext. Errors throw
// `CredentialVaultError` so callers can distinguish vault failures from other
// crypto errors.

const IV_BYTES = 12; // GCM standard IV length
const KEY_BYTES = 32; // AES-256

export class CredentialVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialVaultError';
  }
}

let cachedKey: CryptoKey | null = null;

function readMasterKeyFromEnv(): Uint8Array {
  const env =
    Deno.env.get('PRINTYX_CREDENTIAL_VAULT_KEY') ?? Deno.env.get('ADDRESS_BOOK_MASTER_KEY');

  if (!env) {
    throw new CredentialVaultError(
      'PRINTYX_CREDENTIAL_VAULT_KEY (or legacy ADDRESS_BOOK_MASTER_KEY) is not set',
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = base64Decode(env.trim());
  } catch {
    throw new CredentialVaultError('Master key is not valid base64');
  }

  if (bytes.byteLength !== KEY_BYTES) {
    throw new CredentialVaultError(
      `Master key must decode to exactly ${KEY_BYTES} bytes (got ${bytes.byteLength})`,
    );
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = readMasterKeyFromEnv();
  cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  // zero out the source bytes
  raw.fill(0);
  return cachedKey;
}

/**
 * Reset the cached key — exported so tests can swap env vars between runs.
 */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}

export interface EncryptedCredential {
  /** Base64 of (iv || ciphertext || authTag). */
  blob: string;
  /** Algo + version marker — bump if format changes. */
  v: 1;
}

/**
 * Encrypt a UTF-8 plaintext string. Returns a portable base64 envelope.
 */
export async function encryptCredential(plaintext: string): Promise<EncryptedCredential> {
  if (typeof plaintext !== 'string') {
    throw new CredentialVaultError('encryptCredential requires a string');
  }

  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));

  const out = new Uint8Array(iv.byteLength + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, iv.byteLength);

  return { blob: base64Encode(out), v: 1 };
}

/**
 * Decrypt a previously-encrypted envelope. Throws CredentialVaultError if the
 * key is wrong or the ciphertext was tampered with (auth-tag verification).
 */
export async function decryptCredential(record: EncryptedCredential): Promise<string> {
  if (!record || typeof record !== 'object' || record.v !== 1 || typeof record.blob !== 'string') {
    throw new CredentialVaultError('Malformed encrypted credential record');
  }

  const key = await getKey();
  let bytes: Uint8Array;
  try {
    bytes = base64Decode(record.blob);
  } catch {
    throw new CredentialVaultError('Encrypted blob is not valid base64');
  }

  if (bytes.byteLength <= IV_BYTES + 16) {
    throw new CredentialVaultError('Encrypted blob is too short to contain iv + auth tag');
  }

  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new CredentialVaultError('Decryption failed (auth tag mismatch or wrong key)');
  }

  return new TextDecoder().decode(plain);
}

// ─── base64 helpers (Deno's btoa/atob exist but only handle Latin-1 strings) ──

function base64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return btoa(s);
}

function base64Decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i);
  }
  return out;
}
