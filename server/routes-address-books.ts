/**
 * Address Book Manager API routes (ABK-013 CRUD + ABK-014 import/export).
 * Source PRD: tasks/prd-address-book-manager.md (US-013, US-014).
 *
 * Dev/runtime parity note: the canonical CRUD also exists as a Supabase edge
 * function (supabase/functions/address-books/index.ts, ABK-013), but the dev
 * proxy map does not forward /api/address-books, so these Express routes are
 * the working dev path AND add the import/export endpoints (US-014) using the
 * unit-tested vendor adapters in server/services/address-book/vendors. The
 * edge function should be brought to parity for production import/export in a
 * follow-up (constrained multipart handling — see CLAUDE.md).
 *
 * Every query is filtered by tenantId from getTenantId(req). Source passwords
 * supplied on import are used once to decrypt, re-encrypted at rest via the
 * credential vault, and never persisted in plaintext or logged.
 */
import { Router, type Response, type RequestHandler } from 'express';
import multer from 'multer';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { enhanceUserContext, requirePermission } from './middleware/rbac-route-helper';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  addressBooks,
  addressBookEntries,
  addressBookCredentials,
  addressBookImports,
  addressBookExports,
} from '../shared/address-book-schema';
import type {
  AddressBookVendor,
  CanonicalEntry,
  CanonicalAddressBook,
} from '../shared/address-book-types';
import { encryptCredential, decryptCredential } from './services/address-book/credential-vault';
import { getVendorAdapter } from './services/address-book/vendors';
import { convertBook, mergeOverrides } from './services/address-book/conversion-engine';

const log = createModuleLogger('routes-address-books');
const router = Router();

// requirePermission returns a handler typed against AuthenticatedRequest, which
// does not unify with the Router method overloads; cast to RequestHandler.
const can = (perms: string[]): RequestHandler =>
  requirePermission(perms) as unknown as RequestHandler;
// The module logger's error() takes (Error|object|string, msg?) — normalise.
const logErr = (msg: string, err: unknown): void => {
  log.error(err instanceof Error ? err : new Error(String(err)), msg);
};

const VENDORS = ['canon', 'konica', 'xerox', 'ricoh'] as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(requireAuth as any);
router.use(enhanceUserContext as any);

// ─── Validation ──────────────────────────────────────────────────────────────
const entryBaseSchema = z.object({
  display_name: z.string().min(1).max(200),
  sort_name: z.string().max(200).nullish(),
  short_name: z.string().max(50).nullish(),
  speed_dial_index: z.number().int().nullish(),
});
const emailEntrySchema = entryBaseSchema.extend({
  entry_type: z.literal('email'),
  email: z.string().email(),
});
const smbEntrySchema = entryBaseSchema.extend({
  entry_type: z.literal('smb'),
  smb_full_unc: z.string().min(1).max(500),
  smb_host: z.string().max(255).nullish(),
  smb_share_path: z.string().max(500).nullish(),
  smb_username: z.string().max(255).nullish(),
  password: z.string().optional(),
  is_override: z.boolean().optional(),
  overrides_entry_id: z.string().uuid().nullish(),
});
const groupEntrySchema = entryBaseSchema.extend({
  entry_type: z.literal('group'),
  member_entry_ids: z.array(z.string()).default([]),
});
const entrySchema = z.discriminatedUnion('entry_type', [
  emailEntrySchema,
  smbEntrySchema,
  groupEntrySchema,
]);

const bookCreateSchema = z.object({
  customer_id: z.string().uuid(),
  device_id: z.string().uuid().nullish(),
  name: z.string().min(1).max(200),
  source_vendor: z.enum(VENDORS).nullish(),
  source_model: z.string().max(100).nullish(),
  source_subbook_name: z.string().max(200).nullish(),
});
const bookPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  device_id: z.string().uuid().nullish(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function tid(req: any, res: Response): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(401).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    return null;
  }
  return tenantId;
}

