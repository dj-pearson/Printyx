// Round 213. Canon pwd blobs are AES-256-CBC with no authentication, so a
// WRONG source password still produced valid padding about one time in 256
// (measured 11 of 3,000) and "decrypted" to garbage, which the importer stored
// as the SMB credential. That is also why vendor-adapters' wrong-password test
// failed at random. Both copies now require a plausible plaintext.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  encryptCanonPwd,
  decryptCanonPwd,
  plausiblePassword,
} from '../../../server/services/address-book/vendors/canon/crypto';
import { plausiblePassword as edgePlausible } from '../../../supabase/functions/_shared/address-book/canon-crypto';

const utf8 = (s: string) => Buffer.from(s, 'utf-8');

describe.each([
  ['node', (b: Uint8Array) => plausiblePassword(Buffer.from(b))],
  ['edge', (b: Uint8Array) => edgePlausible(b)],
])('plausiblePassword (%s)', (_host, check) => {
  it('accepts an ordinary password, including non-ASCII', () => {
    expect(check(utf8('s3cret!'))).toBe('s3cret!');
    expect(check(utf8('pässwörd'))).toBe('pässwörd');
  });
  it('rejects invalid UTF-8 and control characters', () => {
    expect(() => check(new Uint8Array([0x31, 0xff, 0xfe, 0x41]))).toThrow();
    expect(() => check(utf8('abc\u0006def'))).toThrow();
    expect(() => check(utf8('abc\u007f'))).toThrow();
  });
});

describe('a wrong password is refused, not decrypted to garbage', () => {
  it('never returns a plaintext across 2,000 attempts', () => {
    let decrypted = 0;
    for (let i = 0; i < 2000; i++) {
      const blob = encryptCanonPwd('s3cret', '1');
      try {
        decryptCanonPwd(blob, 'wrong-password');
        decrypted++;
      } catch {
        /* the expected outcome */
      }
    }
    expect(decrypted).toBe(0);
  }, 60_000);

  it('the right password still round-trips', () => {
    expect(decryptCanonPwd(encryptCanonPwd('s3cret', '1'), '1')).toBe('s3cret');
  });

  it('both decrypt paths go through the check', () => {
    const node = readFileSync('server/services/address-book/vendors/canon/crypto.ts', 'utf8');
    const edge = readFileSync('supabase/functions/_shared/address-book/canon-crypto.ts', 'utf8');
    expect(node).toContain('return plausiblePassword(plaintext);');
    expect(edge).toContain('return plausiblePassword(new Uint8Array(plaintext));');
  });
});
