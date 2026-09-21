/**
 * PROD-008: /api/leads/:id/activities was broken on both hosts.
 *
 * Production had no `activities` branch in supabase/functions/leads/, so the
 * iOS quick-log FAB and its offline write queue hit the trailing 404. Dev's
 * Express handler spread the request body into drizzle, which drops a key that
 * is not a column - iOS sends `type`, the column is `activity_type` - so the
 * NOT NULL column arrived null and Postgres answered 23502. Both are proven
 * against a real Postgres 16 in the story notes, not inferred.
 *
 * Everything below exercises the shared module with real inputs rather than
 * reading either handler as text, because the property is what comes OUT and a
 * source check cannot tell a correct mapping from a constant that is still in
 * the file.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { businessRecordActivities } from '@shared/schema';
import {
  ACTIVITY_FIELDS_WITHOUT_COLUMNS,
  buildActivityInsert,
  presentActivity,
} from '@shared/lead-activity-write';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments stripped: an absence assertion must not match its own explanation. */
function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ctx = { tenantId: 't1', businessRecordId: 'rec-1', createdBy: 'user-1' };

/** Exactly what ios QuickLogActivityRequest encodes. */
const iosBody = () => ({
  type: 'call',
  subject: 'Phone call',
  description: 'Left a voicemail',
  activityDate: '2026-09-21T15:04:00.000Z',
  outcome: 'voicemail',
  latitude: 41.88,
  longitude: -87.62,
  horizontalAccuracyMeters: 12,
});

