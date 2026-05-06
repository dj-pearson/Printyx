/**
 * Canonical address book types — vendor-neutral shape used by every parser,
 * serializer, and edge function. Source PRD: tasks/prd-address-book-manager.md
 * (US-003, ABK-003).
 */

export type AddressBookVendor = 'canon' | 'konica' | 'xerox' | 'ricoh';

export type EntryType = 'email' | 'smb' | 'group';

interface CanonicalEntryBase {
  id?: string;
  source_uuid?: string | null;
  display_name: string;
  sort_name?: string | null;
  short_name?: string | null;
  speed_dial_index?: number | null;
  source_metadata?: Record<string, unknown> | null;
  is_override?: boolean;
  overrides_entry_id?: string | null;
}

export interface CanonicalEmailEntry extends CanonicalEntryBase {
  entry_type: 'email';
  email: string;
}

export interface CanonicalSmbEntry extends CanonicalEntryBase {
  entry_type: 'smb';
  smb_full_unc: string;
  smb_host?: string | null;
  smb_share_path?: string | null;
  smb_username?: string | null;
  credential_id?: string | null;
}

export interface CanonicalGroupEntry extends CanonicalEntryBase {
  entry_type: 'group';
  member_entry_ids: string[];
}

export type CanonicalEntry = CanonicalEmailEntry | CanonicalSmbEntry | CanonicalGroupEntry;

export interface CanonicalAddressBook {
  id?: string;
  tenant_id: string;
  customer_id: string;
  device_id?: string | null;
  name: string;
  source_vendor?: AddressBookVendor | null;
  source_model?: string | null;
  source_subbook_name?: string | null;
}

export interface FieldMappingIssue {
  entry_id: string;
  vendor_field: string;
  reason: string;
}

export interface ConversionReport {
  total_entries: number;
  entries_exported: number;
  entries_dropped: number;
  unmappable_fields: FieldMappingIssue[];
  warnings: string[];
}

export interface ParseRowError {
  row: number;
  reason: string;
  raw?: Record<string, unknown>;
}

export interface ParseResult {
  vendor: AddressBookVendor;
  entries: CanonicalEntry[];
  errors: ParseRowError[];
  password_was_required: boolean;
  source_subbook_name?: string | null;
  source_model?: string | null;
  warnings: string[];
}

export interface SerializeResult {
  vendor: AddressBookVendor;
  filename: string;
  content: Buffer;
  report: ConversionReport;
}

export function isEmailEntry(entry: CanonicalEntry): entry is CanonicalEmailEntry {
  return entry.entry_type === 'email';
}

export function isSmbEntry(entry: CanonicalEntry): entry is CanonicalSmbEntry {
  return entry.entry_type === 'smb';
}

export function isGroupEntry(entry: CanonicalEntry): entry is CanonicalGroupEntry {
  return entry.entry_type === 'group';
}
