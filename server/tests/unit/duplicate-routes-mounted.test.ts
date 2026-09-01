/**
 * check:dup-routes can see routers mounted under a prefix (AUDIT-021 follow-up).
 *
 * Express matches the first handler registered for a path, so a duplicate means
 * one copy is dead and the difference between them is silent. The guard existed
 * for that, and could only see literals starting with `/api/` - but a router
 * mounted under a prefix declares its paths WITHOUT it. Nine routers mount at
 * the /api root, and every route in all of them was invisible.
 *
 * That hid three live collisions, two of which had a fixture beating a real
 * handler: GET/POST /api/projects (a hardcoded "Q4 Enterprise Sales Campaign"
 * behind routes-tasks.ts's real read) and GET /api/signature-requests, where a
 * sample-data fixture won over server/routes/signature-routes.ts reading the
 * real signature_requests table.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const guard = read('scripts/check-duplicate-routes.mjs');

describe('the guard resolves mount prefixes', () => {
  it('reads all three registry mount forms', () => {
    expect(guard).toMatch(/function mountPrefixes\(/);
    // [mountPath, modulePath] pairs, the root-mount list, and app.use(prefix, ident).
    expect(guard).toMatch(/asyncRootApiMounts/);
    expect(guard).toMatch(/app\\\.use/);
    expect(guard).toMatch(/MOUNTED_ROUTE_RE/);
  });

  it('parses forms the registry still uses', () => {
    // The resolution is text matching against routes-registry.ts. Renaming the
    // mount table there would blind the guard silently, which is the failure
    // this pairing exists to make loud.
    const registry = read('server/routes-registry.ts');
    expect(registry).toMatch(/asyncRootApiMounts/);
    expect(registry).toMatch(/asyncApiMounts/);
    expect(registry).toMatch(/app\.use\('\/api', /);
  });

  it('only applies the unanchored pattern to a file whose mount point it knows', () => {
    // Otherwise every router.get('/x') in the tree collides with every other.
    expect(guard).toMatch(/const re = prefix \? MOUNTED_ROUTE_RE : ROUTE_RE;/);
  });

  it('reports every duplicate as a full /api path', () => {
    // Deliberately NOT an assertion that some mounted router still collides:
    // that would be an assertion about DEBT, and it would start failing the day
    // the last one is fixed. What must hold is that resolution produces whole
    // paths - a mounted router's bare '/projects' must never reach the report.
    const out = execFileSync('node', [join(repo, 'scripts/check-duplicate-routes.mjs'), '--list'], {
      encoding: 'utf8',
    });
    const paths = [...out.matchAll(/^ {2}(GET|POST|PUT|PATCH|DELETE) (\S+)$/gm)].map((m) => m[2]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path, path).toMatch(/^\/api(\/|$)/);
  });
});

describe('the collisions it exposed are gone', () => {
  it('leaves one owner for /api/projects, and it is the real one', () => {
    const team = read('server/routes/team-collaboration-routes.ts');
    expect(team).not.toMatch(/router\.(get|post)\('\/projects',/);
    expect(read('server/routes-tasks.ts')).toMatch(/app\.get\('\/api\/projects'/);
  });

  it('deletes the signature fixtures rather than the real handler', () => {
    // routes-esignature.ts was unregistered AND a fixture; the sample-data copy
    // was registered and won. The real one reads storage.
    expect(existsSync(join(repo, 'server/routes-esignature.ts'))).toBe(false);
    expect(read('server/routes-sample-data.ts')).not.toMatch(
      /app\.get\('\/api\/signature-(requests|templates|analytics)'/,
    );
    expect(read('server/routes/signature-routes.ts')).toMatch(
      /storage\.getSignatureRequests\(tenantId/,
    );
  });

  it('keeps the nine handlers that only the customization router owns', () => {
    const cust = read('server/routes-dashboard-customization.ts');
    expect(cust).not.toMatch(/router\.get\('\/layouts',/);
    for (const path of ['/widgets', '/layout/:layoutId', '/preferences', '/snapshot']) {
      expect(cust, path).toContain(`'${path}'`);
    }
  });
});
