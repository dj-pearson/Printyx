/**
 * QBR artifact storage access (LEGAL-006).
 *
 * Quarterly business reviews contain a customer's fleet, usage, downtime and
 * spend. Both QBR code paths used to call `getPublicUrl()` and persist the
 * result, so the deck was reachable by anyone holding the link, forever, with
 * no authentication and no expiry. `getPublicUrl()` returns a URL string
 * whether or not the bucket is public, which is why nothing in the code made
 * that obvious.
 *
 * The fix is not simply swapping in `createSignedUrl()` at the upload site: a
 * signed URL expires, so persisting one just means a dead link later. What gets
 * stored is the storage KEY, and a short-lived signed URL is minted per read.
 *
 * `pdf_url` / `html_url` keep their column names and now hold a key. Rows
 * written before this change still hold a full public URL, so every read goes
 * through `toArtifactKey()`, which accepts either shape.
 */

import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('qbr-artifact-storage');

/**
 * One canonical default. The Express route defaulted to 'qbr' and the edge
 * function to 'qbr-artifacts', so the two halves of the same feature disagreed
 * about where decks live. 'qbr-artifacts' wins because the edge function is what
 * actually serves production.
 *
 * If the live bucket turns out to be named 'qbr', set QBR_STORAGE_BUCKET=qbr
 * rather than editing this default, and record it in
 * docs/storage-bucket-inventory.md.
 */
export const QBR_BUCKET = process.env.QBR_STORAGE_BUCKET || 'qbr-artifacts';

/** How long a minted artifact link stays valid. */
export const QBR_SIGNED_URL_TTL_SECONDS = 15 * 60;

/**
 * Normalize a stored value to a storage key.
 *
 * Accepts a bare key (what this code now writes) or a full public URL (what
 * rows written before LEGAL-006 contain), so historical decks keep working.
 */
export function toArtifactKey(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const marker = `/${QBR_BUCKET}/`;
  const at = raw.indexOf(marker);
  if (at >= 0) return raw.slice(at + marker.length).split('?')[0];

  // A URL we cannot place in this bucket is not something we can sign.
  if (/^https?:\/\//i.test(raw)) {
    const publicMarker = '/object/public/';
    const pub = raw.indexOf(publicMarker);
    if (pub >= 0) {
      const rest = raw.slice(pub + publicMarker.length).split('?')[0];
      const slash = rest.indexOf('/');
      return slash >= 0 ? rest.slice(slash + 1) : rest;
    }
    return null;
  }

  return raw.replace(/^\/+/, '').split('?')[0];
}

async function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Mint a time-limited link for one stored artifact value.
 *
 * Returns null rather than falling back to a public URL: a broken link is a
 * support ticket, an unauthenticated permanent link to a customer's financials
 * is the thing this story exists to remove.
 */
export async function signArtifact(value: string | null | undefined): Promise<string | null> {
  const key = toArtifactKey(value);
  if (!key) return null;

  const client = await storageClient();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(QBR_BUCKET)
      .createSignedUrl(key, QBR_SIGNED_URL_TTL_SECONDS);
    if (error) {
      log.warn({ err: error.message, key }, 'Failed to sign QBR artifact');
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    log.warn({ err: (err as Error)?.message, key }, 'Failed to sign QBR artifact');
    return null;
  }
}

/** Replace the stored keys on a QBR row with freshly-signed, expiring links. */
export async function withSignedArtifacts<
  T extends { pdfUrl?: string | null; htmlUrl?: string | null },
>(row: T): Promise<T> {
  const [pdfUrl, htmlUrl] = await Promise.all([
    signArtifact(row.pdfUrl),
    signArtifact(row.htmlUrl),
  ]);
  return { ...row, pdfUrl, htmlUrl };
}

/** Same, for a list. */
export async function withSignedArtifactsAll<
  T extends { pdfUrl?: string | null; htmlUrl?: string | null },
>(rows: T[]): Promise<T[]> {
  return await Promise.all(rows.map((r) => withSignedArtifacts(r)));
}