/** Map a DB entry row to a CanonicalEntry (without exposing credential blobs). */
function rowToCanonical(row: typeof addressBookEntries.$inferSelect): CanonicalEntry {
  const base = {
    id: row.id,
    display_name: row.displayName,
    sort_name: row.sortName,
    short_name: row.shortName,
    speed_dial_index: row.speedDialIndex,
    source_uuid: row.sourceUuid,
    source_metadata: (row.sourceMetadata as Record<string, unknown> | null) ?? null,
    is_override: row.isOverride,
    overrides_entry_id: row.overridesEntryId,
  };
  if (row.entryType === 'smb') {
    return {
      ...base,
      entry_type: 'smb',
      smb_full_unc: row.smbFullUnc ?? '',
      smb_host: row.smbHost,
      smb_share_path: row.smbSharePath,
      smb_username: row.smbUsername,
      credential_id: row.credentialId,
    };
  }
  if (row.entryType === 'group') {
    return {
      ...base,
      entry_type: 'group',
      member_entry_ids: (row.groupMemberEntryIds as string[] | null) ?? [],
    };
  }
  return { ...base, entry_type: 'email', email: row.email ?? '' };
}

/** Strip the transient _password from source_metadata before persistence. */
function sanitizeMetadata(
  md: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!md) return null;
  if (!('_password' in md)) return md;
  const clone = { ...md };
  delete clone._password;
  return clone;
}

/**
 * Persist a credential plaintext into the vault and return its row id.
 * Plaintext is never logged.
 */
async function storeCredential(tenantId: string, plaintext: string): Promise<string> {
  const enc = encryptCredential(plaintext);
  const [row] = await db
    .insert(addressBookCredentials)
    .values({
      tenantId,
      encryptedBlob: enc.encryptedBlob,
      iv: enc.iv,
      authTag: enc.authTag,
    })
    .returning({ id: addressBookCredentials.id });
  return row.id;
}

async function loadBook(tenantId: string, id: string) {
  const [book] = await db
    .select()
    .from(addressBooks)
    .where(
      and(
        eq(addressBooks.id, id),
        eq(addressBooks.tenantId, tenantId),
        isNull(addressBooks.deletedAt),
      ),
    )
    .limit(1);
  return book ?? null;
}

async function entryCount(bookId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressBookEntries)
    .where(eq(addressBookEntries.bookId, bookId));
  return Number(count) || 0;
}

// ─── Book CRUD (US-013) ──────────────────────────────────────────────────────
router.get('/', can(['service.address_book.view_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  try {
    const filters = [eq(addressBooks.tenantId, tenantId), isNull(addressBooks.deletedAt)];
    if (typeof req.query.customer_id === 'string')
      filters.push(eq(addressBooks.customerId, req.query.customer_id));
    if (typeof req.query.device_id === 'string')
      filters.push(eq(addressBooks.deviceId, req.query.device_id));
    if (typeof req.query.vendor === 'string')
      filters.push(eq(addressBooks.sourceVendor, req.query.vendor));

    const books = await db
      .select()
      .from(addressBooks)
      .where(and(...filters));

    const data = await Promise.all(
      books.map(async (b) => ({
        id: b.id,
        name: b.name,
        customer_id: b.customerId,
        device_id: b.deviceId,
        source_vendor: b.sourceVendor,
        source_model: b.sourceModel,
        last_imported_at: b.lastImportedAt,
        entry_count: await entryCount(b.id),
      })),
    );
    res.json({ data });
  } catch (err) {
    logErr('list books failed', err);
    res.status(500).json({ message: 'Failed to list address books', code: 'LIST_FAILED' });
  }
});

router.post('/', can(['service.address_book.edit_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  const parsed = bookCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid book', code: 'VALIDATION', details: parsed.error.flatten() });
  }
  try {
    const [book] = await db
      .insert(addressBooks)
      .values({
        tenantId,
        customerId: parsed.data.customer_id,
        deviceId: parsed.data.device_id ?? null,
        name: parsed.data.name,
        sourceVendor: parsed.data.source_vendor ?? null,
        sourceModel: parsed.data.source_model ?? null,
        sourceSubbookName: parsed.data.source_subbook_name ?? null,
        createdByUserId: getUserId(req) ?? null,
      })
      .returning();
    res.status(201).json(book);
  } catch (err) {
    logErr('create book failed', err);
    res.status(500).json({ message: 'Failed to create address book', code: 'CREATE_FAILED' });
  }
});

