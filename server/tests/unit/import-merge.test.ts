/**
 * PA-045 — merge-mode import actually merges. A duplicate resolved 'merge' now
 * overwrites the existing record's mapped fields (was a no-op TODO that only
 * incremented the counter).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  updateCalled: false,
  updateSet: null as Record<string, unknown> | null,
}));

vi.mock('../../db', () => ({
  db: {
    update: () => ({
      set: (s: Record<string, unknown>) => {
        state.updateSet = s;
        return {
          where: async () => {
            state.updateCalled = true;
          },
        };
      },
    }),
    insert: () => ({ values: async () => {} }),
  },
}));

vi.mock('../../middleware/supabase-auth', () => ({
  requireSupabaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import importRouter, { importJobs, type ImportJob } from '../../routes-import';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(importRouter);
  return app;
}

describe('PA-045: merge-mode import', () => {
  beforeEach(() => {
    state.updateCalled = false;
    state.updateSet = null;
    importJobs.clear();
  });

  it('updates the existing record when a duplicate is resolved as merge', async () => {
    importJobs.set('job1', {
      id: 'job1',
      tenantId: 'T1',
      userId: 'U1',
      status: 'pending',
      entityType: 'business_records',
      fileName: 'x.csv',
      fileData: [{ Company: 'Renamed Corp' }],
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      importedRows: 0,
      skippedRows: 0,
      mergedRows: 0,
      duplicatesDetected: 1,
      duplicatesResolved: 1,
      columnMappings: [
        {
          sourceColumn: 'Company',
          targetField: 'companyName',
          confidence: 1,
          dataType: 'string',
          isRequired: true,
          aiSuggested: false,
          userConfirmed: true,
        },
      ],
      unmappedColumns: [],
      validationErrors: [],
      duplicates: [
        {
          id: 'd1',
          rowNumber: 2, // row index 0 => i+2
          rowData: { Company: 'Renamed Corp' },
          existingRecordId: 'existing-1',
          existingRecordData: {},
          matchingFields: [],
          matchScore: 1,
          resolution: 'merge',
        },
      ],
      duplicateStrategy: 'prompt',
      useAiRefinement: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies ImportJob);

    const res = await request(buildApp()).post('/api/import/jobs/job1/execute');

    expect(res.status).toBe(200);
    expect(res.body.mergedRows).toBe(1);
    expect(res.body.importedRows).toBe(0);
    // The merge actually wrote to the existing record's mapped field.
    expect(state.updateCalled).toBe(true);
    expect(state.updateSet).toMatchObject({ companyName: 'Renamed Corp' });
  });
});
