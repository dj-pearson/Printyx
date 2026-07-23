/**
 * PA-045 — journal-entries CRUD (was a 501 stub). Tenant-scoped, balanced
 * (debits must equal credits), server-injected tenant/creator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  selectResult: [] as unknown[],
}));

vi.mock('../../db', () => {
  // list ends at .orderBy(); get ends at .limit(1) — both terminals resolve.
  const query = (result: () => unknown[]) => {
    const b = {
      from: () => b,
      where: () => b,
      orderBy: () => Promise.resolve(result()),
      limit: () => Promise.resolve(result()),
    };
    return b;
  };
  return {
    db: {
      select: () => query(() => state.selectResult),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          state.inserted = v;
          return { returning: async () => [{ id: 'j1', ...v }] };
        },
      }),
      update: () => ({
        set: (s: Record<string, unknown>) => ({
          where: () => ({ returning: async () => [{ id: 'j1', ...s }] }),
        }),
      }),
      delete: () => ({ where: () => ({ returning: async () => [{ id: 'j1' }] }) }),
    },
  };
});

vi.mock('../../utils/auth-helpers', () => ({
  getUserId: () => 'U1',
  getTenantId: () => 'T1',
}));

import financialRouter from '../../routes-financial';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(financialRouter);
  return app;
}

const balanced = {
  entryNumber: 'JE-001',
  description: 'Opening balance',
  entryDate: '2026-07-23',
  totalDebit: 100,
  totalCredit: 100,
};

describe('PA-045: journal entries CRUD', () => {
  beforeEach(() => {
    state.inserted = null;
    state.selectResult = [];
  });

  it('creates a balanced entry (201) with tenant/creator injected', async () => {
    const res = await request(buildApp()).post('/api/journal-entries').send(balanced);
    expect(res.status).toBe(201);
    expect(state.inserted).toMatchObject({
      entryNumber: 'JE-001',
      tenantId: 'T1',
      createdBy: 'U1',
      totalDebit: '100',
      totalCredit: '100',
    });
  });

  it('rejects an unbalanced entry (debits != credits) with 400', async () => {
    const res = await request(buildApp())
      .post('/api/journal-entries')
      .send({ ...balanced, totalCredit: 90 });
    expect(res.status).toBe(400);
    expect(state.inserted).toBeNull();
  });

  it('rejects a missing required field with 400', async () => {
    const res = await request(buildApp())
      .post('/api/journal-entries')
      .send({ ...balanced, entryNumber: '' });
    expect(res.status).toBe(400);
  });

  it('lists the tenant entries', async () => {
    state.selectResult = [{ id: 'j1', entryNumber: 'JE-001', tenantId: 'T1' }];
    const res = await request(buildApp()).get('/api/journal-entries');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('404s a missing entry by id', async () => {
    state.selectResult = [];
    const res = await request(buildApp()).get('/api/journal-entries/nope');
    expect(res.status).toBe(404);
  });

  it('deletes an entry', async () => {
    const res = await request(buildApp()).delete('/api/journal-entries/j1');
    expect(res.status).toBe(200);
  });
});
