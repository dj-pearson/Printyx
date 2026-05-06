# PRD: Multi-Vendor Address Book Manager

## 1. Introduction / Overview

Dealer help desk and service staff routinely receive copier address book exports from customers and need to migrate them between manufacturers (e.g., when a customer replaces a Canon imageRUNNER fleet with Konica Minolta bizhub units, every scan-to-folder destination, email contact, and SMB credential has to be reproduced). Today this is a manual, error-prone Excel exercise per device.

This feature adds a **Multi-Vendor Address Book Manager** to Printyx that:

1. Imports manufacturer-specific address book exports (Canon `abook.csv`, Konica Minolta CSV, Xerox CSV, Ricoh CSV in v1).
2. Stores entries in a vendor-neutral canonical format scoped to a customer, with optional per-device overrides.
3. Lets help desk staff edit entries inside Printyx with validation.
4. Exports back to any supported vendor's format for re-import on the target device.

It surfaces both as a top-level **Service Hub → Address Books** module and as an **Address Books** tab on the customer record. Live device push (SNMP/web service sync) is **deferred to phase 2**; v1 is import → store → edit → export only.

## 2. Goals

- Reduce time to migrate an address book between manufacturers from hours of manual entry to under 10 minutes.
- Support email recipients and SMB scan-to-folder destinations (the two entry types covering ~90% of real-world addresses) across Canon, Konica Minolta, Xerox, and Ricoh in v1.
- Preserve credentials securely: decrypt source-vendor encrypted password fields once on import (with user-supplied source password), re-encrypt with Printyx master key at rest, re-encrypt with user-supplied target password on export.
- Provide a customer-scoped "master" address book with per-device override entries to model the real-world case where most devices share contacts but a few have unique destinations.
- Show a clear conversion report after each export listing fields that didn't map cleanly between vendors.
- Gate access via RBAC to Service, Help Desk, Sales, Company Admin, and Platform Admin roles only.

## 3. User Stories

### US-001: Canonical address book schema
**Description:** As a developer, I need vendor-neutral Drizzle tables so address books can be stored, scoped to customer + device, and round-tripped between vendors.

**Acceptance Criteria:**
- [ ] New file `shared/address-book-schema.ts` defines tables: `address_books`, `address_book_entries`, `address_book_credentials`, `address_book_imports`, `address_book_exports`.
- [ ] `address_books` columns: id, tenant_id, customer_id, device_id (nullable — null = customer-master book), name, source_vendor, source_model, source_subbook_name, last_imported_at, created_at, updated_at, created_by_user_id.
- [ ] `address_book_entries` columns: id, book_id, entry_type (`email`|`smb`|`group`), display_name, sort_name, short_name, email, smb_host, smb_share_path, smb_full_unc, smb_username, credential_id (FK nullable), speed_dial_index, group_member_entry_ids (jsonb array), source_uuid, source_metadata (jsonb — preserves vendor-specific fields for round-trip), is_override (boolean — true if this entry overrides a customer-master entry on a specific device), overrides_entry_id (FK self, nullable), created_at, updated_at.
- [ ] `address_book_credentials` columns: id, tenant_id, encrypted_blob (bytea — AES-256-GCM with Printyx master key), iv (bytea), auth_tag (bytea), created_at.
- [ ] `address_book_imports` columns: id, book_id, vendor, raw_filename, raw_file_storage_path, password_was_required (boolean), entry_count, error_count, errors_json, imported_at, imported_by_user_id.
- [ ] `address_book_exports` columns: id, book_id, target_vendor, target_filename, conversion_report_json, exported_at, exported_by_user_id.
- [ ] All tenant-scoped tables have `tenant_id` not null + index.
- [ ] Schema exported from `shared/schema.ts`.
- [ ] `npm run db:generate` produces a clean migration.
- [ ] Typecheck passes.

### US-002: Credential encryption service
**Description:** As a developer, I need a server-side service that encrypts/decrypts credential blobs with the Printyx master key so source-vendor passwords can be safely persisted.

**Acceptance Criteria:**
- [ ] `server/services/address-book/credential-vault.ts` exports `encryptCredential(plaintext)` and `decryptCredential(record)`.
- [ ] Uses AES-256-GCM with random IV per credential, key from env `ADDRESS_BOOK_MASTER_KEY` (32-byte base64).
- [ ] Throws clear error if env var missing or wrong length.
- [ ] Plaintext password never logged.
- [ ] Unit tests cover round-trip + tamper detection (auth tag verification).
- [ ] Typecheck passes.

