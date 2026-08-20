// PROD-014: POST /api/subscriptions/create and /upgrade were Express-only.
// SubscriptionSettings.tsx posts to /upgrade, so in production changing plans
// 404'd against the static origin, and nothing could start a subscription at
// all.
//
// The trap this pins first: the edge function already had a change-plan branch
// that resolves the plan by ID, but the frontend sends a SLUG. A port that
// reused that lookup would reject every real request while looking correct in
// review. Everything else here is the same class as the cancel/convert port —
// which rows are touched, which columns are written.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import {
  tenantSubscriptions,
  tenants,
  subscriptionEvents,
  subscriptionNotifications,
} from '@shared/schema';

const edge = readFileSync(
  join(process.cwd(), 'supabase/functions/subscriptions/index.ts'),
  'utf-8',
);
const hook = readFileSync(join(process.cwd(), 'client/src/hooks/useSubscription.ts'), 'utf-8');
const service = readFileSync(
  join(process.cwd(), 'server/services/subscription-service.ts'),
  'utf-8',
);

const cols = (table: unknown) =>
  new Set(
    Object.values(getTableColumns(table as never) as Record<string, { name: string }>).map(
      (c) => c.name,
    ),
  );

const subscriptionColumns = cols(tenantSubscriptions);
const tenantColumns = cols(tenants);
const eventColumns = cols(subscriptionEvents);
const notificationColumns = cols(subscriptionNotifications);

function branch(startMarker: string, endMarker: string): string {
  const at = edge.indexOf(startMarker);
  expect(at, `branch not found: ${startMarker}`).toBeGreaterThan(-1);
  const end = edge.indexOf(endMarker, at);
  return edge.slice(at, end === -1 ? edge.length : end);
}

const createBranch = branch(
  "secondSegment === 'create' && !thirdSegment",
  'POST /subscriptions/upgrade',
);
const upgradeBranch = branch(
  "secondSegment === 'upgrade' && !thirdSegment",
  'POST /subscriptions/cancel',
);

