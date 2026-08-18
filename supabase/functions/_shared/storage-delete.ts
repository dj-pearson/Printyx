// Shared storage-object removal for edge functions (LEGAL-003).
//
// Why this exists: "delete" has to mean the bytes are gone, because the Privacy
// Policy tells customers it does. Three separate edge functions got this wrong
// in three different ways, and none of them was visible in review:
//
//   file-storage/index.ts  the remove() call was commented out with a note
//                          reading "In production, also delete from Supabase
//                          Storage". The row went, the object stayed forever.
//   files/index.ts         called remove() but discarded the result, so a
//                          storage failure still returned "File deleted".
//   branding-profiles      hard-deleted the profile row and never touched the
//                          uploaded logo.
//
// The second one is the instructive case. `await admin.storage.from(b).remove(p)`
// looks correct at a glance and is not: the supabase-js storage client returns
// errors in `{ data, error }` rather than throwing, so ignoring the return value
// turns every failure into a silent success. That is worse than not calling it
// at all, because the endpoint then reports a deletion that did not happen.
//
// Rules this helper enforces:
//   1. Errors surface. The caller decides the status code; it never gets to
//      not-know.
//   2. Paths are normalized once, here. A leading slash on a storage key is a
//      different object than the same key without one, and file rows in this
//      codebase store both shapes.
//   3. An empty path list is a no-op success, not an error. A row with no
//      object attached is a legitimate state.

export interface StorageRemovalResult {
  /** True when every requested path is confirmed gone from the bucket. */
  ok: boolean;
  /** Paths the storage API confirmed it removed. */
  removed: string[];
  /** Paths that were requested but not confirmed removed. */
  failed: string[];
  /** Human-readable reason, present only when ok is false. */
  error?: string;
}

/** Minimal shape of the supabase-js storage client this helper needs. */
interface StorageBucketApi {
  remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
}
interface StorageCapableClient {
  storage: { from(bucket: string): StorageBucketApi };
}

/**
 * Storage keys are stored inconsistently across these tables - some rows carry
 * a leading slash, some do not, and `bucket/key` shows up too. Normalize to the
 * bare key the storage API expects.
 */
export function normalizeStoragePath(path: string, bucket?: string): string {
  let key = String(path ?? '').trim();
  if (!key) return '';
  key = key.replace(/^\/+/, '');
  if (bucket && key.startsWith(`${bucket}/`)) {
    key = key.slice(bucket.length + 1);
  }
  return key;
}

/**
 * Remove objects from a bucket and report honestly whether it worked.
 *
 * Never throws: callers are request handlers that need to map the outcome onto
 * a status code, not catch an exception. Check `.ok`.
 */
export async function removeStorageObjects(
  client: StorageCapableClient,
  bucket: string,
  paths: Array<string | null | undefined>,
): Promise<StorageRemovalResult> {
  const keys = paths
    .map((p) => normalizeStoragePath(p ?? '', bucket))
    .filter((p): p is string => p.length > 0);

  // Nothing attached to this row. That is a valid state, not a failure.
  if (keys.length === 0) {
    return { ok: true, removed: [], failed: [] };
  }

  try {
    const { data, error } = await client.storage.from(bucket).remove(keys);

    if (error) {
      return { ok: false, removed: [], failed: keys, error: error.message };
    }

    // The storage API reports what it actually removed. A key missing from that
    // list was not deleted - usually because it was already gone, occasionally
    // because the key was wrong. Either way the caller should know rather than
    // assume, so treat a short list as a partial failure and let the caller
    // decide how loud to be.
    const confirmed = Array.isArray(data)
      ? (data as Array<{ name?: string }>)
          .map((o) => (typeof o?.name === 'string' ? o.name : ''))
          .filter(Boolean)
      : [];

    // Some storage versions return the objects without a usable name field. If
    // we cannot tell, trust the absence of an error rather than inventing a
    // failure.
    if (confirmed.length === 0) {
      return { ok: true, removed: keys, failed: [] };
    }

    const failed = keys.filter((k) => !confirmed.some((c) => k === c || k.endsWith(`/${c}`)));
    return failed.length === 0
      ? { ok: true, removed: keys, failed: [] }
      : {
          ok: false,
          removed: keys.filter((k) => !failed.includes(k)),
          failed,
          error: `storage did not confirm removal of ${failed.length} object(s) from ${bucket}`,
        };
  } catch (err) {
    return {
      ok: false,
      removed: [],
      failed: keys,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Storage list API surface used by removeStoragePrefix. */
interface StorageListApi extends StorageBucketApi {
  list(
    prefix: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Array<{ name: string }> | null; error: { message: string } | null }>;
}
interface StorageListCapableClient {
  storage: { from(bucket: string): StorageListApi };
}

/**
 * Remove every object under a path prefix.
 *
 * Needed because some uploaders mint a fresh key per upload (branding logos are
 * `<tenant>/<profile>/logo-<uuid>.<ext>`) and store only the resulting public
 * URL. Nothing then records the previous key, so re-uploading a logo orphaned
 * the old one and deleting the profile orphaned all of them. Listing the prefix
 * is the only way to find objects whose keys were never written down.
 *
 * `exclude` keeps a key that should survive, so an upload can clear its
 * predecessors without deleting the object it just wrote.
 */
export async function removeStoragePrefix(
  client: StorageListCapableClient,
  bucket: string,
  prefix: string,
  exclude: string[] = [],
): Promise<StorageRemovalResult> {
  const cleanPrefix = normalizeStoragePath(prefix, bucket).replace(/\/+$/, '');
  if (!cleanPrefix) {
    return { ok: false, removed: [], failed: [], error: 'refusing to clear an empty prefix' };
  }

  const keep = new Set(exclude.map((k) => normalizeStoragePath(k, bucket)));

  try {
    const { data, error } = await client.storage.from(bucket).list(cleanPrefix, { limit: 1000 });
    if (error) {
      return { ok: false, removed: [], failed: [], error: error.message };
    }

    const keys = (data ?? []).map((o) => `${cleanPrefix}/${o.name}`).filter((k) => !keep.has(k));

    if (keys.length === 0) {
      return { ok: true, removed: [], failed: [] };
    }

    return await removeStorageObjects(client as unknown as StorageCapableClient, bucket, keys);
  } catch (err) {
    return {
      ok: false,
      removed: [],
      failed: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
