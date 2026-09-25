/**
 * Round 148: no edge function takes an authorization decision from
 * user_metadata.
 *
 * user_metadata is written by the session holder through
 * supabase.auth.updateUser (SEC-TENANT-003 records the tenant half of this).
 * Eight functions still read a ROLE, a ROLE LEVEL or a platform flag out of it
 * as a fallback, so any member could grant themselves the gate: security
 * (platform-wide, via isPlatformUser), dedup-companies (a destructive
 * platform-admin merge), mfa (resetting another user's second factor),
 * proposals (the QUOTE-006 margin floor and discount ceiling), pricing (dealer
 * cost visibility), saved-views (editing another user's view), lead-scoring and
 * customer-success (manager writes). All now read app_metadata, or roles.level
 * through _shared/rbac.ts resolveRoleLevel.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const AUTHZ_READ =
  /user_metadata\s*(?:as\s+[^)]*\))?\s*\)?\s*\??\.\s*(role|roleLevel|role_level|roleCode|isPlatformAdmin|isPlatformUser|hasAllPermissions|permissions|canAccessAllTenants)\b/;

describe('user_metadata never decides authorization', () => {
  const files = walk('supabase/functions');

  it('walks the whole edge tree', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('the pattern matches the shapes it has to catch', () => {
    expect(AUTHZ_READ.test('user.user_metadata?.roleLevel ??')).toBe(true);
    expect(
      AUTHZ_READ.test('(u?.user_metadata as Record<string, unknown> | undefined)?.role ??'),
    ).toBe(true);
    expect(AUTHZ_READ.test('user.user_metadata?.isPlatformUser === true')).toBe(true);
    expect(AUTHZ_READ.test('user.user_metadata?.first_name')).toBe(false);
  });

  it('no edge file reads a role, level or platform flag from user_metadata', () => {
    const offenders = files.filter((f) => AUTHZ_READ.test(stripComments(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('the rewritten gates go through the shared resolver', () => {
    for (const f of [
      'supabase/functions/security/index.ts',
      'supabase/functions/dedup-companies/index.ts',
      'supabase/functions/mfa/index.ts',
      'supabase/functions/saved-views/index.ts',
      'supabase/functions/lead-scoring/_rbac.ts',
      'supabase/functions/customer-success/_rbac.ts',
      'supabase/functions/proposals/index.ts',
    ]) {
      expect({
        f,
        calls: /resolveRoleLevel\(/.test(stripComments(readFileSync(f, 'utf8'))),
      }).toEqual({
        f,
        calls: true,
      });
    }
  });

  it('every call to an async gate is awaited', () => {
    const gates: Array<[string, RegExp]> = [
      ['supabase/functions/lead-scoring/handlers', /isAdminOrManager\(/g],
      ['supabase/functions/customer-success/handlers', /isManagerOrAbove\(/g],
    ];
    let seen = 0;
    for (const [dir, re] of gates) {
      for (const f of walk(dir)) {
        const src = stripComments(readFileSync(f, 'utf8'));
        for (const m of src.matchAll(re)) {
          seen++;
          expect({ f, at: m.index, awaited: /await\s*$/.test(src.slice(0, m.index)) }).toEqual({
            f,
            at: m.index,
            awaited: true,
          });
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(7);
  });
});
