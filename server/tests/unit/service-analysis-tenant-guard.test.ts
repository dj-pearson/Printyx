/**
 * QUALITY-002 — service-analysis handlers refuse to run without a tenant.
 *
 * All twelve handlers did `const tenantId = getTenantId(req)` and went straight
 * into `eq(table.tenantId, tenantId)`. getTenantId returns `string | undefined`,
 * and undefined does not scope anything — it becomes a bound parameter of
 * undefined. So a request that arrived without a resolved tenant either died in
 * the driver or, depending on the call, asked the database a question with no
 * tenant predicate on it. Each handler now answers 400 instead.
 *
 * The second half is the insert schemas. drizzle-zod infers a jsonb column from
 * its runtime shape rather than the $type<string[]> annotation, so
 * actionsTaken / diagnosticCodes / beforePhotos / afterPhotos / serialNumbers
 * came out as a structural array-like that was not assignable back to string[]
 * — and, more to the point, validated nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  insertServiceCallAnalysisSchema,
  insertServicePartsUsedSchema,
} from '../../../shared/service-analysis-schema';

const state = vi.hoisted(() => ({ queries: [] as string[] }));

vi.mock('../../db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const client = {
    query: async (config: { text: string }) => {
      state.queries.push(config.text);
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: drizzle(client as never) };
});

import { registerServiceAnalysisRoutes } from '../../routes-service-analysis';

function buildApp(tenantId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (tenantId) (req as express.Request & { tenantId?: string }).tenantId = tenantId;
    (req as express.Request & { user?: unknown }).user = { id: 'user-1', tenantId };
    next();
  });
  registerServiceAnalysisRoutes(app);
  return app;
}

// One read and one write per distinct resource in the file.
const READS = [
  '/api/service-tickets/tk-1/analysis',
  '/api/service-analysis/an-1/parts-used',
  '/api/service-analysis/an-1/parts-orders',
  '/api/parts-orders/po-1/items',
  '/api/service-analysis/stats',
  '/api/service-analysis/recent',
];

beforeEach(() => {
  state.queries = [];
});

describe('QUALITY-002: no tenant on the request means no query', () => {
  it.each(READS)('GET %s answers 400 and issues no SQL', async (path) => {
    const res = await request(buildApp()).get(path);
    expect(res.status).toBe(400);
    // CR-023: the body is the documented { message, code, requestId } shape now,
    // not { error }. The guard's contract - 400 and no SQL - is unchanged; only
    // the key carrying the sentence moved, so the code is asserted alongside it.
    expect(res.body.message).toBe('Tenant ID is required');
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(state.queries, `${path} queried anyway`).toHaveLength(0);
  });

  it('POST .../analysis answers 400 before parsing the body', async () => {
    const res = await request(buildApp()).post('/api/service-tickets/tk-1/analysis').send({});
    expect(res.status).toBe(400);
    expect(state.queries).toHaveLength(0);
  });

  it('with a tenant, the query carries the tenant predicate', async () => {
    const res = await request(buildApp('T1')).get('/api/service-tickets/tk-1/analysis');
    expect(res.status).toBe(200);
    expect(state.queries.length).toBeGreaterThan(0);
    expect(state.queries[0]).toContain('"tenant_id" = ');
    // Never the empty operand drizzle emits for an undefined column or value.
    expect(state.queries[0]).not.toMatch(/(and|or|where)\s{2,}=/);
  });
});

describe('QUALITY-002: the jsonb array columns are actually validated', () => {
  // These columns are uuid, so the fixtures have to be real ones — with a short
  // id every parse below throws on the uuid check and the array assertions pass
  // for the wrong reason.
  const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const base = {
    tenantId: UUID(1),
    serviceTicketId: UUID(2),
    technicianId: UUID(3),
    callStartTime: new Date(),
    analysisType: 'diagnostic' as const,
    problemDescription: 'Fuser error E002 on start-up',
    outcome: 'resolved' as const,
  };

  /** The field each ZodError actually complains about. */
  function failedPaths(parse: () => unknown): string[] {
    try {
      parse();
    } catch (error) {
      const issues = (error as { issues?: { path: (string | number)[] }[] }).issues ?? [];
      return issues.map((i) => i.path.join('.'));
    }
    throw new Error('expected the parse to throw');
  }

  it('accepts a string[] and hands one back', () => {
    const parsed = insertServiceCallAnalysisSchema.parse({
      ...base,
      actionsTaken: ['replaced fuser', 'cleaned rollers'],
      diagnosticCodes: ['E002'],
    });
    expect(parsed.actionsTaken).toEqual(['replaced fuser', 'cleaned rollers']);
    expect(parsed.diagnosticCodes).toEqual(['E002']);
  });

  it('rejects a non-array, which the inferred schema let through', () => {
    expect(
      failedPaths(() =>
        insertServiceCallAnalysisSchema.parse({ ...base, actionsTaken: 'replaced fuser' }),
      ),
    ).toEqual(['actionsTaken']);
  });

  it('rejects an array of the wrong element type', () => {
    expect(
      failedPaths(() =>
        insertServiceCallAnalysisSchema.parse({ ...base, beforePhotos: [1, 2, 3] }),
      ),
    ).toEqual(['beforePhotos.0', 'beforePhotos.1', 'beforePhotos.2']);
  });

  it('applies the same rule to servicePartsUsed.serialNumbers', () => {
    expect(
      failedPaths(() =>
        insertServicePartsUsedSchema.parse({
          tenantId: UUID(1),
          analysisId: UUID(4),
          partNumber: 'P1',
          partName: 'Fuser unit',
          quantityUsed: 1,
          serialNumbers: 'SN-1',
        }),
      ),
    ).toEqual(['serialNumbers']);
  });
});
