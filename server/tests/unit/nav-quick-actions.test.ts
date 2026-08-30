/**
 * Nine quick-action buttons went nowhere, and the guard could not see them.
 *
 * main-layout renders SmartBreadcrumb on every page, and its quick actions
 * linked to `<list page>?action=new`. NO page in the app read that parameter,
 * so "Add Equipment", "Generate Invoice", "Add Part" and six more dropped the
 * user on a list and did nothing. Two of them - both /equipment - pointed at a
 * path that is not registered at all, so they rendered the 404 page.
 *
 * check-nav-targets could not report any of it. Its noise filter skips any
 * literal containing regex characters, and '?' is one, so every target with a
 * query string was discarded before it was ever checked. That guard's own
 * header says a false negative ships a 404 while a false positive is cheap -
 * this was the false negative. Stripping the query string first found three
 * MORE live 404s that had been invisible the same way: /activities twice in the
 * sales-rep dashboard widgets, and /proposals/new in LeadDeals.
 *
 * The deliberate collect-every-slash-literal design is NOT narrowed here. Its
 * header records a real post-login 404 that survived an audit because an
 * earlier script only matched navigation expressions, and the two dead redirect
 * whitelists this pass deleted are exactly what that breadth is for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const breadcrumb = read('client/src/components/layout/smart-breadcrumb.tsx');
const widgets = read('client/src/components/dashboards/widget-components.tsx');
const leadDeals = read('client/src/components/leads/LeadDeals.tsx');
const appTsx = read('client/src/App.tsx');

const PAGES: Array<[string, string]> = [
  ['client/src/pages/CustomersPage.tsx', 'setIsCreateOpen'],
  ['client/src/pages/Invoices.tsx', 'setIsGenerateDialogOpen'],
  ['client/src/pages/MeterReadings.tsx', 'setIsCreateDialogOpen'],
  ['client/src/pages/EquipmentLifecycleHub.tsx', 'setIsPODialogOpen'],
  ['client/src/pages/WarehouseOperations.tsx', 'setShowCreateDialog'],
  ['client/src/pages/ServiceHub.tsx', 'setShowPhoneInCreator'],
];

describe('every quick-action target is a registered route', () => {
  it.each([...breadcrumb.matchAll(/href: '(\/[^']*)'/g)].map((m) => m[1]))(
    '%s resolves',
    (href) => {
      const path = href.split('?')[0];
      if (path === '/') return;
      expect(appTsx).toContain(`path="${path}"`);
    },
  );

  it('no longer links to /equipment, which is not a route', () => {
    // The branch fires on /equipment-lifecycle and
    // /equipment-lifecycle-management, both registered; the links did not.
    expect(breadcrumb).not.toMatch(/href: '\/equipment'/);
    expect(breadcrumb).not.toMatch(/href: '\/equipment\?/);
    expect(breadcrumb).toContain("href: '/equipment-lifecycle'");
  });
});

describe('the ?action= parameter is actually read', () => {
  it('ships one hook rather than six copies of the same effect', () => {
    expect(existsSync(join(repo, 'client/src/hooks/use-action-param.ts'))).toBe(true);
  });

  it('consumes the parameter so a refresh does not reopen the dialog', () => {
    const hook = read('client/src/hooks/use-action-param.ts');
    expect(hook).toContain('history.replaceState');
    expect(hook).toMatch(/params\.delete\('action'\)/);
  });

  it.each(PAGES)('%s opens its dialog from the parameter', (page, setter) => {
    const source = read(page);
    expect(source).toContain('useActionParam');
    // Inside the effect, not merely somewhere in the file: every one of these
    // pages already calls its setter from a real button, so a bare search for
    // the call passes even with the effect gutted.
    const effect = source.slice(source.indexOf('const quickAction = useActionParam()'));
    const body = effect.slice(0, effect.indexOf('}, [quickAction]);'));
    expect(body).toMatch(new RegExp(`${setter}\\(true\\)`));
  });

  it('covers every action value the breadcrumb sends', () => {
    const sent = new Set(
      [...breadcrumb.matchAll(/href: '\/[^'?]*\?action=([a-z-]+)'/g)].map((m) => m[1]),
    );
    expect(sent.size).toBeGreaterThan(0);
    const handled = PAGES.map(([page]) => read(page)).join('\n');
    for (const action of sent) {
      expect(handled).toContain(`'${action}'`);
    }
  });
});

describe('the three 404s the query-string fix exposed', () => {
  it('drops the Log Call action rather than pointing it somewhere approximate', () => {
    // /activities is not a route. PlatformActivities is root-admin only, at
    // /platform-crm/activities, so there is no sales-rep activities surface to
    // point at - and /tasks is a different thing.
    expect(widgets).not.toContain('/activities');
    expect(widgets).not.toContain("label: 'Log Call'");
  });

  it('sends the proposal drill-through to the builder that exists', () => {
    expect(leadDeals).not.toContain('/proposals/new');
    expect(leadDeals).toContain('/proposal-builder?');
    expect(appTsx).toContain('path="/proposal-builder"');
  });
});

describe('the guard', () => {
  it('checks a target with a query string instead of discarding it', () => {
    const guard = readFileSync(join(repo, 'scripts/check-nav-targets.mjs'), 'utf8');
    expect(guard).toContain('function pathOf');
    expect(guard).toMatch(/const raw = pathOf\(literal\)/);
  });

  it('still collects every slash literal, which is what found the dead whitelists', () => {
    // Narrowing this to navigation expressions is what let a post-login 404
    // survive a whole audit pass, per the guard's own header. Not undone.
    const guard = readFileSync(join(repo, 'scripts/check-nav-targets.mjs'), 'utf8');
    expect(guard).toContain('Why it collects EVERY "/" string literal');
  });

  it('passes by exit code', () => {
    execFileSync('node', [join(repo, 'scripts/check-nav-targets.mjs')], { cwd: repo });
  });
});

describe('the redirect whitelists that never ran are gone', () => {
  it.each(['client/src/lib/auth-utils.ts', 'client/src/lib/validations.ts'])(
    '%s declares no stale allow-list',
    (file) => {
      expect(read(file)).not.toMatch(/ALLOWED_REDIRECT_(PATHS|PREFIXES)/);
    },
  );

  it('keeps the control that does the work', () => {
    for (const file of ['client/src/lib/auth-utils.ts', 'client/src/lib/validations.ts']) {
      expect(read(file)).toContain('BLOCKED_REDIRECT_PREFIXES');
    }
    expect(read('client/src/lib/auth-utils.ts')).toContain('sanitizeURL');
  });
});
