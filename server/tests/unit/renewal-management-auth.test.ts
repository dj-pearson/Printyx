/**
 * Eighteen handlers, no authentication, and a caller-supplied tenant (WF-S-11).
 *
 * server/routes-renewal-management.ts registered every one of its endpoints
 * with NO middleware and read the tenant from `req.headers['x-tenant-id']` - a
 * value the caller chooses. Anyone who could reach the dev host could read or
 * write any tenant's contract renewals, renewal activities, playbooks and
 * expansion opportunities by picking a header.
 *
 * Nothing calls these (AUDIT-026, re-confirmed here across all eight client
 * trees) and production resolves all four prefixes to edge functions rather
 * than to Express, so the exposure was the dev host only. "Nobody calls it" is
 * not an access control, and this fix holds whichever way AUDIT-026 decides the
 * feature's fate.
 *
 * Read with comments stripped - the file header quotes the header name.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const src = readFileSync(join(repo, 'server/routes-renewal-management.ts'), 'utf8');
const code = src
  .split('\n')
  .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const HANDLER = /app\.(get|post|put|patch|delete)\('(\/api\/[^']*)',\s*([^,]+),/g;

describe('every handler is authenticated', () => {
  const handlers = [...code.matchAll(HANDLER)].map((m) => ({
    method: m[1],
    path: m[2],
    first: m[3].trim(),
  }));

  it('finds all eighteen', () => {
    expect(handlers.length).toBe(18);
  });

  for (const h of [...new Set([...code.matchAll(HANDLER)].map((m) => `${m[1]} ${m[2]}`))]) {
    it(`${h} carries requireAuth`, () => {
      const found = handlers.find((x) => `${x.method} ${x.path}` === h);
      expect(found?.first, h).toBe('requireAuth');
    });
  }
});

describe('the tenant comes from the session, not from the request', () => {
  it('no handler reads x-tenant-id', () => {
    expect(code).not.toContain("req.headers['x-tenant-id']");
  });

  it('all eighteen resolve it through getTenantId', () => {
    expect((code.match(/const tenantId = getTenantId\(req\);/g) ?? []).length).toBe(18);
  });

  it('and every one of them refuses without a tenant', () => {
    // getTenantId returns string | undefined; ten of these had no guard at all
    // because the old cast lied about the type.
    expect((code.match(/if \(!tenantId\) \{/g) ?? []).length).toBe(18);
  });
});

describe('the finding is recorded where the next reader will look', () => {
  it('the file header names the hole and says it is separate from the product call', () => {
    expect(src).toContain('UNAUTHENTICATED UNTIL WF-S-11');
    expect(src).toContain('AUDIT-026');
  });
});
