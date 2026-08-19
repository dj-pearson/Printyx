// PROD-014 parity lock.
//
// GET /api/subscriptions/current is what SubscriptionBanner reads, and that
// banner is mounted in App.tsx — it runs on every page. The endpoint existed
// only on Express, so in production the whole plan/usage/trial surface answered
// nothing. Now both backends compute it, which means the limit merge, the
// overage test and the day counts exist twice:
//
//   server/lib/subscription-status.ts
//   supabase/functions/_shared/subscription-status.ts
//
// This imports both. The two behaviours worth pinning hardest are the storage
// unit (plan limits are GB, usage is MB) and the `||` in the custom-limit merge,
// because getting either wrong in one copy puts every tenant over their limit,
// or none of them, depending on which backend answered.
import { describe, it, expect } from 'vitest';

import * as node from '../../lib/subscription-status';
import * as edge from '../../../supabase/functions/_shared/subscription-status';

const NOW = new Date('2026-08-19T12:00:00.000Z');

const PLAN = {
  id: 'plan-pro',
  max_users: 25,
  max_storage: 100, // GB
  max_api_calls: 50_000,
  max_locations: 5,
  max_business_records: 10_000,
  features: ['reports', 'api'],
};

const USAGE = {
  total_users: 10,
  storage_used_mb: 4096,
  api_calls: 1200,
  active_locations: 2,
  business_records: 900,
};

function bothLimits(plan: any, custom: any) {
  const a = node.mergeLimits(plan, custom);
  expect(edge.mergeLimits(plan, custom)).toEqual(a);
  return a;
}

function bothOverages(usage: any, limits: any) {
  const a = node.computeOverages(usage, limits);
  expect(edge.computeOverages(usage, limits)).toEqual(a);
  return a;
}

describe('readUsage', () => {
  it('reads the snake_case row PostgREST returns', () => {
    const a = node.readUsage(USAGE);
    expect(edge.readUsage(USAGE)).toEqual(a);
    expect(a).toEqual({
      users: 10,
      storage: 4096,
      apiCalls: 1200,
      locations: 2,
      businessRecords: 900,
    });
  });

  it('reads the camelCase row Drizzle returns', () => {
    const camel = {
      totalUsers: 10,
      storageUsedMb: 4096,
      apiCalls: 1200,
      activeLocations: 2,
      businessRecords: 900,
    };
    expect(node.readUsage(camel)).toEqual(node.readUsage(USAGE));
    expect(edge.readUsage(camel)).toEqual(node.readUsage(USAGE));
  });

  it('is all zeroes when there is no usage row for the period', () => {
    for (const empty of [null, undefined, {}]) {
      expect(node.readUsage(empty as any)).toEqual({
        users: 0,
        storage: 0,
        apiCalls: 0,
        locations: 0,
        businessRecords: 0,
      });
      expect(edge.readUsage(empty as any)).toEqual(node.readUsage(empty as any));
    }
  });
});

describe('mergeLimits', () => {
  it('uses the plan when there is no override', () => {
    expect(bothLimits(PLAN, null)).toEqual({
      users: 25,
      storage: 100,
      apiCalls: 50_000,
      locations: 5,
      businessRecords: 10_000,
    });
  });

  it('lets a custom limit win', () => {
    expect(bothLimits(PLAN, { maxUsers: 40 }).users).toBe(40);
  });

  // `||` not `??`, matching the Express original: a 0 in custom_limits means
  // "nothing recorded", not "zero allowed". Flipping this would silently give
  // every such tenant a limit of zero.
  it('treats a zero override as absent, not as a limit of zero', () => {
    expect(bothLimits(PLAN, { maxUsers: 0 }).users).toBe(25);
  });

  it('carries -1 through as unlimited', () => {
    expect(bothLimits({ ...PLAN, max_users: -1 }, null).users).toBe(-1);
    expect(bothLimits(PLAN, { maxUsers: -1 }).users).toBe(-1);
  });

  it('reads camelCase plan columns too', () => {
    expect(bothLimits({ maxUsers: 7 }, null).users).toBe(7);
  });
});

