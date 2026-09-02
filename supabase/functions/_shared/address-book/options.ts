/**
 * Shared serializer option contract used by every vendor address-book
 * serializer (ABK-005/007/009/011) and the conversion engine (ABK-012).
 */
import type { CanonicalEntry, ConversionReport, FieldMappingIssue } from './types.ts';

export interface SerializeOptions {
  /** Sub-book / address-book display name written into vendor headers. */
  subBookName?: string | null;
  /**
   * Target-vendor password. When provided, vendors that support encrypted
   * credential columns re-encrypt SMB passwords; when omitted, credential
   * columns are left blank and the encrypted-attribute header is omitted.
   */
  password?: string;
  /**
   * Resolve the plaintext password for an SMB entry. The edge function passes
   * a vault-backed resolver; unit tests rely on the `_password` value the
   * parser stashed in `source_metadata`.
   */
  resolvePassword?: (entry: CanonicalEntry) => string | undefined;
}

/** Read a stashed/decrypted password for an SMB entry, resolver first. */
export function resolveEntryPassword(
  entry: CanonicalEntry,
  options: SerializeOptions,
): string | undefined {
  if (options.resolvePassword) {
    const fromResolver = options.resolvePassword(entry);
    if (fromResolver) return fromResolver;
  }
  const md = entry.source_metadata as Record<string, unknown> | null | undefined;
  const stashed = md?._password;
  return typeof stashed === 'string' && stashed.length > 0 ? stashed : undefined;
}

/** Create an empty conversion report seeded with the total entry count. */
export function emptyReport(total: number): ConversionReport {
  return {
    total_entries: total,
    entries_exported: 0,
    entries_dropped: 0,
    unmappable_fields: [],
    warnings: [],
  };
}

export function addIssue(report: ConversionReport, issue: FieldMappingIssue): void {
  report.unmappable_fields.push(issue);
}
