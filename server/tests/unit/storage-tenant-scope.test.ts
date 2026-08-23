/**
 * QUALITY-002 — the tenant predicate survives every optional filter.
 *
 * Drizzle's `.where()` ASSIGNS rather than ANDs (see the note in CLAUDE.md), so
 * `let q = db.select().from(t).where(tenantScope); if (x) q = q.where(f)` throws
 * the tenant scope away and keeps only `f`. storage.ts had that shape in six
 * places. The worst was getLocationHistory, with five chained calls: a
 * start+end range collapsed to "before endDate", and passing any filter at all
 * returned technician GPS history across every tenant.
 *
 * Drizzle's types do reject a second `.where()`, but the whole file compiled
 * with those errors for as long as the ratchet has existed, so the compiler was
 * not the thing that would catch a regression here. This drives the real
 * storage methods over a stub pg client and reads the SQL they emit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[] }));

vi.mock('../../db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const client = {
    query: async (config: { text: string; values?: unknown[] }) => {
      state.queries.push({ text: config.text, values: config.values ?? [] });
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: drizzle(client as never) };
});

import { storage } from '../../storage';

function lastSql(): string {
  return state.queries[state.queries.length - 1].text;
}

/** The first emitted query matching a marker — getTaskStats issues several. */
function sqlContaining(marker: string): string {
  const hit = state.queries.find((q) => q.text.includes(marker));
  if (!hit)
    throw new Error(
      `no query contained ${marker}; got:\n${state.queries.map((q) => q.text).join('\n')}`,
    );
  return hit.text;
}

beforeEach(() => {
  state.queries = [];
});

describe('QUALITY-002: storage keeps the tenant predicate under optional filters', () => {
  it('getLocationHistory ANDs all five predicates instead of replacing them', async () => {
    await storage.getLocationHistory({
      tenantId: 'T1',
      technicianId: 'tech-1',
      sessionId: 'sess-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    });

    const sql = lastSql();
    expect(sql).toContain('"location_history"."tenant_id" = $1');
    expect(sql).toContain('"technician_id" = $2');
    expect(sql).toContain('"session_id" = $3');
    expect(sql).toContain('"timestamp" >= $4');
    expect(sql).toContain('"timestamp" <= $5');
    // Both bounds, not just the last one written.
    expect(sql.match(/timestamp/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('getServicePhotos keeps the tenant scope when filtering by ticket', async () => {
    await storage.getServicePhotos({ tenantId: 'T1', serviceTicketId: 'tk-1' });
    const sql = lastSql();
    expect(sql).toContain('"service_photos"."tenant_id" = $1');
    expect(sql).toContain('"service_ticket_id" = $2');
  });

  it('getMobileServiceSessions keeps the tenant scope when filtering by ticket', async () => {
    await storage.getMobileServiceSessions({ tenantId: 'T1', serviceTicketId: 'tk-1' });
    const sql = lastSql();
    expect(sql).toContain('"mobile_service_sessions"."tenant_id" = $1');
    expect(sql).toContain('"service_ticket_id" = $2');
  });

  it('getTasks keeps the tenant scope when filtering by assignee', async () => {
    await storage.getTasks('T1', 'user-1');
    const sql = lastSql();
    expect(sql).toContain('"tasks"."tenant_id" = $1');
    expect(sql).toContain('"assigned_to" = $2');
  });

  it('getTaskStats keeps the tenant scope when filtering by assignee', async () => {
    await storage.getTaskStats('T1', 'user-1');
    // It issues more than one query; the grouped one carries the filters.
    const sql = sqlContaining('group by');
    expect(sql).toContain('"tasks"."tenant_id" = $1');
    expect(sql).toContain('"assigned_to" = $2');
  });

  it('getDeals keeps the tenant scope alongside stage and search', async () => {
    await storage.getDeals('T1', 'stage-1', 'acme');
    const sql = lastSql();
    expect(sql).toContain('"deals"."tenant_id" = $1');
    expect(sql).toContain('"stage_id" = $2');
    expect(sql).toContain('like');
  });
});

describe('QUALITY-002: storage queries name columns that exist', () => {
  it('getCompanyPricingSettings reads by tenant only — there is no is_active', async () => {
    await storage.getCompanyPricingSettings('T1');
    const sql = lastSql();
    expect(sql).toContain('"company_pricing_settings"."tenant_id" = $1');
    expect(sql).not.toContain('is_active');
    // Naming a column the table does not have makes drizzle emit an EMPTY
    // operand rather than raising: `... and  = $2`, which Postgres rejects as a
    // syntax error at run time. That empty slot is the thing to assert on.
    expect(sql).not.toMatch(/(and|or|where)\s{2,}=/);
  });

  it('getCustomerMeterReadings reaches the customer through equipment', async () => {
    await storage.getCustomerMeterReadings('cust-1', 'T1');
    const sql = lastSql();
    expect(sql).toContain('inner join "equipment"');
    expect(sql).toContain('"equipment"."customer_id" = $1');
    // meter_readings has no customer_id of its own.
    expect(sql).not.toContain('"meter_readings"."customer_id"');
  });

  it('getCpcRates orders by color_mode, the column cpc_rates actually has', async () => {
    await storage.getCpcRates('model-1', 'T1');
    const sql = lastSql();
    expect(sql).toContain('order by "cpc_rates"."color_mode"');
    expect(sql).not.toContain('color_type');
  });
});
