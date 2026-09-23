/**
 * Round 154: /api/audit-logs runs on one host.
 *
 * routes-audit-logs.ts answered dev with the same { logs, pagination } shape the
 * edge function answers production, but accepted any `limit` and fell back to
 * an x-tenant-id header for the tenant. It is deleted and the prefix proxied.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('audit logs', () => {
  it('is proxied and has no Express route left', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/audit-logs': 'audit-logs'/);
    expect(existsSync('server/routes-audit-logs.ts')).toBe(false);
    expect(stripComments(readFileSync('server/routes-registry.ts', 'utf8'))).not.toMatch(
      /registerAuditLogRoutes/,
    );
  });

  it('the edge function caps the page size and scopes to the caller tenant', () => {
    const fn = stripComments(readFileSync('supabase/functions/audit-logs/index.ts', 'utf8'));
    expect(fn).toMatch(/Math\.min\(200,/);
    expect(fn).toMatch(/\.eq\('tenant_id', auth\.tenantId\)/);
    expect(fn).not.toMatch(/x-tenant-id/);
  });
});

describe('software products', () => {
  it('is proxied and has no Express router left', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/software-products': 'software-products'/);
    expect(existsSync('server/routes-software-products.ts')).toBe(false);
  });

  it('the edge function serves every path the page calls', () => {
    const fn = stripComments(readFileSync('supabase/functions/software-products/index.ts', 'utf8'));
    for (const seg of ['import', 'dedupe', 'bulk-delete']) {
      expect(fn).toContain(`'${seg}'`);
    }
  });
});