### US-003: Canonical address book TypeScript types
**Description:** As a developer, I need shared types describing canonical entries so vendor adapters all conform to one shape.

**Acceptance Criteria:**
- [ ] `shared/address-book-types.ts` exports `CanonicalEntry`, `CanonicalAddressBook`, `ParseResult`, `SerializeResult`, `ConversionReport`, `FieldMappingIssue`.
- [ ] `CanonicalEntry` discriminated union on `entry_type` (`email` | `smb` | `group`).
- [ ] `ConversionReport` includes: `total_entries`, `entries_exported`, `entries_dropped`, `unmappable_fields` (array of `{ entry_id, vendor_field, reason }`), `warnings`.
- [ ] Re-exported from `shared/schema.ts` index.
- [ ] Typecheck passes.

### US-004: Canon parser
**Description:** As a help desk user, I want to upload a Canon `abook.csv` and have its entries decoded into canonical form, with my source password used to decrypt SMB credentials.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/canon/parser.ts` exports `parseCanon(buffer, password?) → ParseResult`.
- [ ] Reads header comments (`# Canon AddressBook CSV version`, `# CharSet`, `# Crypto Version`, `# Crypto Attribute`, `# SubAddressBookName`).
- [ ] Maps `objectclass=email` rows to canonical `email` entries (display_name from `cn`, email from `mailaddress`, speed_dial_index from `indxid`).
- [ ] Maps `objectclass=remotefilesystem` rows with `protocol=smb` to canonical `smb` entries (smb_full_unc from `url`, smb_share_path from `path`, smb_username from `username`).
- [ ] When `# Crypto Attribute: pwd` is set, decrypts the `pwd` column using user-supplied password via Canon Crypto v2 KDF (PBKDF2 → AES-256-CBC; verify exact algo against the supplied sample with password "1").
- [ ] Stores all 49 source columns in `source_metadata` for round-trip fidelity.
- [ ] Returns parse errors per row without aborting the whole file.
- [ ] Unit test loads the supplied sample `abook.csv` (password "1") and asserts row count + a known SMB credential decrypts correctly.
- [ ] Typecheck passes.

### US-005: Canon serializer
**Description:** As a help desk user, I want to export a canonical address book back to Canon `abook.csv` format so it can be re-imported on a Canon device.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/canon/serializer.ts` exports `serializeCanon(book, entries, options) → SerializeResult`.
- [ ] Output begins with the same Canon header comments using configured version + sub-book name.
- [ ] When `options.password` provided, encrypts `pwd` column via Canon Crypto v2 KDF and sets `# Crypto Attribute: pwd`.
- [ ] When `options.password` omitted, omits `# Crypto Attribute: pwd` line and leaves `pwd` columns empty.
- [ ] Restores fields from `source_metadata` when source vendor was Canon (round-trip fidelity).
- [ ] Generates fresh `uuid` values for entries that originated from a different vendor.
- [ ] Unit test: parse supplied sample → serialize → parse again → assert canonical equality.
- [ ] Typecheck passes.

### US-006: Konica Minolta parser
**Description:** As a help desk user, I want to upload a Konica Minolta address book CSV and have its entries decoded into canonical form.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/konica/parser.ts` exports `parseKonica(buffer, password?) → ParseResult`.
- [ ] Detects character encoding (KM exports often Shift-JIS; fall back to UTF-8 BOM).
- [ ] Maps email destinations (KM `Type=E-mail`) to canonical `email` entries.
- [ ] Maps SMB destinations (KM `Type=SMB`) to canonical `smb` entries.
- [ ] Stores all source columns in `source_metadata`.
- [ ] Unit test against a fixture KM CSV (sample to be added under `tests/fixtures/address-book/konica-sample.csv`).
- [ ] Typecheck passes.

### US-007: Konica Minolta serializer
**Description:** As a help desk user, I want to export canonical entries to Konica Minolta CSV format.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/konica/serializer.ts` exports `serializeKonica(book, entries, options) → SerializeResult`.
- [ ] Output uses correct KM column order, encoding (UTF-8 BOM), and `Type` values.
- [ ] Speed dial / index allocation handled (KM uses different ranges than Canon).
- [ ] Fields not representable in KM (e.g., Canon-specific scan resolutions) reported in `ConversionReport.unmappable_fields`.
- [ ] Round-trip unit test (parseKonica → serializeKonica → parseKonica equality).
- [ ] Typecheck passes.

