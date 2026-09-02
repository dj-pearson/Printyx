/**
 * Generated address-book export bytes (PA-055 AC4).
 *
 * These used to live in a module-level `Map` with a 15-minute TTL. That cannot
 * work in the deployed shape of this feature for two independent reasons: the
 * edge function is stateless, so it has no Map to write to, and the Node service
 * runs behind more than one process, so an export generated on one instance
 * 404'd when the download landed on another. The symptom was "Export not found
 * or expired" on a file the user had just watched being generated.
 *
 * Both hosts now write the same object: bucket `address-book-exports`, key
 * `<tenantId>/<exportId>`. The tenant prefix is what keeps one tenant from
 * reading another's contact list, and every read here re-checks it rather than
 * trusting the id.
 *
 * Bytes are STREAMED back through the authenticated route, never handed out as a
 * signed URL - an address book export is a customer's full contact list, and an
 * unauthenticated link to one is exactly what LEGAL-006 removed from QBR decks.
 */

import { createModuleLogger } from '../../lib/logger';

const log = createModuleLogger('address-book-export-storage');

export const EXPORT_BUCKET = process.env.ADDRESS_BOOK_EXPORT_BUCKET || 'address-book-exports';

export function exportObjectKey(tenantId: string, exportId: string): string {
  return `${tenantId}/${exportId}`;
}

async function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Persist one generated export. Returns false when the bytes did not land, so
 * the caller can say the export failed instead of handing back a download_url
 * that 404s a second later.
 */
export async function storeExportFile(
  tenantId: string,
  exportId: string,
  content: Buffer,
): Promise<boolean> {
  const client = await storageClient();
  if (!client) {
    log.warn('Supabase storage is not configured; the export file was not stored');
    return false;
  }
  const { error } = await client.storage
    .from(EXPORT_BUCKET)
    .upload(exportObjectKey(tenantId, exportId), content, {
      contentType: 'text/csv; charset=utf-8',
      upsert: true,
    });
  if (error) {
    log.error({ err: error.message, exportId }, 'Failed to store address book export');
    return false;
  }
  return true;
}

/** Read one stored export back. Null means the object is gone, not that the row is. */
export async function loadExportFile(tenantId: string, exportId: string): Promise<Buffer | null> {
  const client = await storageClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(EXPORT_BUCKET)
    .download(exportObjectKey(tenantId, exportId));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
