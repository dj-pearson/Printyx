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
import { createCorsResponse } from '../_shared/cors.ts';
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
