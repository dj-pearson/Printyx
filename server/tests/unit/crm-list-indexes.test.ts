// COP-I01 AC5 and AC6: the indexes the CRM list and board queries need, held
// against drizzle's own declarations.
//
// The benchmark (scripts/bench-crm-lists.mjs) is the measurement and needs a
// database, so it cannot run in CI. This is the part that can: it fails the
// day somebody deletes one of these, which is how an index regression
// normally happens - silently, in a schema refactor, noticed months later as
// "the CRM got slow".
//
// WHY EACH ONE IS COMPOSITE AND TENANT-FIRST. Every one of these queries
// filters by tenant and then sorts or filters by something else. An index on
// the second column ALONE orders the whole table, so one tenant's slice still
// costs every tenant's rows - which is exactly what the benchmark measured
// before these landed: 12-17ms over a 100,000-row table where 5,000 rows
// belonged to the tenant, every query a sequential scan. After: 1.8-3.8ms and
// no scan.
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { companies, businessRecords, deals } from '@shared/schema';

/** Index name -> the columns it must cover, in order. */
function indexColumns(table: Parameters<typeof getTableConfig>[0]) {
  const out = new Map<string, string[]>();
  for (const idx of getTableConfig(table).indexes) {
    const cols = (idx.config.columns ?? [])
      .map((c: unknown) => (c as { name?: string })?.name)
      .filter(Boolean) as string[];
    out.set(idx.config.name, cols);
  }
  return out;
}

describe('companies — the table the primary CRM account list reads', () => {
  const indexes = indexColumns(companies);

  it('had NO index at all before this story, so assert it has some now', () => {
    expect(indexes.size).toBeGreaterThan(0);
  });

  it('covers the list sort: tenant first, created_at second', () => {
    expect(indexes.get('companies_tenant_created_idx')).toEqual(['tenant_id', 'created_at']);
  });

  it('covers the record-type filter', () => {
    expect(indexes.get('companies_tenant_type_idx')).toEqual(['tenant_id', 'business_record_type']);
  });

  it('covers the rep-scoping filter, which resolves to created_by on this table', () => {
    expect(indexes.get('companies_tenant_created_by_idx')).toEqual(['tenant_id', 'created_by']);
  });
});

describe('business_records', () => {
  const indexes = indexColumns(businessRecords);

  it('has a TENANT-SCOPED created_at index, not only the bare one', () => {
    // The bare index orders the whole table and cannot serve "this tenant's
    // newest hundred".
    expect(indexes.get('business_records_tenant_created_idx')).toEqual(['tenant_id', 'created_at']);
  });

  it('keeps the filters it already had', () => {
    expect(indexes.get('business_records_tenant_type_idx')).toEqual(['tenant_id', 'record_type']);
    expect(indexes.get('business_records_tenant_status_idx')).toEqual(['tenant_id', 'status']);
  });
});

describe('deals — the board and the forecast', () => {
  const indexes = indexColumns(deals);

  it('covers the board: tenant and stage', () => {
    expect(indexes.get('deals_tenant_stage_idx')).toEqual(['tenant_id', 'stage_id']);
  });

  it('covers a rep’s own book: tenant and owner', () => {
    expect(indexes.get('deals_tenant_owner_idx')).toEqual(['tenant_id', 'owner_id']);
  });

  it('covers the forecast sort: tenant and close date', () => {
    expect(indexes.get('deals_tenant_close_date_idx')).toEqual([
      'tenant_id',
      'expected_close_date',
    ]);
  });
});

describe('every CRM list index is tenant-first', () => {
  it('names tenant_id as the leading column', () => {
    // A composite whose leading column is not the tenant cannot narrow to one
    // tenant, which is the whole point of these.
    const listIndexes = [
      ...indexColumns(companies).entries(),
      ...[...indexColumns(deals).entries()].filter(([n]) => n.startsWith('deals_tenant_')),
    ];
    expect(listIndexes.length).toBeGreaterThan(3);
    for (const [name, cols] of listIndexes) {
      expect(cols[0], name).toBe('tenant_id');
    }
  });
});
