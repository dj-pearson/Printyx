// EDGE-016a: the agent ingest path writes activity rows that the table can hold.
//
// `client_activity_logs` was declared TWICE — shared/client-monitor-schema.ts
// (uuid tenant/client, activity/status/details/error_code) and
// shared/printyx-client-schema.ts (serial id, integer tenant_id, text client_id,
// event_type/event_data/severity). schema.ts named the second in an explicit
// re-export that beat the wildcard, so the TYPE the app saw was the printyx one
// while every writer was coded against the monitor one. Migration 0001 then
// dropped the six columns those writers use, so /api/client-metrics — the agent
// ingest, deliberately NOT proxied, so these Express handlers are what runs —
// answered 42703 on every write. Two of the inserts sit in the catch block that
// reports the failure of the first, so a metrics submission could not even
// record why it failed.
//
// These assertions are about SQL, not types: tsc now agrees because the
// duplicate is gone, and this is what catches the table drifting out from under
// the writers again.
import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns } from 'drizzle-orm';
import { and, desc, eq } from 'drizzle-orm';
import pg from 'pg';

import { clientActivityLogs } from '@shared/schema';
import { clientActivityLogs as monitorDeclaration } from '@shared/client-monitor-schema';

// toSQL() never opens a connection.
const db = drizzle(new pg.Pool({ connectionString: 'postgresql://unused@127.0.0.1:1/unused' }));

const TENANT = '11111111-1111-4111-8111-111111111111';
const CLIENT = '33333333-3333-4333-8333-333333333333';

describe('@shared/schema resolves client_activity_logs to one declaration', () => {
  it('is the client-monitor one', () => {
    expect(clientActivityLogs).toBe(monitorDeclaration);
  });

  it('carries the columns the ingest path writes', () => {
    const columns = new Set(Object.keys(getTableColumns(clientActivityLogs)));
    for (const field of [
      'tenantId',
      'clientId',
      'activity',
      'status',
      'message',
      'details',
      'devicesInSubmission',
      'metricsCount',
      'errorCode',
    ]) {
      expect(columns.has(field), `${field} missing`).toBe(true);
    }
  });

  it('does not carry the columns of the declaration that was removed', () => {
    const columns = new Set(Object.keys(getTableColumns(clientActivityLogs)));
    for (const field of ['eventType', 'eventData', 'severity']) {
      expect(columns.has(field), `${field} should be gone`).toBe(false);
    }
  });
});

describe('the ingest write', () => {
  it('names only real columns', () => {
    // The shape of the registration write in routes-client-metrics.ts.
    const { sql, params } = db
      .insert(clientActivityLogs)
      .values({
        tenantId: TENANT,
        clientId: CLIENT,
        activity: 'config_update',
        status: 'success',
        message: "Client 'Main Office' registered",
        details: { action: 'client_registered' },
      })
      .toSQL();

    for (const column of ['tenant_id', 'client_id', 'activity', 'status', 'message', 'details']) {
      expect(sql, `${column} not in the insert`).toContain(`"${column}"`);
    }
    // The columns 0001 added from the other declaration must not appear.
    expect(sql).not.toContain('event_type');
    expect(sql).not.toContain('severity');
    expect(params).toContain(TENANT);
  });

  it('carries the submission counters the metrics handler records', () => {
    const { sql } = db
      .insert(clientActivityLogs)
      .values({
        tenantId: TENANT,
        clientId: CLIENT,
        activity: 'metrics_submitted',
        status: 'warning',
        devicesInSubmission: 4,
        metricsCount: 12,
        errorCode: 'PARTIAL',
      })
      .toSQL();

    expect(sql).toContain('"devices_in_submission"');
    expect(sql).toContain('"metrics_count"');
    expect(sql).toContain('"error_code"');
  });
});

describe('the ingest read', () => {
  it('filters by tenant AND client, not by client alone', () => {
    const { sql, params } = db
      .select()
      .from(clientActivityLogs)
      .where(and(eq(clientActivityLogs.tenantId, TENANT), eq(clientActivityLogs.clientId, CLIENT)))
      .orderBy(desc(clientActivityLogs.timestamp))
      .limit(100)
      .toSQL();

    const where = sql.split(' where ')[1];
    expect(where).toContain('tenant_id');
    expect(where).toContain('client_id');
    expect(params).toEqual([TENANT, CLIENT, 100]);
  });

  it('compares tenant_id against a uuid, which the other declaration could not', () => {
    // printyx-client-schema had integer('tenant_id'); every caller passes a uuid,
    // so the comparison in a read errored too.
    expect(getTableColumns(clientActivityLogs).tenantId.columnType).toBe('PgUUID');
    expect(getTableColumns(clientActivityLogs).clientId.columnType).toBe('PgUUID');
  });
});