/** Top-level keys of the object literal starting at `from` in `text`. */
function objectKeys(text: string, from: number): string[] {
  const open = text.indexOf('{', from);
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = text.slice(open + 1, end);
  const keys: string[] = [];
  let nest = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' || ch === '[' || ch === '(') nest++;
    else if (ch === '}' || ch === ']' || ch === ')') nest--;
    else if (ch === ',' && nest === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  for (const part of parts) {
    const m = part.trim().match(/^([a-z_][a-z0-9_]*):/i);
    if (m) keys.push(m[1]);
  }
  return keys;
}

describe('both branches resolve the plan the way the frontend names it', () => {
  it('the frontend sends slugs, not ids', () => {
    expect(hook).toContain('planSlug: string');
    expect(hook).toContain('newPlanSlug: string');
  });

  it('create looks the plan up by slug', () => {
    expect(createBranch).toContain("eq('slug', planSlug)");
    expect(createBranch).not.toContain("eq('id', planSlug)");
  });

  it('upgrade looks the plan up by slug', () => {
    expect(upgradeBranch).toContain("eq('slug', newPlanSlug)");
  });

  it('leaves the id-based change-plan branch alone', () => {
    // change-plan is a different caller with a different contract; folding the
    // two would break whichever one lost.
    expect(edge).toContain("eq('id', newPlanId)");
  });
});

describe('create writes only real columns', () => {
  it('inserts the subscription with columns that exist', () => {
    const at = createBranch.indexOf(".from('tenant_subscriptions')");
    const keys = objectKeys(createBranch, createBranch.indexOf('.insert(', at));
    for (const key of keys) expect(subscriptionColumns.has(key), key).toBe(true);
    expect(keys).toContain('is_trialing');
    expect(keys).toContain('trial_end_date');
    expect(keys).toContain('billing_interval');
  });

  it('caches the plan on the tenant with columns that exist', () => {
    const at = createBranch.indexOf(".from('tenants')");
    const keys = objectKeys(createBranch, createBranch.indexOf('.update(', at));
    expect(keys).toEqual(['plan', 'subscription', 'billing_status', 'updated_at']);
    for (const key of keys) expect(tenantColumns.has(key), key).toBe(true);
  });

  it('records the event and the notification on real columns', () => {
    for (const [table, columns] of [
      ['subscription_events', eventColumns],
      ['subscription_notifications', notificationColumns],
    ] as const) {
      const at = createBranch.indexOf(`.from('${table}')`);
      const keys = objectKeys(createBranch, createBranch.indexOf('.insert(', at));
      expect(keys.length).toBeGreaterThan(3);
      for (const key of keys) expect(columns.has(key), `${table}.${key}`).toBe(true);
    }
  });

  it('refuses a second subscription rather than double-billing', () => {
    expect(createBranch).toContain("in('status', ['active', 'trialing'])");
    expect(createBranch).toContain('Tenant already has an active subscription');
    expect(service).toContain("IN ('active', 'trialing')");
  });

  it('refuses a plan that is not available', () => {
    expect(createBranch).toContain('!plan.is_active || !plan.is_visible');
    expect(service).toContain('!plan.isActive || !plan.isVisible');
  });

  it('validates the billing cycle before writing anything', () => {
    const guard = createBranch.indexOf("['monthly', 'annual'].includes(billingCycle)");
    const insert = createBranch.indexOf('.insert(');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(insert);
  });

  it('takes the trial decision from the shared helper, not its own', () => {
    expect(createBranch).toContain('resolveTrialPeriod(');
    expect(createBranch).not.toContain('trial_days * 24 * 60 * 60 * 1000');
    expect(service).toContain('resolveTrialPeriod(');
  });
});

describe('upgrade writes only real columns', () => {
  it('updates the subscription with columns that exist', () => {
    const at = upgradeBranch.indexOf(".from('tenant_subscriptions')\n        .update(");
    const keys = objectKeys(upgradeBranch, upgradeBranch.indexOf('.update(', at));
    expect(keys).toEqual(['plan_id', 'billing_cycle', 'amount', 'updated_at']);
    for (const key of keys) expect(subscriptionColumns.has(key), key).toBe(true);
  });

  it('re-caches the plan slug on the tenant', () => {
    const at = upgradeBranch.indexOf(".from('tenants')");
    const keys = objectKeys(upgradeBranch, upgradeBranch.indexOf('.update(', at));
    expect(keys).toEqual(['plan', 'updated_at']);
    for (const key of keys) expect(tenantColumns.has(key), key).toBe(true);
  });

  it('names both ends of the move in the event', () => {
    const at = upgradeBranch.indexOf(".from('subscription_events')");
    const keys = objectKeys(upgradeBranch, upgradeBranch.indexOf('.insert(', at));
    expect(keys).toContain('from_plan');
    expect(keys).toContain('to_plan');
    for (const key of keys) expect(eventColumns.has(key), key).toBe(true);
  });

  it('decides upgrade vs downgrade through the shared numeric comparison', () => {
    // PostgREST returns amount as a string. Comparing it to a number without
    // parsing is lexicographic, which labels a $9 -> $10 move a downgrade in
    // the event log and in what the customer is told.
    expect(upgradeBranch).toContain('isUpgradeAmount(newAmount, currentSubscription.amount)');
    expect(upgradeBranch).not.toMatch(/newAmount > currentSubscription\.amount/);
    expect(service).toContain('isUpgradeAmount(newAmount, currentSubscription.amount)');
  });

  it('requires an existing subscription', () => {
    expect(upgradeBranch).toContain("in('status', ['active', 'trialing', 'past_due'])");
    expect(upgradeBranch).toContain('No active subscription found');
  });

  it('refuses a scheduled change instead of pretending to book one', () => {
    // Express throws here rather than silently applying the change now.
    expect(upgradeBranch).toContain('Scheduled plan changes not yet implemented');
    expect(service).toContain('Scheduled plan changes not yet implemented');
  });
});