describe('buildActivityInsert', () => {
  it("maps the iOS app's `type` onto activity_type, which is why dev 23502'd", () => {
    const plan = buildActivityInsert(iosBody(), ctx);
    expect(plan.columns?.activity_type).toBe('call');
    expect(plan.fields?.activityType).toBe('call');
  });

  it('maps activityDate onto completed_date - a logged call happened, it is not an appointment', () => {
    const plan = buildActivityInsert(iosBody(), ctx);
    expect(plan.columns?.completed_date).toBe('2026-09-21T15:04:00.000Z');
    expect(plan.columns?.scheduled_date).toBeUndefined();
  });

  it('every column it emits is a real column on business_record_activities', () => {
    const real = new Set(getTableConfig(businessRecordActivities).columns.map((c) => c.name));
    const plan = buildActivityInsert(
      {
        ...iosBody(),
        direction: 'outbound',
        callDuration: 90,
        callOutcome: 'voicemail',
        nextAction: 'call back',
        dueDate: '2026-09-22T00:00:00.000Z',
        followUpDate: '2026-09-23T00:00:00.000Z',
        scheduledDate: '2026-09-21T14:00:00.000Z',
        isShared: true,
      },
      ctx,
    );
    const unknown = Object.keys(plan.columns ?? {}).filter((c) => !real.has(c));
    expect(unknown).toEqual([]);
  });

  it('supplies every NOT NULL column that has no database default', () => {
    // Derived, not listed: a schema change that adds one fails here rather than
    // at runtime on the first field-logged call.
    const required = getTableConfig(businessRecordActivities)
      .columns.filter((c) => c.notNull && !c.hasDefault)
      .map((c) => c.name);
    const plan = buildActivityInsert(iosBody(), ctx);
    const missing = required.filter((c) => !(c in (plan.columns ?? {})));
    expect(missing).toEqual([]);
  });

  it('names the location fields it cannot store rather than dropping them', () => {
    // Derived from the iOS request model, NOT from the constant itself. The
    // first version of this looped over ACTIVITY_FIELDS_WITHOUT_COLUMNS and
    // asserted each entry was ignored, which is a list checking itself:
    // deleting 'latitude' from it shortened the loop and the test stayed green
    // while the response stopped naming a field it had silently dropped.
    const swift = readFileSync(
      join(repo, 'ios/Printyx/Features/QuickLog/Models/QuickLogModels.swift'),
      'utf8',
    );
    const struct = swift.slice(swift.indexOf('struct QuickLogActivityRequest'));
    const sent = [...struct.matchAll(/^\s*(?:let|var) (\w+):/gm)].map((m) => m[1]);
    expect(sent.length).toBeGreaterThan(5);

    const plan = buildActivityInsert(iosBody(), ctx);
    const unstorable = sent.filter((f) => plan.ignoredFields.includes(f));
    expect([...unstorable].sort()).toEqual([...ACTIVITY_FIELDS_WITHOUT_COLUMNS].sort());
    expect(ACTIVITY_FIELDS_WITHOUT_COLUMNS.length).toBeGreaterThan(0);
  });

  it('refuses a caller-supplied tenant_id rather than letting it decide the row', () => {
    const plan = buildActivityInsert({ ...iosBody(), tenantId: 'other-tenant' }, ctx);
    expect(plan.columns?.tenant_id).toBe('t1');
    expect(plan.refusedFields).toContain('tenantId');
  });

  it('refuses created_by, which decides who is recorded as having made the call', () => {
    const plan = buildActivityInsert({ ...iosBody(), created_by: 'someone-else' }, ctx);
    expect(plan.columns?.created_by).toBe('user-1');
    expect(plan.refusedFields).toContain('created_by');
  });

  it('answers a 400-shaped error for a missing type instead of letting Postgres 23502', () => {
    const noType: Record<string, unknown> = iosBody();
    delete noType.type;
    const plan = buildActivityInsert(noType, ctx);
    expect(plan.columns).toBeNull();
    expect(plan.fields).toBeNull();
    expect(plan.error?.code).toBe('ACTIVITY_TYPE_REQUIRED');
  });

  it('answers a 400-shaped error for a missing subject, the other NOT NULL column', () => {
    const noSubject: Record<string, unknown> = iosBody();
    delete noSubject.subject;
    expect(buildActivityInsert(noSubject, ctx).error?.code).toBe('ACTIVITY_SUBJECT_REQUIRED');
  });

  it('treats a blank type as missing - a whitespace string satisfies NOT NULL and means nothing', () => {
    expect(buildActivityInsert({ ...iosBody(), type: '   ' }, ctx).error?.code).toBe(
      'ACTIVITY_TYPE_REQUIRED',
    );
  });

  it('an unparseable date becomes null rather than the string Postgres would reject', () => {
    const plan = buildActivityInsert({ ...iosBody(), activityDate: 'not a date' }, ctx);
    expect(plan.columns?.completed_date).toBeNull();
  });

  it('the canonical name wins over its alias when a body carries both', () => {
    const plan = buildActivityInsert({ ...iosBody(), type: 'call', activityType: 'meeting' }, ctx);
    expect(plan.columns?.activity_type).toBe('meeting');
  });

  it('fields carries Date objects and columns carries ISO text - drizzle and PostgREST disagree', () => {
    const plan = buildActivityInsert(iosBody(), ctx);
    expect(plan.fields?.completedDate).toBeInstanceOf(Date);
    expect(typeof plan.columns?.completed_date).toBe('string');
  });
});

