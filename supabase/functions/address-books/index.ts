// Address Books Edge Function (ABK-013)
//
// Implements REST CRUD for address books and entries. Source PRD:
// tasks/prd-address-book-manager.md (US-013).
//
// Routes (all tenant-scoped via user.app_metadata.tenantId):
//   GET    /address-books                      list books (?customer_id, ?device_id)
//   POST   /address-books                      create empty book
//   GET    /address-books/:id                  fetch book + its entries
//   PATCH  /address-books/:id                  rename / change scope
//   DELETE /address-books/:id                  soft delete (sets deleted_at)
//   GET    /address-books/:id/entries          paginated entries (?page, ?pageSize)
//   POST   /address-books/:id/entries          create entry
//   PATCH  /address-books/:bookId/entries/:id  edit entry
//   DELETE /address-books/:bookId/entries/:id  delete entry
//
// Cross-tenant access returns 404 — every query .eq('tenant_id', tenantId).

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { handleImportExistingBook, handleImportNewBook } from './_import-export.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const VENDORS = ['canon', 'konica', 'xerox', 'ricoh'] as const;
const ENTRY_TYPES = ['email', 'smb', 'group'] as const;

const bookCreateSchema = z.object({
  customer_id: z.string().uuid(),
  device_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  source_vendor: z.enum(VENDORS).nullable().optional(),
  source_model: z.string().max(100).nullable().optional(),
  source_subbook_name: z.string().max(200).nullable().optional(),
});

const bookPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  customer_id: z.string().uuid().optional(),
  device_id: z.string().uuid().nullable().optional(),
  source_subbook_name: z.string().max(200).nullable().optional(),
});

