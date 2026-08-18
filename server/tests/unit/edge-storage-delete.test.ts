/**
 * Unit Tests: supabase/functions/_shared/storage-delete.ts (LEGAL-003)
 *
 * The bug this guards against is not "we forgot to call remove()". It is that
 * `await client.storage.from(b).remove(keys)` LOOKS like it handles failure and
 * does not: supabase-js returns errors in `{ data, error }` instead of throwing,
 * so discarding the return value converts every storage failure into a silent
 * success and the endpoint reports a deletion that never happened.
 *
 * So the assertions that matter here are the negative ones: a failing storage
 * layer must produce ok === false, never a cheerful no-op.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeStoragePath,
  removeStorageObjects,
  removeStoragePrefix,
} from '../../../supabase/functions/_shared/storage-delete';

/** Fake storage client. `remove` echoes back what it "deleted" like the real one. */
function fakeClient(
  opts: {
    removeError?: string;
    removeThrows?: boolean;
    /** Names the bucket confirms; undefined means "confirm everything asked". */
    confirms?: string[];
    listResult?: Array<{ name: string }>;
    listError?: string;
  } = {},
) {
  const calls: { removed: string[][]; listed: string[] } = { removed: [], listed: [] };
  const client = {
    storage: {
      from() {
        return {
          async remove(paths: string[]) {
            calls.removed.push(paths);
            if (opts.removeThrows) throw new Error('network down');
            if (opts.removeError) return { data: null, error: { message: opts.removeError } };
            const names = opts.confirms ?? paths;
            return { data: names.map((n) => ({ name: n })), error: null };
          },
          async list(prefix: string) {
            calls.listed.push(prefix);
            if (opts.listError) return { data: null, error: { message: opts.listError } };
            return { data: opts.listResult ?? [], error: null };
          },
        };
      },
    },
  };
  return { client: client as never, calls };
}

describe('normalizeStoragePath', () => {
  it('strips leading slashes, which are a different object to the storage API', () => {
    expect(normalizeStoragePath('/tenant/a/file.pdf')).toBe('tenant/a/file.pdf');
    expect(normalizeStoragePath('///tenant/a/file.pdf')).toBe('tenant/a/file.pdf');
  });

  it('strips a redundant bucket prefix when the row stored bucket/key', () => {
    expect(normalizeStoragePath('files/tenant/a.pdf', 'files')).toBe('tenant/a.pdf');
    expect(normalizeStoragePath('/files/tenant/a.pdf', 'files')).toBe('tenant/a.pdf');
  });

  it('leaves a key that merely starts with similar text alone', () => {
    expect(normalizeStoragePath('filesystem/a.pdf', 'files')).toBe('filesystem/a.pdf');
  });

  it('treats empty and whitespace input as no path', () => {
    expect(normalizeStoragePath('')).toBe('');
    expect(normalizeStoragePath('   ')).toBe('');
  });
});

describe('removeStorageObjects', () => {
  it('reports failure when the storage layer returns an error', async () => {
    const { client } = fakeClient({ removeError: 'permission denied' });
    const result = await removeStorageObjects(client, 'files', ['tenant/a.pdf']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(result.failed).toEqual(['tenant/a.pdf']);
  });

  it('reports failure instead of throwing when the client throws', async () => {
    const { client } = fakeClient({ removeThrows: true });
    const result = await removeStorageObjects(client, 'files', ['tenant/a.pdf']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });

  it('reports failure when storage confirms fewer objects than were requested', async () => {
    const { client } = fakeClient({ confirms: ['tenant/a.pdf'] });
    const result = await removeStorageObjects(client, 'files', ['tenant/a.pdf', 'tenant/b.pdf']);
    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['tenant/b.pdf']);
  });

  it('succeeds and normalizes the keys it sends', async () => {
    const { client, calls } = fakeClient();
    const result = await removeStorageObjects(client, 'files', ['/tenant/a.pdf']);
    expect(result.ok).toBe(true);
    expect(calls.removed[0]).toEqual(['tenant/a.pdf']);
  });

  it('is a no-op success when the row has no object attached', async () => {
    const { client, calls } = fakeClient();
    const result = await removeStorageObjects(client, 'files', [null, undefined, '']);
    expect(result.ok).toBe(true);
    expect(result.removed).toEqual([]);
    expect(calls.removed).toHaveLength(0);
  });
});

describe('removeStoragePrefix', () => {
  it('removes every object found under the prefix', async () => {
    const { client, calls } = fakeClient({
      listResult: [{ name: 'logo-1.png' }, { name: 'logo-2.png' }],
    });
    const result = await removeStoragePrefix(client, 'branding-assets', 'tenant/profile');
    expect(result.ok).toBe(true);
    expect(calls.removed[0]).toEqual(['tenant/profile/logo-1.png', 'tenant/profile/logo-2.png']);
  });

  it('keeps an excluded key so an upload can clear only its predecessors', async () => {
    const { client, calls } = fakeClient({
      listResult: [{ name: 'logo-old.png' }, { name: 'logo-new.png' }],
    });
    await removeStoragePrefix(client, 'branding-assets', 'tenant/profile', [
      'tenant/profile/logo-new.png',
    ]);
    expect(calls.removed[0]).toEqual(['tenant/profile/logo-old.png']);
  });

  it('refuses an empty prefix rather than clearing a whole bucket', async () => {
    const { client, calls } = fakeClient();
    const result = await removeStoragePrefix(client, 'branding-assets', '/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('empty prefix');
    expect(calls.removed).toHaveLength(0);
  });

  it('reports a listing failure instead of claiming success', async () => {
    const { client } = fakeClient({ listError: 'bucket not found' });
    const result = await removeStoragePrefix(client, 'branding-assets', 'tenant/profile');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bucket not found');
  });

  it('succeeds when the prefix is already empty', async () => {
    const { client, calls } = fakeClient({ listResult: [] });
    const result = await removeStoragePrefix(client, 'branding-assets', 'tenant/profile');
    expect(result.ok).toBe(true);
    expect(calls.removed).toHaveLength(0);
  });
});
