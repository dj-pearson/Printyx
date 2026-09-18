/**
 * A filter value in a query key is a path segment (QUERYKEY-002).
 *
 * queryClient.ts's default queryFn does `queryKey.join('/')`, so
 * ['/api/crm/goal-progress', ownerScope] requests
 * /api/crm/goal-progress/all. Thirteen keys carried a period, a status, a
 * scope, a tenant or a whole query string that way. Each was either a 404 or a
 * silently unfiltered read, and in every case the selector the user moved did
 * nothing.
 *
 * These assertions read the files with COMMENTS STRIPPED - the prose explaining
 * each fix quotes the key it replaced.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the eleven filters moved into the query string', () => {
  const cases: Array<[string, string]> = [
    ['client/src/pages/AdvancedAnalyticsDashboard.tsx', '/api/analytics/dashboard?period='],
    [
      'client/src/pages/CustomerSuccessManagement.tsx',
      '/api/customer-success/usage-analytics?period=',
    ],
    ['client/src/pages/MobileFieldOperations.tsx', '/api/mobile-field/work-orders?status='],
    ['client/src/pages/PlatformBusinessRecords.tsx', '/api/platform-crm/business-records?$'],
    ['client/src/pages/RootAdminSignupsCRM.tsx', '/api/root-admin/signups?page='],
    [
      'client/src/components/address-book/CustomerAddressBooksTab.tsx',
      '/api/address-books?customer_id=',
    ],
    ['client/src/pages/service/AddressBookDetail.tsx', '/api/address-books?customer_id='],
    ['client/src/components/customer/CustomerContracts.tsx', '/api/contracts?customerId='],
    ['client/src/components/customer/CustomerQuotes.tsx', '/api/quotes?customerId='],
  ];

  for (const [file, fragment] of cases) {
    it(`${file.split('/').pop()} requests ${fragment}`, () => {
      expect(code(file)).toContain(fragment);
    });
  }

  it('the two that append conditionally still start from a bare path', () => {
    expect(code('client/src/pages/SalesCommandCenter.tsx')).toContain(
      "'/api/crm/goal-progress' + (ownerScope === 'me' ? '?owner=me' : '')",
    );
    expect(code('client/src/pages/WorkflowAutomation.tsx')).toContain(
      "'/api/workflow-automation/dashboard' +",
    );
  });

  it('platform-cs drops both, because it filters client-side', () => {
    const page = code('client/src/pages/PlatformCustomerSuccess.tsx');
    expect(page).toContain("queryKey: ['/api/platform-cs/health-scores']");
    // The filtering itself is still there - this was not a feature removal.
    expect(page).toContain("selectedFilter === 'at_risk'");
    expect(page).toContain('tenant.csmId === selectedCSM');
  });
});

describe('two selectors had no endpoint reading them, so the endpoint gained one', () => {
  it('crm/goal-progress filters sales_goals.assigned_to_user_id on ?owner=me', () => {
    const fn = code('supabase/functions/crm/index.ts');
    const branch = fn.slice(fn.indexOf("subRoute === 'goal-progress'"));
    expect(branch.slice(0, 1200)).toContain("url.searchParams.get('owner')");
    expect(branch.slice(0, 1200)).toContain("eq('assigned_to_user_id', user.id)");
  });

  it('workflow-automation/dashboard filters workflows.category on ?category', () => {
    const fn = code('supabase/functions/workflow-automation/index.ts');
    expect(fn).toContain("url.searchParams.get('category')");
    expect(fn).toContain("workflowQuery.eq('category', category)");
    // 'all' is the selector's own default, not a category anyone stored.
    expect(fn).toContain("category !== 'all'");
  });
});

describe('an unrecognised period is a month, not a zero-length window', () => {
  const fn = code('supabase/functions/analytics/index.ts');

  it('accepts the vocabulary the dashboard actually sends', () => {
    for (const v of ['last-7-days', 'last-90-days', 'last-12-months', 'ytd', 'last-30-days']) {
      expect(fn).toContain(`case '${v}':`);
    }
  });

  it('and still accepts the old one', () => {
    for (const v of ['week', 'month', 'quarter', 'year']) {
      expect(fn).toContain(`case '${v}':`);
    }
  });

  it('has a default branch', () => {
    // Without one, startDate stayed at NOW for any unmatched value, so the
    // window was empty and every count came back zero.
    const sw = fn.slice(fn.indexOf('switch (period)'));
    expect(sw.slice(0, 900)).toContain('default:');
  });
});

describe('UserManagement no longer offers filters that cannot work', () => {
  const page = code('client/src/pages/admin/UserManagement.tsx');

  it('the tenant filter is gone', () => {
    // Its options were three invented companies, and the endpoint is
    // hard-scoped to the caller's own tenant, so there was no cross-tenant read
    // for it to narrow.
    expect(page).not.toContain('selectedTenant');
    expect(page).not.toContain('All Tenants');
  });

  it('the invented role filter is gone too', () => {
    // admin / manager / user are not role codes; the endpoint takes a roleId
    // uuid and this page loads no roles to offer.
    expect(page).not.toContain('All Roles');
  });

  it('the untouched Create User dialog is still dead, and that is a different story', () => {
    // Every field in it is unbound and the button has no onClick, so it also
    // still names Acme Corporation. Out of scope here (UI-DEAD-BUTTONS-001);
    // asserted so that fixing it does not silently pass this file by.
    const dialog = page.slice(page.indexOf('Create User'));
    expect(dialog).toContain('Acme Corporation');
  });

  it('search and status are bound to the params the endpoint reads', () => {
    expect(page).toContain("userQueryString.set('search'");
    expect(page).toContain("userQueryString.set('isActive'");
    expect(page).toContain('onChange={(e) => setSearch(e.target.value)}');
    expect(page).toContain('onValueChange={setActiveFilter}');
  });

  it('and the status options match a boolean column', () => {
    expect(page).toContain('>Inactive<');
    expect(page).not.toContain('>Suspended<');
  });
});

describe('the guard records what it allows', () => {
  const doc = JSON.parse(raw('docs/query-key-path-segments.json'));

  it('every allowed key names the URL it builds and who serves it', () => {
    expect(doc.allowed.length).toBeGreaterThan(0);
    for (const entry of doc.allowed) {
      expect(entry.file, JSON.stringify(entry)).toMatch(/^client\/src\//);
      expect(entry.url, JSON.stringify(entry)).toMatch(/^\/api\//);
      expect(entry.servedBy, JSON.stringify(entry)).toBeTruthy();
    }
  });

  it('and none of them is a filter', () => {
    for (const entry of doc.allowed) {
      expect(entry.key, entry.file).not.toMatch(/selected(Period|Segment|Status|Category|Tenant)/);
      expect(entry.key, entry.file).not.toMatch(/Filter\b|Scope\b|queryParams/);
    }
  });
});
