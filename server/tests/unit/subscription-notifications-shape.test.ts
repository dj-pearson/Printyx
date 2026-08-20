// PROD-014: /subscriptions/notifications and its dismiss were Express-only, so
// in production the banner had no alerts and dismissing one did nothing. Both
// are ported now, which means the filter and the column names exist twice.
//
// This pins what a port can silently get wrong: a column that is not there, and
// a filter that quietly widens. Dropping the not-dismissed test would resurrect
// every alert a user has already cleared; dropping the tenant test would show
// them another tenant's.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { subscriptionNotifications } from '@shared/schema';

const edge = readFileSync(
  join(process.cwd(), 'supabase/functions/subscriptions/index.ts'),
  'utf-8',
);
const express = readFileSync(join(process.cwd(), 'server/routes-subscriptions.ts'), 'utf-8');

const columns = new Set(
  Object.values(getTableColumns(subscriptionNotifications) as any).map((c: any) => c.name),
);

/** The notifications block of the edge handler. */
const block = (() => {
  const at = edge.indexOf("secondSegment === 'notifications'");
  const end = edge.indexOf('GET /subscriptions/current', at);
  return edge.slice(at, end === -1 ? at + 3000 : end);
})();

describe('the columns the port writes and filters', () => {
  it.each(['tenant_id', 'user_id', 'status', 'dismissed_at', 'updated_at', 'created_at'])(
    '%s is a real column',
    (column) => {
      expect(columns.has(column)).toBe(true);
    },
  );

  it('writes no column the table does not have', () => {
    // The keys of the .update({...}) the dismiss branch sends.
    const at = block.indexOf('.update({');
    const update = block.slice(at, block.indexOf('})', at));
    const written = [...update.matchAll(/([a-z_]+):/g)].map((m) => m[1]);
    expect(written).toEqual(['status', 'dismissed_at', 'updated_at']);
    for (const key of written) expect(columns.has(key)).toBe(true);
  });
});

describe('the filter matches the Express original', () => {
  it('scopes to the tenant', () => {
    expect(block).toContain("eq('tenant_id', tenantId)");
    expect(express).toContain('subscriptionNotifications.tenantId');
  });

  it('excludes already-dismissed rows', () => {
    expect(block).toContain("neq('status', 'dismissed')");
    expect(express).toContain("!= 'dismissed'");
  });

  it('narrows to the caller when the user is known', () => {
    expect(block).toContain("eq('user_id', user.id)");
  });

  it('keeps the same 50-row cap and newest-first order', () => {
    expect(block).toContain('limit(50)');
    expect(block).toContain("order('created_at', { ascending: false })");
    expect(express).toContain('limit(50)');
  });
});

describe('the response shape the hook reads', () => {
  it('returns { notifications }, never a bare array', () => {
    expect(block).toMatch(/notifications:\s*notifications\s*\?\?\s*\[\]/);
    expect(express).toContain('res.json({ notifications })');
  });

  it('dismiss sets the status and the timestamp, scoped to the tenant', () => {
    expect(block).toContain("status: 'dismissed'");
    expect(block).toContain('dismissed_at: nowIso');
    expect(block).toMatch(/eq\('id', thirdSegment\)[\s\S]{0,80}eq\('tenant_id', tenantId\)/);
  });
});
