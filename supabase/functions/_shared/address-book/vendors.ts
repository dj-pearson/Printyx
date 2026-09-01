/**
 * Vendor adapter registry (ABK-004..011) for the edge tree.
 *
 * PA-055: the Deno counterpart of server/services/address-book/vendors/index.ts.
 * Same four vendors, same supportsEncryptedCredentials flags - locked by
 * server/tests/unit/address-book-port-parity.test.ts.
 *
 * Every parser and serializer is typed ASYNC here even though only Canon's
 * actually awaits: Web Crypto forced parseCanon and serializeCanon async, and a
 * registry where one entry returns a promise and three do not is a trap for the
 * next caller. `await` on a non-promise is free.
 */
import type {
  AddressBookVendor,
  CanonicalAddressBook,
  CanonicalEntry,
  ParseResult,
  SerializeResult,
} from './types.ts';
import type { SerializeOptions } from './options.ts';
import { parseCanon } from './canon-parser.ts';
import { serializeCanon } from './canon-serializer.ts';
import { parseKonica } from './konica-parser.ts';
import { serializeKonica } from './konica-serializer.ts';
import { parseXerox } from './xerox-parser.ts';
import { serializeXerox } from './xerox-serializer.ts';
import { parseRicoh } from './ricoh-parser.ts';
import { serializeRicoh } from './ricoh-serializer.ts';

export type VendorParser = (
  buffer: Uint8Array,
  password?: string,
) => ParseResult | Promise<ParseResult>;

export type VendorSerializer = (
  book: CanonicalAddressBook,
  entries: CanonicalEntry[],
  options?: SerializeOptions,
) => SerializeResult | Promise<SerializeResult>;

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
