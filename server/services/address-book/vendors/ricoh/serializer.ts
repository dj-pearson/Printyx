/**
 * Ricoh "Address Book Import Helper" CSV serializer (ABK-011).
 * Source PRD: tasks/prd-address-book-manager.md (US-011).
 *
 * Produces a header-keyed CSV ingestible by the Ricoh Address Book Import
 * Helper. Email and SMB entries occupy their own rows. Group entries are
 * unmappable and reported.
 */
import type {
  CanonicalAddressBook,
  CanonicalEntry,
  SerializeResult,
} from '../../../../../shared/address-book-types';
import { isEmailEntry, isGroupEntry, isSmbEntry } from '../../../../../shared/address-book-types';
import { toCsv } from '../_shared/csv';
import { encodeText } from '../_shared/encoding';
import { emptyReport, resolveEntryPassword, type SerializeOptions } from '../_shared/options';

const COLUMNS = [
  'index',
  'name',
  'key display',
  'mail address',
  'folder protocol',
  'folder path',
  'folder user name',
  'folder password',
];

export function serializeRicoh(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options: SerializeOptions = {},
): SerializeResult {
  const report = emptyReport(entries.length);
  const rows: string[][] = [COLUMNS];
  let seq = 1;

  for (const entry of entries) {
    const index =
      entry.speed_dial_index != null && entry.speed_dial_index > 0
        ? String(entry.speed_dial_index)
        : String(seq);
    seq++;

    if (isEmailEntry(entry)) {
      rows.push([index, entry.display_name, entry.display_name, entry.email, '', '', '', '']);
      report.entries_exported++;
    } else if (isSmbEntry(entry)) {
      const pwd = options.password ? (resolveEntryPassword(entry, options) ?? '') : '';
      if (options.password && !pwd) {
        report.warnings.push(`SMB entry "${entry.display_name}" exported without a password`);
      }
      rows.push([
        index,
        entry.display_name,
        entry.display_name,
        '',
        'SMB',
        entry.smb_full_unc,
        entry.smb_username ?? '',
        pwd,
      ]);
      report.entries_exported++;
    } else if (isGroupEntry(entry)) {
      report.entries_dropped++;
      report.unmappable_fields.push({
        entry_id: entry.id ?? entry.display_name,
        vendor_field: 'group',
        reason: 'Ricoh Import Helper rows model a single destination; groups are not exported',
      });
    }
  }

  const csv = toCsv(rows);
  const content = encodeText(`${csv}\r\n`, 'utf-8', true);
  const filename = `ricoh-addressbook-${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  return { vendor: 'ricoh', filename, content, report };
}
