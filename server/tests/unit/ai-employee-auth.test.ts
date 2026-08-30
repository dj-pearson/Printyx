/**
 * AUDIT-015 — regression guard for the ai-employee router's auth stub.
 *
 * The router used to do this, mounted at app.use('/api', ...):
 *
 *   router.use((req, res, next) => {
 *     (req as any).userId  = 'mock-user-id';
 *     (req as any).tenantId = 'mock-tenant-id';
 *     next();
 *   });
 *
 * Two defects, and the second is the dangerous one:
 *   1. No authentication on a live /api router.
 *   2. The `router.use` had NO PATH, so it ran for EVERY /api/* request that reached
 *      this router and then fell through to everything mounted after it. Because
 *      getTenantId()'s first priority is `req.tenantId`, unrelated endpoints
 *      (/api/dashboards/today, /api/onboarding/*, /api/notifications/*) resolved the
 *      fabricated tenant instead of the caller's.
 *
 * These tests encode BOTH the Express behaviour that made it dangerous and the shape
 * of the fix, so a future pathless `router.use` on an /api-root router gets caught.
 *
 * PROD-008b: the source scan below no longer names one file. The router this was
 * written for has been retired, but the defect belongs to every /api-root mount,
 * so the guard walks the registry's list instead.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

/** Mirrors getTenantId() priority order in server/utils/auth-helpers.ts. */
function getTenantId(req: any): string | undefined {
  if (req.tenantId) return req.tenantId; // Priority 1 — what the stub poisoned
  if (req.supabaseUser?.tenantId) return req.supabaseUser.tenantId;
  if (req.user?.tenantId) return req.user.tenantId;
  return undefined;
}

/** A downstream /api route registered AFTER the routers, as in routes-registry.ts. */
function buildApp(aiRouter: express.Router) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: 'real-user', tenantId: 'REAL-TENANT' };
    next();
  });
  app.use('/api', aiRouter); // asyncRootApiMounts loop
  app.get('/api/dashboards/today', (req, res) =>
    res.json({ resolvedTenant: getTenantId(req) ?? null }),
  ); // registerTodayDashboardRoutes(app), registered after
  return app;
}

describe('AUDIT-015: the old stub leaked its tenant onto unrelated routes', () => {
  it('reproduces the leak (documents WHY a pathless router.use at /api root is unsafe)', async () => {
    const bad = express.Router();
    bad.use((req, _res, next) => {
      (req as any).userId = 'mock-user-id';
      (req as any).tenantId = 'mock-tenant-id';
      next();
    });
    bad.get('/ai-employees', (_req, res) => res.json({ ok: true }));

    const res = await request(buildApp(bad)).get('/api/dashboards/today');
    // This is the BUG, asserted so the mechanism is unambiguous:
    expect(res.body.resolvedTenant).toBe('mock-tenant-id');
    expect(res.body.resolvedTenant).not.toBe('REAL-TENANT');
  });

  it('a PATH-SCOPED router.use does not leak — this is the fix', async () => {
    const good = express.Router();
    // Scoped to the router's own resource, which is the shape every /api-root
    // router must have.
    good.use('/ai-employees', (req, _res, next) => {
      (req as any).tenantId = 'SCOPED-ONLY';
      next();
    });
    good.get('/ai-employees', (req, res) => res.json({ t: getTenantId(req) }));

    const leaked = await request(buildApp(good)).get('/api/dashboards/today');
    expect(leaked.body.resolvedTenant).toBe('REAL-TENANT'); // untouched

    const own = await request(buildApp(good)).get('/api/ai-employees');
    expect(own.body.t).toBe('SCOPED-ONLY'); // still applies to its own paths
  });
});

describe('AUDIT-015: no /api-root router fabricates or leaks identity', () => {
  /**
   * PROD-008b generalized this. It used to read server/routes/ai-employee-routes.ts
   * by name and assert that one file. That router has been retired — its handlers
   * were shadowed by the /api/ai-employees proxy and the ai-employee edge function
   * covers all ten — but the DEFECT it guarded against is a property of every
   * router mounted at the /api root, not of that one file. So the guard now walks
   * the whole asyncRootApiMounts list instead of dying with its subject.
   *
   * Comment-stripping ORDER MATTERS: line comments must go FIRST. A doc comment
   * containing "/api/*" would otherwise be read as an opening block delimiter by a
   * block-comment regex run first, swallowing everything to the next "*\/" —
   * including the router.use lines these tests assert on. TypeScript is unbothered:
   * inside a // line, "/api/*" is not a comment opener. A regex that disagrees with
   * the real lexer is the AUDIT-003 lesson in miniature.
   */
  const fsMod = require('node:fs') as typeof import('node:fs');
  const registry = fsMod.readFileSync('server/routes-registry.ts', 'utf8') as string;

  // The bare './routes/x' entries in the list mounted with app.use('/api', ...).
  const rootMounted = [...registry.matchAll(/^\s*'(\.\/routes\/[^']+)',$/gm)]
    .map((m) => `server/${m[1].replace(/^\.\//, '')}.ts`)
    .filter((p) => fsMod.existsSync(p));

  const strip = (src: string) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('finds the /api-root routers to check', () => {
    // If this drops to zero the rest of the suite passes vacuously.
    expect(rootMounted.length).toBeGreaterThan(0);
  });

  it('none of them fabricates a mock identity in executable code', () => {
    for (const file of rootMounted) {
      const code = strip(fsMod.readFileSync(file, 'utf8') as string);
      expect(code, file).not.toContain('mock-tenant-id');
      expect(code, file).not.toContain('mock-user-id');
    }
  });

  it('none of them writes identity onto the request', () => {
    for (const file of rootMounted) {
      const code = strip(fsMod.readFileSync(file, 'utf8') as string);
      expect(code, file).not.toMatch(/\(req as any\)\.tenantId\s*=/);
      expect(code, file).not.toMatch(/\(req as any\)\.userId\s*=/);
    }
  });

  it('none of them registers a PATHLESS router.use — the leak itself', () => {
    for (const file of rootMounted) {
      const code = strip(fsMod.readFileSync(file, 'utf8') as string);
      expect(code, file).not.toMatch(/router\.use\(\s*\(/);
    }
  });
});
