/**
 * PA-042 — tenant-onboarding "Execute import" actually inserts rows.
 * Previously the execute handler set importExecuted:true and echoed a row count
 * from the request body while writing NOTHING (silent data loss). It now inserts
 * the validated rows into the target table, tenant-scoped, inside a transaction,
 * and reports the real inserted/failed counts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  validation: null as Record<string, unknown> | null,
  inserted: null as unknown[] | null,
  updateSet: null as Record<string, unknown> | null,
  insertThrows: false,
}));

vi.mock('../../db', () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(state.validation ? [state.validation] : []),
  };
  return {
    db: {
      select: () => selectChain,
      transaction: async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          insert: () => ({
            values: (rows: unknown[]) => {
              if (state.insertThrows) throw new Error('insert failed');
              state.inserted = rows;
              return Promise.resolve();
            },
          }),
        };
        await cb(tx);
      },
      update: () => ({
        set: (s: Record<string, unknown>) => {
          state.updateSet = s;
          return { where: () => ({ returning: async () => [{ id: 'v1', ...s }] }) };
        },
      }),
    },
  };
});

// Middleware + heavy service are stubbed so the router can mount in isolation.
vi.mock('../../replitAuth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../routes-root-admin', () => ({
  requireRootAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/tenant-onboarding-service', () => ({ TenantOnboardingService: {} }));
vi.mock('../../utils/auth-helpers', () => ({
  getUserId: () => 'U1',
  getTenantId: () => 'T1',
}));

import onboardingRouter from '../../routes-tenant-onboarding';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tenants', onboardingRouter);
  return app;
}

const customersValidation = () => ({
  id: 'v1',
  dataType: 'customers',
  tenantId: 'T1',
  importExecuted: false,
  rawRows: [
    { Company: 'Acme', Email: 'a@acme.com' },
    { Company: 'Beta', Email: 'b@beta.com' },
  ],
  columnMappings: {
    Company: { mappedTo: 'companyName' },
    Email: { mappedTo: 'email' },
  },
  errors: [{ row: 2 }], // row 2 (Beta) failed validation → skipped
});

describe('PA-042: tenant-onboarding execute import', () => {
  beforeEach(() => {
    state.validation = null;
    state.inserted = null;
    state.updateSet = null;
    state.insertThrows = false;
  });

  it('inserts only the valid rows into the target table with tenant + defaults', async () => {
    state.validation = customersValidation();
    const res = await request(buildApp()).post('/api/tenants/import/v1/execute');

    expect(res.status).toBe(200);
    // one row skipped as invalid → 1 imported, 1 failed
    expect(res.body.importedRows).toBe(1);
    expect(res.body.failedRows).toBe(1);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted?.[0]).toMatchObject({
      tenantId: 'T1',
      recordType: 'customer',
      status: 'active',
      companyName: 'Acme',
      primaryContactEmail: 'a@acme.com',
    });
    // and the validation is marked executed with the real count
    expect(state.updateSet).toMatchObject({ importExecuted: true, importedRows: 1 });
  });

  it('rejects an unsupported data type without reporting success', async () => {
    state.validation = { ...customersValidation(), dataType: 'equipment' };
    const res = await request(buildApp()).post('/api/tenants/import/v1/execute');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_IMPORT_TYPE');
    expect(state.inserted).toBeNull();
    expect(state.updateSet).toBeNull(); // never marked executed
  });

  it('rolls back and surfaces an error when the insert fails', async () => {
    state.validation = customersValidation();
    state.insertThrows = true;
    const res = await request(buildApp()).post('/api/tenants/import/v1/execute');

    expect(res.status).toBe(500);
    expect(state.updateSet).toBeNull(); // importExecuted never set on failure
  });

  it('404s an unknown validation', async () => {
    state.validation = null;
    const res = await request(buildApp()).post('/api/tenants/import/nope/execute');
    expect(res.status).toBe(404);
  });

  it('409s a validation that was already executed', async () => {
    state.validation = { ...customersValidation(), importExecuted: true };
    const res = await request(buildApp()).post('/api/tenants/import/v1/execute');
    expect(res.status).toBe(409);
    expect(state.inserted).toBeNull();
  });
});
