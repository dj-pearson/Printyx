// PROD-014: POST /api/subscriptions/cancel and /convert-trial were Express-only.
// SubscriptionSettings.tsx posts to both, so in production the Cancel button and
// the trial conversion 404'd against the static origin and the subscription
// stayed exactly as it was — the user saw an error and nothing changed.
//
// Porting them duplicates the state transition. What a port silently gets wrong
// is which rows it touches and which columns it writes: a cancellation that
// forgets the tenant row leaves a canceled tenant fully active, and a conversion
// that writes a column the table lacks is a PGRST204 the user reads as "failed"
// after the money moved. Both are pinned here against the real Drizzle columns.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { tenantSubscriptions, subscriptionEvents, subscriptionNotifications } from '@shared/schema';
import { tenants } from '@shared/schema';

const edge = readFileSync(
  join(process.cwd(), 'supabase/functions/subscriptions/index.ts'),
  'utf-8',
);
const service = readFileSync(
  join(process.cwd(), 'server/services/subscription-service.ts'),
  'utf-8',
);

const cols = (table: any) =>
  new Set(Object.values(getTableColumns(table) as any).map((c: any) => c.name));

const subscriptionColumns = cols(tenantSubscriptions);
const tenantColumns = cols(tenants);
const eventColumns = cols(subscriptionEvents);
const notificationColumns = cols(subscriptionNotifications);

/** Slice one routed branch out of the handler. */
function branch(startMarker: string, endMarker: string): string {
  const at = edge.indexOf(startMarker);
  expect(at, `branch not found: ${startMarker}`).toBeGreaterThan(-1);
  const end = edge.indexOf(endMarker, at);
  return edge.slice(at, end === -1 ? edge.length : end);
}

const cancelBranch = branch(
  "secondSegment === 'cancel' && !thirdSegment",
  'POST /subscriptions/convert-trial',
);
const convertBranch = branch(
  "secondSegment === 'convert-trial' && !thirdSegment",
  'POST /subscriptions/:id/cancel',
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

  // Split on top-level commas so a one-line literal reads the same as a
  // multi-line one, then take the leading key of each part.
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

describe('cancel writes only real columns', () => {
  it('updates tenant_subscriptions with columns that exist', () => {
    const keys = objectKeys(cancelBranch, cancelBranch.indexOf('subscriptionUpdate: Record'));
    expect(keys).toEqual(['canceled_at', 'updated_at']);
    for (const key of [...keys, 'status', 'ended_at', 'cancel_at']) {
      expect(subscriptionColumns.has(key), key).toBe(true);
    }
    // The conditional half of the update, set outside the literal.
    expect(cancelBranch).toContain("subscriptionUpdate.status = 'canceled'");
    expect(cancelBranch).toContain('subscriptionUpdate.ended_at = nowIso');
    expect(cancelBranch).toContain(
      'subscriptionUpdate.cancel_at = subscription.current_period_end',
    );
  });

  it('deactivates the tenant with columns that exist', () => {
    const at = cancelBranch.indexOf(".from('tenants')");
    const keys = objectKeys(cancelBranch, cancelBranch.indexOf('.update(', at));
    expect(keys).toEqual(['subscription', 'billing_status', 'is_active', 'updated_at']);
    for (const key of keys) expect(tenantColumns.has(key), key).toBe(true);
  });

  it('touches the tenant row only for an immediate cancellation', () => {
    // Express leaves an end-of-period cancellation active until it lapses. A
    // port that deactivated unconditionally would lock every canceling customer
    // out of the access they already paid for.
    // The guard has to be the statement the update sits inside, so match the
    // two together rather than looking for an `if (immediate)` anywhere above.
    expect(cancelBranch).toMatch(
      /if \(immediate\) \{\s*const \{ error: tenantError \} = await admin\s*\.from\('tenants'\)/,
    );
    // The Node service names it in Drizzle camelCase.
    expect(service).toContain('isActive: false');
  });

  it('records the cancellation event with the keys the Node service records', () => {
    const at = cancelBranch.indexOf(".from('subscription_events')");
    const keys = objectKeys(cancelBranch, cancelBranch.indexOf('.insert(', at));
    expect(keys).toEqual([
      'tenant_id',
      'subscription_id',
      'event_type',
      'user_id',
      'data',
      'created_at',
    ]);
    for (const key of keys) expect(eventColumns.has(key), key).toBe(true);
    // LEGAL-011 wants the durable record to answer what was cancelled, when it
    // took effect, and whether the customer was told.
    for (const field of ['mode', 'effectiveDate', 'confirmationSent', 'confirmationError']) {
      expect(cancelBranch).toContain(field);
      expect(service).toContain(field);
    }
  });

  it('writes the in-app notification with columns that exist', () => {
    const at = cancelBranch.indexOf(".from('subscription_notifications')");
    const keys = objectKeys(cancelBranch, cancelBranch.indexOf('.insert(', at));
    for (const key of keys) expect(notificationColumns.has(key), key).toBe(true);
    expect(keys).toContain('action_url');
    expect(keys).toContain('action_text');
  });

  it('picks the same subscription Express picks', () => {
    expect(cancelBranch).toContain("in('status', ['active', 'trialing', 'past_due'])");
    expect(service).toContain("IN ('active', 'trialing', 'past_due')");
    expect(cancelBranch).toContain("eq('tenant_id', tenantId)");
  });

  it('never reports success when nothing was updated', () => {
    expect(cancelBranch).toContain('if (!subscription)');
    expect(cancelBranch).toContain('No active subscription found');
  });
});

describe('convert-trial writes only real columns', () => {
  it('activates the subscription with columns that exist', () => {
    const at = convertBranch.indexOf(".from('tenant_subscriptions')\n        .update(");
    const keys = objectKeys(convertBranch, convertBranch.indexOf('.update(', at));
    expect(keys).toEqual([
      'status',
      'is_trialing',
      'current_period_start',
      'current_period_end',
      'updated_at',
    ]);
    for (const key of keys) expect(subscriptionColumns.has(key), key).toBe(true);
  });

  it('marks the tenant current with columns that exist', () => {
    const at = convertBranch.indexOf(".from('tenants')");
    const keys = objectKeys(convertBranch, convertBranch.indexOf('.update(', at));
    expect(keys).toEqual(['subscription', 'billing_status', 'updated_at']);
    for (const key of keys) expect(tenantColumns.has(key), key).toBe(true);
  });

  it('converts only a trialing subscription', () => {
    expect(convertBranch).toContain("eq('status', 'trialing')");
    expect(convertBranch).toContain('No trial subscription found');
    expect(service).toContain("eq(tenantSubscriptions.status, 'trialing')");
  });

  it('takes the renewal date from the shared arithmetic, not its own', () => {
    // A second copy of the annual/monthly calendar maths is how the two
    // backends end up writing different renewal dates for the same customer.
    expect(convertBranch).toContain('nextPeriodEnd(now, subscription.billing_cycle)');
    expect(convertBranch).not.toMatch(/getFullYear\(\) \+ 1/);
    expect(service).toContain('nextPeriodEnd(now, subscription.billingCycle)');
  });
});
