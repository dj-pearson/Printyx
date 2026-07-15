import { describe, it, expect } from 'vitest';
import {
  generateExtensionApiKey,
  hashApiKey,
  keyLookupPrefix,
  isApiKeyValid,
  EXTENSION_KEY_PREFIX,
  KEY_LOOKUP_PREFIX_LEN,
} from '../../lib/extension-api-keys';

describe('generateExtensionApiKey (PA-044)', () => {
  it('produces a prefixed key whose stored form is a hash, not the plaintext', () => {
    const { key, keyHash, keyPrefix } = generateExtensionApiKey('a'.repeat(64));
    expect(key.startsWith(EXTENSION_KEY_PREFIX)).toBe(true);
    expect(keyHash).toBe(hashApiKey(key));
    expect(keyHash).not.toContain(key); // hash never embeds the plaintext
    expect(keyPrefix).toBe(key.slice(0, KEY_LOOKUP_PREFIX_LEN));
    expect(keyPrefix.length).toBe(KEY_LOOKUP_PREFIX_LEN);
  });

  it('generates distinct keys and hashes across calls', () => {
    const a = generateExtensionApiKey();
    const b = generateExtensionApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.keyHash).not.toBe(b.keyHash);
  });
});

describe('keyLookupPrefix', () => {
  it('is the non-secret leading slice used for lookup', () => {
    const key = `${EXTENSION_KEY_PREFIX}deadbeefcafe0000`;
    expect(keyLookupPrefix(key)).toBe(key.slice(0, KEY_LOOKUP_PREFIX_LEN));
  });
});

describe('isApiKeyValid (PA-044)', () => {
  const now = new Date('2026-07-15T00:00:00Z');
  const { key, keyHash } = generateExtensionApiKey('b'.repeat(64));

  it('accepts a matching, non-revoked, unexpired key', () => {
    const record = { keyHash, expiresAt: new Date('2027-01-01'), revokedAt: null };
    expect(isApiKeyValid(key, record, now)).toBe(true);
  });

  it('rejects a wrong key even with a valid record', () => {
    const record = { keyHash, expiresAt: null, revokedAt: null };
    expect(isApiKeyValid('pyx_ext_wrong', record, now)).toBe(false);
  });

  it('rejects an expired key', () => {
    const record = { keyHash, expiresAt: new Date('2026-01-01'), revokedAt: null };
    expect(isApiKeyValid(key, record, now)).toBe(false);
  });

  it('rejects a revoked key', () => {
    const record = { keyHash, expiresAt: null, revokedAt: new Date('2026-06-01') };
    expect(isApiKeyValid(key, record, now)).toBe(false);
  });

  it('treats a null expiry as never-expiring', () => {
    const record = { keyHash, expiresAt: null, revokedAt: null };
    expect(isApiKeyValid(key, record, now)).toBe(true);
  });
});
