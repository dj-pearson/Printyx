/**
 * Unit Tests: server/services/gdpr-storage-erasure.ts (LEGAL-004)
 *
 * The failure this guards against is an erasure record that OVERSTATES what was
 * erased. Before this story the service anonymized database columns, never
 * touched a bucket, and reported success - so a data subject was told their
 * data was gone while every document they had uploaded sat where it was.
 *
 * So the assertions that matter are about honesty as much as deletion: a bucket
 * whose table is missing, whose link column cannot be found, or whose removal
 * fails must be reported as such, never counted as a quiet zero.
 */

import { describe, it, expect } from 'vitest';
import {
  eraseSubjectStorageObjects,
  storageKeyFromValue,
  type StorageErasureClient,
} from '../../services/gdpr-storage-erasure';

interface TableFixture {
  /** Rows keyed by the subject column that links them. */
  linkColumn: string;
  rows: Array<Record<string, unknown>>;
}

/**
 * Fake Supabase client. Buckets are Maps with real state so "the object is
 * gone" is asserted by looking for it, not by counting calls.
 */
function fakeClient(opts: {
  tables?: Record<string, TableFixture>;
  buckets?: Record<string, string[]>;
  removeFails?: boolean;
}) {
  const tables = opts.tables ?? {};
  const buckets: Record<string, Set<string>> = {};
  for (const [name, keys] of Object.entries(opts.buckets ?? {})) {
    buckets[name] = new Set(keys);
  }

  const client = {
    from(table: string) {
      return {
        select(column: string) {
          return {
            eq(_tenantCol: string, _tenantVal: unknown) {
              return {
                async eq(subjectCol: string, subjectVal: unknown) {
                  const fixture = tables[table];
                  if (!fixture) {
                    return {
                      data: null,
                      error: { code: '42P01', message: 'relation does not exist' },
                    };
                  }
                  if (subjectCol !== fixture.linkColumn) {
                    return {
                      data: null,
                      error: { code: '42703', message: `column ${subjectCol} does not exist` },
                    };
                  }
                  const rows = fixture.rows
                    .filter((r) => r[subjectCol] === subjectVal)
                    .map((r) => ({ [column]: r[column] }));
                  return { data: rows, error: null };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            if (opts.removeFails) {
              return { data: null, error: { message: 'permission denied' } };
            }
            for (const p of paths) buckets[bucket]?.delete(p);
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };

  return { client: client as unknown as StorageErasureClient, buckets };
}

describe('storageKeyFromValue', () => {
  it('reduces a public URL to the bare storage key', () => {
    expect(
      storageKeyFromValue(
        'https://api.printyx.net/storage/v1/object/public/files/t1/a.pdf',
        'files',
      ),
    ).toBe('t1/a.pdf');
  });

  it('strips a bucket prefix and a leading slash', () => {
    expect(storageKeyFromValue('files/t1/a.pdf', 'files')).toBe('t1/a.pdf');
    expect(storageKeyFromValue('/t1/a.pdf', 'files')).toBe('t1/a.pdf');
  });

  it('drops a query string so a signed URL still yields the key', () => {
    expect(storageKeyFromValue('/t1/a.pdf?token=abc', 'files')).toBe('t1/a.pdf');
  });
});

describe('eraseSubjectStorageObjects', () => {
  it('reports plainly when no storage client is configured, rather than reporting success', async () => {
    const result = await eraseSubjectStorageObjects(null, 't1', 'user', 'u1');
    expect(result.totalRemoved).toBe(0);
    expect(result.notes.join(' ')).toContain('have NOT been deleted');
  });

  it('deletes the subject objects across more than one bucket', async () => {
    const { client, buckets } = fakeClient({
      tables: {
        files: {
          linkColumn: 'uploaded_by',
          rows: [
            { uploaded_by: 'u1', storage_path: 't1/contract.pdf' },
            { uploaded_by: 'someone-else', storage_path: 't1/other.pdf' },
          ],
        },
        meeting_recordings: {
          linkColumn: 'uploaded_by',
          rows: [{ uploaded_by: 'u1', recording_url: 'meeting-recordings/t1/call.mp3' }],
        },
      },
      buckets: {
        files: ['t1/contract.pdf', 't1/other.pdf'],
        'meeting-recordings': ['t1/call.mp3'],
      },
    });

    const result = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');

    expect(result.totalRemoved).toBe(2);
    // The subject's objects are genuinely gone...
    expect(buckets.files.has('t1/contract.pdf')).toBe(false);
    expect(buckets['meeting-recordings'].has('t1/call.mp3')).toBe(false);
    // ...and someone else's are untouched.
    expect(buckets.files.has('t1/other.pdf')).toBe(true);
  });

  it('is idempotent: a second run finds nothing and reports zero', async () => {
    const { client } = fakeClient({
      tables: { files: { linkColumn: 'uploaded_by', rows: [] } },
      buckets: { files: [] },
    });
    const first = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');
    const second = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');
    expect(first.totalRemoved).toBe(0);
    expect(second.totalRemoved).toBe(0);
  });

  it('reports a failed removal as failed instead of counting it erased', async () => {
    const { client, buckets } = fakeClient({
      tables: {
        files: {
          linkColumn: 'uploaded_by',
          rows: [{ uploaded_by: 'u1', storage_path: 't1/contract.pdf' }],
        },
      },
      buckets: { files: ['t1/contract.pdf'] },
      removeFails: true,
    });

    const result = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');

    expect(result.totalRemoved).toBe(0);
    expect(result.buckets.some((b) => b.failed > 0)).toBe(true);
    expect(result.notes.join(' ')).toContain('INCOMPLETE');
    expect(buckets.files.has('t1/contract.pdf')).toBe(true);
  });

  it('says so when a drift table is absent rather than claiming a clean sweep', async () => {
    const { client } = fakeClient({ tables: {}, buckets: {} });
    const result = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');
    const filesOutcome = result.buckets.find((b) => b.bucket === 'files');
    expect(filesOutcome?.skipped).toContain('does not exist');
  });

  it('warns when no subject link column can be resolved on a table that does exist', async () => {
    const { client } = fakeClient({
      // The table exists but links rows by a column none of the candidates match.
      tables: { files: { linkColumn: 'some_unexpected_column', rows: [] } },
      buckets: { files: ['t1/orphan.pdf'] },
    });

    const result = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');
    const outcome = result.buckets.find((b) => b.bucket === 'files');
    expect(outcome?.skipped).toContain('could NOT be tied');
    expect(result.notes.join(' ')).toContain('could not be linked to this subject');
  });

  it('excludes tenant-level buckets with a stated reason, not silently', async () => {
    const { client } = fakeClient({ tables: {}, buckets: {} });
    const result = await eraseSubjectStorageObjects(client, 't1', 'user', 'u1');

    const branding = result.buckets.find((b) => b.bucket === 'branding-assets');
    expect(branding?.skipped).toContain('not personal data');
    const blog = result.buckets.find((b) => b.bucket === 'blog-assets');
    expect(blog?.skipped).toContain('Marketing content');
  });

  it('does not touch user-only buckets for a customer subject', async () => {
    const { client } = fakeClient({
      tables: {
        meeting_recordings: {
          linkColumn: 'uploaded_by',
          rows: [{ uploaded_by: 'c1', recording_url: 't1/call.mp3' }],
        },
      },
      buckets: { 'meeting-recordings': ['t1/call.mp3'] },
    });

    const result = await eraseSubjectStorageObjects(client, 't1', 'customer', 'c1');
    const recordings = result.buckets.find((b) => b.bucket === 'meeting-recordings');
    expect(recordings?.skipped).toContain("Not applicable to a 'customer' subject");
  });
});
