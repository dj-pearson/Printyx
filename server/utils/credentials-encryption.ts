/**
 * Credentials Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for sensitive credentials
 * like IMAP passwords, API keys, and OAuth tokens.
 *
 * Security Features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV per encryption (prevents pattern analysis)
 * - Authentication tags (prevents tampering)
 * - Key derivation from environment secret
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('credentials-encryption');

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 16;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }; // scrypt parameters

/**
 * Encrypted data structure
 */
interface EncryptedData {
  /** Hex-encoded IV */
  iv: string;
  /** Hex-encoded authentication tag */
  authTag: string;
  /** Hex-encoded salt for key derivation */
  salt: string;
  /** Hex-encoded encrypted data */
  data: string;
  /** Version for future compatibility */
  version: number;
}

/**
 * Get or generate the encryption key from environment
 * Uses scrypt for key derivation from the master secret
 */
function deriveKey(salt: Buffer): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.SESSION_SECRET;

  if (!masterSecret) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY or SESSION_SECRET environment variable is required for credential encryption',
    );
  }

  // Use scrypt for key derivation (memory-hard, resistant to brute force)
  return scryptSync(masterSecret, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

/**
 * Encrypt a credential string using AES-256-GCM
 *
 * @param plaintext - The credential to encrypt
 * @returns JSON string containing encrypted data structure
 *
 * @example
 * const encrypted = encryptCredential('my-imap-password');
 * // Store encrypted in database
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty credential');
  }

  // Generate random IV and salt
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);

  // Derive key using salt
  const key = deriveKey(salt);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt the data
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Build encrypted data structure
  const encryptedData: EncryptedData = {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
    data: encrypted,
    version: 1,
  };

  return JSON.stringify(encryptedData);
}

/**
 * Decrypt a credential string that was encrypted with encryptCredential
 *
 * @param encryptedJson - JSON string from encryptCredential
 * @returns Decrypted plaintext credential
 *
 * @example
 * const password = decryptCredential(storedEncryptedPassword);
 * // Use password for IMAP connection
 */
export function decryptCredential(encryptedJson: string): string {
  if (!encryptedJson) {
    throw new Error('Cannot decrypt empty credential');
  }

  let encryptedData: EncryptedData;

  try {
    encryptedData = JSON.parse(encryptedJson);
  } catch {
    // If parsing fails, the data might be plaintext (legacy/unencrypted)
    // Return as-is for backward compatibility during migration
    log.warn('[CredentialsEncryption] Legacy unencrypted credential detected');
    return encryptedJson;
  }

  // Check for required fields to detect legacy data
  if (!encryptedData.iv || !encryptedData.data || !encryptedData.salt) {
    // Likely plaintext or different format - return as-is for backward compatibility
    log.warn('[CredentialsEncryption] Legacy unencrypted credential detected');
    return encryptedJson;
  }

  // Reconstruct buffers
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const salt = Buffer.from(encryptedData.salt, 'hex');

  // Derive key using same salt
  const key = deriveKey(salt);

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a string appears to be an encrypted credential
 *
 * @param value - String to check
 * @returns true if the value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'iv' in parsed &&
      'data' in parsed &&
      'salt' in parsed &&
      'version' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Safely encrypt a credential, handling already-encrypted data
 *
 * @param value - Credential to encrypt (may already be encrypted)
 * @returns Encrypted credential string
 */
export function safeEncryptCredential(value: string): string {
  if (!value) return value;

  // Don't double-encrypt
  if (isEncrypted(value)) {
    return value;
  }

  return encryptCredential(value);
}

/**
 * Rotate encryption for an existing credential
 * Re-encrypts with new IV and salt while keeping same master key
 *
 * @param encryptedJson - Currently encrypted credential
 * @returns Newly encrypted credential (different IV/salt)
 */
export function rotateCredentialEncryption(encryptedJson: string): string {
  const plaintext = decryptCredential(encryptedJson);
  return encryptCredential(plaintext);
}
