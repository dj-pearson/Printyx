// Konica Minolta address book CSV serializer (ABK-007 / US-007).
//
// Renders vendor-neutral canonical entries back into a Konica Minolta bizhub
// address book CSV (PageScope Data Administrator / Web Connection "Import" style)
// so a book sourced from any vendor can be re-imported on a KM device.
//
// Scope (v1, matching the parser): email + SMB scan-to-folder destinations.
// Group destinations and any source field KM cannot represent (Canon-specific
// scan resolutions, Xerox-specific scan profiles, FTP/WebDAV/i-Fax specifics) are
// reported in the ConversionReport — never silently dropped from the report.
//
// Encoding: UTF-8 with a leading BOM. The parser's `decodeBuffer` strips the BOM
// and decodes UTF-8 first, so a serialize→parse round trip is lossless for the
// canonical fields the parser produces.
//
// SECURITY: passwords are never emitted. Canonical SMB entries carry a
// `credential_id` reference, not a plaintext password, so the Password column is
// always written empty — credential material lives in the vault, never the CSV.

import type {
  CanonicalAddressBook,
  CanonicalEntry,
  CanonicalSmbEntry,
  ConversionReport,
  FieldMappingIssue,
  SerializeResult,
} from '../types.ts';

export interface SerializeKonicaOptions {
  /** Override the output filename. Default: `<book name>-konica.csv`. */
  filename?: string;
  /** Emit a leading UTF-8 BOM (KM-friendly). Default true. */
  includeBom?: boolean;
  /**
   * Write a leading `# ...` title comment line (mimics a real PageScope export
   * header). Default false — the parser auto-locates the header row either way.
   */
  includeTitleComment?: boolean;
}

// KM bizhub abbreviated-destination registration numbers run 1..2000. Indices
// outside this range (or collisions, e.g. when the book came from a vendor with a
// different addressing scheme) are reassigned to the next free slot.
const KM_MIN_INDEX = 1;
const KM_MAX_INDEX = 2000;

// Exact KM column order. Header labels are chosen so the ABK-006 parser's
// tolerant alias map recognizes every one (e.g. "E-mail Address" → emailaddress).
const HEADERS = [
  'No',
  'Type',
  'Name',
  'Sort Name',
  'Short Name',
  'E-mail Address',
  'Host Address',
  'File Path',
  'User ID',
  'Password',
] as const;

// Source-metadata key patterns that have no KM representation. Reported (not
// dropped) so the conversion report stays honest about lost fidelity.
const UNMAPPABLE_KEY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /resolution/i, label: 'scan resolution' },
  { re: /scan.?profile/i, label: 'scan profile' },
  { re: /colou?r.?mode/i, label: 'color mode' },
  { re: /file.?format|filetype/i, label: 'file format' },
  { re: /duplex|simplex|2.?sided/i, label: 'duplex setting' },
  { re: /protocol|ftp|webdav/i, label: 'transfer protocol' },
  { re: /ifax|i.?fax|internet.?fax/i, label: 'internet fax option' },
  { re: /ldap|certificate|encryption.?key/i, label: 'security option' },
];