### US-008: Xerox parser
**Description:** As a help desk user, I want to upload a Xerox address book CSV (AltaLink/VersaLink Embedded Web Server export) and have its entries decoded into canonical form.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/xerox/parser.ts` exports `parseXerox(buffer, password?) → ParseResult`.
- [ ] Maps Xerox email-tab + scan-tab + fax-tab schemas (Xerox separates by destination type) into unified canonical entries.
- [ ] Stores source columns in `source_metadata`.
- [ ] Unit test against fixture.
- [ ] Typecheck passes.

### US-009: Xerox serializer
**Description:** As a help desk user, I want to export canonical entries to Xerox CSV format.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/xerox/serializer.ts` exports `serializeXerox(book, entries, options) → SerializeResult`.
- [ ] Produces output compatible with AltaLink/VersaLink EWS import.
- [ ] Round-trip unit test.
- [ ] Typecheck passes.

### US-010: Ricoh parser
**Description:** As a help desk user, I want to upload a Ricoh address book CSV and have its entries decoded into canonical form.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/ricoh/parser.ts` exports `parseRicoh(buffer, password?) → ParseResult`.
- [ ] Compatible with Ricoh "Address Book Import Helper" CSV schema.
- [ ] Maps email + SMB destinations to canonical entries.
- [ ] Unit test against fixture.
- [ ] Typecheck passes.

### US-011: Ricoh serializer
**Description:** As a help desk user, I want to export canonical entries to Ricoh CSV format.

**Acceptance Criteria:**
- [ ] `server/services/address-book/vendors/ricoh/serializer.ts` exports `serializeRicoh(book, entries, options) → SerializeResult`.
- [ ] Output ingestible by Ricoh Address Book Import Helper.
- [ ] Round-trip unit test.
- [ ] Typecheck passes.

### US-012: Conversion engine + mapping report
**Description:** As a developer, I need an orchestration layer that takes a canonical book + target vendor and produces both the export file and a conversion report listing dropped fields.

**Acceptance Criteria:**
- [ ] `server/services/address-book/conversion-engine.ts` exports `convertBook(book, entries, targetVendor, options) → { file, report }`.
- [ ] Iterates entries, calls target vendor serializer, aggregates `FieldMappingIssue` entries.
- [ ] Persists report to `address_book_exports.conversion_report_json`.
- [ ] Drops unmappable fields silently from the file but always reports them in the response.
- [ ] Unit test: convert Canon→Konica book and assert resolution-related fields appear in `unmappable_fields`.
- [ ] Typecheck passes.

### US-013: API routes — books and entries
**Description:** As a frontend developer, I need REST endpoints to list, view, edit, and delete address books and entries with proper tenant scoping.

**Acceptance Criteria:**
- [ ] New file `server/routes-address-books.ts` registered in `server/routes.ts`.
- [ ] `GET /api/address-books` — list books filtered by tenant; query params `customer_id`, `device_id`.
- [ ] `GET /api/address-books/:id` — fetch single book with entries.
- [ ] `POST /api/address-books` — create empty book.
- [ ] `PATCH /api/address-books/:id` — rename, change scope.
- [ ] `DELETE /api/address-books/:id` — soft delete.
- [ ] `GET /api/address-books/:id/entries` — paginated entries.
- [ ] `POST /api/address-books/:id/entries` — create entry.
- [ ] `PATCH /api/address-books/:bookId/entries/:id` — edit entry.
- [ ] `DELETE /api/address-books/:bookId/entries/:id` — remove entry.
- [ ] All routes use `requireAuth` + `requirePermission(['service.address_book.view' / 'edit'])` and filter by `tenantId`.
- [ ] Zod validation on POST/PATCH bodies.
- [ ] Typecheck passes.

### US-014: API routes — import and export
**Description:** As a frontend developer, I need endpoints to upload a vendor file (with optional password) and download a target-vendor file.

**Acceptance Criteria:**
- [ ] `POST /api/address-books/:id/import` — multipart upload; body fields: `vendor`, `password` (optional). Returns parse result + entry count + errors.
- [ ] `POST /api/address-books/import` — same, but creates a new book if `id` not yet known (used by import wizard before book exists).
- [ ] `POST /api/address-books/:id/export` — body: `target_vendor`, `target_password` (optional). Returns `{ download_url, conversion_report }`.
- [ ] `GET /api/address-books/exports/:exportId/download` — streams the generated file.
- [ ] File uploads capped at 25 MB; multipart parser uses existing project pattern.
- [ ] Source files persisted to storage with tenant-scoped path; never written to public dirs.
- [ ] Source passwords never persisted.
- [ ] Typecheck passes.

### US-015: New RBAC permissions
**Description:** As a platform admin, I need granular permissions so I can grant address book access only to the right roles.

**Acceptance Criteria:**
- [ ] New permissions added to seed: `service.address_book.view_team`, `service.address_book.edit_team`, `service.address_book.import`, `service.address_book.export`, `service.address_book.delete`.
- [ ] Granted by default to: Platform Admin, Company Admin, Service, Help Desk, Sales (view + import + export); Platform Admin + Company Admin (delete).
- [ ] Migration / seed script updates existing tenants.
- [ ] Typecheck passes.

### US-016: Service Hub — Address Books index page
**Description:** As a help desk user, I want a top-level page listing all address books in my tenant so I can quickly find one to edit or convert.

**Acceptance Criteria:**
- [ ] New route `/service/address-books` registered in `client/src/App.tsx`.
- [ ] New page `client/src/pages/service/AddressBooksIndex.tsx`.
- [ ] Sidebar entry under Service Hub in `RoleAwareCollapsibleSidebar.tsx`, gated to roles with `service.address_book.view_team`.
- [ ] Table columns: Name, Customer, Device (or "Customer-wide"), Source Vendor, Entry Count, Last Imported, Actions.
- [ ] Filter controls: customer, vendor, scope (customer-wide vs device).
- [ ] "New Address Book" + "Import from File" buttons.
- [ ] Uses TanStack Query with loading + error states.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-017: Address book detail page
**Description:** As a help desk user, I want to view a book's entries in a paginated table with search and per-entry actions.

**Acceptance Criteria:**
- [ ] New route `/service/address-books/:id`.
- [ ] New page `client/src/pages/service/AddressBookDetail.tsx`.
- [ ] Header shows book name, customer, device scope, source vendor, last import time, "Export" + "Import (replace/merge)" buttons.
- [ ] Entry table: type icon, display name, email/path, speed dial index, override badge (if device-scoped override), edit + delete buttons.
- [ ] Search box filters entries client-side.
- [ ] Type filter (All / Email / SMB / Group).
- [ ] Empty state with "Import" CTA.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-018: Per-entry create/edit form with validation
**Description:** As a help desk user, I want a validated form to add or edit individual entries so I don't introduce malformed addresses.

**Acceptance Criteria:**
- [ ] Modal form opened from "Add Entry" + per-row "Edit" buttons.
- [ ] Type selector switches form schema (email vs SMB vs group).
- [ ] Email form: display name, sort name, email (RFC 5322 validation), speed dial index (numeric, optional).
- [ ] SMB form: display name, host, share path, full UNC (auto-derived from host + share, editable), username, password (masked input, optional change), speed dial index.
- [ ] Group form: display name, member picker (multi-select from existing entries in the same book).
- [ ] React Hook Form + Zod validation; inline error messages.
- [ ] On save: optimistic update with rollback on error.
- [ ] Password change writes a new credential record, swaps `credential_id`.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-019: Import wizard
**Description:** As a help desk user, I want a guided wizard to upload a vendor file, supply the password if needed, preview parsed entries, and commit them to a new or existing book.

**Acceptance Criteria:**
- [ ] Multi-step wizard component: (1) select vendor, (2) upload file, (3) password prompt — only shown if parser detects encrypted credential fields, (4) preview table with parse errors highlighted, (5) choose target — new book (with name + customer + device scope) or existing book (replace / merge), (6) commit.
- [ ] If parser detects `# Crypto Attribute: pwd` (Canon) or vendor-equivalent flag and no password supplied yet, wizard pauses for password input.
- [ ] Password is sent over HTTPS, never persisted, never logged.
- [ ] Preview shows first 50 entries with error rows flagged.
- [ ] Final step calls `POST /api/address-books/:id/import` (or `/import` if new book).
- [ ] On success, navigates to book detail.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-020: Export modal with conversion report
**Description:** As a help desk user, I want to export a book to any supported vendor format and see a clear report of what didn't translate cleanly so I can warn the customer or adjust manually.

