// Round 171 (route-divergence: leads). Express's enforceUsageLimits on
// POST /api/leads never ran in production, where supabase/functions/leads/
// created records with no plan check. The edge side now applies the same rule.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  usageLimitDecision,
  usageLimitRefusal,
  usageLimitBody,
} from '../../../supabase/functions/_shared/usage-limit';

const NOW = new Date('2026-09-23T12:00:00Z');
const PLAN = {
  id: 'p1',
  slug: 'starter',
  max_users: 5,
  max_storage: 10,
  max_api_calls: 1000,
  max_locations: 1,
  max_business_records: 100,
};
const SUB = { id: 's1', plan_id: 'p1', status: 'active', is_free: false };
const UNDER = {
  total_users: 2,
  storage_used_mb: 10,
  api_calls: 5,
  active_locations: 1,
  business_records: 99,
};
const OVER = { ...UNDER, business_records: 101 };

describe('usageLimitDecision', () => {
  it('allows a tenant under every limit', () => {
    expect(usageLimitDecision(SUB, PLAN, UNDER, NOW)).toBeNull();
  });

  it('refuses a tenant over a limit, naming the overage and plan', () => {
    const body = usageLimitDecision(SUB, PLAN, OVER, NOW);
    expect(body).not.toBeNull();
    expect(body!.code).toBe('USAGE_LIMIT_EXCEEDED');
    expect(body!.overageDetails).toEqual({ businessRecords: 1 });
    expect(body!.currentPlan).toBe('starter');
  });

  it('allows an admin-granted free subscription even when over', () => {
    expect(usageLimitDecision({ ...SUB, is_free: true }, PLAN, OVER, NOW)).toBeNull();
  });

  it('allows a tenant with no subscription or no plan', () => {
    expect(usageLimitDecision(null, PLAN, OVER, NOW)).toBeNull();
    expect(usageLimitDecision(SUB, null, OVER, NOW)).toBeNull();
  });

  it('treats -1 as unlimited', () => {
    expect(usageLimitDecision(SUB, { ...PLAN, max_business_records: -1 }, OVER, NOW)).toBeNull();
  });
});

function stub(rows: Record<string, unknown>, fail = false) {
  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        lte: () => chain,
        gte: () => chain,
        maybeSingle: async () => {
          if (fail) throw new Error('connection reset');
          return { data: rows[table] ?? null, error: null };
        },
      };
      return chain;
    },
  };
}

describe('usageLimitRefusal', () => {
  it('reads the three tables and refuses when over', async () => {
    const r = await usageLimitRefusal(
      stub({ tenant_subscriptions: SUB, subscription_plans: PLAN, usage_metrics: OVER }),
      't1',
      NOW,
    );
    expect(r?.code).toBe('USAGE_LIMIT_EXCEEDED');
  });

  it('fails OPEN when the read throws, like the Express middleware', async () => {
    await expect(usageLimitRefusal(stub({}, true), 't1', NOW)).resolves.toBeNull();
  });
});

describe('parity with the Express middleware', () => {
  it('answers the same body keys and wording', () => {
    const express = readFileSync('server/middleware/subscription.ts', 'utf8');
    const block = express.slice(express.indexOf('export async function enforceUsageLimits'));
    const body = usageLimitBody({ overageDetails: {}, plan: { slug: 'x' } });
    for (const [k, v] of Object.entries(body)) {
      expect(block).toContain(`${k}:`);
      if (typeof v === 'string' && k !== 'currentPlan') expect(block).toContain(v);
    }
  });
});

describe('the leads edge function', () => {
  const src = readFileSync('supabase/functions/leads/index.ts', 'utf8');

  it('checks the limit in the create branch, before the insert', () => {
    const at = src.indexOf("req.method === 'POST' && !leadId");
    expect(at).toBeGreaterThan(0);
    const check = src.indexOf('await usageLimitRefusal(admin, tenantId)', at);
    const insert = src.indexOf(".from('business_records')", at);
    expect(check).toBeGreaterThan(at);
    expect(check).toBeLessThan(insert);
    expect(src.slice(check, insert)).toMatch(/createCorsResponse\(overLimit, 403, req\)/);
  });
});
