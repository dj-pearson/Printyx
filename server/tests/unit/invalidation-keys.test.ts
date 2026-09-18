/**
 * An invalidation that matches no query refreshes nothing, silently
 * (INVALIDATE-002).
 *
 * TanStack matches element-wise prefixes, and both halves of that bite. A key
 * LONGER than any query key reaches nothing - ['/api/leads', id, 'contacts']
 * against a query keyed ['/api/leads', id]. And because a key element here is a
 * whole URL, ['/api/deal-desk/requests'] does not reach
 * [`/api/deal-desk/requests/${id}`]: two different strings, not a path and its
 * child. invalidateApiPath() in lib/queryClient.ts is what covers the second.
 *
 * Read with comments stripped - every note below quotes the dead key it
 * replaced.
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

describe('the URL-family invalidations go through the helper', () => {
  const cases: Array<[string, string]> = [
    ['client/src/components/address-book/CustomerAddressBooksTab.tsx', '/api/address-books'],
    ['client/src/pages/PlatformBusinessRecords.tsx', '/api/platform-crm/business-records'],
    ['client/src/pages/MobileFieldOperations.tsx', '/api/mobile-field/work-orders'],
    ['client/src/components/quote-builder/QuoteBuilder.tsx', '/api/deal-desk/requests'],
  ];

  for (const [file, prefix] of cases) {
    it(`${file.split('/').pop()} invalidates ${prefix} by path`, () => {
      const src = code(file);
      expect(src).toContain(`invalidateApiPath('${prefix}')`);
      expect(src).not.toContain(`queryKey: ['${prefix}'] }`);
    });
  }

  it('the two templated ones too', () => {
    expect(code('client/src/components/address-book/EntryFormDialog.tsx')).toContain(
      'invalidateApiPath(`/api/address-books/${bookId}`)',
    );
    expect(code('client/src/components/equipment/EquipmentTransitionDialog.tsx')).toContain(
      'invalidateApiPath(`/api/equipment-lifecycle/${equipmentId}`)',
    );
  });

  it('invalidateApiPath matches the prefix, a child path and a query string', () => {
    const helper = code('client/src/lib/queryClient.ts');
    expect(helper).toContain('first === prefix');
    expect(helper).toContain('${prefix}/');
    expect(helper).toContain('${prefix}?');
    // A predicate, not a queryKey filter - that is the whole point.
    expect(helper).toContain('predicate:');
  });
});

describe('the repointed keys reach the query they meant', () => {
  it('a saved custom report refreshes the list that shows it', () => {
    // EnhancedReportsHub keys its list ['reporting/reports', category, search].
    // '/api/reports' is a different namespace and matched nothing, so a report
    // the user had just saved did not appear until a reload.
    const src = code('client/src/pages/CustomReportBuilder.tsx');
    expect(src).toContain("queryKey: ['reporting/reports']");
    expect(src).not.toContain("queryKey: ['/api/reports']");
    expect(code('client/src/pages/EnhancedReportsHub.tsx')).toContain("'reporting/reports'");
  });

  it('a new lead contact refreshes the lead', () => {
    const src = code('client/src/pages/LeadDetail.tsx');
    expect(src).not.toContain("['/api/leads', id, 'contacts']");
    expect(src).toContain("queryKey: ['/api/leads', id] }");
  });

  it('adding an Apollo lead refreshes stats, not a mutation endpoint', () => {
    const src = code('client/src/pages/ApolloLeadEnrichment.tsx');
    expect(src).not.toContain("queryKey: ['/api/apollo/search']");
    // Two invalidations plus the query itself.
    expect((src.match(/queryKey: \['\/api\/apollo\/stats'\]/g) ?? []).length).toBe(3);
  });

  it('the cross-module hook invalidates lists, not ids nothing is keyed on', () => {
    const src = code('client/src/hooks/useCrossModuleIntegration.ts');
    expect(src).not.toContain("'/api/customers', integration.customerId");
    expect(src).not.toContain("'/api/service-tickets', integration.serviceTicketId");
  });
});

describe('the keys that pointed at nothing at all are gone', () => {
  it('/api/equipment-lifecycle/stages, in both places', () => {
    for (const f of [
      'client/src/components/equipment/EquipmentTransitionDialog.tsx',
      'client/src/pages/EquipmentLifecycleHub.tsx',
    ]) {
      expect(code(f), f).not.toContain('/api/equipment-lifecycle/stages');
    }
  });

  it('/api/field-service/service-signatures, which the page navigates away from', () => {
    expect(code('client/src/pages/DeliveryAcceptance.tsx')).not.toContain(
      "queryKey: ['/api/field-service/service-signatures']",
    );
  });
});

describe('the exemptions are reasons, not a mute button', () => {
  const doc = JSON.parse(raw('docs/invalidation-key-exemptions.json'));

  it('every entry says why it cannot be resolved', () => {
    expect(doc.exempt.length).toBeGreaterThan(0);
    for (const e of doc.exempt) {
      expect(e.file, JSON.stringify(e)).toMatch(/^client\/src\//);
      expect(e.reason, JSON.stringify(e)).toBeTruthy();
      expect(e.reason.length, e.file).toBeGreaterThan(60);
    }
  });

  it('and each is a runtime-assembled key, not a literal somebody gave up on', () => {
    for (const e of doc.exempt) {
      const runtime =
        /\$\{/.test(e.key) ||
        /\.replace\(|\.map\(|\breduce\b/.test(e.key) ||
        !e.key.startsWith('[');
      expect(runtime, `${e.file} ${e.key}`).toBe(true);
    }
  });
});
