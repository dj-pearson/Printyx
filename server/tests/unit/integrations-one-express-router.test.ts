// Round 176 (route-divergence: integrations). server/routes-integrations.ts
// mounted ahead of server/integrations/routes.ts and won GET /api/integrations,
// PUT /:id and POST /:id/test, so PA-053's handlers over platform_integrations
// never ran in dev: the list read system_integrations, and the test route
// wrote status 'connected' and answered 'Connection test successful' without
// testing anything. It is deleted, as is the importer-less
// routes-integrations-real.ts.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'tests' || e === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.ts')) out.push(p);
  }
  return out;
}

const SOURCES = walk('server').map((f) => [f, strip(readFileSync(f, 'utf8'))] as const);

/** Files registering `method path` where :params are compared by position only. */
function registrants(method: string, path: string): string[] {
  const shape = path.replace(/:[A-Za-z]+/g, ':p');
  return SOURCES.filter(([, src]) =>
    [...src.matchAll(new RegExp(`\\.${method}\\(\\s*'(\\/api\\/integrations[^']*)'`, 'g'))].some(
      (m) => m[1].replace(/:[A-Za-z]+/g, ':p') === shape,
    ),
  ).map(([f]) => f);
}

describe('each /api/integrations path the pages call has one Express registrant', () => {
  it('walks the server tree (floor)', () => {
    expect(SOURCES.length).toBeGreaterThan(200);
  });

  it.each([
    ['get', '/api/integrations'],
    ['put', '/api/integrations/:id'],
    ['post', '/api/integrations/:id/test'],
    ['post', '/api/integrations/:id/disconnect'],
  ])('%s %s', (method, path) => {
    expect(registrants(method, path)).toEqual(['server/integrations/routes.ts']);
  });

  it('the shadowing router and the orphan are gone', () => {
    expect(existsSync('server/routes-integrations.ts')).toBe(false);
    expect(existsSync('server/routes-integrations-real.ts')).toBe(false);
    const registry = strip(readFileSync('server/routes-registry.ts', 'utf8'));
    expect(registry).not.toMatch(/registerIntegrationRoutes/);
  });

  it('the surviving test route never claims a connection it did not make', () => {
    const src = strip(readFileSync('server/integrations/routes.ts', 'utf8'));
    expect(src).toMatch(/connectivityVerified: false/);
    expect(src).not.toMatch(/Connection test successful/);
  });
});
