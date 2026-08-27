import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * CR-033 regression. mobile-logger builds its singleton at import time, so a
 * throw in the constructor happens at MODULE SCOPE and takes down every module
 * that imports it — queryClient.ts does, so that is most of the client.
 *
 * The environment that broke it is not a browser and not plain Node, but the one
 * in between: a global `window` with no `document` and no `window.location`.
 * That is what this repo's vitest suite produces (every file shares one fork and
 * something in it defines a bare window), which made
 * server/tests/unit/crm-kpi-pagination.test.ts fail about half the time while
 * passing in isolation. Patching one guard at a time just moved the throw to the
 * next line, so this pins the whole shape rather than a single call site.
 */
describe('mobile-logger survives a partial DOM', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function importFresh() {
    vi.resetModules();
    return import('./mobile-logger');
  }

  it('imports in plain Node, with no browser globals at all', async () => {
    await expect(importFresh()).resolves.toBeDefined();
  });

  it('imports with a window that has no document and no location', async () => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    const mod = await importFresh();
    expect(mod.mobileLogger).toBeDefined();
  });

  it('imports with a window and document but still no location', async () => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
    const mod = await importFresh();
    expect(mod.mobileLogger).toBeDefined();
  });

  it('logging does not throw when location is missing', async () => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    const { mobileLogger } = await importFresh();
    expect(() => mobileLogger.info('hello', { a: 1 })).not.toThrow();
    expect(() => mobileLogger.error('bad', { b: 2 })).not.toThrow();
  });
});
