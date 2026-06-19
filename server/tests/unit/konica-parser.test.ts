/**
 * Konica Minolta parser tests (ABK-006 / US-006).
 *
 * Loads the representative fixture tests/fixtures/address-book/konica-sample.csv
 * and asserts email + SMB destinations decode into canonical form, that source
 * columns survive in source_metadata, and that unsupported / malformed rows are
 * reported (never silently dropped).
 *
 * TODO: the fixture is a representative PageScope-style export, not a capture
 * from a real bizhub device. Replace with a real export when one is available
 * and tighten the column aliases in parser.ts to match.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  parseKonica,
  parseCsv,
  decodeBuffer,
} from '../../../supabase/functions/_shared/address-book/konica/parser';
import { isEmailEntry, isSmbEntry } from '../../../shared/address-book-types';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../tests/fixtures/address-book/konica-sample.csv');

describe('konica parser', () => {
  const buffer = readFileSync(FIXTURE);
  const result = parseKonica(buffer);

  it('reports the konica vendor', () => {
    expect(result.vendor).toBe('konica');
  });

  it('decodes the expected number of email + SMB entries', () => {
    // 3 valid email rows + 2 valid SMB rows = 5; fax + email-missing-address = 2 errors.
    expect(result.entries).toHaveLength(5);
    expect(result.errors).toHaveLength(2);
  });

  it('maps email destinations to canonical email entries', () => {
    const andy = result.entries.find(
      (e) => isEmailEntry(e) && e.email === 'amortenson@infomaxoffice.com',
    );
    expect(andy).toBeDefined();
    expect(andy!.display_name).toBe('Andy Mortenson');
    expect(andy!.speed_dial_index).toBe(1);
  });

  it('falls back to the email as display name when name is blank', () => {
    const noname = result.entries.find(
      (e) => isEmailEntry(e) && e.email === 'noname@infomaxoffice.com',
    );
    expect(noname).toBeDefined();
    expect(noname!.display_name).toBe('noname@infomaxoffice.com');
  });

  it('maps SMB destinations to canonical smb entries with a UNC path', () => {
    const ach = result.entries.find((e) => isSmbEntry(e) && e.display_name === 'Scan to ACH');
    expect(ach).toBeDefined();
    if (ach && isSmbEntry(ach)) {
      expect(ach.smb_full_unc).toBe('\\\\IOSI-FILESERV\\Data\\Laserfiche Scan Folders\\ACH');
      expect(ach.smb_host).toBe('IOSI-FILESERV');
      expect(ach.smb_username).toBe('scanuser');
      // SMB passwords are never persisted by the parser.
      expect(ach.credential_id).toBeNull();
    }
  });

  it('flags that a source password was present (without persisting it)', () => {
    expect(result.password_was_required).toBe(true);
    // The plaintext password must not leak into any entry field.
    const serialized = JSON.stringify(result.entries);
    expect(serialized).not.toContain('Secret123');
  });

  it('preserves all source columns in source_metadata for round-trip fidelity', () => {
    const ach = result.entries.find((e) => isSmbEntry(e) && e.display_name === 'Scan to ACH');
    expect(ach!.source_metadata).toMatchObject({
      Type: 'SMB',
      'Host Address': 'IOSI-FILESERV',
      'User ID': 'scanuser',
    });
  });

  it('reports unsupported destination types as errors', () => {
    const faxError = result.errors.find((e) => /Unsupported/i.test(e.reason));
    expect(faxError).toBeDefined();
    expect(faxError!.reason).toContain('Fax');
  });

  it('reports email rows missing an address as errors', () => {
    const missing = result.errors.find((e) => /missing address/i.test(e.reason));
    expect(missing).toBeDefined();
  });
});

describe('konica parser helpers', () => {
  it('parses quoted CSV fields with embedded commas', () => {
    const rows = parseCsv('a,"b,c",d\n1,2,3');
    expect(rows[0]).toEqual(['a', 'b,c', 'd']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });

  it('detects a UTF-8 BOM and strips it', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x42]);
    const { text, encoding } = decodeBuffer(bytes);
    expect(text).toBe('AB');
    expect(encoding).toBe('utf-8');
  });

  it('falls back to Shift-JIS for non-UTF-8 bytes', () => {
    // Shift-JIS encoding of テスト ("test" in katakana).
    const sjis = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
    const { text, encoding } = decodeBuffer(sjis);
    expect(encoding).toBe('shift-jis');
    expect(text).toBe('テスト');
  });

  it('returns an empty result for an empty buffer', () => {
    const result = parseKonica(new Uint8Array());
    expect(result.entries).toHaveLength(0);
    expect(result.vendor).toBe('konica');
  });
});