router.get('/:id', can(['service.address_book.view_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    const rows = await db
      .select()
      .from(addressBookEntries)
      .where(eq(addressBookEntries.bookId, book.id));
    res.json({
      book: {
        id: book.id,
        name: book.name,
        customer_id: book.customerId,
        device_id: book.deviceId,
        source_vendor: book.sourceVendor,
        source_model: book.sourceModel,
        source_subbook_name: book.sourceSubbookName,
        last_imported_at: book.lastImportedAt,
        entry_count: rows.length,
      },
      entries: rows.map(rowToCanonical),
    });
  } catch (err) {
    logErr('get book failed', err);
    res.status(500).json({ message: 'Failed to load address book', code: 'GET_FAILED' });
  }
});

router.patch('/:id', can(['service.address_book.edit_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  const parsed = bookPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid update', code: 'VALIDATION', details: parsed.error.flatten() });
  }
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    const [updated] = await db
      .update(addressBooks)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.device_id !== undefined ? { deviceId: parsed.data.device_id } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(addressBooks.id, book.id), eq(addressBooks.tenantId, tenantId)))
      .returning();
    res.json(updated);
  } catch (err) {
    logErr('patch book failed', err);
    res.status(500).json({ message: 'Failed to update address book', code: 'PATCH_FAILED' });
  }
});

router.delete('/:id', can(['service.address_book.delete']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    await db
      .update(addressBooks)
      .set({ deletedAt: new Date() })
      .where(and(eq(addressBooks.id, book.id), eq(addressBooks.tenantId, tenantId)));
    res.status(204).end();
  } catch (err) {
    logErr('delete book failed', err);
    res.status(500).json({ message: 'Failed to delete address book', code: 'DELETE_FAILED' });
  }
});

// ─── Entry CRUD (US-013) ─────────────────────────────────────────────────────
router.get('/:id/entries', can(['service.address_book.view_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      500,
      Math.max(1, Number.parseInt(String(req.query.pageSize ?? '100'), 10) || 100),
    );
    const rows = await db
      .select()
      .from(addressBookEntries)
      .where(eq(addressBookEntries.bookId, book.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    res.json({ data: rows.map(rowToCanonical), total: await entryCount(book.id) });
  } catch (err) {
    logErr('list entries failed', err);
    res.status(500).json({ message: 'Failed to list entries', code: 'LIST_ENTRIES_FAILED' });
  }
});

async function insertEntry(
  bookId: string,
  tenantId: string,
  entry: z.infer<typeof entrySchema>,
): Promise<typeof addressBookEntries.$inferSelect> {
  let credentialId: string | null = null;
  if (entry.entry_type === 'smb' && entry.password) {
    credentialId = await storeCredential(tenantId, entry.password);
  }
  const [row] = await db
    .insert(addressBookEntries)
    .values({
      bookId,
      entryType: entry.entry_type,
      displayName: entry.display_name,
      sortName: entry.sort_name ?? null,
      shortName: entry.short_name ?? null,
      speedDialIndex: entry.speed_dial_index ?? null,
      email: entry.entry_type === 'email' ? entry.email : null,
      smbFullUnc: entry.entry_type === 'smb' ? entry.smb_full_unc : null,
      smbHost: entry.entry_type === 'smb' ? (entry.smb_host ?? null) : null,
      smbSharePath: entry.entry_type === 'smb' ? (entry.smb_share_path ?? null) : null,
      smbUsername: entry.entry_type === 'smb' ? (entry.smb_username ?? null) : null,
      credentialId,
      groupMemberEntryIds: entry.entry_type === 'group' ? entry.member_entry_ids : null,
      isOverride: entry.entry_type === 'smb' ? (entry.is_override ?? false) : false,
      overridesEntryId: entry.entry_type === 'smb' ? (entry.overrides_entry_id ?? null) : null,
    })
    .returning();
  return row;
}

router.post('/:id/entries', can(['service.address_book.edit_team']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid entry', code: 'VALIDATION', details: parsed.error.flatten() });
  }
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    const row = await insertEntry(book.id, tenantId, parsed.data);
    res.status(201).json(rowToCanonical(row));
  } catch (err) {
    logErr('create entry failed', err);
    res.status(500).json({ message: 'Failed to create entry', code: 'CREATE_ENTRY_FAILED' });
  }
});

