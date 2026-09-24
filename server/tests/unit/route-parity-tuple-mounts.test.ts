/**
 * Round 238: routes-registry mounts eleven routers through tuple tables -
 * `['/api/x', './routes/x-routes']` looped into app.use(mountPath, router) -
 * and route-parity never read them, because the router's own paths are
 * relative to the mount. automated-billing, mileage, gps, extension and billing
 * were invisible to check:routes, check:uncalled-express and
 * check:route-divergence. The set of tuples is derived from the registry here
 * rather than listed, so the next table entry is covered too.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
// @ts-expect-error - plain .mjs module without types
import { computeParity } from '../../../scripts/lib/route-parity.mjs';

const repo = process.cwd();
const registry = readFileSync('server/routes-registry.ts', 'utf8')
  .replace(/(?<![:/])\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const tuples = [...registry.matchAll(/\[\s*'\/api\/([a-z0-9-]+)'\s*,\s*'(\.\/[^']+)'/g)]
  .map((m) => ({ domain: m[1], mod: m[2] }))
  .filter(({ mod }) => existsSync(join(repo, 'server', `${mod}.ts`)));

describe('route-parity tuple mounts', () => {
  const { expressServed } = computeParity(repo);

  it('finds the tuple tables at all', () => {
    expect(tuples.length).toBeGreaterThanOrEqual(10);
  });

  it('counts every tuple-mounted domain as Express-served', () => {
    const missing = tuples.filter(({ domain }) => !expressServed.has(domain)).map((t) => t.domain);
    expect(missing).toEqual([]);
  });

  it('includes the ones every guard used to miss', () => {
    for (const d of ['automated-billing', 'mileage', 'gps', 'route-optimization']) {
      expect(expressServed.has(d)).toBe(true);
    }
  });

  it('records the Chrome extension as the caller of /api/extension', () => {
    const src = readFileSync('scripts/check-uncalled-express-routes.mjs', 'utf8');
    expect(src).toMatch(/\bextension:\s*\n?\s*'printyx-extension\//);
    expect(readFileSync('printyx-extension/lib/api-client.js', 'utf8')).toMatch(
      /\/api\/extension\//,
    );
  });
});
