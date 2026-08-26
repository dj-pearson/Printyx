// QUALITY-002: drizzle's where() ASSIGNS. It does not AND.
//
// `select().from(t).where(a).where(b)` produces `WHERE b`, not `WHERE a AND b`.
// In this repo the discarded predicate `a` was almost always the tenant scope,
// so a route that applied an optional filter with a second where() served every
// tenant's rows. Three of the twenty-four sites were exactly that: warehouse
// kitting operations, auto-invoices, and the quote margin report.
//
// The type system half-catches it — after the first where(), the returned type
// omits where() — but `.$dynamic()` removes that protection, and several sites
// used it. scripts/check-chained-where.mjs is the real guard and is closed at 0.
//
// This test pins the SEMANTICS, so that a drizzle upgrade which changed them
// (in either direction) surfaces here rather than silently making the guard
// meaningless or the fixed code wrong.
import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import pg from 'pg';

import { deals } from '@shared/schema';

// toSQL() never opens a connection, so this pool is never used.
const db = drizzle(new pg.Pool({ connectionString: 'postgresql://unused@127.0.0.1:1/unused' }));

const TENANT = 'tenant-a';

describe('drizzle where() semantics', () => {
  it('keeps only the LAST predicate when where() is chained', () => {
    const base = db.select().from(deals).where(eq(deals.tenantId, TENANT));
    // After the first where(), the type omits where() — that is the type system
    // half-catching this. The cast reproduces what `.$dynamic()` and the `as any`
    // in the original code did: remove that protection and leave the runtime
    // behaviour exposed.
    type ChainableWhere = {
      where: (condition: unknown) => { toSQL: () => { sql: string; params: unknown[] } };
    };
    const chained = (base as unknown as ChainableWhere).where(eq(deals.status, 'open'));

    const { sql, params } = chained.toSQL();
    // Assert on the WHERE clause alone: tenant_id also appears in the select list.
    const where = sql.split(' where ')[1];
    expect(where).toContain('"status" = $1');
    expect(where).not.toContain('tenant_id');
    expect(params).toEqual(['open']);
  });

  it('keeps both predicates when they are composed with and()', () => {
    const { sql, params } = db
      .select()
      .from(deals)
      .where(and(eq(deals.tenantId, TENANT), eq(deals.status, 'open')))
      .toSQL();

    const where = sql.split(' where ')[1];
    expect(where).toContain('tenant_id');
    expect(where).toContain('"status"');
    expect(params).toEqual([TENANT, 'open']);
  });

  it('composes a variable-length condition list without losing the tenant scope', () => {
    // The shape every fixed site now uses: seed with the tenant predicate, push
    // the optional filters, spread into a single and().
    const conditions = [eq(deals.tenantId, TENANT)];
    conditions.push(eq(deals.status, 'open'));
    conditions.push(eq(deals.priority, 'high'));

    const { params } = db
      .select()
      .from(deals)
      .where(and(...conditions))
      .toSQL();

    expect(params).toEqual([TENANT, 'open', 'high']);
  });
});
