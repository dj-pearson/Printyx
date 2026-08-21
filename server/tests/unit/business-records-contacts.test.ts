// PROD-008b: the single-contact branch on the business-records edge function.
//
// QuoteTransformer.tsx requests /api/business-records/:id/contacts/:contactId
// through the DEFAULT queryFn - it has no queryFn of its own, so the key is the
// URL - and types the result as one Contact. The edge function's contacts branch
// had no third-segment guard, so that request fell into the LIST branch and
// returned the whole array. Reading firstName off an array is undefined, which
// rendered blank contact fields into a generated proposal.
//
// Source-reading, so no database or edge runtime is needed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const strip = (src: string) =>
  src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
const read = (p: string) => strip(readFileSync(join(repo, p), 'utf-8'));

const EDGE = read('supabase/functions/business-records/index.ts');

describe('single-contact lookup', () => {
  it('has a branch keyed on the third path segment', () => {
    expect(EDGE).toContain('const subResourceId = pathParts[2];');
    expect(EDGE).toContain("subResource === 'contacts' && recordId && subResourceId");
  });

  it('matches the single-contact branch BEFORE the list branch', () => {
    // Both test `subResource === 'contacts' && recordId`; the list branch has no
    // third-segment guard, so the wrong order answers a single-contact request
    // with the whole array - which is the bug this closes.
    const single = EDGE.indexOf("subResource === 'contacts' && recordId && subResourceId");
    const list = EDGE.indexOf("subResource === 'contacts' && recordId)");
    expect(single).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(-1);
    expect(single).toBeLessThan(list);
  });

  it('scopes the lookup by company AND tenant, not by contact id alone', () => {
    const branch = EDGE.slice(
      EDGE.indexOf("subResource === 'contacts' && recordId && subResourceId"),
    ).slice(0, 700);
    expect(branch).toContain(".eq('id', subResourceId)");
    expect(branch).toContain(".eq('company_id', recordId)");
    expect(branch).toContain(".eq('tenant_id', tenantId)");
  });

  it('404s a missing contact rather than returning null as a body', () => {
    const branch = EDGE.slice(
      EDGE.indexOf("subResource === 'contacts' && recordId && subResourceId"),
    ).slice(0, 900);
    expect(branch).toContain('Contact not found');
  });

  it('the caller that needs it still requests that path', () => {
    // If this fails the component changed shape - re-derive rather than
    // deleting the branch.
    const component = read('client/src/components/proposal-builder/QuoteTransformer.tsx');
    expect(component).toContain('/contacts/${quote?.contactId}');
  });
});
