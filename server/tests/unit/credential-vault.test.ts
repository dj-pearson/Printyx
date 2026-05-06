/**
 * Credential Vault Tests (ABK-002)
 *
 * Covers: round-trip equality, tamper detection (auth tag verification),
 * missing key error path, wrong-length key error path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import {
  encryptCredential,
  decryptCredential,
  _resetMasterKeyCache,
} from '../../services/address-book/credential-vault';

const ENV = 'ADDRESS_BOOK_MASTER_KEY';

describe('credential-vault', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env[ENV];
    process.env[ENV] = randomBytes(32).toString('base64');
    _resetMasterKeyCache();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env[ENV];
    else process.env[ENV] = originalKey;
    _resetMasterKeyCache();
  });

  it('round-trips a plaintext password through encrypt/decrypt', () => {
    const plaintext = 'CorrectHorseBatteryStaple!';
    const record = encryptCredential(plaintext);

    expect(record.encryptedBlob).toBeInstanceOf(Buffer);
    expect(record.iv).toBeInstanceOf(Buffer);
    expect(record.iv.length).toBe(12);
    expect(record.authTag).toBeInstanceOf(Buffer);
    expect(record.authTag.length).toBe(16);
    expect(record.encryptedBlob.toString('utf8')).not.toBe(plaintext);

    const recovered = decryptCredential(record);
    expect(recovered).toBe(plaintext);
  });

  it('produces a fresh IV per encryption (no IV reuse)', () => {
    const a = encryptCredential('same-secret');
    const b = encryptCredential('same-secret');
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.encryptedBlob.equals(b.encryptedBlob)).toBe(false);
  });

  it('detects ciphertext tampering via auth tag verification', () => {
    const record = encryptCredential('top-secret');
    const tampered = Buffer.from(record.encryptedBlob);
    tampered[0] = tampered[0] ^ 0xff;

    expect(() => decryptCredential({ ...record, encryptedBlob: tampered })).toThrow();
  });

  it('detects auth tag tampering', () => {
    const record = encryptCredential('top-secret');
    const tamperedTag = Buffer.from(record.authTag);
    tamperedTag[0] = tamperedTag[0] ^ 0xff;

    expect(() => decryptCredential({ ...record, authTag: tamperedTag })).toThrow();
  });

  it('throws a clear error when ADDRESS_BOOK_MASTER_KEY is missing', () => {
    delete process.env[ENV];
    _resetMasterKeyCache();
    expect(() => encryptCredential('x')).toThrow(/ADDRESS_BOOK_MASTER_KEY/);
  });

  it('throws when ADDRESS_BOOK_MASTER_KEY decodes to wrong length', () => {
    process.env[ENV] = Buffer.from('too-short').toString('base64');
    _resetMasterKeyCache();
    expect(() => encryptCredential('x')).toThrow(/32 bytes/);
  });
});
