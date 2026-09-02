// Address-book credential vault, in the THREE-COLUMN shape the table uses.
//
// PA-055: `_shared/credential-vault.ts` already exists and is NOT usable here.
// It returns a single base64 envelope, `{ blob, v }`, for a jsonb column - which
// is right for the blog and address-book CONFIG rows that store one. But
// `address_book_credentials` has three bytea columns, encrypted_blob, iv and
// auth_tag, because server/services/address-book/credential-vault.ts writes it
// that way.
//
// Both are AES-256-GCM under the same key (ADDRESS_BOOK_MASTER_KEY), so the only
// difference is the envelope - and that difference is total: a credential
// written by one and read by the other fails auth-tag verification, which
// surfaces as "wrong password" on an SMB entry rather than as a format error.
// This module writes what the table holds, so a password imported on either host
// is exported correctly by the other.
//
// server/tests/unit/address-book-port-parity.test.ts locks the algorithm, the IV
// length and the env var against the Node copy.

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENV_VAR = 'ADDRESS_BOOK_MASTER_KEY';

export class AddressBookCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddressBookCredentialError';
  }
}

/** The row shape: three byte arrays, one per column. */
export interface CredentialColumns {
  encryptedBlob: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}

let cachedKey: CryptoKey | null = null;

async function loadMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const raw = Deno.env.get(ENV_VAR);
  if (!raw) {
    throw new AddressBookCredentialError(
      `${ENV_VAR} is not set. It must be the same base64 AES-256 key the Node vault uses, or ` +
        'credentials written on one host cannot be read on the other.',
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch {
    throw new AddressBookCredentialError(`${ENV_VAR} is not valid base64.`);
  }
  if (bytes.length !== KEY_LENGTH_BYTES) {
    throw new AddressBookCredentialError(
      `${ENV_VAR} must decode to ${KEY_LENGTH_BYTES} bytes (got ${bytes.length}).`,
    );
  }

  cachedKey = await crypto.subtle.importKey('raw', bytes, ALGORITHM, false, ['encrypt', 'decrypt']);
  return cachedKey;
}

/** For tests only — clears the cached key so re-loading picks up env changes. */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}

/**
 * Encrypt a plaintext into the three columns.
 *
 * Web Crypto appends the auth tag to the ciphertext; node:crypto exposes it
 * separately via getAuthTag(). Splitting the last 16 bytes off is what makes the
 * two formats identical on disk.
 */
export async function encryptCredentialColumns(plaintext: string): Promise<CredentialColumns> {
  if (typeof plaintext !== 'string') {
    throw new AddressBookCredentialError('encryptCredentialColumns expects a string plaintext');
  }

  const key = await loadMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, new TextEncoder().encode(plaintext)),
  );

  return {
    encryptedBlob: sealed.subarray(0, sealed.length - AUTH_TAG_BYTES),
    iv,
    authTag: sealed.subarray(sealed.length - AUTH_TAG_BYTES),
  };
}

/** Decrypt the three columns back to a plaintext. */
export async function decryptCredentialColumns(record: CredentialColumns): Promise<string> {
  const key = await loadMasterKey();

  const sealed = new Uint8Array(record.encryptedBlob.length + record.authTag.length);
  sealed.set(record.encryptedBlob, 0);
  sealed.set(record.authTag, record.encryptedBlob.length);

  try {
    const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv: record.iv }, key, sealed);
    return new TextDecoder().decode(plaintext);
  } catch {
    // Auth-tag verification failing means a wrong key or a tampered row. Do not
    // echo the ciphertext or the key into the message.
    throw new AddressBookCredentialError(
      'Credential could not be decrypted (wrong master key or altered row).',
    );
  }
}

/** PostgREST returns bytea as a \x-prefixed hex string. */
export function fromPgBytea(value: string): Uint8Array {
  const hex = value.startsWith('\\x') ? value.slice(2) : value;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** And accepts one on the way in. */
export function toPgBytea(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `\\x${hex}`;
}