**Acceptance Criteria:**
- [ ] "Export" button on detail page opens modal.
- [ ] Form fields: target vendor, target password (optional, only enabled for vendors that support encrypted credentials), filename (auto-suggested e.g. `abook-acme-corp-canon-2026-05-06.csv`).
- [ ] On submit, calls `POST /api/address-books/:id/export`.
- [ ] After response, shows conversion report: total entries, exported count, dropped entries, table of unmappable fields grouped by entry.
- [ ] "Download File" button downloads via the returned URL.
- [ ] Report can be re-viewed later from address book history (link to `address_book_exports` row).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-021: Customer record — Address Books tab
**Description:** As a help desk user, I want to start from the customer record and see all their address books so I can answer "what does Acme Corp's scan setup look like" without leaving the page.

**Acceptance Criteria:**
- [ ] New tab "Address Books" added to the customer record page.
- [ ] Shows the customer-master book at top + a list of device-scoped books below (one per device with overrides).
- [ ] Each row links to the book detail page.
- [ ] "Create Customer-Master Book" button if none exists.
- [ ] Inherits page-level customer context (no extra customer selection needed).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-022: Per-device override UI
**Description:** As a help desk user, I want to mark an entry as a device-specific override of the customer-master book so I can model devices that have unique destinations without forking the whole book.

