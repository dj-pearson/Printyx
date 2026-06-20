import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseCanon,
  serializeCanon,
  parseKonica,
  serializeKonica,
  parseXerox,
  serializeXerox,
  parseRicoh,
  serializeRicoh,
} from '../../../services/address-book/vendors';
import {
  encryptCanonPwd,
  decryptCanonPwd,
  CanonCryptoError,
} from '../../../services/address-book/vendors/canon/crypto';
import { convertBook, mergeOverrides } from '../../../services/address-book/conversion-engine';
import {
  isEmailEntry,
  isSmbEntry,
  type CanonicalAddressBook,
  type CanonicalEntry,
} from '../../../../shared/address-book-types';

const FIX = (name: string) => resolve(__dirname, '../../../../tests/fixtures/address-book', name);

const book: CanonicalAddressBook = {
  tenant_id: 't1',
  customer_id: 'c1',
  name: 'Acme Corp',
};

describe('Canon Crypto v2 codec (ABK-004/005)', () => {
  it('round-trips encrypt → decrypt with the source password', () => {
    const blob = encryptCanonPwd('hunter2', '1');
    expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptCanonPwd(blob, '1')).toBe('hunter2');
  });

  it('throws CanonCryptoError on wrong password', () => {
    const blob = encryptCanonPwd('hunter2', '1');
    expect(() => decryptCanonPwd(blob, 'wrong')).toThrow(CanonCryptoError);
  });

  it('throws CanonCryptoError on malformed blob', () => {
    expect(() => decryptCanonPwd('not-a-real-blob', '1')).toThrow(CanonCryptoError);
  });
});

describe('Canon parser (ABK-004)', () => {
  function loadCanonWithEncryptedPwd(password: string): Buffer {
    const raw = readFileSync(FIX('canon-sample.csv'), 'utf-8');
    const blob = encryptCanonPwd('s3cret', password);
    return Buffer.from(raw.replace('__PWD__', blob), 'utf-8');
  }

  it('parses header comments, email, smb and group rows', () => {
    const result = parseCanon(loadCanonWithEncryptedPwd('1'), '1');
    expect(result.vendor).toBe('canon');
    expect(result.password_was_required).toBe(true);
    expect(result.source_subbook_name).toBe('Main');
    // 2 email + 1 smb + 1 group
    expect(result.entries).toHaveLength(4);
    const emails = result.entries.filter(isEmailEntry);
    expect(emails.map((e) => e.email)).toContain('jane.doe@acme.example');
  });

  it('decrypts a known SMB credential to a non-empty plaintext', () => {
    const result = parseCanon(loadCanonWithEncryptedPwd('1'), '1');
    const smb = result.entries.find(isSmbEntry);
    expect(smb).toBeTruthy();
    expect(smb!.smb_full_unc).toBe('\\\\IOSI-FILESERV\\Data');
    const pwd = (smb!.source_metadata as Record<string, unknown>)._password;
    expect(typeof pwd).toBe('string');
    expect(pwd).toBe('s3cret');
  });

  it('falls back to a per-row error when the password is wrong (no abort)', () => {
    const result = parseCanon(loadCanonWithEncryptedPwd('1'), 'wrong-password');
    // all 4 entries still produced; the smb row reports a decryption error
    expect(result.entries).toHaveLength(4);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    const smb = result.entries.find(isSmbEntry)!;
    expect((smb.source_metadata as Record<string, unknown>)._password).toBeUndefined();
  });

  it('preserves all source columns in source_metadata for round-trip fidelity', () => {
    const result = parseCanon(loadCanonWithEncryptedPwd('1'), '1');
    const email = result.entries.find(isEmailEntry)!;
    const md = email.source_metadata as Record<string, unknown>;
    expect(md.objectclass).toBe('email');
    expect(md.uuid).toBe('11111111-1111-1111-1111-111111111111');
    expect('resolution' in md).toBe(true);
  });
});

describe('Canon serializer + round-trip (ABK-005)', () => {
  it('parse → serialize → parse preserves canonical entries', () => {
    const raw = readFileSync(FIX('canon-sample.csv'), 'utf-8');
    const blob = encryptCanonPwd('s3cret', '1');
    const first = parseCanon(Buffer.from(raw.replace('__PWD__', blob), 'utf-8'), '1');
    const canonBook: CanonicalAddressBook = { ...book, source_vendor: 'canon' };
    const serialized = serializeCanon(canonBook, first.entries, { password: '1' });
    expect(serialized.content.length).toBeGreaterThan(0);
    const second = parseCanon(serialized.content, '1');
    expect(second.entries).toHaveLength(first.entries.length);
    expect(
      second.entries
        .filter(isEmailEntry)
        .map((e) => e.email)
        .sort(),
    ).toEqual(
      first.entries
        .filter(isEmailEntry)
        .map((e) => e.email)
        .sort(),
    );
    // smb password survives the re-encryption round trip
    const smb = second.entries.find(isSmbEntry)!;
    expect((smb.source_metadata as Record<string, unknown>)._password).toBe('s3cret');
  });

  it('omits the Crypto Attribute header when no password supplied', () => {
    const serialized = serializeCanon({ ...book, source_vendor: 'canon' }, [
      { entry_type: 'email', display_name: 'A', email: 'a@x.example' },
    ]);
    const text = serialized.content.toString('utf-8');
    expect(text).not.toContain('# Crypto Attribute: pwd');
  });
});

