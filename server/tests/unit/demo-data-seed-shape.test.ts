/**
 * QUALITY-002 — every insert in the shared demo data set is bound to real columns.
 *
 * The seeder was written against a mock schema: `companies.name` (real column is
 * business_name), `equipment.companyId` (customer_id), `supplies.sku`
 * (product_code), and two dozen more. It never got past phase 2 — drizzle's
 * `.values()` walks the TABLE's columns and picks each one out of the object, so
 * an unknown key is DROPPED silently and the NOT NULL it was meant to fill blows
 * up the insert.
 *
 * tsc only sees the keys written directly in the literal; a `...row` spread turns
 * excess-property checking off for everything it carries. So this drives all
 * seven phases against a db stub that captures every (table, values) pair, and
 * checks both halves against the real Drizzle columns:
 *
 *   - no key that is not a column   (the silent-drop half)
 *   - no missing NOT NULL column    (the insert-blows-up half)
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

type Capture = { table: PgTable; values: Record<string, unknown> };
const state = vi.hoisted(() => ({ captured: [] as { table: unknown; values: unknown }[] }));

vi.mock('../../db', () => {
  const settled: Record<string, unknown> = {};
  settled.onConflictDoNothing = () => settled;
  settled.returning = () => Promise.resolve([]);
  settled.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  const selectChain: Record<string, unknown> = {};
  selectChain.from = () => selectChain;
  selectChain.where = () => Promise.resolve([]);
  return {
    db: {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          state.captured.push({ table, values });
          return settled;
        },
      }),
      select: () => selectChain,
    },
  };
});

import { seedDemoData } from '../../seeds/demo-data';

let counts: Record<string, number>;

beforeAll(async () => {
  counts = await seedDemoData({ tenantId: 'tenant-1', userId: 'user-1' });
});

describe('QUALITY-002: demo seed inserts match the real schema', () => {
  it('runs all seven phases and reports a count per entity', () => {
    expect(Object.keys(counts).sort()).toEqual(
      [
        'accessories',
        'activities',
        'businessRecords',
        'chartOfAccounts',
        'companies',
        'contacts',
        'contracts',
        'dealStages',
        'deals',
        'equipment',
        'inventoryItems',
        'invoices',
        'leases',
        'locations',
        'meterReadings',
        'opportunities',
        // COP-M07: the canonical mirror of dealStages, so a seeded tenant is not
        // left with a legacy stage list and an empty pipeline.
        'pipelineStages',
        'pipelineTemplates',
        'productModels',
        'professionalServices',
        'projects',
        'proposals',
        'purchaseOrders',
        'quotes',
        'regions',
        'salesGoals',
        'serviceCalls',
        'serviceContracts',
        'serviceProducts',
        'serviceTickets',
        'softwareProducts',
        'supplies',
        'tasks',
        'teams',
        'technicians',
        'users',
        'vendors',
      ].sort(),
    );
    for (const [entity, n] of Object.entries(counts)) {
      expect(n, `${entity} seeded nothing`).toBeGreaterThan(0);
    }
  });

  it('issues one insert per seeded row and nothing else', () => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(state.captured.length).toBe(total);
  });

  it('never passes a key the table does not have (drizzle would drop it)', () => {
    const bad: string[] = [];
    for (const { table, values } of state.captured as Capture[]) {
      const props = new Set(Object.keys(getTableColumns(table)));
      const name = getTableConfig(table).name;
      for (const key of Object.keys(values)) {
        if (!props.has(key)) bad.push(`${name}.${key}`);
      }
    }
    expect([...new Set(bad)].sort()).toEqual([]);
  });

  it('never omits a NOT NULL column that has no default', () => {
    const missing: string[] = [];
    for (const { table, values } of state.captured as Capture[]) {
      const cfg = getTableConfig(table);
      for (const [prop, column] of Object.entries(getTableColumns(table))) {
        if (!column.notNull || column.hasDefault) continue;
        if (values[prop] === undefined || values[prop] === null) {
          missing.push(`${cfg.name}.${column.name}`);
        }
      }
    }
    expect([...new Set(missing)].sort()).toEqual([]);
  });
});
