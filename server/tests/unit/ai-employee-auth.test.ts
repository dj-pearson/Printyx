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
    // Scoped to the router's own resource, exactly as ai-employee-routes now does.
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

describe('AUDIT-015: ai-employee-routes source no longer fabricates identity', () => {
  const src = readSource();
  function readSource() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node:fs').readFileSync('server/routes/ai-employee-routes.ts', 'utf8') as string;
  }
  /**
   * Strip comments so the explanatory block describing the OLD bug isn't matched.
   *
   * ORDER MATTERS: line comments must go FIRST. The doc comment in that router
   * contains the text "/api/*", and a block-comment regex run first would treat that
   * "/*" as an opening delimiter and swallow everything up to the next "*\/" —
   * including the very `router.use(...)` line these tests assert on. (TypeScript is
   * unbothered: inside a // line, "/api/*" is not a comment opener. A regex that
   * disagrees with the real lexer is exactly the AUDIT-003 lesson, in miniature.)
   */
  const code = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('contains no mock identity in executable code', () => {
    expect(code).not.toContain('mock-tenant-id');
    expect(code).not.toContain('mock-user-id');
  });

  it('never reads identity off the request without the helpers', () => {
    expect(code).not.toMatch(/\(req as any\)\.tenantId/);
    expect(code).not.toMatch(/\(req as any\)\.userId/);
  });

  it('requires auth, and scopes that middleware to its own path', () => {
    expect(code).toContain("router.use('/ai-employees', requireAuth)");
    // No pathless router.use — that is what caused the leak.
    expect(code).not.toMatch(/router\.use\(\s*\(/);
  });

  it('resolves identity via the canonical auth helpers', () => {
    expect(code).toMatch(/getTenantId\(req\)/);
    expect(code).toMatch(/getUserId\(req\)/);
  });
});