**Acceptance Criteria:**
- [ ] Device-scoped book detail page shows entries from the customer-master book in a "Inherited" section (read-only) plus device overrides in an "Overrides" section.
- [ ] "Override this entry" action on inherited rows creates a new entry with `is_override=true` and `overrides_entry_id` set; subsequent edits affect only the override.
- [ ] "Revert override" removes the override entry.
- [ ] Overrides clearly badged in the entry table.
- [ ] On export of a device-scoped book, the engine merges inherited entries with overrides (overrides win).
- [ ] Unit test for the merge logic.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-023: E2E happy path
**Description:** As a developer, I want a Playwright test covering the full Canon→Konica round trip so regressions are caught before deploy.

**Acceptance Criteria:**
- [ ] `tests/e2e/address-books.spec.ts` covers: log in as help desk → import provided Canon `abook.csv` (password "1") → verify entries in detail page → export as Konica → download file → verify file parses back into matching canonical entries.
- [ ] Test passes against local dev environment.
- [ ] Typecheck passes.

## 4. Functional Requirements

- **FR-1:** The system MUST store address books in a vendor-neutral canonical format with tenant, customer, and optional device scope.
- **FR-2:** The system MUST support Canon, Konica Minolta, Xerox, and Ricoh import + export in v1.
- **FR-3:** The system MUST support `email` and `smb` (scan-to-folder) entry types in v1, plus `group` entries that reference existing entries.
- **FR-4:** The system MUST detect when an uploaded source file contains encrypted credential fields and prompt the user for the source password before parsing.
- **FR-5:** The system MUST decrypt source-vendor encrypted credentials with the user-supplied source password, re-encrypt with Printyx master key (AES-256-GCM, key from `ADDRESS_BOOK_MASTER_KEY` env var), and store ciphertext at rest.
- **FR-6:** The system MUST NOT persist source passwords supplied during import.
- **FR-7:** The system MUST allow exporting any address book to any of the supported vendors regardless of source vendor.
- **FR-8:** The system MUST drop unmappable fields silently from exported files but report them in a conversion report shown to the user after export.
- **FR-9:** The system MUST support customer-wide "master" address books and device-scoped override books that inherit from the master and supersede individual entries.
- **FR-10:** The system MUST validate user-edited entries with Zod schemas before persisting.
- **FR-11:** All address book API routes MUST filter queries by `tenantId` from `getTenantId(req)`.
- **FR-12:** The system MUST gate access via RBAC permissions granted by default to Platform Admin, Company Admin, Service, Help Desk, and Sales roles.
- **FR-13:** The system MUST surface address books both at `/service/address-books` (Service Hub) and on the customer record page.
- **FR-14:** The system MUST persist a record of every import (with parse errors) and export (with conversion report) for audit.
- **FR-15:** The UI MUST handle TanStack Query loading and error states for every data-fetching surface.

## 5. Non-Goals (Out of Scope for v1)

