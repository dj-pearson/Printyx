/**
 * Integration: file deletion actually removes the bytes (LEGAL-003)
 *
 * Drives the real edge handlers with a fake Supabase client whose storage
 * bucket is a Map with genuine state, so "the object is gone" is asserted by
 * looking for it afterwards rather than by counting mock calls.
 *
 * Both handlers are covered because they are NOT duplicates: file-storage owns
 * the `files` table with a `storage_path` column, files owns `file_uploads`
 * with `file_path`. Neither table appears in any Drizzle schema or migration -
 * they are drift tables reachable only through these functions - which is part
 * of why the leak went unnoticed.
 *
 * The failure cases matter more than the happy paths. Before this story, a
 * storage failure still returned "File deleted" while the object stayed in the
 * bucket, because supabase-js reports errors in `{ data, error }` rather than
 * throwing and the return value was discarded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The shared factory imports supabase-js from an https:// URL that vitest
// cannot resolve, and calls Deno.env at module scope. Replace it wholesale.
const state = {
  bucket: new Map<string, string>(),
  rows: new Map<string, Record<string, unknown>>(),
  storageFails: false,
  table: 'files',
  pathColumn: 'storage_path',
};

function fakeAdmin() {
  return {
    from(table: string) {
      const api = {
        _filters: {} as Record<string, unknown>,
        select() {
          return api;
        },
        eq(col: string, val: unknown) {
          api._filters[col] = val;
          return api;
        },
        single() {
          const row = state.rows.get(String(api._filters.id));
          return Promise.resolve({
            data: row ?? null,
            error: row ? null : { message: 'not found' },
          });
        },
        delete() {
          const del = {
            _f: {} as Record<string, unknown>,
            eq(col: string, val: unknown) {
              del._f[col] = val;
              return del;
            },
            then(resolve: (v: unknown) => void) {
              if (table === state.table) state.rows.delete(String(del._f.id));
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return del;
        },
      };
      return api;
    },
    storage: {
      from() {
        return {
          remove(keys: string[]) {
            if (state.storageFails) {
              return Promise.resolve({ data: null, error: { message: 'permission denied' } });
            }
            const removed: Array<{ name: string }> = [];
            for (const k of keys) {
              if (state.bucket.delete(k)) removed.push({ name: k });
            }
            return Promise.resolve({ data: removed, error: null });
          },
        };
      },
    },
  };
}

vi.mock('../../../supabase/functions/_shared/supabase.ts', () => ({
  createSupabaseClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'user-1', app_metadata: { tenant_id: 'tenant-1' } } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => fakeAdmin(),
}));

// cors.ts reads Deno.env inside its functions.
(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

function deleteRequest(fn: string, id: string) {
  return new Request(`https://functions.printyx.net/${fn}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer test-jwt' },
  });
}

describe('LEGAL-003: file-storage DELETE removes the object', () => {
  beforeEach(() => {
    state.bucket = new Map([['tenant-1/report.pdf', 'bytes']]);
    state.rows = new Map([['file-1', { id: 'file-1', storage_path: 'tenant-1/report.pdf' }]]);
    state.storageFails = false;
    state.table = 'files';
  });

  it('deletes the bytes, not just the row', async () => {
    const handler = (await import('../../../supabase/functions/file-storage/index.ts')).default;
    const res = await handler(deleteRequest('file-storage', 'file-1'));

    expect(res.status).toBe(200);
    // The object is genuinely absent from the bucket afterwards.
    expect(state.bucket.has('tenant-1/report.pdf')).toBe(false);
    expect(state.rows.has('file-1')).toBe(false);
  });

  it('refuses to drop the row when storage removal fails, so nothing is orphaned', async () => {
    state.storageFails = true;
    const handler = (await import('../../../supabase/functions/file-storage/index.ts')).default;
    const res = await handler(deleteRequest('file-storage', 'file-1'));

    expect(res.status).toBe(500);
    // Crucially: the row survives, so the object still has a reference pointing
    // at it and the delete can be retried. A silent success here is the bug.
    expect(state.rows.has('file-1')).toBe(true);
    expect(state.bucket.has('tenant-1/report.pdf')).toBe(true);
  });
});

describe('LEGAL-003: files DELETE removes the object', () => {
  beforeEach(() => {
    state.bucket = new Map([['tenant-1/scan.png', 'bytes']]);
    state.rows = new Map([['up-1', { id: 'up-1', file_path: '/tenant-1/scan.png' }]]);
    state.storageFails = false;
    state.table = 'file_uploads';
  });

  it('normalizes a leading-slash path and deletes the bytes', async () => {
    const handler = (await import('../../../supabase/functions/files/index.ts')).default;
    const res = await handler(deleteRequest('files', 'up-1'));

    expect(res.status).toBe(200);
    // The row stored "/tenant-1/scan.png"; the bucket key has no leading slash.
    // Without normalization this remove is a silent no-op.
    expect(state.bucket.has('tenant-1/scan.png')).toBe(false);
  });

  it('reports a storage failure instead of claiming the file was deleted', async () => {
    state.storageFails = true;
    const handler = (await import('../../../supabase/functions/files/index.ts')).default;
    const res = await handler(deleteRequest('files', 'up-1'));

    expect(res.status).toBe(500);
    expect(state.rows.has('up-1')).toBe(true);
    expect(state.bucket.has('tenant-1/scan.png')).toBe(true);
  });
});
