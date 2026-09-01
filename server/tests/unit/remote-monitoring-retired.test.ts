/**
 * /remote-monitoring is a redirect, and its three back ends are gone (AUDIT-030).
 *
 * The page was a fixture twin of Fleet Monitoring: same fleet, same three tables,
 * 1,176 lines bound to a shape no endpoint produced. Five paths, all 404 in
 * production; two answered in dev by hardcoded equipment (47 machines, a
 * customer called Metro Office Solutions, 96.8% average uptime).
 *
 * The part worth locking is what the triage found underneath. There were THREE
 * Express implementations of /api/remote-monitoring. The only one that read real
 * tables - routes-remote-monitoring.ts, over device_registrations and
 * device_metrics - was registered nowhere, so the two that ran were both
 * invented. A future port would have found the working file first and assumed it
 * was live.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Line comments first: a prose path like `/api/*` otherwise opens a block
// comment that runs to the next `*/` and swallows the code being asserted on.
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the Remote Monitoring page and its back ends are gone', () => {
  it('deletes the page', () => {
    expect(existsSync(join(repo, 'client/src/pages/RemoteMonitoring.tsx'))).toBe(false);
  });

  it('deletes all three Express implementations', () => {
    expect(existsSync(join(repo, 'server/routes-remote-monitoring.ts'))).toBe(false);
    for (const f of ['server/routes-sample-data.ts', 'server/routes-operations-extended.ts']) {
      expect(stripComments(read(f))).not.toMatch(/api\/remote-monitoring/);
    }
  });

  it('leaves no client caller of the prefix', () => {
    // A caller with no page is how an endpoint gets rebuilt by mistake.
    const app = stripComments(read('client/src/App.tsx'));
    expect(app).not.toMatch(/pages\/RemoteMonitoring/);
  });
});

describe('the route survives as a redirect, on the terms of its target', () => {
  it('redirects /remote-monitoring to /fleet-monitoring', () => {
    const app = read('client/src/App.tsx');
    expect(app).toMatch(
      /path="\/remote-monitoring">[\s\S]{0,160}LegacyRedirect to="\/fleet-monitoring"/,
    );
  });

  it('gates the redirect exactly as it gates the target', () => {
    // A looser source would let someone reach the target on terms the target
    // does not accept; a stricter one advertises a link that then denies them.
    const nav = read('client/src/lib/navigation-permissions.ts');
    const gate = (path: string) => {
      const at = nav.indexOf(`'${path}': {`);
      expect(at).toBeGreaterThan(-1);
      return nav.slice(at, nav.indexOf('},', at));
    };
    const source = gate('/remote-monitoring');
    const target = gate('/fleet-monitoring');
    const fields = (s: string) =>
      [...s.matchAll(/(requiredPermissions|minLevel):\s*([^\n]+)/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(fields(source)).toEqual(fields(target));
  });

  it('drops the duplicate sidebar entry, keeping the match pattern', () => {
    for (const f of [
      'client/src/components/layout/RoleAwareCollapsibleSidebar.tsx',
      'client/src/components/mobile/MobileNavigationDrawer.tsx',
    ]) {
      const src = read(f);
      // Two entries for one screen is not navigation, it is a coin flip.
      expect(src).not.toMatch(/title: 'Remote Monitoring'/);
      // The pattern stays so an old bookmark still lights the right section.
      expect(src).toMatch(/'\/remote-monitoring\*'/);
    }
  });
});
