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
 * importer and is not an orphan; its enforcement middleware was still never
 * mounted, because the importer takes only its helper functions. File-reachable
 * is not middleware-mounted, and the guard's header says so.
 *
 * AUDIT-034 settled that one. All three controls are DELETED, not mounted, and
 * the block at the bottom of this file records why each could not be turned on
 * and asserts the prerequisites are still absent - so it fails the day someone
 * adds the columns rather than going quietly stale. The walk's contract
 * assertions above are unchanged.
 *
 * These assertions cover the walk's contract, not its output count - the
 * baseline is the ratchet. Comments are stripped where a file's own text is
 * matched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { complianceSettings } from '../../../shared/security-schema';

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
    // customer-portal-service.ts was here until round 248: its only importer
    // was routes-enhanced-service.ts, retired that round, and /api/customer-portal
    // is served by its edge function. The workflow runtime is live via the
    // boot-started sweeper.
    'server/services/workflow-execution-service.ts',
  ])('does not call %s an orphan', (file) => {
    expect(bare.has(file)).toBe(false);
  });

  it.each([
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
    // The distinction the guard could not make, and the annotation had to:
    // this file is reached, and its enforcement middleware was never mounted.
    // AUDIT-034 removed the enforcement half; the helpers below are what the
    // live importer actually takes, and are why the file is still reachable.
    expect(bare.has('server/middleware/session-timeout.ts')).toBe(false);
    const sessionRoutes = stripComments(read('server/routes-session-management.ts'));
    for (const helper of [
      'getActiveSessions',
      'terminateSession',
      'logoutOtherSessions',
      'getSessionConfig',
    ]) {
      expect(sessionRoutes).toContain(helper);
      expect(stripComments(read('server/middleware/session-timeout.ts'))).toContain(
        `export async function ${helper}`,
      );
    }
  });
});

