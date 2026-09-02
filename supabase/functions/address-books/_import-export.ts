// Address-book import + export handlers (PA-055).
//
// ABK-014's title is "Edge function: address book import + export endpoints" and
// every one of its acceptance criteria named an endpoint here; what shipped was
// the Express router. getApiUrl sends /api/* to the functions host, so
// production never reached it, and PA-052 made these four paths answer 501
// saying so. This is that follow-up.
//
// WHERE THE BYTES LIVE (PA-055 AC4). Supabase Storage, at a tenant-scoped path.
// The Express side kept generated files in an in-process Map with a 15-minute
// TTL, which is not merely unportable to a stateless runtime - it is already
// wrong behind a second Node instance, because an export generated on one and
// downloaded from another 404s. Storage is also what ABK-014's own AC asked for
// ("tenant-scoped storage, never written to public dirs").
//
// The download STREAMS the bytes rather than handing back a signed URL: the
// caller (ExportModal) fetches with a Bearer token and reads a blob, so the
// bytes go through this function, which authenticates first. A signed URL would
// be an unauthenticated link to a customer's contact list.
import { createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { getVendorAdapter } from '../_shared/address-book/vendors.ts';
import { convertBook } from '../_shared/address-book/conversion-engine.ts';
import { encryptCredentialColumns, toPgBytea } from '../_shared/address-book/credential-columns.ts';
import type { AddressBookVendor, CanonicalEntry } from '../_shared/address-book/types.ts';

const VENDORS: AddressBookVendor[] = ['canon', 'konica', 'xerox', 'ricoh'];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // ABK-014's cap
const EXPORT_BUCKET = Deno.env.get('ADDRESS_BOOK_EXPORT_BUCKET') || 'address-book-exports';

type Admin = any;

function readVendor(value: unknown): AddressBookVendor | null {
  return VENDORS.includes(value as AddressBookVendor) ? (value as AddressBookVendor) : null;
}

/** Strip the decrypted password before anything is returned or stored as metadata. */
function sanitizeMetadata(
  md: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!md) return null;
  if (!('_password' in md)) return md;
  const clone = { ...md };
  delete clone._password;
  return clone;
}

interface UploadedFile {
  bytes: Uint8Array;
  filename: string;
  fields: Record<string, string>;
}

/**
 * Read the multipart body. Deno's Request.formData() handles the parsing, which
 * is why there is no multer equivalent here.
 */
