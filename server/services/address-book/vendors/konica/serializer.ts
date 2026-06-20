/**
 * Konica Minolta (PageScope / bizhub) address-book CSV serializer (ABK-007).
 * Source PRD: tasks/prd-address-book-manager.md (US-007).
 *
 * Writes a UTF-8 (BOM) header-keyed CSV in PageScope import column order.
 * Konica index range differs from Canon: speed-dial indices are re-allocated
 * sequentially starting at 1 when the source index is missing or out of range,
 * with the original index preserved in source_metadata. Group entries are not
 * representable as a single Konica row and are reported as unmappable.
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
  'No.',
  'Name',
  'Index',
  'Type',
  'E-mail Address',
  'Host Address',
  'File Path',
  'User ID',
  'Password',
];

const KM_MAX_INDEX = 2000;

export function serializeKonica(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options: SerializeOptions = {},
): SerializeResult {
  const report = emptyReport(entries.length);
  const rows: string[][] = [COLUMNS];
  let seq = 1;

  for (const entry of entries) {
    if (isGroupEntry(entry)) {
      report.entries_dropped++;
      report.unmappable_fields.push({
        entry_id: entry.id ?? entry.display_name,
        vendor_field: 'group',
        reason:
          'Konica PageScope CSV import does not represent nested groups; expand members instead',
      });
      continue;
    }

    const index =
      entry.speed_dial_index != null &&
      entry.speed_dial_index > 0 &&
      entry.speed_dial_index <= KM_MAX_INDEX
        ? entry.speed_dial_index
        : seq++;

    if (isEmailEntry(entry)) {
      rows.push([
        String(seq++),
        entry.display_name,
        String(index),
        'E-mail',
        entry.email,
        '',
        '',
        '',
        '',
      ]);
      report.entries_exported++;
    } else if (isSmbEntry(entry)) {
      const pwd = options.password ? (resolveEntryPassword(entry, options) ?? '') : '';
      if (options.password && !pwd) {
        report.warnings.push(`SMB entry "${entry.display_name}" exported without a password`);
      }
      rows.push([
        String(seq++),
        entry.display_name,
        String(index),
        'SMB',
        '',
        entry.smb_host ?? '',
        entry.smb_share_path ?? '',
        entry.smb_username ?? '',
        pwd,
      ]);
      report.entries_exported++;
    }
  }

  const csv = toCsv(rows);
  const content = encodeText(`${csv}\r\n`, 'utf-8', true);
  const filename = `addressbook-${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-konica.csv`;
  return { vendor: 'konica', filename, content, report };
}