router.patch(
  '/:bookId/entries/:id',
  can(['service.address_book.edit_team']),
  async (req: any, res) => {
    const tenantId = tid(req, res);
    if (!tenantId) return;
    // PATCH expects a full entry payload (the edit form always submits the
    // complete entry); validate against the discriminated union as-is.
    const parsed = entrySchema.safeParse({
      ...req.body,
      entry_type: req.body.entry_type ?? 'email',
    });
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid entry', code: 'VALIDATION', details: parsed.error.flatten() });
    }
    try {
      const book = await loadBook(tenantId, req.params.bookId);
      if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
      const data = parsed.data as z.infer<typeof entrySchema>;
      let credentialId: string | undefined;
      if (data.entry_type === 'smb' && data.password) {
        credentialId = await storeCredential(tenantId, data.password);
      }
      const [updated] = await db
        .update(addressBookEntries)
        .set({
          displayName: data.display_name,
          sortName: data.sort_name ?? null,
          shortName: data.short_name ?? null,
          speedDialIndex: data.speed_dial_index ?? null,
          email: data.entry_type === 'email' ? data.email : undefined,
          smbFullUnc: data.entry_type === 'smb' ? data.smb_full_unc : undefined,
          smbHost: data.entry_type === 'smb' ? (data.smb_host ?? null) : undefined,
          smbSharePath: data.entry_type === 'smb' ? (data.smb_share_path ?? null) : undefined,
          smbUsername: data.entry_type === 'smb' ? (data.smb_username ?? null) : undefined,
          groupMemberEntryIds: data.entry_type === 'group' ? data.member_entry_ids : undefined,
          ...(credentialId ? { credentialId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(addressBookEntries.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: 'Entry not found', code: 'NOT_FOUND' });
      res.json(rowToCanonical(updated));
    } catch (err) {
      logErr('patch entry failed', err);
      res.status(500).json({ message: 'Failed to update entry', code: 'PATCH_ENTRY_FAILED' });
    }
  },
);

router.delete(
  '/:bookId/entries/:id',
  can(['service.address_book.edit_team']),
  async (req: any, res) => {
    const tenantId = tid(req, res);
    if (!tenantId) return;
    try {
      const book = await loadBook(tenantId, req.params.bookId);
      if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
      await db.delete(addressBookEntries).where(eq(addressBookEntries.id, req.params.id));
      res.status(204).end();
    } catch (err) {
      logErr('delete entry failed', err);
      res.status(500).json({ message: 'Failed to delete entry', code: 'DELETE_ENTRY_FAILED' });
    }
  },
);

// ─── Import (US-014) ─────────────────────────────────────────────────────────
const importFields = upload.single('file');

async function commitParsedEntries(
  bookId: string,
  tenantId: string,
  entries: CanonicalEntry[],
): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    let credentialId: string | null = null;
    const md = entry.source_metadata as Record<string, unknown> | null | undefined;
    if (entry.entry_type === 'smb' && md && typeof md._password === 'string' && md._password) {
      credentialId = await storeCredential(tenantId, md._password);
    }
    await db.insert(addressBookEntries).values({
      bookId,
      entryType: entry.entry_type,
      displayName: entry.display_name,
      sortName: entry.sort_name ?? null,
      shortName: entry.short_name ?? null,
      speedDialIndex: entry.speed_dial_index ?? null,
      email: entry.entry_type === 'email' ? entry.email : null,
      smbFullUnc: entry.entry_type === 'smb' ? entry.smb_full_unc : null,
      smbHost: entry.entry_type === 'smb' ? (entry.smb_host ?? null) : null,
      smbSharePath: entry.entry_type === 'smb' ? (entry.smb_share_path ?? null) : null,
      smbUsername: entry.entry_type === 'smb' ? (entry.smb_username ?? null) : null,
      credentialId,
      groupMemberEntryIds: entry.entry_type === 'group' ? entry.member_entry_ids : null,
      sourceUuid: entry.source_uuid ?? null,
      sourceMetadata: sanitizeMetadata(md),
    });
    count++;
  }
  return count;
}

function readVendor(value: unknown): AddressBookVendor | null {
  return VENDORS.includes(value as AddressBookVendor) ? (value as AddressBookVendor) : null;
}