async function readUpload(req: Request): Promise<UploadedFile | { error: Response }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      error: createCorsResponse(
        { message: 'Expected a multipart upload', code: 'NO_FILE' },
        400,
        req,
      ),
    };
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return { error: createCorsResponse({ message: 'File required', code: 'NO_FILE' }, 400, req) };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    // Checked before reading the body into memory.
    return {
      error: createCorsResponse(
        {
          message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`,
          code: 'TOO_LARGE',
        },
        413,
        req,
      ),
    };
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') fields[key] = value;
  }

  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name || 'upload.csv',
    fields,
  };
}

/** Parse-only response for the wizard's preview step. Persists nothing. */
async function previewResponse(
  req: Request,
  vendor: AddressBookVendor,
  bytes: Uint8Array,
  password?: string,
): Promise<Response> {
  const parse = await getVendorAdapter(vendor).parse(bytes, password);
  return createCorsResponse(
    {
      preview: true,
      entry_count: parse.entries.length,
      errors: parse.errors,
      parse: {
        ...parse,
        // The source password is decrypted in memory and never leaves it.
        entries: parse.entries.map((e) => ({
          ...e,
          source_metadata: sanitizeMetadata(e.source_metadata),
        })),
      },
    },
    200,
    req,
  );
}

/** Insert parsed entries, vaulting any SMB password. Returns the count written. */
async function commitParsedEntries(
  admin: Admin,
  bookId: string,
  tenantId: string,
  entries: CanonicalEntry[],
): Promise<number> {
  let count = 0;

  for (const entry of entries) {
    let credentialId: string | null = null;
    const md = entry.source_metadata as Record<string, unknown> | null | undefined;

    if (entry.entry_type === 'smb' && md && typeof md._password === 'string' && md._password) {
      const enc = await encryptCredentialColumns(md._password);
      const { data: cred, error: credError } = await admin
        .from('address_book_credentials')
        .insert({
          tenant_id: tenantId,
          encrypted_blob: toPgBytea(enc.encryptedBlob),
          iv: toPgBytea(enc.iv),
          auth_tag: toPgBytea(enc.authTag),
        })
        .select('id')
        .single();

      // A credential that cannot be stored must not become an entry that
      // silently has no password: the export would then write a blank one.
      if (credError) throw new Error(`Failed to vault a credential: ${credError.message}`);
      credentialId = cred.id;
    }

    const { error } = await admin.from('address_book_entries').insert({
      book_id: bookId,
      entry_type: entry.entry_type,
      display_name: entry.display_name,
      sort_name: entry.sort_name ?? null,
      short_name: entry.short_name ?? null,
      speed_dial_index: entry.speed_dial_index ?? null,
      email: entry.entry_type === 'email' ? entry.email : null,
      smb_full_unc: entry.entry_type === 'smb' ? entry.smb_full_unc : null,
      smb_host: entry.entry_type === 'smb' ? (entry.smb_host ?? null) : null,
      smb_share_path: entry.entry_type === 'smb' ? (entry.smb_share_path ?? null) : null,
      smb_username: entry.entry_type === 'smb' ? (entry.smb_username ?? null) : null,
      credential_id: credentialId,
      group_member_entry_ids: entry.entry_type === 'group' ? entry.member_entry_ids : null,
      source_uuid: entry.source_uuid ?? null,
      source_metadata: sanitizeMetadata(md),
    });

    if (error) throw new Error(`Failed to write an entry: ${error.message}`);
    count++;
  }

  return count;
}

// ─── POST /address-books/import ────────────────────────────────────────────
export async function handleImportNewBook(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  url: URL,
): Promise<Response> {
  const upload = await readUpload(req);
  if ('error' in upload) return upload.error;

  const vendor = readVendor(upload.fields.vendor);
  if (!vendor) {
    return createCorsResponse({ message: 'Unknown vendor', code: 'VALIDATION' }, 400, req);
  }

  const password = upload.fields.password || undefined;
  const isPreview = url.searchParams.get('preview') === 'true' || upload.fields.preview === 'true';
  if (isPreview) return await previewResponse(req, vendor, upload.bytes, password);

  if (!upload.fields.customer_id) {
    return createCorsResponse({ message: 'customer_id required', code: 'VALIDATION' }, 400, req);
  }

  try {
    const parse = await getVendorAdapter(vendor).parse(upload.bytes, password);

    const { data: book, error: bookError } = await admin
      .from('address_books')
      .insert({
        tenant_id: tenantId,
        customer_id: upload.fields.customer_id,
        device_id: upload.fields.device_id || null,
        name: upload.fields.name || `${vendor} import`,
        source_vendor: vendor,
        source_model: parse.source_model ?? null,
        source_subbook_name: parse.source_subbook_name ?? null,
        last_imported_at: new Date().toISOString(),
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (bookError) throw new Error(bookError.message);

    const entryCount = await commitParsedEntries(admin, book.id, tenantId, parse.entries);

    await admin.from('address_book_imports').insert({
      tenant_id: tenantId,
      book_id: book.id,
      vendor,
      raw_filename: upload.filename,
      password_was_required: parse.password_was_required,
      entry_count: entryCount,
      error_count: parse.errors.length,
      errors_json: parse.errors,
      imported_by_user_id: userId,
    });

    return createCorsResponse(
      {
        book_id: book.id,
        entry_count: entryCount,
        errors: parse.errors,
        parse: {
          ...parse,
          entries: parse.entries.map((e) => ({
            ...e,
            source_metadata: sanitizeMetadata(e.source_metadata),
          })),
        },
      },
      201,
      req,
    );
  } catch (err) {
    // The message may name a column but never a credential.
    console.error('Address book import failed:', err);
    return createCorsResponse({ message: 'Import failed', code: 'IMPORT_FAILED' }, 500, req);
  }
}

// ─── POST /address-books/:id/import ────────────────────────────────────────
export async function handleImportExistingBook(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  bookId: string,
  url: URL,
): Promise<Response> {
  const upload = await readUpload(req);
  if ('error' in upload) return upload.error;

  const vendor = readVendor(upload.fields.vendor);
  if (!vendor) {
    return createCorsResponse({ message: 'Unknown vendor', code: 'VALIDATION' }, 400, req);
  }

  const password = upload.fields.password || undefined;
  const isPreview = url.searchParams.get('preview') === 'true' || upload.fields.preview === 'true';
  if (isPreview) return await previewResponse(req, vendor, upload.bytes, password);

  const { data: book } = await admin
    .from('address_books')
    .select('id')
    .eq('id', bookId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!book) {
    return createCorsResponse({ message: 'Address book not found', code: 'NOT_FOUND' }, 404, req);
  }

  const mode = upload.fields.mode === 'merge' ? 'merge' : 'replace';

  try {
    const parse = await getVendorAdapter(vendor).parse(upload.bytes, password);

    // Replace drops the existing entries first. Doing it after the parse means a
    // file that fails to parse leaves the book intact.
    if (mode === 'replace') {
      const { error: deleteError } = await admin
        .from('address_book_entries')
        .delete()
        .eq('book_id', bookId);
      if (deleteError) throw new Error(deleteError.message);
    }

    const entryCount = await commitParsedEntries(admin, bookId, tenantId, parse.entries);

    await admin
      .from('address_books')
      .update({ last_imported_at: new Date().toISOString(), source_vendor: vendor })
      .eq('id', bookId)
      .eq('tenant_id', tenantId);

    await admin.from('address_book_imports').insert({
      tenant_id: tenantId,
      book_id: bookId,
      vendor,
      raw_filename: upload.filename,
      password_was_required: parse.password_was_required,
      entry_count: entryCount,
      error_count: parse.errors.length,
      errors_json: parse.errors,
      imported_by_user_id: userId,
    });

    return createCorsResponse(
      { book_id: bookId, mode, entry_count: entryCount, errors: parse.errors },
      200,
      req,
    );
  } catch (err) {
    console.error('Address book import failed:', err);
    return createCorsResponse({ message: 'Import failed', code: 'IMPORT_FAILED' }, 500, req);
  }
}

// ─── Export (PA-055) ───────────────────────────────────────────────────────

import { mergeOverrides } from '../_shared/address-book/conversion-engine.ts';
import {
  decryptCredentialColumns,
  fromPgBytea,
} from '../_shared/address-book/credential-columns.ts';
import type { CanonicalAddressBook } from '../_shared/address-book/types.ts';

/** Map a DB entry row to a CanonicalEntry (without exposing credential blobs). */
function rowToCanonical(row: Record<string, any>): CanonicalEntry {
  const base = {
    id: row.id,
    display_name: row.display_name,
    sort_name: row.sort_name,
    short_name: row.short_name,
    speed_dial_index: row.speed_dial_index,
    source_uuid: row.source_uuid,
    source_metadata: (row.source_metadata as Record<string, unknown> | null) ?? null,
    is_override: row.is_override,
    overrides_entry_id: row.overrides_entry_id,
  };

  if (row.entry_type === 'smb') {
    return {
      ...base,
      entry_type: 'smb',
      smb_full_unc: row.smb_full_unc ?? '',
      smb_host: row.smb_host,
      smb_share_path: row.smb_share_path,
      smb_username: row.smb_username,
      credential_id: row.credential_id,
    };
  }
  if (row.entry_type === 'group') {
    return {
      ...base,
      entry_type: 'group',
      member_entry_ids: (row.group_member_entry_ids as string[] | null) ?? [],
    };
  }
  return { ...base, entry_type: 'email', email: row.email ?? '' };
}

/**
 * Resolve plaintext SMB passwords from the vault so the serializer can
 * re-encrypt them for the target vendor.
 *
 * A credential that fails to decrypt is SKIPPED, not fatal: the entry exports
 * without a password and the serializer already warns about that. One unreadable
 * row must not cost the dealer the other two hundred.
 */
async function buildPasswordResolver(
  admin: Admin,
  rows: Record<string, any>[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const credIds = rows.map((r) => r.credential_id).filter((c: unknown): c is string => !!c);
  if (credIds.length === 0) return map;

  const { data: creds, error } = await admin
    .from('address_book_credentials')
    .select('id, encrypted_blob, iv, auth_tag')
    .in('id', credIds);

  if (error) {
    console.error('Failed to load address book credentials:', error.message);
    return map;
  }

  const byId = new Map((creds || []).map((c: any) => [c.id, c]));

  for (const row of rows) {
    if (!row.credential_id) continue;
    const cred = byId.get(row.credential_id);
    if (!cred) continue;
    try {
      map.set(
        row.id,
        await decryptCredentialColumns({
          encryptedBlob: fromPgBytea(cred.encrypted_blob),
          iv: fromPgBytea(cred.iv),
          authTag: fromPgBytea(cred.auth_tag),
        }),
      );
    } catch {
      // Never log the row id alongside a credential failure in a way that
      // fingerprints which entries hold secrets.
    }
  }

  return map;
}

// ─── POST /address-books/:id/export ────────────────────────────────────────
export async function handleExport(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  bookId: string,
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const targetVendor = readVendor(body.target_vendor);

  if (!targetVendor) {
    return createCorsResponse(
      { message: 'Invalid export', code: 'VALIDATION', details: 'target_vendor is required' },
      400,
      req,
    );
  }

  const { data: book, error: bookError } = await admin
    .from('address_books')
    .select('*')
    .eq('id', bookId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (bookError) {
    console.error('Failed to load address book for export:', bookError.message);
    return createCorsResponse({ message: 'Export failed', code: 'EXPORT_FAILED' }, 500, req);
  }
  if (!book) return createCorsResponse({ message: 'Not found', code: 'NOT_FOUND' }, 404, req);

  try {
    const { data: ownRows, error: entryError } = await admin
      .from('address_book_entries')
      .select('*')
      .eq('book_id', book.id);

    if (entryError) throw new Error(entryError.message);

    let effective: CanonicalEntry[];
    let passwordRows: Record<string, any>[] = ownRows || [];

    // A device-scoped book inherits the customer master and layers its own
    // overrides on top. Exporting the device rows alone would drop every
    // inherited contact from the file.
    if (book.device_id) {
      const { data: master } = await admin
        .from('address_books')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('customer_id', book.customer_id)
        .is('device_id', null)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (master) {
        const { data: masterRows } = await admin
          .from('address_book_entries')
          .select('*')
          .eq('book_id', master.id);

        effective = mergeOverrides(
          (masterRows || []).map(rowToCanonical),
          (ownRows || []).map(rowToCanonical),
        );
        passwordRows = [...(masterRows || []), ...(ownRows || [])];
      } else {
        effective = (ownRows || []).map(rowToCanonical);
      }
    } else {
      effective = (ownRows || []).map(rowToCanonical);
    }

    const passwordMap = await buildPasswordResolver(admin, passwordRows);

    const canonicalBook: CanonicalAddressBook = {
      id: book.id,
      tenant_id: tenantId,
      customer_id: book.customer_id,
      device_id: book.device_id,
      name: book.name,
      source_vendor: book.source_vendor ?? null,
      source_subbook_name: book.source_subbook_name,
    };

    const { file, report } = await convertBook(canonicalBook, effective, targetVendor, {
      password: body.target_password,
      resolvePassword: (e) => (e.id ? passwordMap.get(e.id) : undefined),
    });

    const filename = body.filename || file.filename;

    const { data: exportRow, error: exportError } = await admin
      .from('address_book_exports')
      .insert({
        tenant_id: tenantId,
        book_id: book.id,
        target_vendor: targetVendor,
        target_filename: filename,
        conversion_report_json: report,
        exported_by_user_id: userId,
      })
      .select('id')
      .single();

    if (exportError) throw new Error(exportError.message);

    // PA-055 AC4: the bytes go to tenant-scoped Storage, not to an in-process
    // Map. The Express version's cache could not survive a restart or a second
    // instance, so an export generated on one and downloaded from another 404'd.
    const path = `${tenantId}/${exportRow.id}`;
    const { error: uploadError } = await admin.storage
      .from(EXPORT_BUCKET)
      .upload(path, file.content, { contentType: 'text/csv; charset=utf-8', upsert: true });

    if (uploadError) {
      // The row exists but the file does not. Saying so beats handing back a
      // download_url that 404s a second later.
      console.error('Failed to store the export file:', uploadError.message);
      return createCorsResponse(
        { message: 'The file was generated but could not be stored', code: 'EXPORT_STORE_FAILED' },
        500,
        req,
      );
    }

    return createCorsResponse(
      {
        export_id: exportRow.id,
        download_url: `/api/address-books/exports/${exportRow.id}/download`,
        conversion_report: report,
      },
      200,
      req,
    );
  } catch (err) {
    console.error('Address book export failed:', err);
    return createCorsResponse({ message: 'Export failed', code: 'EXPORT_FAILED' }, 500, req);
  }
}

// ─── GET /address-books/exports/:id/download ───────────────────────────────
//
// STREAMS the bytes rather than redirecting to a signed URL. ExportModal fetches
// this with a Bearer token and reads a blob, and a signed URL would be an
// unauthenticated link to a customer's whole contact list.
export async function handleExportDownload(
  req: Request,
  admin: Admin,
  tenantId: string,
  exportId: string,
): Promise<Response> {
  const { data: row, error } = await admin
    .from('address_book_exports')
    .select('id, target_filename')
    .eq('id', exportId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load export row:', error.message);
    return createCorsResponse({ message: 'Download failed', code: 'DOWNLOAD_FAILED' }, 500, req);
  }
  if (!row) {
    return createCorsResponse({ message: 'Export not found', code: 'NOT_FOUND' }, 404, req);
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from(EXPORT_BUCKET)
    .download(`${tenantId}/${exportId}`);

  if (downloadError || !blob) {
    // The row outlives the file if the bucket is pruned. That is a 404 about the
    // FILE, which is different from an export that never existed.
    return createCorsResponse(
      { message: 'The export file is no longer available; re-run the export', code: 'GONE' },
      410,
      req,
    );
  }

  const filename = String(row.target_filename || 'address-book.csv').replace(/["\r\n]/g, '');

  return new Response(await blob.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...getCorsHeaders(req.headers.get('origin')),
    },
  });
}
