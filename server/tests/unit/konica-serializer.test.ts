/**
 * Konica Minolta serializer tests (ABK-007 / US-007).
 *
 * Verifies the canonical → KM CSV serializer: column order, Type values, UTF-8
 * BOM, index allocation/range, the conversion report for unmappable fields, and
 * — the load-bearing AC — a parse → serialize → parse round trip that produces
 * canonically equal entries.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseKonica } from '../../../supabase/functions/_shared/address-book/konica/parser';
import { serializeKonica } from '../../../supabase/functions/_shared/address-book/konica/serializer';
import type {
  CanonicalAddressBook,
  CanonicalEntry,
} from '../../../supabase/functions/_shared/address-book/types';
import { isEmailEntry, isSmbEntry } from '../../../shared/address-book-types';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../tests/fixtures/address-book/konica-sample.csv');

const book: CanonicalAddressBook = {
  tenant_id: 't1',
  customer_id: 'c1',
  name: 'Test Book',
  source_vendor: 'konica',
};

/** Compare only the canonical fields the parser is able to reconstruct. */
function canonicalShape(e: CanonicalEntry) {
  const base = {
    entry_type: e.entry_type,
    display_name: e.display_name,
    sort_name: e.sort_name ?? null,
    short_name: e.short_name ?? null,
    speed_dial_index: e.speed_dial_index ?? null,
  };
  if (isEmailEntry(e)) return { ...base, email: e.email };
  if (isSmbEntry(e)) {
    return {
      ...base,
      smb_full_unc: e.smb_full_unc,
      smb_host: e.smb_host ?? null,
      smb_share_path: e.smb_share_path ?? null,
      smb_username: e.smb_username ?? null,
    };
  }
  return base;
}

describe('konica serializer', () => {
  const parsed = parseKonica(readFileSync(FIXTURE));
  const result = serializeKonica(book, parsed.entries);

  it('reports the konica vendor and a .csv filename', () => {
    expect(result.vendor).toBe('konica');
    expect(result.filename).toMatch(/\.csv$/);
  });

  it('emits a UTF-8 BOM', () => {
    expect(result.content[0]).toBe(0xef);
    expect(result.content[1]).toBe(0xbb);
    expect(result.content[2]).toBe(0xbf);
  });

  it('writes the canonical KM header row in order', () => {
    const text = new TextDecoder('utf-8').decode(result.content).replace(/^﻿/, '');
    const header = text.split(/\r?\n/)[0];
    expect(header).toBe(
      'No,Type,Name,Sort Name,Short Name,E-mail Address,Host Address,File Path,User ID,Password',
    );
  });

  it('uses E-mail and SMB Type values', () => {
    const text = new TextDecoder('utf-8').decode(result.content);
    expect(text).toContain(',E-mail,');
    expect(text).toContain(',SMB,');
  });

  it('never emits a password (security)', () => {
    const text = new TextDecoder('utf-8').decode(result.content);
    expect(text).not.toContain('Secret123');
  });

  it('reports the expected export counts', () => {
    // The fixture yields 5 canonical entries (3 email + 2 smb); all exportable.
    expect(result.report.total_entries).toBe(5);
    expect(result.report.entries_exported).toBe(5);
    expect(result.report.entries_dropped).toBe(0);
  });

  it('round-trips parse → serialize → parse to canonically equal entries', () => {
    const reparsed = parseKonica(result.content);
    expect(reparsed.entries).toHaveLength(parsed.entries.length);
    const before = parsed.entries.map(canonicalShape);
    const after = reparsed.entries.map(canonicalShape);
    expect(after).toEqual(before);
  });
});

describe('konica serializer — index allocation', () => {
  it('keeps in-range source indices and reassigns out-of-range / duplicate ones', () => {
    const entries: CanonicalEntry[] = [
      { entry_type: 'email', email: 'a@x.com', display_name: 'A', speed_dial_index: 5 },
      // Out of KM range (>2000) → reassigned.
      { entry_type: 'email', email: 'b@x.com', display_name: 'B', speed_dial_index: 5000 },
      // Duplicate of 5 → reassigned.
      { entry_type: 'email', email: 'c@x.com', display_name: 'C', speed_dial_index: 5 },
      // No index → allocated.
      { entry_type: 'email', email: 'd@x.com', display_name: 'D' },
    ];
    const res = serializeKonica({ ...book, source_vendor: 'canon' }, entries);
    const text = new TextDecoder('utf-8').decode(res.content).replace(/^﻿/, '');
    const dataRows = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((r) => r.split(','));
    const indices = dataRows.map((r) => Number(r[0]));
    // Every assigned index is unique and within KM's 1..2000 range.
    expect(new Set(indices).size).toBe(indices.length);
    for (const n of indices) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2000);
    }
    // Entry A retains its original index 5.
    expect(indices[0]).toBe(5);
    // A reassignment was recorded in the report.
    expect(res.report.warnings.some((w) => /Reassigned index/.test(w))).toBe(true);
  });
});

describe('konica serializer — conversion report', () => {
  it('drops group entries and reports them as unmappable', () => {
    const entries: CanonicalEntry[] = [
      { entry_type: 'email', email: 'a@x.com', display_name: 'A' },
      { entry_type: 'group', display_name: 'Everyone', member_entry_ids: ['1', '2'] },
    ];
    const res = serializeKonica(book, entries);
    expect(res.report.entries_dropped).toBe(1);
    expect(res.report.unmappable_fields.some((f) => f.vendor_field === 'group')).toBe(true);
  });

  it('reports vendor-specific source fields KM cannot represent without dropping the entry', () => {
    const entries: CanonicalEntry[] = [
      {
        entry_type: 'smb',
        display_name: 'Scan',
        smb_full_unc: '\\\\HOST\\Share',
        smb_host: 'HOST',
        smb_share_path: 'Share',
        source_metadata: {
          'Scan Resolution': '600dpi',
          'Color Mode': 'Full Color',
          Name: 'Scan',
        },
      },
    ];
    const res = serializeKonica({ ...book, source_vendor: 'xerox' }, entries);
    expect(res.report.entries_exported).toBe(1);
    const fields = res.report.unmappable_fields.map((f) => f.vendor_field);
    expect(fields).toContain('Scan Resolution');
    expect(fields).toContain('Color Mode');
    // Plain non-vendor fields are not flagged.
    expect(fields).not.toContain('Name');
  });
});