const entryCreateSchema = z
  .object({
    entry_type: z.enum(ENTRY_TYPES),
    display_name: z.string().min(1).max(200),
    sort_name: z.string().max(200).nullable().optional(),
    short_name: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    smb_host: z.string().max(255).nullable().optional(),
    smb_share_path: z.string().max(500).nullable().optional(),
    smb_full_unc: z.string().max(500).nullable().optional(),
    smb_username: z.string().max(255).nullable().optional(),
    credential_id: z.string().uuid().nullable().optional(),
    speed_dial_index: z.number().int().nullable().optional(),
    group_member_entry_ids: z.array(z.string().uuid()).nullable().optional(),
    source_uuid: z.string().max(100).nullable().optional(),
    source_metadata: z.record(z.unknown()).nullable().optional(),
    is_override: z.boolean().optional(),
    overrides_entry_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (e) => {
      if (e.entry_type === 'email') return !!e.email;
      if (e.entry_type === 'smb') return !!e.smb_full_unc;
      if (e.entry_type === 'group') return Array.isArray(e.group_member_entry_ids);
      return false;
    },
    {
      message:
        'entry_type-specific required field missing (email | smb_full_unc | group_member_entry_ids)',
    },
  );

const entryPatchSchema = entryCreateSchema._def.schema.partial();

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'address-books');

    const bookId = parts[0];
    const sub = parts[1];
    const entryId = parts[2];

    // /address-books
    if (!bookId) {
      if (req.method === 'GET') return await listBooks(admin, tenantId, url, req);
      if (req.method === 'POST') return await createBook(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // Import / export / download — served by Express only.
    //
    // PA-052: all five of these paths are called by the address-book UI and none
    // of them had a branch here, so in production they fell to the generic 404 at
    // the bottom - or, for the download, into getBook() looking up an address
    // book whose id is the literal string "exports", which answers
    // "Address book not found". Both are misleading: the book exists, the host
    // does not serve the feature.
    //
    // ABK-014 is recorded as passing and its own closure note says the edge
    // parity "remains a follow-up"; PA-055 is that follow-up. Three things have
    // to move before these can be real branches: ~1,350 lines of vendor
    // parsers/serializers under server/services/address-book/vendors, multipart
    // upload handling, and the generated export bytes, which today live in an
    // in-process Map with a 15-minute TTL - a design that cannot exist in a
    // stateless runtime and is already wrong behind more than one Node process.
    //
    // Until then, say so. A 501 naming the reason is worth more to whoever is
    // reading a production log than a 404 that reads like a missing record.
    const UNSERVED_HERE =
      'Address book import and export run in the Node service; this host does not serve them. ' +
      'No file was read and nothing was written.';

    // POST /address-books/import - create a new book from an uploaded file
    if (req.method === 'POST' && bookId === 'import') {
      return await handleImportNewBook(req, admin, tenantId, user.id, url);
    }

    // POST /address-books/:id/import - import into an existing book
    if (req.method === 'POST' && bookId && sub === 'import') {
      return await handleImportExistingBook(req, admin, tenantId, user.id, bookId, url);
    }

    // Export is still Express-only: its device-override merge (a device book
    // layered over the customer master) has real semantics that have not been
    // ported yet. PA-055 carries it.
    if (bookId === 'import' || sub === 'import' || sub === 'export') {
      return createCorsResponse(
        { error: 'Not implemented on this host', message: UNSERVED_HERE, code: 'NOT_IMPLEMENTED' },
        501,
        req,
      );
    }

    if (bookId === 'exports' && entryId === 'download') {
      return createCorsResponse(
        {
          error: 'Not implemented on this host',
          message:
            'Generated export files are held in the Node service and cannot be downloaded from ' +
            'this host. Re-run the export where it was generated.',
          code: 'NOT_IMPLEMENTED',
        },
        501,
        req,
      );
    }

    // /address-books/:id/entries[/:entryId]
    if (sub === 'entries') {
      // Verify the book belongs to this tenant before any entry operation.
      const ownsBook = await bookBelongsToTenant(admin, tenantId, bookId);
      if (!ownsBook) return createCorsResponse({ error: 'Address book not found' }, 404, req);

      if (!entryId) {
        if (req.method === 'GET') return await listEntries(admin, bookId, url, req);
        if (req.method === 'POST') return await createEntry(admin, bookId, req);
        return createCorsResponse({ error: 'Method not allowed' }, 405, req);
      }

      if (req.method === 'PATCH') return await updateEntry(admin, bookId, entryId, req);
      if (req.method === 'DELETE') return await deleteEntry(admin, bookId, entryId, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // /address-books/:id
    if (req.method === 'GET') return await getBook(admin, tenantId, bookId, req);
    if (req.method === 'PATCH') return await updateBook(admin, tenantId, bookId, req);
    if (req.method === 'DELETE') return await deleteBook(admin, tenantId, bookId, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in address-books function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function bookBelongsToTenant(
  admin: Admin,
  tenantId: string,
  bookId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('address_books')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', bookId)
    .is('deleted_at', null)
    .maybeSingle();
  return !!data;
}

function zodErrorBody(err: z.ZodError) {
  return {
    error: 'Validation failed',
    details: err.flatten(),
  };
}

// ─── book handlers ──────────────────────────────────────────────────────────

async function listBooks(
  admin: Admin,
  tenantId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  let q = admin
    .from('address_books')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const customerId = url.searchParams.get('customer_id');
  if (customerId) q = q.eq('customer_id', customerId);

  const deviceId = url.searchParams.get('device_id');
  if (deviceId === 'null') q = q.is('device_id', null);
  else if (deviceId) q = q.eq('device_id', deviceId);

  const { data, error } = await q;
  if (error) {
    console.error('Error listing address books:', error);
    return createCorsResponse({ error: 'Failed to list address books' }, 500, req);
  }
  return createCorsResponse(data ?? [], 200, req);
}

async function getBook(
  admin: Admin,
  tenantId: string,
  bookId: string,
  req: Request,
): Promise<Response> {
  const { data: book, error } = await admin
    .from('address_books')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', bookId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !book) {
    return createCorsResponse({ error: 'Address book not found' }, 404, req);
  }

  const { data: entries, error: entriesError } = await admin
    .from('address_book_entries')
    .select('*')
    .eq('book_id', bookId)
    .order('display_name', { ascending: true });

  if (entriesError) {
    console.error('Error fetching address book entries:', entriesError);
    return createCorsResponse({ error: 'Failed to fetch entries' }, 500, req);
  }
  return createCorsResponse({ ...book, entries: entries ?? [] }, 200, req);
}

async function createBook(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const raw = await req.json();
  const parsed = bookCreateSchema.safeParse(raw);
  if (!parsed.success) return createCorsResponse(zodErrorBody(parsed.error), 400, req);

  const { data, error } = await admin
    .from('address_books')
    .insert({
      tenant_id: tenantId,
      customer_id: parsed.data.customer_id,
      device_id: parsed.data.device_id ?? null,
      name: parsed.data.name,
      source_vendor: parsed.data.source_vendor ?? null,
      source_model: parsed.data.source_model ?? null,
      source_subbook_name: parsed.data.source_subbook_name ?? null,
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating address book:', error);
    return createCorsResponse({ error: 'Failed to create address book' }, 500, req);
  }
  return createCorsResponse(data, 201, req);
}

async function updateBook(
  admin: Admin,
  tenantId: string,
  bookId: string,
  req: Request,
): Promise<Response> {
  const raw = await req.json();
  const parsed = bookPatchSchema.safeParse(raw);
  if (!parsed.success) return createCorsResponse(zodErrorBody(parsed.error), 400, req);

  const { data, error } = await admin
    .from('address_books')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', bookId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error) {
    return createCorsResponse({ error: 'Failed to update address book' }, 500, req);
  }
  if (!data) return createCorsResponse({ error: 'Address book not found' }, 404, req);
  return createCorsResponse(data, 200, req);
}

async function deleteBook(
  admin: Admin,
  tenantId: string,
  bookId: string,
  req: Request,
): Promise<Response> {
  const { data, error } = await admin
    .from('address_books')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', bookId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return createCorsResponse({ error: 'Failed to delete address book' }, 500, req);
  }
  if (!data) return createCorsResponse({ error: 'Address book not found' }, 404, req);
  return createCorsResponse({ success: true, id: data.id }, 200, req);
}

// ─── entry handlers ─────────────────────────────────────────────────────────

async function listEntries(
  admin: Admin,
  bookId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get('pageSize') || '100')));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await admin
    .from('address_book_entries')
    .select('*', { count: 'exact' })
    .eq('book_id', bookId)
    .order('display_name', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Error listing entries:', error);
    return createCorsResponse({ error: 'Failed to list entries' }, 500, req);
  }
  return createCorsResponse({ entries: data ?? [], page, pageSize, total: count ?? 0 }, 200, req);
}