describe('the three unmountable security controls are retired (AUDIT-034)', () => {
  it.each([
    'server/middleware/security-index.ts',
    'server/middleware/ip-whitelist.ts',
    'server/middleware/mfa-enforcement.ts',
  ])('%s is deleted, not left exported', (file) => {
    expect(existsSync(join(repo, file))).toBe(false);
  });

  it('no server file names the deleted middleware', () => {
    // Comments are stripped on BOTH sides: session-timeout.ts's own header
    // quotes every one of these names in prose explaining what went and why,
    // and an assertion matching a name rather than a construct would report
    // that explanation as the defect.
    const files = execFileSync('git', ['ls-files', 'server/*.ts', 'server/**/*.ts'], {
      cwd: repo,
      encoding: 'utf8',
    })
      .split('\n')
      // `git ls-files` reads the INDEX, which can still name a file that has
      // been deleted from disk but not yet staged - readFileSync then throws
      // ENOENT and the walk fails for a reason that has nothing to do with the
      // property. Skip what is not there; the floor below stops that from
      // becoming a way to pass by skipping everything.
      .filter((f) => f && !f.startsWith('server/tests/') && existsSync(join(repo, f)));

    // A walk that stops matching must fail rather than pass in silence.
    expect(files.length).toBeGreaterThan(200);

    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(read(file));
      for (const name of [
        'enforceSessionTimeout',
        'extendSessionOnActivity',
        'initializeSession',
        'isSessionExpired',
        'getTimeUntilWarning',
        'enforceIpWhitelist',
        'getTenantIpConfig',
        'updateTenantIpWhitelist',
        'requireMfaForAdmins',
        'requireMfaVerification',
        'markMfaVerified',
        'getTenantMfaSettings',
        'applySecurityMiddleware',
      ]) {
        if (src.includes(name)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the session inventory, which a live router serves', () => {
    // The half that was NOT deleted. security_sessions is real and
    // routes-session-management.ts reads it; only the timeout enforcement went.
    const src = stripComments(read('server/middleware/session-timeout.ts'));
    expect(src).toContain('securitySessions');
    expect(src).toContain('export async function getSessionConfig');
    expect(src).not.toMatch(/NextFunction/);
  });
});

describe('why each control could not be turned on, asserted rather than asserted-in-prose', () => {
  // Each of these is designed to FAIL the day somebody builds the missing
  // prerequisite, so the deletion cannot quietly outlive its reason. Two of the
  // three were measured against a Postgres 16 with all 80 journalled migrations
  // replayed (the COP-M07 recipe), not inferred from a grep.

  it('MFA-for-admins: compliance_settings carries no MFA policy to read', () => {
    // getTenantMfaSettings did `settings?.mfaEnabled !== false`, so with no such
    // column the answer was `undefined !== false` - true for EVERY tenant,
    // configured or not. The story description and CLAUDE.md both said the
    // control was "subject to per-tenant settings"; there were none. Mounting it
    // would have 403'd every user at level 4+ on every tenant, with no switch.
    const cols = getTableConfig(complianceSettings).columns.map((c) => c.name);
    expect(cols.length).toBeGreaterThan(10);
    expect(cols.filter((c) => /mfa/i.test(c))).toEqual([]);
    // The one session field it DOES carry, so the finding is not overstated.
    expect(cols).toContain('session_timeout_minutes');
  });

  it('MFA-for-admins: its only policy writer never wrote one either', () => {
    // supabase/functions/admin/ is the sole writer of compliance_settings in the
    // tree. It maps nine fields and none is an MFA field - so even the column
    // landing would not be enough on its own.
    const admin = stripComments(read('supabase/functions/admin/index.ts'));
    const block = admin.slice(admin.indexOf('const complianceData'));
    expect(block).toContain('session_timeout_minutes');
    expect(block.slice(0, block.indexOf('.upsert('))).not.toMatch(/mfa/i);
  });

  it('IP whitelist: its settings reader discards the row and returns defaults', () => {
    // getTenantIpConfig could never see enabled: true. There is no
    // security_settings table and no ip_whitelist column on any of the 682
    // tables the migration chain creates, so getSecuritySettings fetches the
    // compliance row and then throws it away.
    const storage = read('server/storage/security-storage.ts');
    expect(storage).toContain('...DEFAULT_SECURITY_SETTINGS');
    expect(stripComments(storage)).toMatch(/ipWhitelistEnabled:\s*false/);
  });

  it('session idle timeout: nothing in the product populates an Express session', () => {
    // Its guard was `req.session.userId`. Only two handlers set it, both under
    // /api/auth, which production resolves to an edge-function directory that
    // does not exist; the web app authenticates through Supabase GoTrue.
    const writers = execFileSync('git', ['grep', '-l', '-e', 'session.userId =', '--', 'server'], {
      cwd: repo,
      encoding: 'utf8',
    })
      .split('\n')
      // This file quotes the pattern in the assertion below, so its own corpus
      // would otherwise report it - the guard-reads-its-own-header trap.
      .filter((f) => f && !f.startsWith('server/tests/'));
    expect(writers).toEqual(['server/auth-routes.ts']);
    expect(stripComments(read('client/src/hooks/useSupabaseAuth.ts'))).toContain(
      'signInWithPassword',
    );
  });

  it('step-up MFA is kept but says it has no writer', () => {
    // requireMFA in enhanced-rbac-middleware.ts fails closed on
    // session.mfaVerified, whose only writer went with mfa-enforcement.ts. It is
    // inert (no mount site) and left in place; what it must not be is silent.
    const src = read('server/middleware/enhanced-rbac-middleware.ts');
    expect(src).toContain('export const requireMFA');
    expect(src).toContain('NOTHING MOUNTS THIS, AND NOTHING CAN SATISFY IT');
    const mounted = execFileSync('git', ['grep', '-c', '-e', 'requireMFA', '--', 'server'], {
      cwd: repo,
      encoding: 'utf8',
    });
    // Only its definition, the helper's re-export, and the factory that wraps
    // it - no route anywhere applies it.
    expect(mounted).not.toMatch(/server\/routes/);
  });

  it('leaves API versioning alone, which IS mounted directly', () => {
    // The one control from that module that works, so the finding is not
    // overstated. It never went through security-index.
    const routes = stripComments(read('server/routes.ts'));
    expect(routes).toContain('apiVersioning()');
    expect(routes).toContain("from './middleware/api-versioning'");
  });
});

describe('the session half that was KEPT, and the two fabricated counts in it', () => {
  // Found while vouching for the half AUDIT-034 did not delete: both of these
  // returned the literal 1, and one of them broke the feature outright.
  // Verified behaviourally against a Postgres 16 with all 80 journalled
  // migrations replayed - five sessions for one user across two tenants gave
  // revokedCount 3 (was 1), left 'current' and the other tenant's row active,
  // cleanupExpiredSessions 1, and a second revoke-all 0 (was 1, reporting a
  // revocation that did not happen).
  const src = read('server/middleware/session-timeout.ts');
  /** A function's own body, bounded by the next top-level export - not a window. */
  const bodyOf = (name: string) => {
    const from = src.indexOf(`export async function ${name}`);
    expect(from).toBeGreaterThan(-1);
    const to = src.indexOf('\nexport ', from + 1);
    return src.slice(from, to === -1 ? src.length : to);
  };

  it('revoke-all excludes the session making the request', () => {
    const body = bodyOf('logoutOtherSessions');
    expect(body).toContain('ne(securitySessions.sessionId, currentSessionId)');
    // An empty id must not become `sessionId <> ''`, which matches every row.
    expect(body).toMatch(/if \(currentSessionId\)/);
  });

  it('revoke-all narrows by tenant, which it used to accept and drop', () => {
    expect(bodyOf('logoutOtherSessions')).toContain('eq(securitySessions.tenantId, tenantId)');
  });

  it.each(['logoutOtherSessions', 'cleanupExpiredSessions'])(
    '%s counts what it wrote instead of returning 1',
    (name) => {
      const body = bodyOf(name);
      expect(body).toContain('.returning({ id: securitySessions.id })');
      expect(stripComments(body)).toMatch(/return \w+\.length;/);
      expect(stripComments(body)).not.toMatch(/return 1;/);
    },
  );
});
