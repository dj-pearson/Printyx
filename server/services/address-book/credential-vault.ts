/**
 * Credential Vault — AES-256-GCM encryption for address book SMB passwords.
 * Source PRD: tasks/prd-address-book-manager.md (US-002, ABK-002).
 *
 * Plaintext passwords are NEVER logged, NEVER returned alongside ciphertext,
 * and source buffers are zeroed after encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const ENV_VAR = 'ADDRESS_BOOK_MASTER_KEY';

export interface EncryptedCredential {
  encryptedBlob: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

let cachedKey: Buffer | null = null;

function loadMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env[ENV_VAR];
  if (!raw) {
    throw new Error(
      `${ENV_VAR} is not set. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" and add to env.`,
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${ENV_VAR} is not valid base64.`);
  }
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `${ENV_VAR} must decode to ${KEY_LENGTH_BYTES} bytes (got ${key.length}). Expected base64-encoded AES-256 key.`,
    );
  }
  cachedKey = key;
  return key;
}

/**
 * For tests only — clears the cached key so re-loading picks up env changes.
 */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}

export function encryptCredential(plaintext: string): EncryptedCredential {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptCredential expects a string plaintext');
  }
  const key = loadMasterKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintextBuffer = Buffer.from(plaintext, 'utf8');
  const encryptedBlob = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  plaintextBuffer.fill(0);

  return { encryptedBlob, iv, authTag };
}

export function decryptCredential(record: EncryptedCredential): string {
  const key = loadMasterKey();
  if (!Buffer.isBuffer(record.iv) || record.iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`Invalid IV length (expected ${IV_LENGTH_BYTES} bytes)`);
  }
  if (!Buffer.isBuffer(record.authTag) || record.authTag.length !== 16) {
    throw new Error('Invalid auth tag length (expected 16 bytes)');
  }
  const decipher = createDecipheriv(ALGORITHM, key, record.iv);
  decipher.setAuthTag(record.authTag);
  const decrypted = Buffer.concat([decipher.update(record.encryptedBlob), decipher.final()]);
  return decrypted.toString('utf8');
}
