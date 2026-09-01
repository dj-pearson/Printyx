// Canonical address-book types for the edge tree.
//
// PA-055: shared/address-book-types.ts is the one definition (ABK-003) and the
// Node vendor adapters import it directly. A type-only import from shared/ is
// the documented edge idiom (see the example in _shared/db.ts) - types are
// erased, so nothing outside supabase/functions is needed at runtime. The three
// guard FUNCTIONS are values, so they are re-exported separately.
export type {
  AddressBookVendor,
  EntryType,
  CanonicalEmailEntry,
  CanonicalSmbEntry,
  CanonicalGroupEntry,
  CanonicalEntry,
  CanonicalAddressBook,
  FieldMappingIssue,
  ConversionReport,
  ParseRowError,
  ParseResult,
  SerializeResult,
} from '../../../../shared/address-book-types.ts';

export { isEmailEntry, isSmbEntry, isGroupEntry } from '../../../../shared/address-book-types.ts';