describe('Konica parser + serializer (ABK-006/007)', () => {
  it('parses email and SMB rows', () => {
    const result = parseKonica(readFileSync(FIX('konica-sample.csv')));
    expect(result.entries).toHaveLength(3);
    const smb = result.entries.find(isSmbEntry)!;
    expect(smb.smb_host).toBe('IOSI-FILESERV');
    expect((smb.source_metadata as Record<string, unknown>)._password).toBe('s3cret');
  });

  it('round-trips parse → serialize → parse', () => {
    const first = parseKonica(readFileSync(FIX('konica-sample.csv')));
    const out = serializeKonica(book, first.entries, { password: 'x' });
    // UTF-8 BOM present
    expect(out.content[0]).toBe(0xef);
    const second = parseKonica(out.content);
    expect(second.entries.filter(isEmailEntry)).toHaveLength(2);
    expect(second.entries.filter(isSmbEntry)).toHaveLength(1);
  });
});

describe('Xerox parser + serializer (ABK-008/009)', () => {
  it('parses email + smb destinations', () => {
    const result = parseXerox(readFileSync(FIX('xerox-sample.csv')));
    expect(result.entries.filter(isEmailEntry)).toHaveLength(2);
    expect(result.entries.filter(isSmbEntry)).toHaveLength(1);
  });

  it('round-trips', () => {
    const first = parseXerox(readFileSync(FIX('xerox-sample.csv')));
    const out = serializeXerox(book, first.entries);
    const second = parseXerox(out.content);
    expect(second.entries).toHaveLength(first.entries.length);
  });
});

describe('Ricoh parser + serializer (ABK-010/011)', () => {
  it('parses email + smb destinations', () => {
    const result = parseRicoh(readFileSync(FIX('ricoh-sample.csv')));
    expect(result.entries.filter(isEmailEntry)).toHaveLength(2);
    const smb = result.entries.find(isSmbEntry)!;
    expect(smb.smb_host).toBe('IOSI-FILESERV');
  });

  it('round-trips', () => {
    const first = parseRicoh(readFileSync(FIX('ricoh-sample.csv')));
    const out = serializeRicoh(book, first.entries, { password: 'x' });
    const second = parseRicoh(out.content);
    expect(second.entries.filter(isEmailEntry)).toHaveLength(2);
    expect(second.entries.filter(isSmbEntry)).toHaveLength(1);
  });
});

describe('Conversion engine (ABK-012)', () => {
  it('converts a Canon book to Konica and reports group + vendor-only fields as unmappable', () => {
    const raw = readFileSync(FIX('canon-sample.csv'), 'utf-8');
    const blob = encryptCanonPwd('s3cret', '1');
    const parsed = parseCanon(Buffer.from(raw.replace('__PWD__', blob), 'utf-8'), '1');
    const canonBook: CanonicalAddressBook = { ...book, source_vendor: 'canon' };
    const { file, report } = convertBook(canonBook, parsed.entries, 'konica');
    expect(file.vendor).toBe('konica');
    // the group entry can't be represented in Konica
    expect(report.unmappable_fields.some((f) => f.vendor_field === 'group')).toBe(true);
    // canon 'resolution' column flagged as vendor-only
    expect(report.unmappable_fields.some((f) => f.vendor_field === 'resolution')).toBe(true);
    expect(report.entries_exported).toBeGreaterThan(0);
  });
});

describe('Override merge (ABK-022)', () => {
  const master: CanonicalEntry[] = [
    { id: 'm1', entry_type: 'email', display_name: 'Shared A', email: 'a@x.example' },
    { id: 'm2', entry_type: 'email', display_name: 'Shared B', email: 'b@x.example' },
  ];

  it('lets a device override supersede the master entry it targets', () => {
    const overrides: CanonicalEntry[] = [
      {
        id: 'o1',
        entry_type: 'email',
        display_name: 'Override A',
        email: 'a-new@x.example',
        is_override: true,
        overrides_entry_id: 'm1',
      },
    ];
    const merged = mergeOverrides(master, overrides);
    expect(merged).toHaveLength(2);
    expect((merged[0] as { email: string }).email).toBe('a-new@x.example');
    expect((merged[1] as { email: string }).email).toBe('b@x.example');
  });

  it('appends device-only additions and orphan overrides', () => {
    const overrides: CanonicalEntry[] = [
      {
        id: 'o2',
        entry_type: 'email',
        display_name: 'Device Only',
        email: 'd@x.example',
        is_override: true,
      },
    ];
    const merged = mergeOverrides(master, overrides);
    expect(merged).toHaveLength(3);
    expect((merged[2] as { email: string }).email).toBe('d@x.example');
  });
});
