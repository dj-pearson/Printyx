// Round 167 (route-divergence: root-admin).
//
// 1. Every handler in server/routes-root-admin.ts is gated. The two
//    /security/* handlers were not, so any authenticated member of any tenant
//    could list every locked account and clear any lockout (login_attempts has
//    no tenant_id).
// 2. Every /api/root-admin path a client calls resolves in dev: either this
//    router registers it, or a scoped crmProxies entry forwards it to the edge
//    function production already uses. Five used to 404 in dev only.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const ROUTER = strip(readFileSync('server/routes-root-admin.ts', 'utf8'));
const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

describe('routes-root-admin.ts', () => {
  const registrations = [
    ...ROUTER.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'([^]*?)async/g),
  ];

  it('registers a meaningful number of handlers (floor)', () => {
    expect(registrations.length).toBeGreaterThanOrEqual(10);
  });

  it('gates every handler with requireRootAdmin', () => {
    const ungated = registrations
      .filter((m) => !/\brequireRootAdmin\b/.test(m[3]))
      .map((m) => `${m[1].toUpperCase()} ${m[2]}`);
    expect(ungated).toEqual([]);
  });

  it('includes the two security handlers in that walk', () => {
    const paths = registrations.map((m) => m[2]);
    expect(paths).toContain('/security/locked-accounts');
    expect(paths).toContain('/security/unlock-account');
  });
});

describe('/api/root-admin client paths resolve in dev', () => {
  const expressPaths = new Set(
    [...ROUTER.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m) => m[1]),
  );
  const proxied = new Set(
    [...PROXY.matchAll(/'\/api\/root-admin\/([a-z-]+)':\s*\{\s*fn:\s*'root-admin'/g)].map(
      (m) => m[1],
    ),
  );

  const called = new Set<string>();
  for (const f of walk('client/src')) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\/api\/root-admin\/([a-z-]+)/g)) called.add(m[1]);
  }

  it('finds the client calls (floor)', () => {
    expect(called.size).toBeGreaterThanOrEqual(10);
  });

  it('each is registered on Express or proxied to the edge function', () => {
    const unserved = [...called].filter((seg) => !expressPaths.has('/' + seg) && !proxied.has(seg));
    expect(unserved).toEqual([]);
  });

  it('does not proxy a path Express deliberately keeps', () => {
    for (const seg of ['system-resources', 'database-tables', 'execute-query']) {
      expect(proxied.has(seg)).toBe(false);
    }
  });

  it('the edge function serves every proxied segment', () => {
    const edge = strip(readFileSync('supabase/functions/root-admin/index.ts', 'utf8'));
    for (const seg of proxied) expect(edge).toContain(`endpoint === '${seg}'`);
  });
});

describe('round 178: the four paths both hosts served now have one', () => {
  const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
  const ROUTER = strip(readFileSync('server/routes-root-admin.ts', 'utf8'));

  it.each(['overview', 'tenants', 'security-alerts', 'audit-logs'])('%s', (seg) => {
    expect(PROXY).toMatch(
      new RegExp(
        `'/api/root-admin/${seg}':\\s*\\{\\s*fn:\\s*'root-admin',\\s*pathPrefix:\\s*'/${seg}'`,
      ),
    );
    expect(ROUTER).not.toMatch(new RegExp(`router\\.get\\(\\s*'/${seg}'`));
  });

  it('keeps the direct-SQL paths on Express', () => {
    for (const seg of ['system-resources', 'database-tables']) {
      expect(ROUTER).toMatch(new RegExp(`router\\.get\\(\\s*'/${seg}'`));
    }
    expect(ROUTER).toMatch(/router\.post\(\s*'\/execute-query'/);
  });
});
