// Storage-object erasure for a GDPR data subject (LEGAL-004).
//
// SHARED BY BOTH HOSTS ON PURPOSE. This was implemented once, correctly, under
// server/services/ - per-bucket outcomes, Art. 17(3) exemptions named, the
// backup note corrected because pg_dump archives do not contain bucket
// contents - and it ran for nobody. `/api/gdpr` is not proxied, so production
// resolves it to supabase/functions/gdpr/, whose data-deletion branch
// anonymised two tables of rows and touched no storage at all, while reporting
// "User data has been anonymized" to a data subject exercising Article 17.
//
// So the portable core lives here and both hosts import it (round 94's rule:
// one module beats a parity test whenever both runtimes can read it). The Node
// side keeps only its client factory; the edge function supplies a PostgREST
// client and Deno's own environment.

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
export interface BucketSpec {
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

/**
 * The default QBR bucket. `server/routes-qbr.ts` and the edge function used to
 * disagree about this name, which is why it is a parameter with one default
 * rather than two literals.
 */
export const DEFAULT_QBR_BUCKET = 'qbr-artifacts';

/**
 * `qbrBucket` is passed in because this module is imported by BOTH hosts and
 * they read configuration differently - `process.env` in Node, `Deno.env.get`
 * in the edge runtime. A module that reaches for one of them cannot be shared.
 */
export function bucketSpecs(qbrBucket: string = DEFAULT_QBR_BUCKET): BucketSpec[] {
  return [
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
    // qbr_reports IS in the Drizzle schema (shared/qbr-schema.ts) and stores two
    // artifacts per row, so it gets two specs. The columns are pdf_url/html_url;
    // an earlier draft of this file guessed 'artifact_url', which does not exist.
    {
      bucket: qbrBucket,
      table: 'qbr_reports',
      pathColumn: 'pdf_url',
      subjectColumns: ['customer_id'],
      appliesTo: ['contact', 'customer', 'lead'],
    },
    {
      bucket: qbrBucket,
      table: 'qbr_reports',
      pathColumn: 'html_url',
      subjectColumns: ['customer_id'],
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
}

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

export async function eraseBucket(
  client: StorageErasureClient,
  spec: BucketSpec,
  tenantId: string,
  subjectType: StorageErasureSubjectType,
  subjectId: string,
  onError?: (...args: unknown[]) => void,
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
    onError?.(
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
  options: { qbrBucket?: string; onError?: (...args: unknown[]) => void } = {},
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
  for (const spec of bucketSpecs(options.qbrBucket)) {
    try {
      buckets.push(
        await eraseBucket(client, spec, tenantId, subjectType, subjectId, options.onError),
      );
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
