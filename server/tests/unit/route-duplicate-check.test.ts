import { describe, it, expect, vi } from 'vitest';
import type { Express } from 'express';
import { findDuplicateRoutes, warnOnDuplicateRoutes } from '../../lib/route-duplicate-check';

// Build a fake Express app whose _router.stack mimics registered route layers.
function fakeApp(routes: Array<{ path: string; methods: string[] }>): Express {
  const stack = routes.map((r) => ({
    route: {
      path: r.path,
      methods: Object.fromEntries(r.methods.map((m) => [m, true])),
    },
  }));
  return { _router: { stack } } as unknown as Express;
}

describe('findDuplicateRoutes (CR-018)', () => {
  it('returns nothing when every method+path is unique', () => {
    const app = fakeApp([
      { path: '/api/a', methods: ['get'] },
      { path: '/api/a', methods: ['post'] }, // same path, different method — not a dup
      { path: '/api/b', methods: ['get'] },
    ]);
    expect(findDuplicateRoutes(app)).toEqual([]);
  });

  it('detects a duplicate method+path registered by two modules', () => {
    const app = fakeApp([
      { path: '/api/software-products', methods: ['get'] },
      { path: '/api/software-products', methods: ['get'] },
    ]);
    const dups = findDuplicateRoutes(app);
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ method: 'GET', path: '/api/software-products', count: 2 });
  });

  it('handles a path (like /api/tasks/:id) registered 3 times', () => {
    const app = fakeApp([
      { path: '/api/tasks/:id', methods: ['patch'] },
      { path: '/api/tasks/:id', methods: ['patch'] },
      { path: '/api/tasks/:id', methods: ['patch'] },
    ]);
    expect(findDuplicateRoutes(app)[0].count).toBe(3);
  });

  it('warnOnDuplicateRoutes logs one warning per duplicate and never throws', () => {
    const warn = vi.fn();
    const app = fakeApp([
      { path: '/api/mobile/dashboard', methods: ['get'] },
      { path: '/api/mobile/dashboard', methods: ['get'] },
    ]);
    const dups = warnOnDuplicateRoutes(app, { warn });
    expect(dups).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('/api/mobile/dashboard');
  });

  it('tolerates a missing router (never throws)', () => {
    const warn = vi.fn();
    expect(() => warnOnDuplicateRoutes({} as Express, { warn })).not.toThrow();
  });
});
