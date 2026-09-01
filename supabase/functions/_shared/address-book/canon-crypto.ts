// Canon "Crypto v2" password field codec — Deno / edge-function compatible.
//
// PA-055: the Deno counterpart of
// server/services/address-book/vendors/canon/crypto.ts. Same scheme, same blob
// layout, same parameters:
//
//   PBKDF2(SHA-256, 10000 iterations, 32-byte key)
//   AES-256-CBC
//   base64( salt[16] || iv[16] || ciphertext )
//
// server/tests/unit/address-book-port-parity.test.ts fails if the iteration
// count, key length, digest or layout drift, because a file written by one host
// must be readable by the other.
//
// THE ONE DIFFERENCE THAT RIPPLES: node:crypto's pbkdf2Sync and createCipheriv
// are synchronous; Web Crypto has no synchronous API at all. So these two
// functions are async here, which makes parseCanon and serializeCanon async in
// the edge tree. That is why the ported parser awaits inside its row loop.
//
// The honest limitation the Node copy records still applies: the repository
// ships no reference abook.csv, so Canon's real salt source and iteration count
// are unconfirmed. This layout is self-describing and round-trips with itself,
// and the parser treats a decryption failure as a per-row error rather than
// aborting the import.

export class CanonCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonCryptoError';
  }
}

const SALT_LEN = 16;
const IV_LEN = 16;
const KEY_LEN = 32; // AES-256
const ITERATIONS = 10000;
const DIGEST = 'SHA-256';

const encoder = new TextEncoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: DIGEST },
    base,
    { name: 'AES-CBC', length: KEY_LEN * 8 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Encrypt a plaintext password into a Canon v2 pwd blob (base64). */
export async function encryptCanonPwd(plaintext: string, password: string): Promise<string> {
  if (!password) throw new CanonCryptoError('password required to encrypt Canon pwd field');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoder.encode(plaintext)),
  );

  const out = new Uint8Array(salt.length + iv.length + ciphertext.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ciphertext, salt.length + iv.length);
  return toBase64(out);
}

/**
 * Decrypt a Canon v2 pwd blob (base64) with the user-supplied source password.
 * Throws CanonCryptoError on any structural or cryptographic failure so the
 * parser can fall back gracefully.
 */
export async function decryptCanonPwd(blob: string, password: string): Promise<string> {
  if (!password) throw new CanonCryptoError('password required to decrypt Canon pwd field');

  let raw: Uint8Array;
  try {
    raw = fromBase64(blob);
  } catch {
    throw new CanonCryptoError('pwd field is not valid base64');
  }
  if (raw.length < SALT_LEN + IV_LEN + 16) {
    throw new CanonCryptoError('pwd blob too short to be a Canon v2 ciphertext');
  }

  const salt = raw.subarray(0, SALT_LEN);
  const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = raw.subarray(SALT_LEN + IV_LEN);

  try {
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new CanonCryptoError('Canon pwd decryption failed (wrong password or unsupported KDF)');
  }
}