describe('computeOverages', () => {
  const limits = {
    users: 25,
    storage: 100,
    apiCalls: 50_000,
    locations: 5,
    businessRecords: 10_000,
  };

  it('is clear when everything is inside the limit', () => {
    expect(bothOverages(node.readUsage(USAGE), limits)).toEqual({
      isOverLimit: false,
      overageDetails: {},
    });
  });

  it('reports the amount over, not just the fact', () => {
    const over = { ...node.readUsage(USAGE), users: 30 };
    expect(bothOverages(over, limits)).toEqual({
      isOverLimit: true,
      overageDetails: { users: 5 },
    });
  });

  // The asymmetry to get right: the plan states GB, usage records MB.
  it('compares storage in MB against a limit stated in GB', () => {
    const under = { ...node.readUsage(USAGE), storage: 100 * 1024 };
    expect(bothOverages(under, limits).isOverLimit).toBe(false);

    const over = { ...node.readUsage(USAGE), storage: 100 * 1024 + 512 };
    expect(bothOverages(over, limits)).toEqual({
      isOverLimit: true,
      overageDetails: { storage: 512 },
    });
  });

  it('never flags a limit of -1', () => {
    const unlimited = { users: -1, storage: -1, apiCalls: -1, locations: -1, businessRecords: -1 };
    const huge = {
      users: 1e6,
      storage: 1e9,
      apiCalls: 1e9,
      locations: 1e6,
      businessRecords: 1e9,
    };
    expect(bothOverages(huge, unlimited)).toEqual({ isOverLimit: false, overageDetails: {} });
  });

  it('reports every breached limit at once', () => {
    const over = {
      users: 30,
      storage: 200 * 1024,
      apiCalls: 60_000,
      locations: 9,
      businessRecords: 11_000,
    };
    const result = bothOverages(over, limits);
    expect(Object.keys(result.overageDetails).sort()).toEqual([
      'apiCalls',
      'businessRecords',
      'locations',
      'storage',
      'users',
    ]);
  });

  it('does not flag usage exactly at the limit', () => {
    expect(bothOverages({ ...node.readUsage(USAGE), users: 25 }, limits).isOverLimit).toBe(false);
  });
});

describe('daysUntil', () => {
  it.each([
    ['2026-08-26T12:00:00.000Z', 7],
    ['2026-08-19T12:00:00.000Z', 0],
    ['2026-08-19T13:00:00.000Z', 1], // rounds up: any part of a day counts
    ['2026-08-12T12:00:00.000Z', -7], // already past
  ])('daysUntil(%s) === %i', (date, expected) => {
    expect(node.daysUntil(date, NOW)).toBe(expected);
    expect(edge.daysUntil(date, NOW)).toBe(expected);
  });

  it('accepts a Date as well as a string', () => {
    expect(node.daysUntil(new Date('2026-08-26T12:00:00.000Z'), NOW)).toBe(7);
    expect(edge.daysUntil(new Date('2026-08-26T12:00:00.000Z'), NOW)).toBe(7);
  });

  it('is 0 rather than NaN for a missing or unparseable date', () => {
    for (const bad of [null, undefined, '', 'not a date']) {
      expect(node.daysUntil(bad as any, NOW)).toBe(0);
      expect(edge.daysUntil(bad as any, NOW)).toBe(0);
    }
  });
});

describe('trialDaysRemaining', () => {
  it('counts down while trialing', () => {
    const sub = { is_trialing: true, trial_end_date: '2026-08-24T12:00:00.000Z' };
    expect(node.trialDaysRemaining(sub, NOW)).toBe(5);
    expect(edge.trialDaysRemaining(sub, NOW)).toBe(5);
  });

  it('is undefined when not trialing, not zero', () => {
    const sub = { is_trialing: false, trial_end_date: '2026-08-24T12:00:00.000Z' };
    expect(node.trialDaysRemaining(sub, NOW)).toBeUndefined();
    expect(edge.trialDaysRemaining(sub, NOW)).toBeUndefined();
  });

  it('is undefined when trialing with no end date recorded', () => {
    expect(node.trialDaysRemaining({ is_trialing: true }, NOW)).toBeUndefined();
    expect(edge.trialDaysRemaining({ is_trialing: true }, NOW)).toBeUndefined();
  });

  it('floors at zero once the trial has passed', () => {
    const sub = { is_trialing: true, trial_end_date: '2026-08-01T12:00:00.000Z' };
    expect(node.trialDaysRemaining(sub, NOW)).toBe(0);
    expect(edge.trialDaysRemaining(sub, NOW)).toBe(0);
  });

  it('reads the camelCase subscription too', () => {
    const sub = { isTrialing: true, trialEndDate: '2026-08-24T12:00:00.000Z' };
    expect(node.trialDaysRemaining(sub, NOW)).toBe(5);
    expect(edge.trialDaysRemaining(sub, NOW)).toBe(5);
  });
});

