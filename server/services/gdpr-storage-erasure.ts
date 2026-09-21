// Node adapter for the shared GDPR storage-erasure core (LEGAL-004).
//
// The rules, the bucket specs and the reporting live in shared/ because the
// edge function needs them too - see that file's header for why. All this adds
// is the service-role client and Node's own environment.

export {
  bucketSpecs,
  eraseBucket,
  eraseSubjectStorageObjects,
  storageKeyFromValue,
  DEFAULT_QBR_BUCKET,
} from '@shared/gdpr-storage-erasure';
export type {
  BucketSpec,
  BucketErasureOutcome,
  StorageErasureClient,
  StorageErasureResult,
  StorageErasureSubjectType,
} from '@shared/gdpr-storage-erasure';

import type { StorageErasureClient } from '@shared/gdpr-storage-erasure';
import { DEFAULT_QBR_BUCKET } from '@shared/gdpr-storage-erasure';

/** The bucket this deployment stores QBR artifacts in. */
export function qbrBucket(): string {
  return process.env.QBR_STORAGE_BUCKET || DEFAULT_QBR_BUCKET;
}

/** Build the service-role client, or null when storage is not configured. */
export async function createStorageErasureClient(): Promise<StorageErasureClient | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as StorageErasureClient;
}
