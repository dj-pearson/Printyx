// Round 212. Every table referencing platform_business_records is ON DELETE
// CASCADE, so deleting an account silently deleted its deals, contacts and
// activities; the single delete answered success for an id that matched
// nothing; and bulk Delete was disabled. Records with dependents are refused
// and named now, on both paths.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAX_BULK_DELETE,
  bulkDeleteMessage,
  describeDependents,
  planRecordDeletion,
} from '../../../shared/platform-record-deletion';

const found = [
  { id: 'a', company_name: 'Acme' },
  { id: 'b', company_name: 'Beta' },
  { id: 'c', company_name: 'Gamma' },
];

describe('planRecordDeletion', () => {
  it('deletes only records with no deals, contacts or activities', () => {
    const plan = planRecordDeletion({
      recordIds: ['a', 'b', 'c', 'zz', 'a'],
      found,
      dependents: { deals: ['a', 'a'], contacts: [], activities: ['b'] },
    });
    expect(plan.deletable).toEqual(['c']);
    expect(plan.blocked).toEqual([
      { id: 'a', name: 'Acme', deals: 2, contacts: 0, activities: 0 },
      { id: 'b', name: 'Beta', deals: 0, contacts: 0, activities: 1 },
    ]);
    expect(plan.missing).toEqual(['zz']);
  });

  it('refuses an empty or oversized request rather than truncating it', () => {
    expect(
      planRecordDeletion({
        recordIds: [],
        found,
        dependents: { deals: [], contacts: [], activities: [] },
      }).error,
    ).toBeTruthy();
    const many = Array.from({ length: MAX_BULK_DELETE + 1 }, (_, i) => `id${i}`);
    const plan = planRecordDeletion({
      recordIds: many,
      found: [],
      dependents: { deals: [], contacts: [], activities: [] },
    });
    expect(plan.error).toMatch(/At most 200/);
    expect(plan.deletable).toEqual([]);
  });

  it('describes dependents for a person to read', () => {
    expect(describeDependents({ deals: 3, contacts: 1, activities: 0 })).toBe('3 deals, 1 contact');
    expect(describeDependents({ deals: 0, contacts: 0, activities: 2 })).toBe('2 activities');
  });

  it('never reports a partial delete as a clean one', () => {
    const blocked = [{ id: 'a', name: 'Acme', deals: 1, contacts: 0, activities: 0 }];
    const partial = bulkDeleteMessage({ deleted: ['c'], blocked, missing: [] });
    expect(partial.title).toBe('Some records kept');
    expect(partial.description).toContain('Acme (1 deal)');
    expect(partial.destructive).toBe(true);
    expect(bulkDeleteMessage({ deleted: [], blocked, missing: [] }).title).toBe('Nothing deleted');
    expect(bulkDeleteMessage({ deleted: ['c'], blocked: [], missing: [] })).toEqual({
      title: 'Deleted',
      description: 'Deleted 1 record.',
      destructive: false,
    });
  });
});

describe('platform-crm edge function', () => {
  const src = readFileSync('supabase/functions/platform-crm/index.ts', 'utf8');
  const branch = (marker: string) => {
    const at = src.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('\n    if (req.method', at + marker.length));
  };

  it('the single delete refuses dependents and 404s an id that matched nothing', () => {
    const b = branch(
      "if (req.method === 'DELETE' && endpoint === 'business-records' && resourceId && !parts[2]) {",
    );
    const refuse = b.indexOf("code: 'HAS_DEPENDENTS'");
    const del = b.indexOf('.delete()');
    expect(refuse).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(refuse);
    expect(b).toMatch(/\.delete\(\)\s*\.eq\('id', resourceId\)\s*\.select\('id'\)/);
    expect(b).toMatch(/if \(!gone \|\| gone\.length === 0\)[\s\S]{0,120}404/);
  });

  it('bulk delete sits above the /:id branches and reports what the delete returned', () => {
    const bulk = src.indexOf("parts[2] === 'delete'");
    const single = src.indexOf('// GET /platform-crm/business-records/:id - Single record');
    expect(bulk).toBeGreaterThan(-1);
    expect(bulk).toBeLessThan(single);
    const b = src.slice(bulk, single);
    expect(b).toMatch(/\.in\('id', plan\.deletable\)\s*\.select\('id'\)/);
    expect(b).toContain('deleted = (gone ?? []).map(');
  });

  it('reads dependents for all three tables that matter', () => {
    for (const t of ['platform_deals', 'platform_contacts', 'platform_activities']) {
      expect(src).toMatch(new RegExp(`from\\('${t}'\\)\\s*\\.select\\('business_record_id'\\)`));
    }
  });
});

describe('PlatformBusinessRecords page', () => {
  const page = readFileSync('client/src/pages/PlatformBusinessRecords.tsx', 'utf8');
  it('enables bulk delete behind a confirm and keeps what was not deleted selected', () => {
    expect(page).not.toContain('Bulk delete is not available yet');
    expect(page).toMatch(/if \(ok\) bulkDeleteMutation\.mutate\(ids\)/);
    expect(page).toMatch(/setSelectedRecords\(new Set\(result\.blocked\.map\(\(b\) => b\.id\)\)\)/);
  });
});
