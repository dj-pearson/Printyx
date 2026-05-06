import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const addressBooks = pgTable(
  'address_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    deviceId: uuid('device_id'),
    name: varchar('name', { length: 200 }).notNull(),
    sourceVendor: varchar('source_vendor', { length: 32 }),
    sourceModel: varchar('source_model', { length: 100 }),
    sourceSubbookName: varchar('source_subbook_name', { length: 200 }),
    lastImportedAt: timestamp('last_imported_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: uuid('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('address_books_tenant_idx').on(table.tenantId),
    customerIdx: index('address_books_customer_idx').on(table.tenantId, table.customerId),
    deviceIdx: index('address_books_device_idx').on(table.tenantId, table.deviceId),
  }),
);

export const addressBookCredentials = pgTable(
  'address_book_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    encryptedBlob: bytea('encrypted_blob').notNull(),
    iv: bytea('iv').notNull(),
    authTag: bytea('auth_tag').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('address_book_credentials_tenant_idx').on(table.tenantId),
  }),
);

export const addressBookEntries = pgTable(
  'address_book_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => addressBooks.id, { onDelete: 'cascade' }),
    entryType: varchar('entry_type', { length: 16 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    sortName: varchar('sort_name', { length: 200 }),
    shortName: varchar('short_name', { length: 50 }),
    email: varchar('email', { length: 320 }),
    smbHost: varchar('smb_host', { length: 255 }),
    smbSharePath: varchar('smb_share_path', { length: 500 }),
    smbFullUnc: varchar('smb_full_unc', { length: 500 }),
    smbUsername: varchar('smb_username', { length: 255 }),
    credentialId: uuid('credential_id').references(() => addressBookCredentials.id, {
      onDelete: 'set null',
    }),
    speedDialIndex: integer('speed_dial_index'),
    groupMemberEntryIds: jsonb('group_member_entry_ids'),
    sourceUuid: varchar('source_uuid', { length: 100 }),
    sourceMetadata: jsonb('source_metadata'),
    isOverride: boolean('is_override').notNull().default(false),
    overridesEntryId: uuid('overrides_entry_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    bookIdx: index('address_book_entries_book_idx').on(table.bookId),
    bookTypeIdx: index('address_book_entries_book_type_idx').on(table.bookId, table.entryType),
    overridesIdx: index('address_book_entries_overrides_idx').on(table.overridesEntryId),
  }),
);

export const addressBookImports = pgTable(
  'address_book_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => addressBooks.id, { onDelete: 'cascade' }),
    vendor: varchar('vendor', { length: 32 }).notNull(),
    rawFilename: varchar('raw_filename', { length: 500 }).notNull(),
    rawFileStoragePath: varchar('raw_file_storage_path', { length: 1000 }),
    passwordWasRequired: boolean('password_was_required').notNull().default(false),
    entryCount: integer('entry_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    errorsJson: jsonb('errors_json'),
    importedAt: timestamp('imported_at').notNull().defaultNow(),
    importedByUserId: uuid('imported_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('address_book_imports_tenant_idx').on(table.tenantId),
    bookIdx: index('address_book_imports_book_idx').on(table.bookId),
  }),
);

export const addressBookExports = pgTable(
  'address_book_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => addressBooks.id, { onDelete: 'cascade' }),
    targetVendor: varchar('target_vendor', { length: 32 }).notNull(),
    targetFilename: varchar('target_filename', { length: 500 }).notNull(),
    conversionReportJson: jsonb('conversion_report_json'),
    exportedAt: timestamp('exported_at').notNull().defaultNow(),
    exportedByUserId: uuid('exported_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('address_book_exports_tenant_idx').on(table.tenantId),
    bookIdx: index('address_book_exports_book_idx').on(table.bookId),
  }),
);

export const insertAddressBookSchema = createInsertSchema(addressBooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressBookEntrySchema = createInsertSchema(addressBookEntries, {
  entryType: z.enum(['email', 'smb', 'group']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressBookCredentialSchema = createInsertSchema(addressBookCredentials).omit({
  id: true,
  createdAt: true,
});

export const insertAddressBookImportSchema = createInsertSchema(addressBookImports).omit({
  id: true,
  importedAt: true,
});

export const insertAddressBookExportSchema = createInsertSchema(addressBookExports).omit({
  id: true,
  exportedAt: true,
});

export type AddressBook = typeof addressBooks.$inferSelect;
export type NewAddressBook = typeof addressBooks.$inferInsert;
export type AddressBookEntry = typeof addressBookEntries.$inferSelect;
export type NewAddressBookEntry = typeof addressBookEntries.$inferInsert;
export type AddressBookCredential = typeof addressBookCredentials.$inferSelect;
export type NewAddressBookCredential = typeof addressBookCredentials.$inferInsert;
export type AddressBookImport = typeof addressBookImports.$inferSelect;
export type NewAddressBookImport = typeof addressBookImports.$inferInsert;
export type AddressBookExport = typeof addressBookExports.$inferSelect;
export type NewAddressBookExport = typeof addressBookExports.$inferInsert;