describe('buildSubscriptionStatus', () => {
  const subscription = {
    id: 'sub-1',
    plan_id: 'plan-pro',
    status: 'trialing',
    current_period_end: '2026-09-18T12:00:00.000Z',
    is_trialing: true,
    trial_end_date: '2026-08-24T12:00:00.000Z',
    custom_limits: null,
  };

  it('is identical across copies', () => {
    expect(edge.buildSubscriptionStatus(subscription, PLAN, USAGE, NOW)).toEqual(
      node.buildSubscriptionStatus(subscription, PLAN, USAGE, NOW),
    );
  });

  it('returns the keys the hook reads', () => {
    const status = node.buildSubscriptionStatus(subscription, PLAN, USAGE, NOW);
    expect(Object.keys(status).sort()).toEqual([
      'daysUntilRenewal',
      'features',
      'hasSubscription',
      'isOverLimit',
      'isTrialing',
      'limits',
      'overageDetails',
      'plan',
      'subscription',
      'trialDaysRemaining',
      'usage',
    ]);
    expect(status.hasSubscription).toBe(true);
    expect(status.daysUntilRenewal).toBe(30);
    expect(status.trialDaysRemaining).toBe(5);
  });

  it('has empty features rather than undefined when the plan lists none', () => {
    const status = node.buildSubscriptionStatus(
      subscription,
      { ...PLAN, features: null },
      USAGE,
      NOW,
    );
    expect(status.features).toEqual([]);
    expect(
      edge.buildSubscriptionStatus(subscription, { ...PLAN, features: null }, USAGE, NOW),
    ).toEqual(status);
  });

  it('works with no usage row for the period', () => {
    const status = node.buildSubscriptionStatus(subscription, PLAN, null, NOW);
    expect(status.isOverLimit).toBe(false);
    expect(edge.buildSubscriptionStatus(subscription, PLAN, null, NOW)).toEqual(status);
  });
});

describe('nextPeriodEnd parity', () => {
  // POST /api/subscriptions/convert-trial was Express-only too, so converting a
  // trial did nothing in production. Both backends now write the renewal date,
  // and a customer whose renewal lands on a different day depending on which
  // backend answered is a billing dispute, so the calendar arithmetic is pinned.
  const cases: Array<[string, string | null | undefined, string]> = [
    ['annual', 'annual', '2027-08-19'],
    ['monthly', 'monthly', '2026-09-19'],
    ['unset cycle falls back to monthly', null, '2026-09-19'],
    ['unknown cycle falls back to monthly', 'weekly', '2026-09-19'],
  ];

  it.each(cases)('%s', (_label, cycle, expectedDay) => {
    const nodeEnd = node.nextPeriodEnd(NOW, cycle);
    const edgeEnd = edge.nextPeriodEnd(NOW, cycle);
    expect(edgeEnd.getTime()).toBe(nodeEnd.getTime());
    expect(
      `${nodeEnd.getFullYear()}-${String(nodeEnd.getMonth() + 1).padStart(2, '0')}-${String(
        nodeEnd.getDate(),
      ).padStart(2, '0')}`,
    ).toBe(expectedDay);
  });

  it('rolls a month end forward the same way on both sides', () => {
    // Jan 31 + 1 month has no Feb 31; Date normalizes it into March. That has
    // always been production's behaviour — the point is that it stays identical,
    // not that it is elegant.
    const jan31 = new Date(2026, 0, 31, 12);
    expect(edge.nextPeriodEnd(jan31, 'monthly').getTime()).toBe(
      node.nextPeriodEnd(jan31, 'monthly').getTime(),
    );
    expect(node.nextPeriodEnd(jan31, 'monthly').getMonth()).toBe(2); // March
  });

  it('leaves a leap day on Feb 29 -> Feb 28 identically', () => {
    const feb29 = new Date(2028, 1, 29, 12);
    expect(edge.nextPeriodEnd(feb29, 'annual').getTime()).toBe(
      node.nextPeriodEnd(feb29, 'annual').getTime(),
    );
  });
});