// POST /import — create a new book from an uploaded file.
router.post(
  '/import',
  can(['service.address_book.import']),
  importFields,
  async (req: any, res) => {
    const tenantId = tid(req, res);
    if (!tenantId) return;
    const vendor = readVendor(req.body.vendor);
    if (!vendor) return res.status(400).json({ message: 'Unknown vendor', code: 'VALIDATION' });
    if (!req.file) return res.status(400).json({ message: 'File required', code: 'NO_FILE' });
    if (!req.body.customer_id)
      return res.status(400).json({ message: 'customer_id required', code: 'VALIDATION' });

    try {
      const adapter = getVendorAdapter(vendor);
      const parse = adapter.parse(req.file.buffer, req.body.password || undefined);
      const [book] = await db
        .insert(addressBooks)
        .values({
          tenantId,
          customerId: req.body.customer_id,
          deviceId: req.body.device_id || null,
          name: req.body.name || `${vendor} import`,
          sourceVendor: vendor,
          sourceModel: parse.source_model ?? null,
          sourceSubbookName: parse.source_subbook_name ?? null,
          lastImportedAt: new Date(),
          createdByUserId: getUserId(req) ?? null,
        })
        .returning();
      const entryCnt = await commitParsedEntries(book.id, tenantId, parse.entries);
      await db.insert(addressBookImports).values({
        tenantId,
        bookId: book.id,
        vendor,
        rawFilename: req.file.originalname ?? 'upload.csv',
        passwordWasRequired: parse.password_was_required,
        entryCount: entryCnt,
        errorCount: parse.errors.length,
        errorsJson: parse.errors,
        importedByUserId: getUserId(req) ?? null,
      });
      res.status(201).json({
        book_id: book.id,
        entry_count: entryCnt,
        errors: parse.errors,
        parse: {
          ...parse,
          entries: parse.entries.map((e) => ({
            ...e,
            source_metadata: sanitizeMetadata(e.source_metadata),
          })),
        },
      });
    } catch (err) {
      logErr('import (new book) failed', err);
      res.status(500).json({ message: 'Import failed', code: 'IMPORT_FAILED' });
    }
  },
);

// POST /:id/import — import into an existing book (replace | merge).
router.post(
  '/:id/import',
  can(['service.address_book.import']),
  importFields,
  async (req: any, res) => {
    const tenantId = tid(req, res);
    if (!tenantId) return;
    const vendor = readVendor(req.body.vendor);
    if (!vendor) return res.status(400).json({ message: 'Unknown vendor', code: 'VALIDATION' });
    if (!req.file) return res.status(400).json({ message: 'File required', code: 'NO_FILE' });
    const mode = req.body.mode === 'merge' ? 'merge' : 'replace';
    try {
      const book = await loadBook(tenantId, req.params.id);
      if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
      const adapter = getVendorAdapter(vendor);
      const parse = adapter.parse(req.file.buffer, req.body.password || undefined);
      if (mode === 'replace') {
        await db.delete(addressBookEntries).where(eq(addressBookEntries.bookId, book.id));
      }
      const entryCnt = await commitParsedEntries(book.id, tenantId, parse.entries);
      await db
        .update(addressBooks)
        .set({ lastImportedAt: new Date(), sourceVendor: vendor })
        .where(eq(addressBooks.id, book.id));
      await db.insert(addressBookImports).values({
        tenantId,
        bookId: book.id,
        vendor,
        rawFilename: req.file.originalname ?? 'upload.csv',
        passwordWasRequired: parse.password_was_required,
        entryCount: entryCnt,
        errorCount: parse.errors.length,
        errorsJson: parse.errors,
        importedByUserId: getUserId(req) ?? null,
      });
      res.json({ entry_count: entryCnt, errors: parse.errors, mode });
    } catch (err) {
      logErr('import (existing) failed', err);
      res.status(500).json({ message: 'Import failed', code: 'IMPORT_FAILED' });
    }
  },
);

// ─── Export (US-014) ─────────────────────────────────────────────────────────
const exportSchema = z.object({
  target_vendor: z.enum(VENDORS),
  target_password: z.string().optional(),
  filename: z.string().max(500).optional(),
});

