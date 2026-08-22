/**
 * QUALITY-002 — /api/root-admin reads columns that exist, and still answers in
 * the shape RootAdminDashboard.tsx and DatabaseManagement.tsx read.
 *
 * This file was written against a schema that isn't there. /overview and
 * /security-alerts queried `activity_reports` — the SALES metrics table, all
 * calls and emails and win rates — for type / severity / description / metadata
 * / resolved. /tenants read tenants.status, /users read users.name and
 * users.status, /audit-logs read auditLogs.tableName and .recordId. None of
 * those columns exist, so every one of those endpoints raised at run time.
 *
 * Fixing them meant re-sourcing the data, which is exactly the change that can
 * quietly break the dashboard: it does `alert.type.replace('_', ' ')` and
 * `${log.action} on ${log.tableName}`, so a dropped key is a blank panel or a
 * TypeError, not a type error. Both halves are asserted here — the SQL names
 * real columns, and the JSON still carries the keys the pages read.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({ queries: [] as string[] }));

/**
 * drizzle asks node-postgres for rowMode:'array', so a stubbed row is positional
 * and has to match the select list. Counting the top-level items in it lets one
 * stub answer every handler with a single plausible row, which is what makes the
 * response-shape half of this test possible.
 */
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
  const client = {
    query: async (config: { text: string }) => {
      state.queries.push(config.text);
      // requireRootAdmin's lookup, matched on a column only it selects:
      // userId, roleId, roleName, roleLevel, canAccessAllTenants.
      if (config.text.includes('can_access_all_tenants')) {
        return { rows: [['root-1', 'role-1', 'Root Admin', 7, true]], rowCount: 1 };
      }
      if (!config.text.startsWith('select ') || !config.text.includes(' from ')) {
        return { rows: [], rowCount: 0 };
      }
      const row = Array.from({ length: selectArity(config.text) }, (_, i) => `v${i}`);
      return { rows: [row], rowCount: 1 };
    },
  };
  return { db: drizzle(client as never) };
});

import rootAdminRouter from '../../routes-root-admin';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user?: unknown }).user = { id: 'root-1', tenantId: 'T1' };
    next();
  });
  app.use('/api/root-admin', rootAdminRouter);
  return app;
}

/** Every statement issued by the handler, minus requireRootAdmin's own lookup. */
function handlerSql(): string {
  return state.queries.filter((q) => !q.includes('can_access_all_tenants')).join('\n');
}

beforeEach(() => {
  state.queries = [];
});

describe('QUALITY-002: root-admin queries name real columns', () => {
  it('never emits an empty operand, which is what an undefined column compiles to', async () => {
    for (const path of ['/overview', '/tenants', '/security-alerts', '/users', '/audit-logs']) {
      state.queries = [];
      const res = await request(buildApp()).get(`/api/root-admin${path}`);
      expect(res.status, `${path} responded ${res.status}`).toBe(200);
      expect(handlerSql(), path).not.toMatch(/(and|or|where)\s{2,}=/);
    }
  });

  it('reads the audit trail, not the sales activity_reports table', async () => {
    await request(buildApp()).get('/api/root-admin/security-alerts');
    const sql = handlerSql();
    expect(sql).toContain('from "audit_logs"');
    expect(sql).not.toContain('activity_reports');
  });

  it('/overview counts critical alerts out of audit_logs', async () => {
    await request(buildApp()).get('/api/root-admin/overview');
    expect(handlerSql()).not.toContain('activity_reports');
  });

  it('/users filters on is_active and the split name columns', async () => {
    await request(buildApp()).get('/api/root-admin/users?status=active&search=ana');
    const sql = handlerSql();
    expect(sql).toContain('"users"."is_active"');
    expect(sql).toContain('"users"."first_name"');
    expect(sql).not.toMatch(/"users"\."(name|status)"/);
  });

  it('/audit-logs selects resource / resource_id', async () => {
    await request(buildApp()).get('/api/root-admin/audit-logs');
    const sql = handlerSql();
    expect(sql).toContain('"resource"');
    expect(sql).toContain('"resource_id"');
  });
});

describe('QUALITY-002: root-admin keeps the keys the dashboards read', () => {
  // The pages read these off each row; a missing one renders blank or throws.
  const CONTRACTS: Record<string, string[]> = {
    '/tenants': ['id', 'name', 'userCount', 'status', 'subscription', 'lastActivity'],
    '/security-alerts': ['id', 'type', 'severity', 'tenant', 'message', 'timestamp', 'status'],
    '/users': ['id', 'name', 'email', 'status', 'role', 'tenant'],
    '/audit-logs': ['id', 'action', 'tableName', 'recordId', 'timestamp', 'userName'],
  };

  it.each(Object.entries(CONTRACTS))('%s keeps its keys', async (path, keys) => {
    const res = await request(buildApp()).get(`/api/root-admin${path}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length, `${path} returned no rows to check`).toBeGreaterThan(0);
    for (const key of keys) {
      expect(res.body[0], `${path} dropped ${key}`).toHaveProperty(key);
    }
  });

  it('/overview returns the summary keys the dashboard reads', async () => {
    const res = await request(buildApp()).get('/api/root-admin/overview');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'activeTenants',
        'activeUsers',
        'criticalAlerts',
        'pendingActions',
        'systemHealth',
        'systemUptime',
        'totalTenants',
        'totalUsers',
      ].sort(),
    );
  });
});
