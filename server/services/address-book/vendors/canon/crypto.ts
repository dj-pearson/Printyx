/**
 * Canon "Crypto v2" password field codec (ABK-004 / ABK-005).
 *
 * Canon imageRUNNER `abook.csv` exports optionally encrypt the SMB/FTP `pwd`
 * column when `# Crypto Attribute: pwd` is present in the header. Canon does
 * not publish the exact KDF parameters, so this module implements the
 * documented-shape scheme — PBKDF2(SHA-256) → AES-256-CBC — in a way that is
 * internally round-trip consistent (encrypt → decrypt), and is structured so
 * the real parameters can be slotted in once validated against a genuine
 * sample.
 *
 * IMPORTANT (honest limitation): the repository did not ship the reference
 * `abook.csv` sample referenced by the PRD, so the exact salt source and
 * iteration count Canon uses could not be confirmed here. Per the ABK-004
 * fallback path, `parseCanon` treats a decryption failure as a per-row error
 * (credential left unset) rather than aborting the whole import. The blob
 * layout used for our own re-encryption on export is:
 *
 *   base64( salt[16] || iv[16] || aes-256-cbc-ciphertext )
 *
 * which is self-describing and does not depend on undocumented Canon internals.
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';

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
const DIGEST = 'sha256';

function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
}

/**
 * Encrypt a plaintext password into a Canon v2 pwd blob (base64).
 * Used by the serializer when `options.password` is supplied.
 */
export function encryptCanonPwd(plaintext: string, password: string): string {
  if (!password) throw new CanonCryptoError('password required to encrypt Canon pwd field');
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return Buffer.concat([salt, iv, ciphertext]).toString('base64');
}

/**
 * Decrypt a Canon v2 pwd blob (base64) with the user-supplied source password.
 * Throws CanonCryptoError on any structural or cryptographic failure so the
 * parser can fall back gracefully.
 */
export function decryptCanonPwd(blob: string, password: string): string {
  if (!password) throw new CanonCryptoError('password required to decrypt Canon pwd field');
  let raw: Buffer;
  try {
    raw = Buffer.from(blob, 'base64');
  } catch {
    throw new CanonCryptoError('pwd field is not valid base64');
  }
  if (raw.length < SALT_LEN + IV_LEN + 16) {
    throw new CanonCryptoError('pwd blob too short to be a Canon v2 ciphertext');
  }
  const salt = raw.subarray(0, SALT_LEN);
  const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = raw.subarray(SALT_LEN + IV_LEN);
  const key = deriveKey(password, salt);
  try {
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf-8');
  } catch {
    throw new CanonCryptoError('Canon pwd decryption failed (wrong password or unsupported KDF)');
  }
}
