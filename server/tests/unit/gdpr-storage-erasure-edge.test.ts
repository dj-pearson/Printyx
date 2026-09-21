import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  bucketSpecs,
  eraseSubjectStorageObjects,
  storageKeyFromValue,
  DEFAULT_QBR_BUCKET,
  type StorageErasureClient,
} from '@shared/gdpr-storage-erasure';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * A fake that answers one table with one row and records what was removed.
 * The real client is supabase-js; the module takes the narrow interface so the
 * rules can be exercised rather than read.
 */
function fakeClient(rows: Record<string, unknown[]>, removeFails = new Set<string>()) {
  const removed: Array<{ bucket: string; paths: string[] }> = [];
  const client: StorageErasureClient = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                eq: async () =>
                  table in rows
                    ? { data: rows[table], error: null }
                    : { data: null, error: { code: '42P01', message: 'missing' } },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          remove: async (paths: string[]) => {
            if (removeFails.has(bucket)) return { data: null, error: { message: 'denied' } };
            removed.push({ bucket, paths });
            return { data: paths, error: null };
          },
        };
      },
    },
  };
  return { client, removed };
}

/**
 * LEGAL-004 was implemented correctly under server/services/ and ran for
 * nobody: `/api/gdpr` is not proxied, so production resolves it to
 * supabase/functions/gdpr/, whose data-deletion branch anonymised two tables of
 * rows, touched no storage, and told the data subject their data had been
 * anonymized.
 */
describe('the erasure core is one module, not a parity pair', () => {
  it('is imported by the edge function', () => {
    const edge = read('supabase/functions/gdpr/index.ts');
    expect(edge).toContain("from '../../../shared/gdpr-storage-erasure.ts'");
    expect(edge).toContain('eraseSubjectStorageObjects(');
  });

  it('is imported by the Express service, through its adapter', () => {
    const adapter = read('server/services/gdpr-storage-erasure.ts');
    expect(adapter).toContain("from '@shared/gdpr-storage-erasure'");
    expect(read('server/services/gdpr-erasure-service.ts')).toContain(
      'eraseSubjectStorageObjects(',
    );
  });

  it('reaches for neither runtime environment, so both can read it', () => {
    // Comments stripped first: the header explains WHY neither environment is
    // read here and therefore names both. Thirteenth time in this repo that an
    // absence assertion would otherwise report its own explanation.
    const shared = stripComments(read('shared/gdpr-storage-erasure.ts'));
    expect(shared).not.toContain('process.env');
    expect(shared).not.toContain('Deno.env');
    // The bucket name is a parameter instead.
    expect(bucketSpecs('custom-qbr').some((s) => s.bucket === 'custom-qbr')).toBe(true);
    // The literal, not just `=== DEFAULT_QBR_BUCKET`, which moves with it. The
    // two hosts used to disagree about this name (routes-qbr.ts defaulted to
    // 'qbr'), so the default is pinned against what the inventory documents.
    expect(DEFAULT_QBR_BUCKET).toBe('qbr-artifacts');
    expect(read('docs/storage-bucket-inventory.md')).toContain('`qbr-artifacts`');
    expect(bucketSpecs().some((s) => s.bucket === 'qbr-artifacts')).toBe(true);
  });

  it('keeps each host supplying its own environment', () => {
    expect(read('server/services/gdpr-storage-erasure.ts')).toContain(
      'process.env.QBR_STORAGE_BUCKET',
    );
    expect(read('supabase/functions/gdpr/index.ts')).toContain(
      "Deno.env.get('QBR_STORAGE_BUCKET')",
    );
  });
});

describe('the bucket specs say what is out of scope and why', () => {
  const specs = bucketSpecs();

  it('covers the buckets that can hold a subject personal data', () => {
    const buckets = new Set(specs.map((s) => s.bucket));
    expect(buckets.has('files')).toBe(true);
    expect(buckets.has('meeting-recordings')).toBe(true);
    expect(buckets.has(DEFAULT_QBR_BUCKET)).toBe(true);
  });

  it('excludes the tenant-owned buckets with a named reason, not silently', () => {
    for (const bucket of ['branding-assets', 'blog-assets']) {
      const spec = specs.find((s) => s.bucket === bucket);
      expect(spec, `${bucket} is not in the spec list at all`).toBeTruthy();
      expect(spec!.excluded, `${bucket} is skipped with no reason`).toBeTruthy();
      expect(spec!.excluded!.length).toBeGreaterThan(40);
      expect(spec!.appliesTo).toEqual([]);
    }
  });
});

