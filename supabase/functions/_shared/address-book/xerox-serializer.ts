/**
 * Xerox AltaLink / VersaLink address-book CSV serializer (ABK-009).
 * Source PRD: tasks/prd-address-book-manager.md (US-009).
 *
 * Produces an EWS-import-compatible header-keyed CSV. Email and SMB entries
 * each occupy their own row (Xerox accepts one destination per row on import).
 * Group entries are unmappable and reported.
 */
import type { CanonicalAddressBook, CanonicalEntry, SerializeResult } from './types.ts';
import { isEmailEntry, isGroupEntry, isSmbEntry } from './types.ts';
import { toCsv } from './csv.ts';
import { encodeText } from './encoding.ts';
import { emptyReport, resolveEntryPassword, type SerializeOptions } from './options.ts';

const COLUMNS = [
  'Display Name',
  'Email Address',
  '(SMB) Server',
  '(SMB) Share',
  '(SMB) Document Path',
  '(SMB) Login Name',
  '(SMB) Password',
];

function splitSharePath(value: string | null | undefined): { share: string; path: string } {
  if (!value) return { share: '', path: '' };
  const parts = value
    .replace(/^[\\/]+/, '')
    .split(/[\\/]+/)
    .filter(Boolean);
  const share = parts.shift() ?? '';
  return { share, path: parts.join('/') };
}

export function serializeXerox(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options: SerializeOptions = {},
): SerializeResult {
  const report = emptyReport(entries.length);
  const rows: string[][] = [COLUMNS];

  for (const entry of entries) {
    if (isEmailEntry(entry)) {
      rows.push([entry.display_name, entry.email, '', '', '', '', '']);
      report.entries_exported++;
    } else if (isSmbEntry(entry)) {
      const { share, path } = splitSharePath(entry.smb_share_path);
      const pwd = options.password ? (resolveEntryPassword(entry, options) ?? '') : '';
      if (options.password && !pwd) {
        report.warnings.push(`SMB entry "${entry.display_name}" exported without a password`);
      }
      rows.push([
        entry.display_name,
        '',
        entry.smb_host ?? '',
        share,
        path,
        entry.smb_username ?? '',
        pwd,
      ]);
      report.entries_exported++;
    } else if (isGroupEntry(entry)) {
      report.entries_dropped++;
      report.unmappable_fields.push({
        entry_id: entry.id ?? entry.display_name,
        vendor_field: 'group',
        reason: 'Xerox EWS CSV import has no group destination type',
      });
    }
  }

  const csv = toCsv(rows);
  const content = encodeText(`${csv}\r\n`, 'utf-8', false);
  const filename = `xerox-addressbook-${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  return { vendor: 'xerox', filename, content, report };
}
