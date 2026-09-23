/**
 * Round 147: /api/content-gap-analysis.
 *
 * The edge function's admin check read the role and role level from
 * user_metadata as well as app_metadata, and accepted any role string that
 * CONTAINED "admin". user_metadata is written by the session holder
 * (SEC-TENANT-003), so any tenant member could make themselves an admin here.
 * The Express twin could never authenticate at all and fell back to a zero-uuid
 * tenant; it is deleted and the prefix proxied.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const fn = stripComments(readFileSync('supabase/functions/content-gap-analysis/index.ts', 'utf8'));
const gate = fn.slice(fn.indexOf('async function isAdmin('), fn.indexOf('function stripPrefix'));

describe('content-gap-analysis admin gate', () => {
  it('locates the gate', () => {
    expect(gate.length).toBeGreaterThan(40);
  });

  it('never reads user_metadata, which the caller can write', () => {
    expect(fn).not.toMatch(/user_metadata/);
  });

  it('has no substring role match', () => {
    expect(gate).not.toMatch(/\.includes\(/);
  });

  it('resolves the level from the claim or the roles table, at company admin', () => {
    expect(gate).toMatch(/resolveRoleLevel\(createSupabaseServiceClient\(\), auth\.supabaseUser\)/);
    expect(gate).toMatch(/level >= ROLE_LEVEL\.COMPANY_ADMIN/);
  });

  it('awaits the gate before any work', () => {
    const call = fn.indexOf('if (!(await isAdmin(auth)))');
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(fn.indexOf('getDb()'));
  });
});

describe('content-gap-analysis runs on one host', () => {
  it('proxies the prefix and has no Express router or service left', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/content-gap-analysis': 'content-gap-analysis'/);
    expect(existsSync('server/routes/content-gap-analysis-routes.ts')).toBe(false);
    expect(existsSync('server/services/content-gap-analysis-service.ts')).toBe(false);
    const registry = stripComments(readFileSync('server/routes-registry.ts', 'utf8'));
    expect(registry).not.toMatch(/contentGapAnalysisRoutes/);
  });
});
