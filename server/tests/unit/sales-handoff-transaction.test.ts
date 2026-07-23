/**
 * CR-024 — regression guard: the sales-handoff create endpoint must write the
 * checklist and its template tasks ATOMICALLY.
 *
 * Before the fix the handler did two independent writes (insert checklist, then
 * insert tasks). A failure on the second write left a checklist with no tasks —
 * a partial write. The handler now wraps both in db.transaction, so a
 * second-write failure aborts the whole unit (the DB rolls the checklist back)
 * and the request fails instead of returning 201 with partial data.
 *
 * These tests drive a real Express mount with a mocked db: db.transaction runs
 * the callback with a `tx` whose SECOND write throws, proving the failure
 * propagates (500) rather than being reported as success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// State the mock exposes so assertions can inspect what happened.
const state = vi.hoisted(() => ({
  failSecondWrite: false,
  writeCount: 0,
}));

vi.mock('../../db', () => {
  const makeTx = () => ({
    insert: () => ({
      values: () => {
        state.writeCount += 1;
        // First write = checklist (succeeds, returns a row). Second = tasks.
        if (state.writeCount === 1) {
          return { returning: async () => [{ id: 'handoff-1' }] };
        }
        if (state.failSecondWrite) {
          throw new Error('simulated task insert failure');
        }
        return { returning: async () => [{ id: 'task-1' }] };
      },
    }),
  });
  return {
    db: {
      // A faithful transaction: if the callback throws, reject (as a real DB
      // would after rolling back).
      transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(makeTx()),
      query: {
        handoffTaskTemplates: {
          findFirst: async () => ({
            id: 'template-1',
            tasks: [
              { taskName: 'Kickoff', category: 'onboarding', isRequired: true, dueInDays: 3 },
            ],
          }),
        },
      },
    },
  };
});

import { registerSalesHandoffRoutes } from '../../routes-sales-handoff';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerSalesHandoffRoutes(app);
  return app;
}

describe('CR-024: sales-handoff create is transactional', () => {
  beforeEach(() => {
    state.failSecondWrite = false;
    state.writeCount = 0;
  });

  it('fails the request (no partial 201) when the task insert fails', async () => {
    state.failSecondWrite = true;

    const res = await request(buildApp())
      .post('/api/sales-handoffs')
      .set('x-tenant-id', 'T1')
      .send({ templateId: 'template-1', title: 'Handoff A' });

    // The checklist write happened first, then the task write failed — the
    // second-write failure must surface as an error, not a partial success.
    expect(state.writeCount).toBe(2);
    expect(res.status).not.toBe(201);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('returns 201 when both writes in the transaction succeed', async () => {
    const res = await request(buildApp())
      .post('/api/sales-handoffs')
      .set('x-tenant-id', 'T1')
      .send({ templateId: 'template-1', title: 'Handoff B' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'handoff-1' });
    expect(state.writeCount).toBe(2);
  });
});