async function createEntry(admin: Admin, bookId: string, req: Request): Promise<Response> {
  const raw = await req.json();
  const parsed = entryCreateSchema.safeParse(raw);
  if (!parsed.success) return createCorsResponse(zodErrorBody(parsed.error), 400, req);

  const { data, error } = await admin
    .from('address_book_entries')
    .insert({ book_id: bookId, ...parsed.data })
    .select()
    .single();

  if (error) {
    console.error('Error creating entry:', error);
    return createCorsResponse({ error: 'Failed to create entry' }, 500, req);
  }
  return createCorsResponse(data, 201, req);
}

async function updateEntry(
  admin: Admin,
  bookId: string,
  entryId: string,
  req: Request,
): Promise<Response> {
  const raw = await req.json();
  const parsed = entryPatchSchema.safeParse(raw);
  if (!parsed.success) return createCorsResponse(zodErrorBody(parsed.error), 400, req);

  const { data, error } = await admin
    .from('address_book_entries')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('book_id', bookId)
    .eq('id', entryId)
    .select()
    .maybeSingle();

  if (error) return createCorsResponse({ error: 'Failed to update entry' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Entry not found' }, 404, req);
  return createCorsResponse(data, 200, req);
}

async function deleteEntry(
  admin: Admin,
  bookId: string,
  entryId: string,
  req: Request,
): Promise<Response> {
  const { data, error } = await admin
    .from('address_book_entries')
    .delete()
    .eq('book_id', bookId)
    .eq('id', entryId)
    .select('id')
    .maybeSingle();

  if (error) return createCorsResponse({ error: 'Failed to delete entry' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Entry not found' }, 404, req);
  return createCorsResponse({ success: true, id: data.id }, 200, req);
}
