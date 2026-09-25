/**
 * Round 256. lead-intelligence's hot-lead list selected
 * businessRecords.firstName / lastName / email - columns business_records does
 * not have - so drizzle threw building the query and the list never loaded; the
 * lookup also had no tenant filter. dpa-management threw a TypeError on any
 * stored status missing from DPA_STATUSES.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { businessRecords } from '../../../shared/schema';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('lead intelligence hot leads', () => {
  const src = strip(readFileSync('server/services/lead-intelligence-service.ts', 'utf8'));
  const cols = new Set(Object.keys(getTableColumns(businessRecords)));

  it('selects only real business_records properties', () => {
    const named = [...src.matchAll(/businessRecords\.([a-zA-Z]+)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(5);
    expect(named.filter((n) => !cols.has(n))).toEqual([]);
  });

  it('scopes the lead lookup to the tenant', () => {
    expect(src).toMatch(
      /inArray\(businessRecords\.id, leadIds\), eq\(businessRecords\.tenantId, tenantId\)/,
    );
  });
});

describe('dpa status transitions', () => {
  it('treats an unknown stored status as allowing nothing rather than crashing', () => {
    const src = strip(readFileSync('server/services/dpa-management-service.ts', 'utf8'));
    expect(src).toMatch(
      /DPA_STATUSES\[existing\.status as DpaStatus\]\?\.allowedTransitions \?\? \[\]/,
    );
  });
});
