/**
 * GDPR storage-object erasure (LEGAL-004).
 *
 * The erasure service anonymized database columns and never touched Supabase
 * Storage, so a completed right-to-erasure request left every uploaded
 * document, logo, recording and report sitting in a bucket. The completion
 * record said the subject had been erased. It had not.
 *
 * Why this is a separate module rather than more code in the erasure service:
 * the objects are reached through the Supabase service client, not Drizzle, and
 * the tables that reference them are mostly DRIFT tables - `files`,
 * `file_uploads`, `meeting_recordings` and the QBR artifact table appear in no
 * Drizzle schema and no migration. They exist only in the live database. So
 * this code cannot be written against typed models; it probes, tolerates
 * absence, and reports honestly what it could and could not reach.
 *
 * The reporting matters as much as the deleting. An erasure record that
 * overstates its scope is its own compliance problem, so a bucket that could
 * not be resolved is reported as `skipped` with a reason rather than quietly
 * counting as zero.
 */

import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('gdpr-storage-erasure');

export type StorageErasureSubjectType = 'user' | 'contact' | 'customer' | 'lead';

export interface BucketErasureOutcome {
  bucket: string;
  /** Object keys confirmed removed. */
  removed: number;
  /** Object keys found but not removed. */
  failed: number;
  /** Set when nothing was attempted, explaining why. */
  skipped?: string;
}

export interface StorageErasureResult {
  buckets: BucketErasureOutcome[];
  totalRemoved: number;
  notes: string[];
}

/**
 * PostgREST/Postgres "relation does not exist".
 *
 * Deliberately narrower than the edge-function helper this mirrors. That one
 * falls back to a bare `does not exist` substring, which also matches
 * `column "x" does not exist` - so a missing COLUMN gets misdiagnosed as a
 * missing TABLE. Here that would abort the whole bucket instead of trying the
 * next candidate link column, and would report the wrong reason in an erasure
 * record. A message mentioning a column is never a missing-table error.
 */
function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  if (e.code === '42703' || e.code === 'PGRST204') return false;
  const msg = (e.message || '').toLowerCase();
  if (msg.includes('column')) return false;
  return (
    msg.includes('could not find the table') ||
    msg.includes('relation') ||
    msg.includes('does not exist')
  );
}

/** PostgREST/Postgres "column does not exist". */
function isMissingColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'PGRST204' || e.code === '42703') return true;
  const msg = (e.message || '').toLowerCase();
  return (
    msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'))
  );
}

/**
 * How to find one bucket's objects for a given subject.
 *
 * `subjectColumns` is a list of CANDIDATES because these are drift tables whose
 * shape is not recorded anywhere in this repo. Each is probed in order and the
 * first that resolves is used; if none does, the bucket is skipped with a
 * reason rather than guessed at.
 */
interface BucketSpec {
  bucket: string;
  table: string;
  /** Column holding the storage key or a URL containing it. */
  pathColumn: string;
  /** Candidate columns linking a row to the data subject. */
  subjectColumns: string[];
  /** Subject types this bucket can hold personal data for. */
  appliesTo: StorageErasureSubjectType[];
  /** Set when the bucket is deliberately out of scope. */
  excluded?: string;
}

const BUCKET_SPECS: BucketSpec[] = [
  {
    bucket: 'files',
    table: 'files',
    pathColumn: 'storage_path',
    subjectColumns: ['uploaded_by', 'user_id', 'customer_id', 'business_record_id', 'contact_id'],
    appliesTo: ['user', 'contact', 'customer', 'lead'],
  },
  {
    bucket: 'files',
    table: 'file_uploads',
    pathColumn: 'file_path',
    subjectColumns: ['uploaded_by', 'user_id', 'customer_id', 'business_record_id', 'contact_id'],
    appliesTo: ['user', 'contact', 'customer', 'lead'],
  },
  {
    bucket: 'meeting-recordings',
    table: 'meeting_recordings',
    pathColumn: 'recording_url',
    subjectColumns: ['uploaded_by', 'user_id'],
    appliesTo: ['user'],
  },
  {
    bucket: process.env.QBR_STORAGE_BUCKET || 'qbr-artifacts',
    table: 'qbr_reports',
    pathColumn: 'artifact_url',
    subjectColumns: ['customer_id', 'business_record_id'],
    appliesTo: ['contact', 'customer', 'lead'],
  },
  {
    bucket: 'branding-assets',
    table: 'company_branding_profiles',
    pathColumn: 'logo_url',
    subjectColumns: [],
    appliesTo: [],
    excluded:
      'Tenant-level brand assets, not personal data about any subject. Erasing one subject must not delete the company logo.',
  },
  {
    bucket: 'blog-assets',
    table: 'blog_assets',
    pathColumn: 'storage_path',
    subjectColumns: [],
    appliesTo: [],
    excluded: 'Marketing content owned by the tenant, not personal data about a data subject.',
  },
];

/** Reduce a stored value (bare key or public URL) to a storage key. */
export function storageKeyFromValue(value: string, bucket: string): string {
  let v = String(value ?? '').trim();
  if (!v) return '';
  const marker = `/${bucket}/`;
  const at = v.indexOf(marker);
  if (at >= 0) v = v.slice(at + marker.length);
  // Some rows store `<bucket>/<key>` with no leading slash.
  if (v.startsWith(`${bucket}/`)) v = v.slice(bucket.length + 1);
  return v.replace(/^\/+/, '').split('?')[0];
}

