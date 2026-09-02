/**
 * Cross-vendor conversion engine + override merge logic (ABK-012, ABK-022).
 * Source PRD: tasks/prd-address-book-manager.md (US-012, US-022).
 *
 * `convertBook` takes a canonical book + entries and a target vendor and
 * returns the serialized file plus an aggregated conversion report listing
 * fields that did not map cleanly. `mergeOverrides` implements the per-device
 * inheritance rule (device overrides win over customer-master entries).
 */
import type {
  AddressBookVendor,
  CanonicalAddressBook,
  CanonicalEntry,
  ConversionReport,
  SerializeResult,
} from './types.ts';
import { getVendorAdapter } from './vendors.ts';
import type { SerializeOptions } from './options.ts';

export interface ConvertResult {
  file: SerializeResult;
  report: ConversionReport;
}

/**
 * Merge a customer-master entry list with a device's override entries.
 * An override (is_override=true, overrides_entry_id set) supersedes the master
 * entry it points at; overrides without a target are appended as device-only
 * additions. Returns the effective entry list for the device.
 */
export function mergeOverrides(
  masterEntries: CanonicalEntry[],
  overrideEntries: CanonicalEntry[],
): CanonicalEntry[] {
  const overridesByTarget = new Map<string, CanonicalEntry>();
  const additions: CanonicalEntry[] = [];
  for (const o of overrideEntries) {
    if (o.overrides_entry_id) {
      overridesByTarget.set(o.overrides_entry_id, o);
    } else {
      additions.push(o);
    }
  }

  const merged: CanonicalEntry[] = [];
  for (const master of masterEntries) {
    const override = master.id ? overridesByTarget.get(master.id) : undefined;
    merged.push(override ?? master);
    if (override) overridesByTarget.delete(master.id!);
  }
  // overrides whose target was not found in the master list still apply
  for (const leftover of Array.from(overridesByTarget.values())) merged.push(leftover);
  merged.push(...additions);
  return merged;
}

/**
 * Convert a canonical book to a target vendor file. Cross-vendor warnings (e.g.
 * a Canon-resolution column that Konica cannot store) are surfaced in the
 * report's `unmappable_fields`. Unmappable fields are dropped from the file but
 * always reported.
 */
// PA-055: async in the edge tree, because serializeCanon is (Web Crypto has no
// synchronous API). The Node copy stays synchronous.
export async function convertBook(
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  targetVendor: AddressBookVendor,
  options: SerializeOptions = {},
): Promise<ConvertResult> {
  const adapter = getVendorAdapter(targetVendor);

  // If the target cannot hold encrypted credentials but a password was given,
  // warn rather than silently dropping the intent.
  const effectiveOptions: SerializeOptions = { ...options };
  if (options.password && !adapter.supportsEncryptedCredentials) {
    effectiveOptions.password = undefined;
  }

  const file = await adapter.serialize(book, entries, effectiveOptions);
  const report = file.report;

  if (options.password && !adapter.supportsEncryptedCredentials) {
    report.warnings.push(
      `${targetVendor} export does not support encrypted credential columns; SMB passwords were written in cleartext-capable columns per vendor format`,
    );
  }

  // Source-vendor-only metadata fields that the target format has no column for
  // are reported per entry so the dealer can reconcile manually.
  if (book.source_vendor && book.source_vendor !== targetVendor) {
    for (const entry of entries) {
      const md = entry.source_metadata as Record<string, unknown> | null | undefined;
      if (!md) continue;
      for (const key of Object.keys(md)) {
        if (key.startsWith('_')) continue; // internal (_password etc.)
        if (isCrossVendorOnlyField(book.source_vendor, key)) {
          report.unmappable_fields.push({
            entry_id: entry.id ?? entry.display_name,
            vendor_field: key,
            reason: `"${key}" is a ${book.source_vendor}-specific field with no ${targetVendor} equivalent`,
          });
        }
      }
    }
  }

  return { file, report };
}

// Vendor-specific source columns that have no cross-vendor canonical home.
// Intentionally conservative: only flags fields known to be vendor-proprietary
// (e.g. Canon scan-resolution / document-format hints) so the report stays
// signal-rich rather than listing every preserved column.
const VENDOR_ONLY_FIELDS: Record<string, string[]> = {
  canon: ['resolution', 'documentformat', 'filename', 'transmissionmode', 'dividetx', 'sendmode'],
  konica: ['scansettings', 'resolutiondpi'],
  xerox: ['(scan) resolution', 'file format'],
  ricoh: ['scan resolution', 'fax line'],
};

function isCrossVendorOnlyField(sourceVendor: string, field: string): boolean {
  const list = VENDOR_ONLY_FIELDS[sourceVendor] ?? [];
  return list.includes(field.toLowerCase());
}
