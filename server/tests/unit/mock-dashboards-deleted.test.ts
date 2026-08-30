/**
 * The last two missing-edge domains were mocks, and both were unreachable
 * anyway (PROD-010).
 *
 * /api/business-process and /api/incident-response were the only entries left
 * in docs/route-ownership-baseline.json's missingEdge list, and PROD-010
 * refused to port either one - twice - because both Express handlers returned
 * hardcoded numbers with no database access, so an edge function would have
 * published fabricated figures to production where the page 404'd. Refusing a
 * port is a holding position, not a resolution; this deletes them instead.
 *
 * The part worth keeping: NEITHER PAGE EVER RENDERED THE FIXTURE. Both passed
 * filter state in the query key -
 *   ['/api/business-process/dashboard', selectedCategory, selectedDepartment]
 * - and getQueryFn joins a query key into a url, so the request went to
 * /dashboard/all/all. Express registers the exact path, so both 404'd in dev
 * too, and both pages render their content behind `{data && ...}`. Two
 * dashboards of 865 and 1162 lines had therefore been blank everywhere since
 * they were written. That the fake numbers never shipped was luck.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const deleted = [
  'client/src/pages/BusinessProcessOptimization.tsx',
  'client/src/pages/IncidentResponseSystem.tsx',
  'server/routes-business-process-optimization.ts',
];

describe('the files are gone', () => {
  it.each(deleted)('%s no longer exists', (p) => {
    expect(existsSync(join(repo, p))).toBe(false);
  });

  it('removed both mock handlers from routes-sample-data', () => {
    const sample = read('server/routes-sample-data.ts');
    expect(sample).not.toMatch(/'\/api\/business-process\/dashboard'/);
    expect(sample).not.toMatch(/'\/api\/incident-response\/dashboard'/);
    // The invented figures themselves, so a re-add under any path is caught.
    // Keyed on names unique to these two payloads - the neighbouring
    // /api/document-management/workflows mock (SUPA-024, out of scope here)
    // has its own slaComplianceRate, and matching that would have asserted
    // something this change did not do.
    expect(sample).not.toMatch(/127890\.5/);
    expect(sample).not.toMatch(/totalProcesses/);
    expect(sample).not.toMatch(/iocMatches/);
    expect(sample).not.toMatch(/escalatedIncidents/);
  });
});

describe('nothing still points at them', () => {
  const app = read('client/src/App.tsx');
  const nav = read('client/src/lib/navigation-permissions.ts');
  const sidebar = read('client/src/components/layout/RoleAwareCollapsibleSidebar.tsx');
  const drawer = read('client/src/components/mobile/MobileNavigationDrawer.tsx');

  it('App.tsx has neither the lazy import nor the three routes', () => {
    expect(app).not.toMatch(/BusinessProcessOptimization/);
    expect(app).not.toMatch(/IncidentResponseSystem/);
  });

  it.each([
    ['navigation-permissions', nav],
    ['desktop sidebar', sidebar],
    ['mobile drawer', drawer],
  ])('%s lists neither path', (_name, src) => {
    expect(src).not.toMatch(/business-process/);
    expect(src).not.toMatch(/incident-response/);
  });
});

describe('the ratchet records the result', () => {
  it('missingEdge is empty', () => {
    const baseline = JSON.parse(
      readFileSync(join(repo, 'docs/route-ownership-baseline.json'), 'utf8'),
    );
    expect(baseline.missingEdge).toEqual([]);
  });

  it('neither prefix was proxied instead of deleted', () => {
    // A crmProxies entry would have been the wrong fix: it forwards the whole
    // prefix to an edge function that does not exist.
    const proxy = read('server/middleware/edge-function-proxy.ts');
    expect(proxy).not.toMatch(/'\/api\/business-process'\s*:/);
    expect(proxy).not.toMatch(/'\/api\/incident-response'\s*:/);
    expect(existsSync(join(repo, 'supabase/functions/business-process'))).toBe(false);
    expect(existsSync(join(repo, 'supabase/functions/incident-response'))).toBe(false);
  });
});