describe('presentActivity', () => {
  /** A stored row as PostgREST hands it back. */
  const pgRow = {
    id: 'a1',
    tenant_id: 't1',
    business_record_id: 'rec-1',
    activity_type: 'call',
    subject: 'Phone call',
    completed_date: '2026-09-21T15:04:00.000Z',
    scheduled_date: null,
    created_at: '2026-09-21T15:04:01.000Z',
  };

  it('emits the three aliases the shipped iOS build decodes', () => {
    const out = presentActivity(pgRow);
    expect({ type: out.type, leadId: out.leadId, activityDate: out.activityDate }).toEqual({
      type: 'call',
      leadId: 'rec-1',
      activityDate: '2026-09-21T15:04:00.000Z',
    });
  });

  it('emits the camelCase keys ActivityTimeline reads on the web', () => {
    const out = presentActivity({ ...pgRow, call_outcome: 'voicemail', next_action: 'call back' });
    expect({ activityType: out.activityType, callOutcome: out.callOutcome }).toEqual({
      activityType: 'call',
      callOutcome: 'voicemail',
    });
    expect(out.nextAction).toBe('call back');
  });

  it('serialises a drizzle Date as ISO, not as String(date)', () => {
    // Express returns drizzle rows, whose timestamps are Date objects.
    // String(date) gives "Mon Sep 21 2026 15:04:00 GMT+0000", which the iOS
    // decoder reads as no date at all while the edge host returns ISO text.
    const out = presentActivity({
      ...pgRow,
      completed_date: new Date('2026-09-21T15:04:00.000Z'),
    });
    expect(out.activityDate).toBe('2026-09-21T15:04:00.000Z');
  });

  it('falls back to the scheduled date so an appointment still shows a time', () => {
    const out = presentActivity({
      ...pgRow,
      completed_date: null,
      scheduled_date: '2026-09-22T09:00:00.000Z',
    });
    expect(out.activityDate).toBe('2026-09-22T09:00:00.000Z');
  });

  it('accepts a camelCase drizzle row as readily as a snake_case PostgREST one', () => {
    const out = presentActivity({
      id: 'a1',
      businessRecordId: 'rec-1',
      activityType: 'email',
      subject: 'Sent quote',
    });
    expect({ type: out.type, leadId: out.leadId }).toEqual({ type: 'email', leadId: 'rec-1' });
  });
});

describe('both hosts go through the shared module', () => {
  const edge = stripComments(read('supabase/functions/leads/index.ts'));
  const express = stripComments(read('server/routes-crm-core.ts'));

  it('the leads edge function has an activities branch at all', () => {
    // The whole defect: this branch did not exist, so every field-logged call
    // fell past it to the trailing 404.
    expect(edge).toMatch(/subResource === 'activities'/);
  });

  it('the edge branch reads and writes business_record_activities', () => {
    const at = edge.indexOf("subResource === 'activities'");
    const branch = edge.slice(at, edge.indexOf("leadId === 'geocode'", at));
    expect(branch).toMatch(/\.from\('business_record_activities'\)/);
    expect(branch).toMatch(/\.insert\(plan\.columns\)/);
  });

  it('the edge branch scopes both the read and the write to the tenant', () => {
    const at = edge.indexOf("subResource === 'activities'");
    const branch = edge.slice(at, edge.indexOf("leadId === 'geocode'", at));
    // The read filters explicitly; the write gets its tenant from the plan,
    // which takes it from the verified JWT and refuses a body that names one.
    expect(branch).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(branch).toMatch(/tenantId,\s*\n\s*businessRecordId: leadId/);
  });

  it('neither host builds its own column map', () => {
    for (const [name, src] of [
      ['edge', edge],
      ['express', express],
    ] as const) {
      expect({ name, uses: /buildActivityInsert\(/.test(src) }).toEqual({ name, uses: true });
      expect({ name, uses: /presentActivity\(/.test(src) }).toEqual({ name, uses: true });
    }
  });

  it('Express no longer spreads the request body into the insert', () => {
    // `...req.body` into drizzle is what silently dropped `type` and left
    // activity_type null.
    const at = express.indexOf("app.post('/api/leads/:id/activities'");
    expect(at).toBeGreaterThan(-1);
    const handler = express.slice(at, express.indexOf('app.get(', at + 1));
    expect(handler).not.toMatch(/\.\.\.req\.body/);
  });

  it('Express reports what was dropped instead of answering a bare 200', () => {
    const at = express.indexOf("app.post('/api/leads/:id/activities'");
    const handler = express.slice(at, express.indexOf('app.get(', at + 1));
    expect(handler).toMatch(/ignoredFields: plan\.ignoredFields/);
    expect(handler).toMatch(/refusedFields: plan\.refusedFields/);
  });
});
