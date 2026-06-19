/**
 * Xerox parser tests (ABK-008 / US-008).
 *
 * Loads the representative fixture tests/fixtures/address-book/xerox-sample.csv
 * (an AltaLink/VersaLink EWS-style export with a concatenated email tab + scan
 * tab) and asserts email + SMB destinations decode into canonical form, that
 * source columns survive in source_metadata, and that unsupported / malformed
 * rows are reported (never silently dropped).
 *
 * TODO: the fixture is a representative EWS-style export, not a capture from a
 * real Xerox device. Replace with a real export when one is available and
 * tighten the column aliases in parser.ts to match.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  parseXerox,
  parseCsv,
  decodeBuffer,
} from '../../../supabase/functions/_shared/address-book/xerox/parser';
import { isEmailEntry, isSmbEntry } from '../../../shared/address-book-types';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../tests/fixtures/address-book/xerox-sample.csv');

describe('xerox parser', () => {
  const buffer = readFileSync(FIXTURE);
  const result = parseXerox(buffer);

  it('reports the xerox vendor', () => {
    expect(result.vendor).toBe('xerox');
  });

  it('decodes email + SMB entries across concatenated sections', () => {
    // Section 1 (email tab): 3 email rows + fax (error) + broken (error).
    // Section 2 (scan tab): 2 SMB rows.
    expect(result.entries).toHaveLength(5);
    expect(result.errors).toHaveLength(2);
  });

  it('maps email destinations to canonical email entries', () => {
    const andy = result.entries.find(
      (e) => isEmailEntry(e) && e.email === 'amortenson@infomaxoffice.com',
    );
    expect(andy).toBeDefined();
    expect(andy!.display_name).toBe('Andy Mortenson');
  });

  it('composes a display name from first + last when Display Name is blank', () => {
    // The "noname" row has no Display Name and no first/last, so it falls back
    // to the email address.
    const noname = result.entries.find(
      (e) => isEmailEntry(e) && e.email === 'noname@infomaxoffice.com',
    );
    expect(noname).toBeDefined();
    expect(noname!.display_name).toBe('noname@infomaxoffice.com');
  });

  it('maps SMB destinations from the scan tab to canonical smb entries with a UNC path', () => {
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
    const serialized = JSON.stringify(result.entries);
    expect(serialized).not.toContain('Secret123');
  });

  it('preserves all source columns in source_metadata for round-trip fidelity', () => {
    const ach = result.entries.find((e) => isSmbEntry(e) && e.display_name === 'Scan to ACH');
    expect(ach!.source_metadata).toMatchObject({
      'Server Name': 'IOSI-FILESERV',
      'Share Name': 'Data',
      'Login Name': 'scanuser',
    });
  });

  it('reports fax destinations as unsupported errors', () => {
    const faxError = result.errors.find((e) => /Unsupported.*Fax/i.test(e.reason));
    expect(faxError).toBeDefined();
  });

  it('reports rows with no recognizable destination as errors', () => {
    const missing = result.errors.find((e) => /no recognizable/i.test(e.reason));
    expect(missing).toBeDefined();
  });
});

describe('xerox parser helpers', () => {
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

  it('skips Xerox marker lines and pre-header metadata', () => {
    const csv =
      'XrxAddressBookImportFormat:1\n' +
      'Display Name,Email Address\n' +
      'Jane Doe,jane@example.com\n';
    const result = parseXerox(new TextEncoder().encode(csv));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].display_name).toBe('Jane Doe');
  });

  it('accepts a single email-only export (no SMB section)', () => {
    const csv = 'Display Name,Email Address\nJane Doe,jane@example.com\n';
    const result = parseXerox(new TextEncoder().encode(csv));
    expect(result.entries).toHaveLength(1);
    expect(isEmailEntry(result.entries[0])).toBe(true);
  });

  it('returns an empty result for an empty buffer', () => {
    const result = parseXerox(new Uint8Array());
    expect(result.entries).toHaveLength(0);
    expect(result.vendor).toBe('xerox');
  });
});
