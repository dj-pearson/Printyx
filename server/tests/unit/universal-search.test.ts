/**
 * CR-029 — universal search runs its six entity searches in parallel, returns
 * all entity types sorted by relevance, degrades gracefully when an optional
 * table errors, and caches repeated identical queries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request } from 'express';
import request from 'supertest';
import {
  businessRecords,
  deals,
  businessRecordActivities,
  quotes,
  invoices,
  equipment,
} from '@shared/schema';

const state = vi.hoisted(() => ({
  queryCount: 0,
  throwFor: null as unknown, // a table object whose query should throw
  fixtures: new Map<unknown, unknown[]>(),
}));

vi.mock('../../db', () => {
  const makeBuilder = () => {
    let table: unknown;
    const b: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t;
        return b;
      },
      leftJoin: () => b,
      where: () => b,
      limit: () => {
        state.queryCount += 1;
        if (state.throwFor && table === state.throwFor) {
          return Promise.reject(new Error('simulated table error'));
        }
        return Promise.resolve(state.fixtures.get(table) ?? []);
      },
    };
    return b;
  };
  return { db: { select: () => makeBuilder() } };
});

// Simple no-interval cache so the module-level instance is deterministic and
// leaves no open handle.
vi.mock('../../cache-service', () => {
  const store = new Map<string, unknown>();
  return {
    MemoryCacheService: class {
      async get(k: string) {
        return store.has(k) ? store.get(k) : null;
      }
      async set(k: string, v: unknown) {
        store.set(k, v);
      }
    },
  };
});

import universalSearchRouter from '../../routes-universal-search';

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as Request & { tenantId?: number }).tenantId = 1 as unknown as number;
    next();
  });
  app.use(universalSearchRouter);
  return app;
}

describe('CR-029: universal search', () => {
  beforeEach(() => {
    state.queryCount = 0;
    state.throwFor = null;
    state.fixtures = new Map<unknown, unknown[]>([
      [
        businessRecords,
        [
          {
            id: 'br1',
            companyName: 'Acme',
            contactName: 'Jo',
            email: null,
            phone: null,
            recordType: 'customer',
            status: 'active',
            estimatedValue: 1000,
            urlSlug: 'acme',
          },
        ],
      ],
      [
        deals,
        [
          {
            id: 'd1',
            name: 'Acme Deal',
            value: 5000,
            stage: 'proposal',
            status: 'open',
            expectedCloseDate: null,
            companyName: 'Acme',
          },
        ],
      ],
      [
        businessRecordActivities,
        [
          {
            id: 'a1',
            title: 'Acme Call',
            type: 'call',
            status: 'pending',
            dueDate: null,
            companyName: 'Acme',
          },
        ],
      ],
      [
        quotes,
        [
          {
            id: 'q1',
            quoteNumber: 'Q-1',
            status: 'draft',
            totalAmount: 2000,
            validUntil: null,
            companyName: 'Acme',
          },
        ],
      ],
      [
        invoices,
        [
          {
            id: 'i1',
            invoiceNumber: 'INV-1',
            invoiceDate: null,
            totalAmount: 3000,
            balanceDue: 0,
            invoiceType: 'standard',
            companyName: 'Acme',
          },
        ],
      ],
      [
        equipment,
        [
          {
            id: 'e1',
            serialNumber: 'SN1',
            modelNumber: 'M1',
            manufacturer: 'HP',
            description: 'printer',
            equipmentStatus: 'active',
            companyName: 'Acme',
          },
        ],
      ],
    ]);
  });

  it('returns all six entity types, sorted by relevance, from six queries', async () => {
    const res = await request(buildApp()).get('/api/universal-search?q=zeta');
    expect(res.status).toBe(200);

    const types = res.body.map((r: { type: string }) => r.type);
    expect(new Set(types)).toEqual(
      new Set(['customer', 'deal', 'activity', 'quote', 'invoice', 'equipment']),
    );

    // Sorted by relevance desc: customer(10) > deal(8) > quote/invoice(7) > activity/equipment(6)
    const rel = res.body.map((r: { relevance: number }) => r.relevance);
    expect([...rel]).toEqual([...rel].sort((a, b) => b - a));
    expect(res.body[0].type).toBe('customer');

    // All six entity searches issued exactly one query.
    expect(state.queryCount).toBe(6);
  });

  it('serves an identical repeat query from cache (no new queries)', async () => {
    const app = buildApp();
    await request(app).get('/api/universal-search?q=cachekey');
    expect(state.queryCount).toBe(6);
    await request(app).get('/api/universal-search?q=cachekey');
    // Second call hits the cache — no additional queries.
    expect(state.queryCount).toBe(6);
  });

  it('degrades gracefully when an optional table errors', async () => {
    state.throwFor = quotes;
    const res = await request(buildApp()).get('/api/universal-search?q=degrade');
    expect(res.status).toBe(200);
    const types = res.body.map((r: { type: string }) => r.type);
    expect(types).not.toContain('quote');
    // The other five still resolve.
    expect(new Set(types)).toEqual(
      new Set(['customer', 'deal', 'activity', 'invoice', 'equipment']),
    );
  });

  it('short-circuits (no query) for a <2 char term', async () => {
    const res = await request(buildApp()).get('/api/universal-search?q=a');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(state.queryCount).toBe(0);
  });
});
