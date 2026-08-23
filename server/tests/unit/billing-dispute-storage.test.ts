/**
 * QUALITY-002 — advanced billing storage writes the columns it is handed.
 *
 * server/routes/advanced-billing-routes.ts called fifteen storage methods that
 * do not exist: resolveMeterAnomaly, getOpenBillingDisputes,
 * assignBillingDispute, resolveBillingDispute and so on. Storage had settled on
 * the shorter names (resolveAnomaly, getOpenDisputes, assignDispute,
 * resolveDispute) and the router was never updated, so every one of those
 * handlers was a TypeError on its first request.
 *
 * Renaming them surfaced two things the compiler cannot check, which is what
 * this file is for:
 *
 *   resolveAnomaly took correctedBwReading / correctedColorReading from the
 *   route and dropped them, even though meter_anomalies has both columns and
 *   correcting the reading is the main reason to resolve an anomaly.
 *
 *   escalateDispute named its third parameter userId while writing it straight
 *   into escalated_to, so the argument means the opposite of what it was called.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[] }));

vi.mock('../../db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const client = {
    // node-postgres is called as query(config, values) — the parameters are the
    // SECOND argument, not a field on the config object.
    query: async (config: { text: string }, values?: unknown[]) => {
      state.queries.push({ text: config.text, values: values ?? [] });
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: drizzle(client as never) };
});

import { storage } from '../../storage';

const last = () => state.queries[state.queries.length - 1];

/** Just the SET clause: `returning` lists every column, including ones not set. */
function setClause(text: string): string {
  return text.slice(text.indexOf(' set '), text.indexOf(' where '));
}

beforeEach(() => {
  state.queries = [];
});

describe('QUALITY-002: resolveAnomaly records the corrected readings', () => {
  it('writes both corrected columns when the caller supplies them', async () => {
    await storage.resolveAnomaly(
      'a1',
      'T1',
      'manual_correction',
      'rekeyed from the panel',
      45230,
      8450,
    );
    const { text, values } = last();
    const set = setClause(text);
    expect(set).toContain('"corrected_bw_reading"');
    expect(set).toContain('"corrected_color_reading"');
    expect(values).toContain(45230);
    expect(values).toContain(8450);
    expect(set).toContain('"resolved"');
  });

  it('omits them when the caller has no correction to record', async () => {
    await storage.resolveAnomaly('a1', 'T1', 'accepted', 'reading confirmed');
    const set = setClause(last().text);
    expect(set).not.toContain('corrected_bw_reading');
    expect(set).not.toContain('corrected_color_reading');
    expect(set).toContain('"resolution_method"');
  });

  it('still scopes the update by tenant', async () => {
    await storage.resolveAnomaly('a1', 'T1', 'accepted', 'ok');
    expect(last().text).toContain('"tenant_id" = ');
  });
});

describe('QUALITY-002: escalateDispute escalates TO the third argument', () => {
  it('writes it into escalated_to, not into a resolver field', async () => {
    await storage.escalateDispute('d1', 'T1', 'manager-9', 'customer rejected the credit');
    const { text, values } = last();
    const set = setClause(text);
    expect(set).toContain('"escalated_to"');
    expect(values).toContain('manager-9');
    expect(values).toContain('customer rejected the credit');
    expect(set).toContain('"escalated"');
  });
});

describe('QUALITY-002: resolveDispute takes the resolution as one object', () => {
  it('records the approved credit amount alongside the resolution', async () => {
    await storage.resolveDispute('d1', 'T1', 'user-1', {
      resolutionType: 'partial_credit',
      resolutionDescription: 'credited the colour overage',
      creditAmount: 125.5,
    });
    const { text, values } = last();
    const set = setClause(text);
    expect(set).toContain('"approved_credit_amount"');
    expect(set).toContain('"resolved_by"');
    expect(values).toContain('125.5');
    expect(values).toContain('user-1');
  });
});