describe('erasing a subject, against a fake bucket', () => {
  it('removes the objects it can tie to the subject', async () => {
    const { client, removed } = fakeClient({
      files: [{ storage_path: 'tenant/abc/lease.pdf' }],
    });
    const out = await eraseSubjectStorageObjects(client, 't1', 'customer', 's1');
    expect(out.totalRemoved).toBe(1);
    expect(removed[0]).toEqual({ bucket: 'files', paths: ['tenant/abc/lease.pdf'] });
  });

  it('is idempotent: a second run finds nothing and reports zero', async () => {
    const { client } = fakeClient({ files: [] });
    const out = await eraseSubjectStorageObjects(client, 't1', 'customer', 's1');
    expect(out.totalRemoved).toBe(0);
    expect(out.buckets.every((b) => b.failed === 0)).toBe(true);
  });

  it('reports a failed removal rather than counting it as removed', async () => {
    const { client } = fakeClient(
      { files: [{ storage_path: 'tenant/abc/lease.pdf' }] },
      new Set(['files']),
    );
    const out = await eraseSubjectStorageObjects(client, 't1', 'customer', 's1');
    expect(out.totalRemoved).toBe(0);
    expect(out.buckets.some((b) => b.failed > 0)).toBe(true);
    expect(out.notes.join(' ')).toMatch(/INCOMPLETE/);
  });

  it('answers a skip rather than a silent zero when no client is configured', async () => {
    const out = await eraseSubjectStorageObjects(null, 't1', 'customer', 's1');
    expect(out.totalRemoved).toBe(0);
    expect(out.notes.join(' ')).toMatch(/SKIPPED/);
    expect(out.notes.join(' ')).toMatch(/have NOT been deleted/);
  });

  it('reduces a stored public URL to the bare storage key', () => {
    expect(
      storageKeyFromValue('https://x.co/storage/v1/object/public/files/a/b.pdf', 'files'),
    ).toBe('a/b.pdf');
    expect(storageKeyFromValue('/files/a/b.pdf', 'files')).toBe('a/b.pdf');
    expect(storageKeyFromValue('a/b.pdf?token=1', 'files')).toBe('a/b.pdf');
  });
});

describe('the production branch tells the truth about what it did', () => {
  const code = stripComments(read('supabase/functions/gdpr/index.ts'));
  const branch = code.slice(
    code.indexOf("endpoint === 'data-deletion'"),
    code.indexOf("endpoint === 'audit-log'"),
  );

  it('runs the erasure for both kinds of subject it anonymised', () => {
    // Bound to the SOURCE array as well as the type literal: replacing
    // `anonymizedRecords` with an empty list leaves the literal in place and
    // erases nothing for any business record.
    expect(branch).toMatch(/\(anonymizedContacts \?\? \[\]\)\.map/);
    expect(branch).toMatch(/\(anonymizedRecords \?\? \[\]\)\.map/);
    expect(branch).toContain("type: 'contact' as const");
    expect(branch).toContain("type: 'customer' as const");
  });

  it('reports per-bucket counts beside the row counts', () => {
    expect(branch).toMatch(/storage:\s*\{/);
    expect(branch).toContain('buckets: byBucket');
    expect(branch).toContain('removed: storageRemoved');
    expect(branch).toContain('failed: storageFailed');
  });

  it('refuses to report success when an object could not be deleted', () => {
    // A completion record that overstates its scope is its own compliance
    // problem - the same false claim this branch was corrected for once.
    expect(branch).toContain('success: storageFailed === 0');
    expect(branch).toMatch(/storageFailed === 0 \? 200 : 500/);
    expect(branch).toContain('INCOMPLETE');
  });

  it('carries the backup note corrected for storage', () => {
    // pg_dump archives do not contain bucket contents, so "ages out under the
    // backup retention schedule" is not true of an object.
    expect(branch).toMatch(/NOT covered by database backups/);
  });

  it('no longer claims anonymisation without qualification', () => {
    expect(branch).not.toMatch(/message:\s*'User data has been anonymized'/);
  });
});
