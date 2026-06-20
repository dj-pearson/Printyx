/**
 * Canon imageRUNNER `abook.csv` serializer (ABK-005).
 * Source PRD: tasks/prd-address-book-manager.md (US-005).
 *
 * Emits the Canon header-comment block followed by a CSV table. Entries that
 * originated from Canon are reconstructed from `source_metadata` for byte-level
 * round-trip fidelity; entries from other vendors get a fresh objectUUID and a
 * minimal column set. When `options.password` is supplied the `pwd` column is
 * re-encrypted via Canon Crypto v2 and `# Crypto Attribute: pwd` is written.
 */
import { randomUUID } from 'node:crypto';
import type {
  CanonicalAddressBook,
  CanonicalEntry,
  SerializeResult,
} from '../../../../../shared/address-book-types';
import { isEmailEntry, isGroupEntry, isSmbEntry } from '../../../../../shared/address-book-types';
import { toCsv } from '../_shared/csv';
import { encodeText } from '../_shared/encoding';
import { encryptCanonPwd } from './crypto';
import { emptyReport, resolveEntryPassword, type SerializeOptions } from '../_shared/options';

const CANON_VERSION = '0x0207';

// A representative, stable Canon column order. Round-tripped Canon entries
// additionally carry their full original column set in source_metadata; any of
// those not in this list are appended so no source column is lost.
const BASE_COLUMNS = [
  'objectclass',
  'cn',
  'indxid',
  'mailaddress',
  'url',
  'path',
  'protocol',
  'username',
  'pwd',
  'members',
  'uuid',
];

export function serializeCanon(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options: SerializeOptions = {},
): SerializeResult {
  const report = emptyReport(entries.length);
  const usePassword = typeof options.password === 'string' && options.password.length > 0;

  // Determine the full column set (base + any extra source columns).
  const columns = [...BASE_COLUMNS];
  for (const entry of entries) {
    if (book.source_vendor === 'canon' && entry.source_metadata) {
      for (const key of Object.keys(entry.source_metadata)) {
        if (key !== '_password' && !columns.includes(key)) columns.push(key);
      }
    }
  }

  const rows: string[][] = [columns];

  for (const entry of entries) {
    const fromCanon = book.source_vendor === 'canon' && entry.source_metadata != null;
    const md = (entry.source_metadata as Record<string, unknown> | null) ?? {};
    const row: Record<string, string> = {};

    // seed from source metadata for round-trip fidelity
    if (fromCanon) {
      for (const [k, v] of Object.entries(md)) {
        if (k === '_password') continue;
        row[k] = v == null ? '' : String(v);
      }
    }

    row.uuid = row.uuid || (typeof md.uuid === 'string' ? md.uuid : '') || randomUUID();
    row.cn = entry.display_name;
    if (entry.speed_dial_index != null) row.indxid = String(entry.speed_dial_index);

    if (isEmailEntry(entry)) {
      row.objectclass = 'email';
      row.mailaddress = entry.email;
    } else if (isSmbEntry(entry)) {
      row.objectclass = 'remotefilesystem';
      row.protocol = 'smb';
      row.url = entry.smb_full_unc;
      if (entry.smb_share_path) row.path = entry.smb_share_path;
      if (entry.smb_username) row.username = entry.smb_username;
      if (usePassword) {
        const plaintext = resolveEntryPassword(entry, options);
        if (plaintext) {
          row.pwd = encryptCanonPwd(plaintext, options.password!);
        } else {
          row.pwd = '';
          report.warnings.push(
            `SMB entry "${entry.display_name}" exported without a password (none available)`,
          );
        }
      } else {
        row.pwd = '';
      }
    } else if (isGroupEntry(entry)) {
      row.objectclass = 'group';
      row.members = entry.member_entry_ids.join(';');
    }

    rows.push(columns.map((c) => row[c] ?? ''));
    report.entries_exported++;
  }

  const headerLines = [`# Canon AddressBook CSV version: ${CANON_VERSION}`, `# CharSet: UTF-8`];
  if (usePassword) {
    headerLines.push(`# Crypto Version: 2`, `# Crypto Attribute: pwd`);
  }
  if (options.subBookName ?? book.source_subbook_name) {
    headerLines.push(`# SubAddressBookName: ${options.subBookName ?? book.source_subbook_name}`);
  }

  const csv = toCsv(rows);
  const content = encodeText(`${headerLines.join('\r\n')}\r\n${csv}\r\n`, 'utf-8', false);
  const filename = `abook-${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-canon.csv`;

  return { vendor: 'canon', filename, content, report };
}
