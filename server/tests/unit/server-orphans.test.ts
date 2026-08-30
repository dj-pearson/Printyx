/**
 * The server had no reachability walk, and it cost the same thing three times.
 *
 * check:orphan-files answers "can a user reach this file?" for client/src.
 * There was no server equivalent, so the question got answered by hand and the
 * answer thrown away, over and over - which is precisely the history AUDIT-018
 * records for the client side before that ratchet existed:
 *
 *   - Ten *-reporting-service.ts files, 5,839 lines, that nothing imported.
 *   - team-alert-service.ts, 629 lines over four real tables, no importer.
 *   - security-index.ts, the ONLY mount site for session-timeout, ip-whitelist
 *     and mfa-enforcement, imported by nothing.
 *
 * That last one is why one-level grep is not enough. session-timeout.ts HAS an
 * importer and is not an orphan; its enforcement middleware is still never
 * mounted, because the importer takes only its helper functions. File-reachable
 * is not middleware-mounted, and the guard's header says so.
 *
 * These assertions cover the walk's contract, not its output count - the
 * baseline is the ratchet. Comments are stripped where a file's own text is
 * matched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const baseline = JSON.parse(read('docs/server-orphans-baseline.json'));
const orphans: string[] = baseline.orphans;
const bare = new Set(orphans.map((o) => o.replace(' (test-only)', '')));

describe('the guard', () => {
  it('exists, is CI-wired, and passes by exit code', () => {
    expect(existsSync(join(repo, 'scripts/check-server-orphans.mjs'))).toBe(true);
    expect(read('.github/workflows/ci.yml')).toContain('check:server-orphans');
    execFileSync('node', [join(repo, 'scripts/check-server-orphans.mjs')], { cwd: repo });
  });

  it('walks from the process entry, not from a route table', () => {
    const guard = read('scripts/check-server-orphans.mjs');
    expect(guard).toMatch(/const ENTRY = join\(SERVER, 'index\.ts'\)/);
  });

  it('follows the registry dynamic mounts, whose specifier is a variable', () => {
    // routes-registry mounts a dozen routers through
    // `for (const [path, mod] of table) await import(mod)`, so a scan for
    // import(' finds none of them.
    const guard = read('scripts/check-server-orphans.mjs');
    expect(guard).toMatch(/import\\\(\\s\*\[A-Za-z_\$\]/);
  });
});

describe('the walk agrees with what is known to be live', () => {
  it.each([
    'server/routes-registry.ts',
    'server/routes.ts',
    'server/storage.ts',
    'server/middleware/tenancy.ts',
    'server/middleware/supabase-auth.ts',
    'server/services/customer-portal-service.ts',
  ])('does not call %s an orphan', (file) => {
    expect(bare.has(file)).toBe(false);
  });

  it.each([
    'server/middleware/security-index.ts',
    'server/services/team-alert-service.ts',
    'server/services/warehouse-reporting-service.ts',
  ])('reports %s, which nothing reaches', (file) => {
    expect(bare.has(file)).toBe(true);
  });

  it('is transitive: a file reachable only from an orphan is an orphan', () => {
    // warehouse-reporting-service HAS an importer - team-alert-service - and
    // that importer has none. A one-level grep calls it used.
    expect(bare.has('server/services/warehouse-reporting-service.ts')).toBe(true);
    expect(read('server/services/team-alert-service.ts')).toContain('WarehouseReportingService');
  });

  it('does not report session-timeout, which a live file imports', () => {
    // The distinction the guard cannot make, and the annotation must: this file
    // is reached, and its enforcement middleware is still never mounted.
    expect(bare.has('server/middleware/session-timeout.ts')).toBe(false);
    const sessionRoutes = stripComments(read('server/routes-session-management.ts'));
    expect(sessionRoutes).toContain('getActiveSessions');
    expect(sessionRoutes).not.toContain('enforceSessionTimeout');
  });
});

describe('the unapplied security controls are recorded', () => {
  it('says so in the file that would mount them', () => {
    const index = read('server/middleware/security-index.ts');
    expect(index).toContain('NOTHING IMPORTS THIS FILE');
    for (const control of [
      'enforceSessionTimeout',
      'enforceIpWhitelist',
      'requireMfaForAdmins',
      'requireMfaVerification',
    ]) {
      expect(index).toContain(control);
    }
  });

  // This assertion is meant to FAIL the day someone mounts one of these. That
  // is the point: enabling a control that 403s admins without MFA is a
  // behaviour change, and it should not be able to land without a reader
  // noticing that this test, and the annotation it guards, need updating.
  it('none of them is mounted anywhere else', () => {
    for (const file of ['server/index.ts', 'server/routes.ts', 'server/routes-registry.ts']) {
      const source = stripComments(read(file));
      for (const control of [
        'enforceSessionTimeout',
        'enforceIpWhitelist',
        'requireMfaForAdmins',
      ]) {
        expect(source).not.toContain(control);
      }
    }
  });

  it('leaves API versioning alone, which IS mounted directly', () => {
    // The one control from that module that works, so the finding is not
    // overstated.
    expect(stripComments(read('server/routes.ts'))).toContain('apiVersioning()');
  });
});