/** Escape a single CSV cell per RFC-4180 (quote when it contains ",\r\n). */
function csvCell(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

/** Split a `\\host\share\path` UNC into host + remaining path. */
function splitUnc(unc: string): { host: string; path: string } {
  const stripped = unc.replace(/\//g, '\\').replace(/^\\+/, '');
  const parts = stripped.split('\\');
  const host = parts.shift() ?? '';
  return { host, path: parts.join('\\') };
}

/** Resolve the Host Address + File Path columns for an SMB entry. */
function smbColumns(entry: CanonicalSmbEntry): { host: string; path: string } {
  if (entry.smb_host || entry.smb_share_path) {
    return { host: entry.smb_host ?? '', path: entry.smb_share_path ?? '' };
  }
  // Fall back to decomposing the full UNC when the discrete fields are absent.
  return entry.smb_full_unc ? splitUnc(entry.smb_full_unc) : { host: '', path: '' };
}

/** A stable identifier for report rows: entry id, else its display name. */
function entryId(entry: CanonicalEntry): string {
  return entry.id ?? entry.display_name ?? '(unnamed)';
}

/**
 * Allocate a 1..2000 KM registration number to every entry.
 *
 * An entry keeps its `speed_dial_index` when it is in range and unclaimed;
 * otherwise it gets the next free slot. Reassignments are recorded as warnings
 * (and the original index, where it came from a non-KM source, is preserved on
 * the entry's `source_metadata` so it survives the conversion).
 */
function allocateIndices(
  entries: CanonicalEntry[],
  fromForeignVendor: boolean,
  warnings: string[],
): Map<CanonicalEntry, number> {
  const assigned = new Map<CanonicalEntry, number>();
  const used = new Set<number>();

  const inRange = (n: number | null | undefined): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= KM_MIN_INDEX && n <= KM_MAX_INDEX;

  // Pass 1: honour valid, non-colliding source indices.
  for (const entry of entries) {
    const desired = entry.speed_dial_index;
    if (inRange(desired) && !used.has(desired)) {
      used.add(desired);
      assigned.set(entry, desired);
    }
  }

  // Pass 2: fill the rest from the lowest free slot.
  let next = KM_MIN_INDEX;
  for (const entry of entries) {
    if (assigned.has(entry)) continue;
    while (used.has(next) && next <= KM_MAX_INDEX) next++;
    if (next > KM_MAX_INDEX) {
      warnings.push(
        `KM index range exhausted (max ${KM_MAX_INDEX}); "${entry.display_name}" was not assigned an index`,
      );
      assigned.set(entry, 0); // 0 = sentinel meaning "no index written"
      continue;
    }
    const original = entry.speed_dial_index;
    used.add(next);
    assigned.set(entry, next);
    if (original != null && original !== next) {
      warnings.push(
        `Reassigned index ${original} → ${next} for "${entry.display_name}" (outside KM range or duplicate)`,
      );
      // Preserve the original index from a different-vendor source so it is not
      // silently lost during the conversion.
      if (fromForeignVendor && entry.source_metadata && typeof entry.source_metadata === 'object') {
        (entry.source_metadata as Record<string, unknown>).km_original_index ??= original;
      }
    }
  }

  return assigned;
}

/**
 * Serialize canonical entries into a Konica Minolta address book CSV.
 *
 * @param book    Canonical book metadata (used for the filename + source vendor).
 * @param entries Canonical entries to export.
 * @param options Output options (filename, BOM, title comment).
 */
export function serializeKonica(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options: SerializeKonicaOptions = {},
): SerializeResult {
  const { includeBom = true, includeTitleComment = false } = options;
  const warnings: string[] = [];
  const unmappable: FieldMappingIssue[] = [];

  const fromForeignVendor = !!book.source_vendor && book.source_vendor !== 'konica';

  // Only email + SMB are representable in KM v1. Group entries are dropped (and
  // reported); everything else is exported.
  const exportable = entries.filter((e) => e.entry_type === 'email' || e.entry_type === 'smb');
  for (const entry of entries) {
    if (entry.entry_type === 'group') {
      unmappable.push({
        entry_id: entryId(entry),
        vendor_field: 'group',
        reason: 'Group destinations are not supported by the Konica Minolta v1 export',
      });
    }
  }

  const indices = allocateIndices(exportable, fromForeignVendor, warnings);

  const lines: string[] = [];
  if (includeTitleComment) {
    lines.push(csvCell(`# Konica Minolta Address Book Export — ${book.name}`));
  }
  lines.push(HEADERS.map(csvCell).join(','));

  for (const entry of exportable) {
    // Report any source-vendor fields KM cannot represent — without dropping the
    // entry itself.
    const meta = entry.source_metadata;
    if (meta && typeof meta === 'object') {
      for (const [key, value] of Object.entries(meta)) {
        if (value == null || value === '') continue;
        const hit = UNMAPPABLE_KEY_PATTERNS.find((p) => p.re.test(key));
        if (hit) {
          unmappable.push({
            entry_id: entryId(entry),
            vendor_field: key,
            reason: `${hit.label} has no Konica Minolta equivalent and is omitted from the export`,
          });
        }
      }
    }

    const index = indices.get(entry) ?? 0;
    const no = index > 0 ? String(index) : '';
    const name = entry.display_name ?? '';
    const sortName = entry.sort_name ?? '';
    const shortName = entry.short_name ?? '';

    let row: string[];
    if (entry.entry_type === 'email') {
      row = [no, 'E-mail', name, sortName, shortName, entry.email, '', '', '', ''];
    } else {
      const { host, path } = smbColumns(entry);
      row = [no, 'SMB', name, sortName, shortName, '', host, path, entry.smb_username ?? '', ''];
    }
    lines.push(row.map(csvCell).join(','));
  }

  // CRLF line endings — KM exports are DOS-style and the parser handles both.
  const body = lines.join('\r\n') + '\r\n';
  const encoded = new TextEncoder().encode(body);
  const content = includeBom
    ? (() => {
        const out = new Uint8Array(encoded.length + 3);
        out[0] = 0xef;
        out[1] = 0xbb;
        out[2] = 0xbf;
        out.set(encoded, 3);
        return out;
      })()
    : encoded;

  const report: ConversionReport = {
    total_entries: entries.length,
    entries_exported: exportable.length,
    entries_dropped: entries.length - exportable.length,
    unmappable_fields: unmappable,
    warnings,
  };

  const safeName = (options.filename ?? `${book.name || 'address-book'}-konica.csv`)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    vendor: 'konica',
    filename: safeName.endsWith('.csv') ? safeName : `${safeName}.csv`,
    content,
    report,
  };
}
