/**
 * Vendor adapter registry (ABK-004..011). Maps each supported vendor to its
 * parser + serializer so the conversion engine and edge function can dispatch
 * generically.
 */
import type {
  AddressBookVendor,
  CanonicalAddressBook,
  CanonicalEntry,
  ParseResult,
  SerializeResult,
} from '../../../../shared/address-book-types';
import type { SerializeOptions } from './_shared/options';
import { parseCanon } from './canon/parser';
import { serializeCanon } from './canon/serializer';
import { parseKonica } from './konica/parser';
import { serializeKonica } from './konica/serializer';
import { parseXerox } from './xerox/parser';
import { serializeXerox } from './xerox/serializer';
import { parseRicoh } from './ricoh/parser';
import { serializeRicoh } from './ricoh/serializer';

export type VendorParser = (buffer: Buffer, password?: string) => ParseResult;
export type VendorSerializer = (
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options?: SerializeOptions,
) => SerializeResult;

interface VendorAdapter {
  parse: VendorParser;
  serialize: VendorSerializer;
  /** Whether this vendor supports encrypted credential columns on export. */
  supportsEncryptedCredentials: boolean;
}

export const vendorAdapters: Record<AddressBookVendor, VendorAdapter> = {
  canon: { parse: parseCanon, serialize: serializeCanon, supportsEncryptedCredentials: true },
  konica: { parse: parseKonica, serialize: serializeKonica, supportsEncryptedCredentials: false },
  xerox: { parse: parseXerox, serialize: serializeXerox, supportsEncryptedCredentials: false },
  ricoh: { parse: parseRicoh, serialize: serializeRicoh, supportsEncryptedCredentials: false },
};

export function getVendorAdapter(vendor: AddressBookVendor): VendorAdapter {
  const adapter = vendorAdapters[vendor];
  if (!adapter) throw new Error(`Unsupported address-book vendor: ${vendor}`);
  return adapter;
}

export {
  parseCanon,
  serializeCanon,
  parseKonica,
  serializeKonica,
  parseXerox,
  serializeXerox,
  parseRicoh,
  serializeRicoh,
};
