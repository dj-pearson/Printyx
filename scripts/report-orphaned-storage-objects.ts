#!/usr/bin/env tsx
/**
 * Orphaned storage object reporter (LEGAL-003).
 *
 * Finds objects sitting in Supabase Storage that no database row references.
 * Three edge functions used to leak them, in three different ways, so there is
 * an unknown backlog in the live buckets that fixing the code does not clear:
 *
 *   file-storage  the removal was commented out entirely
 *   files         the removal ignored its own error result
 *   branding      profile deletes never touched the logos, and every logo
 *                 re-upload abandoned its predecessor
 *
 * REPORTS BY DEFAULT. Deleting customer data is not something a script should
 * do because someone ran it to have a look, so purging requires --purge AND
 * --bucket, and it prints what it is about to remove either way.
 *
 * Usage:
 *   npx tsx scripts/report-orphaned-storage-objects.ts
 *   npx tsx scripts/report-orphaned-storage-objects.ts --bucket files
 *   npx tsx scripts/report-orphaned-storage-objects.ts --bucket files --purge
 *
 * Env: SUPABASE_URL (default https://api.printyx.net), SUPABASE_SERVICE_ROLE_KEY
 *
 * Caveat worth knowing before trusting a number: `files` and `file_uploads` are
 * DRIFT tables - they appear in no Drizzle schema and no migration, only in
 * raw SQL against the live database. If one is missing entirely, every object
 * in its bucket looks orphaned. The script detects that and refuses to purge
 * rather than reporting a bucket-wide false positive.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.printyx.net';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const PURGE = args.includes('--purge');
const bucketArgIndex = args.indexOf('--bucket');
const ONLY_BUCKET = bucketArgIndex >= 0 ? args[bucketArgIndex + 1] : undefined;

if (PURGE && !ONLY_BUCKET) {
  console.error('--purge requires --bucket <name>. Refusing to purge every bucket at once.');
  process.exit(1);
}

/** Where each bucket's keys are supposed to be referenced from. */
interface BucketSpec {
  bucket: string;
  /** Table holding the reference, and the column holding the key or URL. */
  refs: Array<{
    table: string;
    column: string;
    /** column stores a URL, not a key */ isUrl?: boolean;
  }>;
  note?: string;
}

const BUCKETS: BucketSpec[] = [
  {
    bucket: 'files',
    refs: [
      { table: 'files', column: 'storage_path' },
      { table: 'file_uploads', column: 'file_path' },
    ],
    note: 'Both tables are drift tables (no Drizzle schema, no migration).',
  },
  {
    bucket: 'branding-assets',
    refs: [{ table: 'company_branding_profiles', column: 'logo_url', isUrl: true }],
    note: 'Only the public URL is stored, so the key is derived from it.',
  },
  {
    bucket: 'blog-assets',
    refs: [{ table: 'blog_assets', column: 'storage_path' }],
    note: 'Soft delete by design: a row with deleted_at set still references its object.',
  },
  {
    bucket: 'meeting-recordings',
    refs: [{ table: 'meeting_recordings', column: 'recording_url' }],
  },
];

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Recursively list every object key in a bucket. */
async function listAll(bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Storage returns folders as entries with no id/metadata.
      const isFolder = !(entry as { id?: string }).id;
      if (isFolder) {
        out.push(...(await listAll(bucket, key)));
      } else {
        out.push(key);
      }
    }
    if (data.length < pageSize) break;
  }
  return out;
}

/** Strip a public-URL wrapper down to the storage key. */
function keyFromValue(value: string, bucket: string): string {
  let v = String(value ?? '').trim();
  if (!v) return '';
  const marker = `/${bucket}/`;
  const at = v.indexOf(marker);
  if (at >= 0) v = v.slice(at + marker.length);
  return v.replace(/^\/+/, '').split('?')[0];
}

async function referencedKeys(spec: BucketSpec): Promise<{ keys: Set<string>; missing: string[] }> {
  const keys = new Set<string>();
  const missing: string[] = [];

  for (const ref of spec.refs) {
    const { data, error } = await admin.from(ref.table).select(ref.column);
    if (error) {
      // 42P01 = undefined_table. A missing table means we cannot tell what is
      // referenced, which is very different from "nothing is referenced".
      if (error.code === '42P01' || /does not exist/i.test(error.message)) {
        missing.push(ref.table);
        continue;
      }
      throw new Error(`select ${ref.table}.${ref.column}: ${error.message}`);
    }
    for (const row of data ?? []) {
      const raw = (row as Record<string, unknown>)[ref.column];
      if (typeof raw === 'string' && raw) keys.add(keyFromValue(raw, spec.bucket));
    }
  }
  return { keys, missing };
}

async function main() {
  const specs = ONLY_BUCKET ? BUCKETS.filter((b) => b.bucket === ONLY_BUCKET) : BUCKETS;
  if (specs.length === 0) {
    console.error(
      `Unknown bucket "${ONLY_BUCKET}". Known: ${BUCKETS.map((b) => b.bucket).join(', ')}`,
    );
    process.exit(1);
  }

  let totalOrphans = 0;

  for (const spec of specs) {
    console.log(`\n=== ${spec.bucket} ===`);
    if (spec.note) console.log(`    ${spec.note}`);

    let objects: string[];
    try {
      objects = await listAll(spec.bucket);
    } catch (err) {
      console.log(`    SKIPPED: ${(err as Error).message}`);
      continue;
    }

    const { keys, missing } = await referencedKeys(spec);
    const orphans = objects.filter((o) => !keys.has(o));
    totalOrphans += orphans.length;

    console.log(`    objects in bucket: ${objects.length}`);
    console.log(`    referenced by rows: ${keys.size}`);
    console.log(`    unreferenced:       ${orphans.length}`);

    if (missing.length > 0) {
      console.log(`    WARNING: reference table(s) not found: ${missing.join(', ')}.`);
      console.log(
        '    Every object looks orphaned when the table holding its reference is absent.',
      );
      console.log(
        '    Not purging this bucket. Confirm the table names against the live database first.',
      );
    }

    for (const o of orphans.slice(0, 20)) console.log(`      - ${o}`);
    if (orphans.length > 20) console.log(`      ... and ${orphans.length - 20} more`);

    if (PURGE && orphans.length > 0) {
      if (missing.length > 0) {
        console.log('    PURGE REFUSED: see the warning above.');
        continue;
      }
      const { error } = await admin.storage.from(spec.bucket).remove(orphans);
      if (error) console.log(`    PURGE FAILED: ${error.message}`);
      else console.log(`    PURGED ${orphans.length} object(s).`);
    }
  }

  console.log(
    `\n${totalOrphans} unreferenced object(s) across ${specs.length} bucket(s).` +
      (PURGE ? '' : ' Re-run with --bucket <name> --purge to remove them.'),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
