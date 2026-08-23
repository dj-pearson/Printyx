/**
 * QUALITY-002 — auto lead routing reads the PER-TENANT lead tables.
 *
 * The service imported the platform tables under the per-tenant names:
 *
 *   platformLeadScoringRules   as leadScoringRules
 *   platformBantQualification  as bantQualificationCriteria
 *   platformRepCapacity        as repCapacity
 *   platformSalesTerritories   as salesTerritories
 *   platformLeadAssignmentHistory as leadAssignmentHistory
 *
 * Those are PLATFORM-level configuration: they have no tenant_id at all, and
 * their columns differ (points vs scorePoints, business_record_id vs lead_id,
 * current_active_prospects vs current_active_leads). Every query filtered them
 * by tenantId, which drizzle compiles to an empty operand — so lead scoring,
 * BANT lookup, capacity and territory matching all raised at run time. The
 * feature is live: there is an /auto-lead-routing dashboard page, a route file,
 * and web-form-processor calls it for inbound form leads.
 *
 * The per-tenant tables the service was written for exist in
 * shared/lead-scoring-schema.ts and shared/lead-assignment-schema.ts and carry
 * exactly the columns the code uses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import * as scoring from '../../../shared/lead-scoring-schema';
import * as platform from '../../../shared/platform-crm-schema';

const state = vi.hoisted(() => ({ queries: [] as { text: string; values: unknown[] }[] }));

/** Positional stub rows: drizzle asks node-postgres for rowMode 'array'. */
function selectArity(sql: string): number {
  const body = sql.slice('select '.length, sql.indexOf(' from '));
  let depth = 0;
  let items = 1;
  for (const ch of body) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) items += 1;
  }
  return items;
}

vi.mock('../../db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('../../../shared/schema');
  const client = {
    query: async (config: { text: string }, values?: unknown[]) => {
      state.queries.push({ text: config.text, values: values ?? [] });
      // Only the lead itself comes back, so scoring runs with no rules and the
      // flow stops at "no available reps" — far enough to see every read.
      if (config.text.startsWith('select ') && config.text.includes('"business_records"')) {
        return {
          rows: [Array.from({ length: selectArity(config.text) }, (_, i) => `v${i}`)],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: drizzle({ client: client as never, schema }) };
});

import { autoLeadRoutingService } from '../../services/auto-lead-routing-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LEAD = '22222222-2222-4222-8222-222222222222';

async function route() {
  await autoLeadRoutingService.routeLeadAutomatically(LEAD, TENANT).catch(() => undefined); // ends at "No available sales reps" with the stub
}

const find = (fragment: string) => state.queries.find((q) => q.text.includes(fragment));

beforeEach(() => {
  state.queries = [];
});

describe('QUALITY-002: the per-tenant and platform lead tables are different tables', () => {
  it('the platform ones have no tenant_id, which is why filtering them raised', () => {
    for (const table of [
      platform.platformLeadScoringRules,
      platform.platformRepCapacity,
      platform.platformSalesTerritories,
    ]) {
      expect(Object.keys(getTableColumns(table))).not.toContain('tenantId');
    }
  });

  it('the per-tenant ones carry tenantId and the columns this service uses', () => {
    expect(Object.keys(getTableColumns(scoring.leadScoringRules))).toEqual(
      expect.arrayContaining(['tenantId', 'scorePoints', 'isActive', 'priority']),
    );
    expect(Object.keys(getTableColumns(scoring.bantQualificationCriteria))).toEqual(
      expect.arrayContaining(['tenantId', 'leadId', 'totalBantScore']),
    );
    expect(Object.keys(getTableColumns(scoring.leadScoreCalculations))).toEqual(
      expect.arrayContaining(['tenantId', 'leadId', 'predictionScore', 'rulesApplied']),
    );
  });
});

describe('QUALITY-002: every read is against the tenant-scoped table', () => {
  it('scores from lead_scoring_rules, filtered by tenant', async () => {
    await route();
    const read = find('from "lead_scoring_rules"');
    expect(read, 'lead_scoring_rules was never read').toBeTruthy();
    expect(read!.text).not.toContain('platform_lead_scoring_rules');
    expect(read!.values).toContain(TENANT);
  });

  it('looks BANT up by lead_id and tenant_id', async () => {
    await route();
    const read = find('from "bant_qualification_criteria"');
    expect(read).toBeTruthy();
    expect(read!.text).toContain('"lead_id" =');
    expect(read!.text).toContain('"tenant_id" =');
    // The lead id is whatever the stubbed business_records row returned, so the
    // tenant is the value worth pinning here.
    expect(read!.values).toContain(TENANT);
  });

  it('reads rep capacity from the tenant-scoped table', async () => {
    await route();
    const read = find('from "rep_capacity"');
    expect(read).toBeTruthy();
    expect(read!.text).not.toContain('platform_rep_capacity');
    expect(read!.values).toContain(TENANT);
  });

  it('never emits an empty operand, which is what a missing column compiles to', async () => {
    await route();
    expect(state.queries.map((q) => q.text).join('\n')).not.toMatch(/(and|or|where)\s{2,}=/);
  });
});

describe('QUALITY-002: the score calculation persists what the table can hold', () => {
  it('writes prediction_score as a string and records the rules applied', async () => {
    await route();
    const insert = state.queries.find((q) =>
      q.text.startsWith('insert into "lead_score_calculations"'),
    );
    expect(insert, 'no score calculation was written').toBeTruthy();
    expect(insert!.values, 'tenant was dropped').toContain(TENANT);
    // prediction_score is a decimal column: a number would be rejected.
    expect(insert!.values.some((v) => typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))).toBe(true);
    expect(insert!.values.every((v) => typeof v !== 'number' || Number.isInteger(v))).toBe(true);
  });
});
