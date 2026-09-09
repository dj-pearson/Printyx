/**
 * The paginated list endpoints, against the real Drizzle tables (iteration 7).
 *
 * TWO DEFECTS, both of which tsc had been reporting as TS2339/TS2345 in this exact
 * file the whole time - nine errors, unread, in a ratchet counted in the thousands.
 *
 * 1. ?sortBy= was `table[sortBy as keyof typeof table] || table.createdAt`. An
 *    unknown key falls back correctly, but `enableRLS` and `constructor` exist on
 *    the table OBJECT and are functions, so the `||` never fires and drizzle binds
 *    the function as a parameter: the statement comes out `order by $1 asc`, which
 *    Postgres rejects. A 500 on four endpoints from a query string.
 *
 * 2. Four column names on inventory_items and one on invoices do not exist, so
 *    ?search= and ?lowStock=true threw before reaching the database.
 *
 * These assert against generated SQL rather than a mock, because both failures are
 * about which SQL comes out.
 */
import { describe, it, expect } from 'vitest';
import { asc, getTableColumns, ilike, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { businessRecords, serviceTickets, inventoryItems, invoices } from '../../../shared/schema';

const db = drizzle({} as any);

function resolveSortColumn(table: any, sortBy: string | undefined, fallback: any) {
  if (!sortBy) return fallback;
  const columns = getTableColumns(table) as Record<string, any>;
  if (!Object.prototype.hasOwnProperty.call(columns, sortBy)) return fallback;
  return columns[sortBy] ?? fallback;
}

const TABLES = { businessRecords, serviceTickets, inventoryItems, invoices } as const;

describe('?sortBy= resolves to a real column or falls back', () => {
  for (const [name, table] of Object.entries(TABLES)) {
    it(`${name}: a hostile sortBy never reaches ORDER BY as a bind parameter`, () => {
      for (const hostile of ['enableRLS', 'constructor', 'toString', 'valueOf', '__proto__']) {
        const col = resolveSortColumn(table, hostile, (table as any).createdAt);
        const stmt = db
          .select()
          .from(table as any)
          .orderBy(asc(col))
          .toSQL().sql;
        const orderBy = stmt.slice(stmt.indexOf('order by'));
        expect(orderBy, `sortBy=${hostile} on ${name}`).not.toMatch(/order by \$\d/);
        expect(orderBy).toMatch(/order by "\w+"\."created_at" asc/);
      }
    });

    it(`${name}: the OLD expression is what produced order by $1`, () => {
      // Locks the reason the fix exists: keyof-indexing still reaches the function.
      const old = (table as any)['enableRLS' as keyof typeof table] || (table as any).createdAt;
      expect(typeof old).toBe('function');
    });

    it(`${name}: a declared column still sorts by that column`, () => {
      const first = Object.keys(getTableColumns(table as any))[0];
      const col = resolveSortColumn(table, first, (table as any).createdAt);
      expect(
        db
          .select()
          .from(table as any)
          .orderBy(asc(col))
          .toSQL().sql,
      ).toContain('order by');
      expect(col).not.toBeUndefined();
    });
  }
});

describe('the list filters name columns that exist', () => {
  it('inventory search and lowStock build real SQL', () => {
    const clause = or(
      ilike(inventoryItems.name, '%x%'),
      ilike(inventoryItems.partNumber, '%x%'),
      ilike(inventoryItems.itemDescription, '%x%'),
    )!;
    const stmt = db.select().from(inventoryItems).where(clause).toSQL().sql;
    expect(stmt).toContain('"name"');
    expect(stmt).toContain('"part_number"');
    expect(stmt).toContain('"item_description"');

    const low = sql`${inventoryItems.quantityOnHand} <= ${inventoryItems.reorderPoint}`;
    expect(db.select().from(inventoryItems).where(low).toSQL().sql).toContain('"quantity_on_hand"');
  });

  it('invoice search uses invoice_notes, the column that exists', () => {
    const clause = or(ilike(invoices.invoiceNumber, '%x%'), ilike(invoices.invoiceNotes, '%x%'))!;
    expect(db.select().from(invoices).where(clause).toSQL().sql).toContain('"invoice_notes"');
  });

  it('the names the handlers used before are not columns', () => {
    const inv = getTableColumns(inventoryItems) as Record<string, unknown>;
    for (const gone of ['itemName', 'sku', 'description', 'currentStock']) {
      expect(inv[gone], `inventory_items.${gone}`).toBeUndefined();
    }
    expect((getTableColumns(invoices) as Record<string, unknown>).description).toBeUndefined();
  });
});