- Live device push/pull via SNMP, web service, or vendor APIs (Canon iW MC, KM PageScope, Ricoh @Remote, Xerox CWW). Phase 2.
- Address book entry types beyond email, SMB, and group: no FTP, WebDAV, fax, i-fax, LDAP-linked, or shared inbox in v1.
- Manufacturers beyond the big four: Sharp, Kyocera, HP, Lexmark, Toshiba, Brother. Phase 2.
- Direct decryption of full-device backup files (Canon `.dcm`, KM full-config exports). Address books only.
- Bulk/spreadsheet inline editing — v1 is per-entry form only.
- Customer portal access — internal staff only in v1.
- Automatic conflict resolution when merging imports into an existing book — v1 supports replace or append only, not field-level merge.
- Versioning / rollback of past book states beyond the import/export audit log.
- Scheduled or scripted exports.

## 6. Design Considerations

- Reuse existing shadcn/ui components: `Table`, `Dialog`, `Form`, `Input`, `Select`, `Tabs`, `Badge`, `Card`.
- Mobile-first per project convention; the entry table should collapse to cards on small screens (touch targets ≥ 48 px).
- Sidebar entry under existing **Service Hub** section in `RoleAwareCollapsibleSidebar.tsx`, alongside Tickets and Dispatch.
- Entry type icons: envelope (email), folder-network (SMB), users (group) — pulled from existing `lucide-react` set.
- Conversion report uses an alert/info panel pattern consistent with other admin reports in the app.

## 7. Technical Considerations

- **Drizzle migration**: generate via `npm run db:generate`, review SQL, apply with `npm run db:migrate`. Never `db:push` against production.
- **Master key**: `ADDRESS_BOOK_MASTER_KEY` is a 32-byte base64 value, set once per environment, rotated only with planned re-encryption (out of v1 scope).
- **Canon Crypto v2** algorithm: PBKDF2 (SHA-256, iteration count to confirm against Canon docs / sample) + AES-256-CBC; verify by decrypting the supplied `qXiioxBKG3fl7dAwodxTOw==` blob with password "1" and confirming it produces a sensible plaintext (likely the SMB password for the `\\IOSI-FILESERV\Data` share).
- **Vendor format references**: Canon abook.csv (sample provided in repo root: `abook.csv`); Konica Minolta CSV from PageScope; Xerox CSV from Embedded Web Server; Ricoh CSV from Address Book Import Helper. Add small fixture files under `tests/fixtures/address-book/` for parser unit tests.
- **File storage**: persist raw uploads under tenant-scoped path (use existing storage pattern in the project); never write to `client/public/` or root `public/`.
- **Encoding**: Konica Minolta exports often Shift-JIS; use `iconv-lite` for decoding (already in project deps if present, otherwise add).
- **Pre-existing TS errors**: this codebase has known unrelated TS errors; new code MUST be clean but full-repo `npm run check` need not be made green.
- **Multipart uploads**: use the existing pattern from other routes (likely `multer` or equivalent already configured).

## 8. Success Metrics

- Help desk staff complete a vendor migration of a 200-entry address book in under 10 minutes, end-to-end (vs. multiple hours manual today).
- Round-trip parse-serialize-parse equality holds for every supported vendor in unit tests.
- Zero source passwords appear in logs, database, or stored files (verified by code review + grep over logs).
- 100% of API endpoints filter by `tenantId`; verified by integration test that attempts cross-tenant access and asserts 404/403.
- Conversion report surfaces ≥ 95% of dropped fields (no silent data loss).

## 9. Open Questions

- **Canon Crypto v2 specifics**: PBKDF2 iteration count and salt source need to be confirmed against the supplied sample. If Canon's algorithm turns out to be undocumented and reverse-engineering it for the supplied sample fails within a time budget, the fallback is to skip credential decryption in v1 and require users to re-enter SMB passwords on the target side (degrades UX but preserves v1 ship date).
- **Konica Minolta encoding**: confirm whether modern bizhub i-series exports default to UTF-8 or Shift-JIS; parser should detect both.
- **Xerox multi-tab CSV**: Xerox EWS sometimes exports separate files for email/scan/fax. Decide whether the import wizard accepts multiple files in one operation or one per book.
- **Speed dial index allocation on cross-vendor export**: how should the engine handle index collisions when the source uses a wider range than the target? Default: allocate sequentially starting at the target's minimum, preserve original index in `source_metadata`.
- **Group entries across vendors**: each vendor models groups slightly differently. Confirm v1 behavior is "expand groups inline if target vendor doesn't support nested groups, report in conversion report."
- **Customer-master vs. device-scoped on first import**: when a user imports a file from a single device, do we default the new book to customer-master or device-scoped? Recommended default: device-scoped, with a "Promote to customer-master" action available later.
