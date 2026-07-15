/**
 * Chrome-extension API key helpers (PA-044).
 *
 * Keys are shown to the user ONCE at generation and only a SHA-256 hash is
 * persisted (never the plaintext). A non-secret prefix is stored alongside so an
 * incoming key can be looked up by prefix, then verified with a timing-safe hash
 * comparison. Validity also enforces expiry and revocation.
 */
import crypto from 'crypto';

export const EXTENSION_KEY_PREFIX = 'pyx_ext_';
/** Characters of the key stored in cleartext for lookup (prefix + 8 hex). */
export const KEY_LOOKUP_PREFIX_LEN = EXTENSION_KEY_PREFIX.length + 8;
/** Default lifetime for a generated key. */
export const DEFAULT_KEY_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export interface GeneratedApiKey {
  /** Plaintext key — returned to the caller ONCE, never stored. */
  key: string;
  /** SHA-256 hex of the key — this is what gets persisted. */
  keyHash: string;
  /** Non-secret lookup prefix persisted alongside the hash. */
  keyPrefix: string;
}

/** SHA-256 hex of a key. Deterministic — used for both storage and lookup. */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** The non-secret lookup prefix for a key. */
export function keyLookupPrefix(key: string): string {
  return key.slice(0, KEY_LOOKUP_PREFIX_LEN);
}

/** Generate a new extension API key plus its stored hash + lookup prefix. */
export function generateExtensionApiKey(randomHex?: string): GeneratedApiKey {
  const rand = randomHex ?? crypto.randomBytes(32).toString('hex');
  const key = `${EXTENSION_KEY_PREFIX}${rand}`;
  return { key, keyHash: hashApiKey(key), keyPrefix: keyLookupPrefix(key) };
}

export interface StoredKeyLike {
  keyHash: string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}

/**
 * True if `key` matches the stored record and the record is neither revoked nor
 * expired. Uses a timing-safe comparison on the hashes.
 */
export function isApiKeyValid(key: string, record: StoredKeyLike, now: Date): boolean {
  if (record.revokedAt) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) return false;
  const provided = Buffer.from(hashApiKey(key));
  const stored = Buffer.from(record.keyHash);
  if (provided.length !== stored.length) return false;
  return crypto.timingSafeEqual(provided, stored);
}
