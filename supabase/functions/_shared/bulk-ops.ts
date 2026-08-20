/**
 * Bulk-operation request parsing (PROD-014).
 *
 * The frontend calls /api/<resource>/bulk-delete and /bulk-update. The edge
 * functions had no branch for either, so the request fell through to the
 * generic :id handler and the action word became the id:
 *
 *   DELETE /product-models/bulk-delete -> delete where id = 'bulk-delete'
 *
 * `id` is a varchar, so that matches no row, PostgREST reports no error, and
 * the function answers 200. The user is told the bulk delete succeeded and
 * nothing was deleted. On invoices it was worse: the bulk paths are POSTs, so
 * they reached the CREATE branch instead.
 *
 * The parsing and the update whitelist live here because both backends need to
 * agree on them — the whitelist in particular is what stops a client naming
 * total_amount in `updates` and rewriting an invoice's value through an
 * endpoint meant for its status. server/tests/unit/bulk-ops-parity.test.ts
 * fails on drift.
 *
 * Deno copy — kept textually identical to
 * server/lib/bulk-ops.ts.
 */

/** Matches the Express `z.array(z.string()).min(1).max(500)` cap. */
export const MAX_BULK_IDS = 500;

export interface BulkIdsResult {
  ok: boolean;
  ids: string[];
  message?: string;
}

/**
 * The ids of a bulk request.
 *
 * An empty list is refused rather than treated as "all", which is the
 * difference between a no-op and deleting a tenant's invoices.
 */
export function parseBulkIds(body: unknown): BulkIdsResult {
  const raw = (body as { ids?: unknown } | null | undefined)?.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, ids: [], message: 'Validation failed' };
  }
  if (raw.length > MAX_BULK_IDS) {
    return { ok: false, ids: [], message: 'Validation failed' };
  }
  if (!raw.every((id) => typeof id === 'string' && id.length > 0)) {
    return { ok: false, ids: [], message: 'Validation failed' };
  }
  return { ok: true, ids: raw as string[] };
}

/**
 * Fields a bulk update may set, by resource.
 *
 * Keys are the camelCase names the frontend sends; values are the real column
 * names. Anything not named here is dropped, so widening what a bulk endpoint
 * can write is a deliberate edit to this map rather than a consequence of what
 * a caller happened to send.
 */
export const BULK_UPDATE_FIELDS: Record<string, Record<string, string>> = {
  invoices: {
    status: 'status',
    invoiceStatus: 'invoice_status',
    invoice_status: 'invoice_status',
    salesRep: 'sales_rep',
    sales_rep: 'sales_rep',
    paymentTerms: 'payment_terms',
    payment_terms: 'payment_terms',
    invoiceNotes: 'invoice_notes',
    invoice_notes: 'invoice_notes',
  },
};

export interface BulkUpdateResult {
  ok: boolean;
  ids: string[];
  updates: Record<string, unknown>;
  message?: string;
}

/**
 * The ids and the whitelisted column updates of a bulk-update request.
 *
 * Returns snake_case column names, which is what PostgREST needs; the Node
 * caller maps them back to its Drizzle fields.
 */
export function parseBulkUpdate(body: unknown, resource: string): BulkUpdateResult {
  const ids = parseBulkIds(body);
  if (!ids.ok) return { ok: false, ids: [], updates: {}, message: ids.message };

  const raw = (body as { updates?: unknown } | null | undefined)?.updates;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, ids: [], updates: {}, message: 'Validation failed' };
  }

  const allowed = BULK_UPDATE_FIELDS[resource] ?? {};
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const column = allowed[key];
    if (column) updates[column] = value;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, ids: [], updates: {}, message: 'No valid update fields provided' };
  }

  return { ok: true, ids: ids.ids, updates };
}