// Resolve plaintext SMB passwords from the vault for re-encryption on export.
async function buildPasswordResolver(
  rows: (typeof addressBookEntries.$inferSelect)[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const credIds = rows.map((r) => r.credentialId).filter((c): c is string => !!c);
  if (credIds.length === 0) return map;
  const creds = await db
    .select()
    .from(addressBookCredentials)
    .where(inArray(addressBookCredentials.id, credIds));
  const byId = new Map(creds.map((c) => [c.id, c]));
  for (const r of rows) {
    if (!r.credentialId) continue;
    const cred = byId.get(r.credentialId);
    if (!cred) continue;
    try {
      map.set(
        r.id,
        decryptCredential({
          encryptedBlob: cred.encryptedBlob,
          iv: cred.iv,
          authTag: cred.authTag,
        }),
      );
    } catch {
      /* skip undecryptable credential */
    }
  }
  return map;
}

router.post('/:id/export', can(['service.address_book.export']), async (req: any, res) => {
  const tenantId = tid(req, res);
  if (!tenantId) return;
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid export', code: 'VALIDATION', details: parsed.error.flatten() });
  }
  try {
    const book = await loadBook(tenantId, req.params.id);
    if (!book) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });

    let rows = await db
      .select()
      .from(addressBookEntries)
      .where(eq(addressBookEntries.bookId, book.id));

    // Device-scoped books merge inherited customer-master entries with overrides.
    if (book.deviceId) {
      const [master] = await db
        .select()
        .from(addressBooks)
        .where(
          and(
            eq(addressBooks.tenantId, tenantId),
            eq(addressBooks.customerId, book.customerId),
            isNull(addressBooks.deviceId),
            isNull(addressBooks.deletedAt),
          ),
        )
        .limit(1);
      if (master) {
        const masterRows = await db
          .select()
          .from(addressBookEntries)
          .where(eq(addressBookEntries.bookId, master.id));
        const merged = mergeOverrides(masterRows.map(rowToCanonical), rows.map(rowToCanonical));
        const passwordMap = await buildPasswordResolver([...masterRows, ...rows]);
        return await finishExport(req, res, tenantId, book, merged, parsed.data, passwordMap);
      }
    }

    const passwordMap = await buildPasswordResolver(rows);
    await finishExport(
      req,
      res,
      tenantId,
      book,
      rows.map(rowToCanonical),
      parsed.data,
      passwordMap,
    );
  } catch (err) {
    logErr('export failed', err);
    res.status(500).json({ message: 'Export failed', code: 'EXPORT_FAILED' });
  }
});

async function finishExport(
  req: any,
  res: Response,
  tenantId: string,
  book: typeof addressBooks.$inferSelect,
  entries: CanonicalEntry[],
  opts: z.infer<typeof exportSchema>,
  passwordMap: Map<string, string>,
) {
  const canonicalBook: CanonicalAddressBook = {
    id: book.id,
    tenant_id: tenantId,
    customer_id: book.customerId,
    device_id: book.deviceId,
    name: book.name,
    source_vendor: (book.sourceVendor as AddressBookVendor | null) ?? null,
    source_subbook_name: book.sourceSubbookName,
  };
  const { file, report } = convertBook(canonicalBook, entries, opts.target_vendor, {
    password: opts.target_password,
    resolvePassword: (e) => (e.id ? passwordMap.get(e.id) : undefined),
  });
  const filename = opts.filename || file.filename;
  const [exportRow] = await db
    .insert(addressBookExports)
    .values({
      tenantId,
      bookId: book.id,
      targetVendor: opts.target_vendor,
      targetFilename: filename,
      conversionReportJson: report as unknown as Record<string, unknown>,
      exportedByUserId: getUserId(req) ?? null,
    })
    .returning({ id: addressBookExports.id });

  // Stash the generated bytes for the download endpoint (in-memory, tenant-scoped).
  exportCache.set(exportRow.id, { tenantId, filename, content: file.content, ts: Date.now() });
  res.json({
    export_id: exportRow.id,
    download_url: `/api/address-books/exports/${exportRow.id}/download`,
    conversion_report: report,
  });
}

// Short-lived in-memory cache of generated export files (avoids persisting raw
// vendor files to disk). Entries expire after 15 minutes.
const exportCache = new Map<
  string,
  { tenantId: string; filename: string; content: Buffer; ts: number }
>();
const EXPORT_TTL_MS = 15 * 60 * 1000;
function sweepExportCache() {
  const now = Date.now();
  for (const [id, v] of Array.from(exportCache.entries())) {
    if (now - v.ts > EXPORT_TTL_MS) exportCache.delete(id);
  }
}

router.get(
  '/exports/:exportId/download',
  can(['service.address_book.export']),
  async (req: any, res) => {
    const tenantId = tid(req, res);
    if (!tenantId) return;
    sweepExportCache();
    const cached = exportCache.get(req.params.exportId);
    if (!cached || cached.tenantId !== tenantId) {
      return res.status(404).json({ message: 'Export not found or expired', code: 'NOT_FOUND' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cached.filename}"`);
    res.send(cached.content);
  },
);

export default router;