/** Minimal shape of the supabase client this module needs, so it can be faked in tests. */
export interface StorageErasureClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        eq(column: string, value: unknown): Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
  storage: {
    from(bucket: string): {
      remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
}

async function eraseBucket(
  client: StorageErasureClient,
  spec: BucketSpec,
  tenantId: string,
  subjectType: StorageErasureSubjectType,
  subjectId: string,
): Promise<BucketErasureOutcome> {
  if (spec.excluded) {
    return { bucket: spec.bucket, removed: 0, failed: 0, skipped: spec.excluded };
  }
  if (!spec.appliesTo.includes(subjectType)) {
    return {
      bucket: spec.bucket,
      removed: 0,
      failed: 0,
      skipped: `Not applicable to a '${subjectType}' subject (${spec.table}).`,
    };
  }

  // Probe the candidate subject columns. Drift tables have no recorded shape,
  // so the only way to learn which link column exists is to ask.
  let rows: unknown[] | null = null;
  let matchedColumn: string | null = null;
  const columnErrors: string[] = [];

  for (const subjectColumn of spec.subjectColumns) {
    const { data, error } = await client
      .from(spec.table)
      .select(spec.pathColumn)
      .eq('tenant_id', tenantId)
      .eq(subjectColumn, subjectId);

    if (!error) {
      rows = data ?? [];
      matchedColumn = subjectColumn;
      break;
    }
    if (isMissingTableError(error)) {
      return {
        bucket: spec.bucket,
        removed: 0,
        failed: 0,
        skipped: `Table '${spec.table}' does not exist in this database.`,
      };
    }
    if (isMissingColumnError(error)) {
      columnErrors.push(subjectColumn);
      continue;
    }
    return {
      bucket: spec.bucket,
      removed: 0,
      failed: 0,
      skipped: `Query against '${spec.table}' failed: ${(error as { message?: string })?.message ?? 'unknown error'}`,
    };
  }

  if (!matchedColumn) {
    return {
      bucket: spec.bucket,
      removed: 0,
      failed: 0,
      skipped:
        `No subject link column found on '${spec.table}' (tried ${columnErrors.join(', ') || 'none'}). ` +
        'Objects in this bucket could NOT be tied to the subject and were left in place.',
    };
  }

  const keys = (rows ?? [])
    .map((row) => {
      const raw = (row as Record<string, unknown>)[spec.pathColumn];
      return typeof raw === 'string' ? storageKeyFromValue(raw, spec.bucket) : '';
    })
    .filter((k) => k.length > 0);

  if (keys.length === 0) {
    return { bucket: spec.bucket, removed: 0, failed: 0 };
  }

  const { error } = await client.storage.from(spec.bucket).remove(keys);
  if (error) {
    log.error(
      { bucket: spec.bucket, table: spec.table, tenantId, error: error.message },
      'storage erasure failed',
    );
    return { bucket: spec.bucket, removed: 0, failed: keys.length };
  }

  return { bucket: spec.bucket, removed: keys.length, failed: 0 };
}

/**
 * Delete every storage object this subject can be tied to.
 *
 * Idempotent: a second run finds no referencing rows and reports zero removed.
 * Never throws - an erasure must not fail wholesale because one bucket is
 * unreachable, and the caller needs the partial outcome for the record.
 */
export async function eraseSubjectStorageObjects(
  client: StorageErasureClient | null,
  tenantId: string,
  subjectType: StorageErasureSubjectType,
  subjectId: string,
): Promise<StorageErasureResult> {
  const notes: string[] = [];

  if (!client) {
    return {
      buckets: [],
      totalRemoved: 0,
      notes: [
        'Storage erasure SKIPPED: no Supabase service client configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
          'Uploaded objects for this subject have NOT been deleted.',
      ],
    };
  }

  const buckets: BucketErasureOutcome[] = [];
  for (const spec of BUCKET_SPECS) {
    try {
      buckets.push(await eraseBucket(client, spec, tenantId, subjectType, subjectId));
    } catch (err) {
      buckets.push({
        bucket: spec.bucket,
        removed: 0,
        failed: 0,
        skipped: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const totalRemoved = buckets.reduce((sum, b) => sum + b.removed, 0);
  const totalFailed = buckets.reduce((sum, b) => sum + b.failed, 0);

  notes.push(
    `Storage objects removed: ${totalRemoved} across ${buckets.filter((b) => b.removed > 0).length} bucket(s).`,
  );
  if (totalFailed > 0) {
    notes.push(
      `WARNING: ${totalFailed} storage object(s) were identified but could not be deleted. ` +
        'The erasure is INCOMPLETE for those objects and must be retried.',
    );
  }
  const unresolved = buckets.filter((b) => b.skipped?.includes('could NOT be tied'));
  if (unresolved.length > 0) {
    notes.push(
      `WARNING: ${unresolved.length} bucket(s) could not be linked to this subject and were left untouched: ` +
        unresolved.map((b) => b.bucket).join(', ') +
        '.',
    );
  }

  return { buckets, totalRemoved, notes };
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
