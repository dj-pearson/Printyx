/**
 * CR-025 — regression guard: POST /api/dispatch/check-parts must resolve parts
 * availability with a SINGLE batched inventory query, not one query per part.
 *
 * Before: `requiredParts.map(async (p) => db.select()...where(partNumber = p))`
 *   → N inventory round-trips for N parts (an N+1).
 * After: one `WHERE part_number IN (...)` query + in-memory resolution.
 *
 * The test drives a real Express mount with a mocked db that COUNTS select
 * calls, asserting exactly one query for a 3-part request and that the response
 * shape is identical to the old per-part output (found-available,
 * found-unavailable, and not-found branches).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request } from 'express';
import request from 'supertest';

type InvRow = {
  partNumber: string;
  name: string;
  quantityAvailable: number;
  quantityOnHand: number;
  quantityOnOrder: number;
};

const state = vi.hoisted(() => ({ selectCalls: 0, rows: [] as InvRow[] }));

vi.mock('../../db', () => {
  const builder = {
    from: () => builder,
    // Terminal: awaiting the where() clause runs the query.
    where: () => {
      state.selectCalls += 1;
      return Promise.resolve(state.rows);
    },
  };
  return { db: { select: () => builder } };
});

import { serviceDispatchRouter } from '../../routes-service-dispatch';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request & { user?: { tenantId: string } }).user = { tenantId: 'T1' };
    next();
  });
  app.use(serviceDispatchRouter);
  return app;
}

describe('CR-025: check-parts uses one batched inventory query', () => {
  beforeEach(() => {
    state.selectCalls = 0;
    state.rows = [
      {
        partNumber: 'P1',
        name: 'Part 1',
        quantityAvailable: 5,
        quantityOnHand: 5,
        quantityOnOrder: 0,
      },
      {
        partNumber: 'P2',
        name: 'Part 2',
        quantityAvailable: 0,
        quantityOnHand: 0,
        quantityOnOrder: 3,
      },
    ];
  });

  it('issues exactly ONE query for a 3-part request (was 3)', async () => {
    const res = await request(buildApp())
      .post('/api/dispatch/check-parts')
      .send({ ticketId: 'tk1', requiredParts: ['P1', 'P2', 'P3'] });

    expect(res.status).toBe(200);
    // Before: 3 queries (one per part). After: 1.
    expect(state.selectCalls).toBe(1);
  });

  it('returns identical per-part shapes (available / out-of-stock / not-found)', async () => {
    const res = await request(buildApp())
      .post('/api/dispatch/check-parts')
      .send({ ticketId: 'tk1', requiredParts: ['P1', 'P2', 'P3'] });

    expect(res.body.available).toBe(false); // P2 + P3 unavailable
    expect(res.body.canDispatch).toBe(false);
    expect(res.body.message).toContain('2 part(s) unavailable');

    const available = res.body.availableParts;
    const missing = res.body.missingParts;

    expect(available).toEqual([
      {
        partNumber: 'P1',
        name: 'Part 1',
        available: true,
        quantityAvailable: 5,
        quantityOnHand: 5,
        quantityOnOrder: 0,
        // reason is undefined → omitted by JSON
      },
    ]);
    expect(missing).toEqual([
      {
        partNumber: 'P2',
        name: 'Part 2',
        available: false,
        quantityAvailable: 0,
        quantityOnHand: 0,
        quantityOnOrder: 3,
        reason: 'Out of stock (3 on order)',
      },
      {
        partNumber: 'P3',
        available: false,
        reason: 'Part not found in inventory',
        quantityAvailable: 0,
        quantityOnOrder: 0,
      },
    ]);
  });

  it('short-circuits with no query when no parts are required', async () => {
    const res = await request(buildApp())
      .post('/api/dispatch/check-parts')
      .send({ ticketId: 'tk1', requiredParts: [] });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(state.selectCalls).toBe(0);
  });
});
