/**
 * QUALITY-002 — the equipment onboarding checklist lives in
 * equipment_onboarding_checklists, not in the user-lifecycle table that shares
 * its export name.
 *
 * There are two unrelated tables here:
 *   equipment_onboarding_checklists (shared/schema.ts) — the installation
 *     checklist. checklistTitle, installationType, customerData,
 *     siteInformation, scheduledInstallDate. onboarding_equipment,
 *     _network_config, _print_management, _dynamic_sections and _tasks all carry
 *     a checklistId into it.
 *   onboarding_checklists (shared/user-lifecycle-schema.ts) — a NEW-USER
 *     checklist, keyed on userId with a jsonb items array, owned by
 *     services/user-lifecycle-service.ts.
 *
 * Both export a type named OnboardingChecklist and shared/schema.ts re-exports
 * the user-lifecycle one, so it won the name. storage's five checklist methods
 * and routes-export.ts both ended up on the wrong table: POST
 * /api/onboarding/checklists could not succeed (userId, items and totalItems are
 * all NOT NULL over there and nothing supplied them), and every equipment row
 * pointed at an id that was never in the table it FKs into.
 *
 * A name collision has no natural regression signal, so it is asserted here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  equipmentOnboardingChecklists,
  insertEquipmentOnboardingChecklistSchema,
} from '../../../shared/schema';
import { onboardingChecklists } from '../../../shared/user-lifecycle-schema';

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

import { storage } from '../../storage';
import { exportChecklistPDF } from '../../routes-export';

beforeEach(() => {
  state.queries = [];
});

function sql(): string {
  return state.queries.join('\n');
}

describe('QUALITY-002: the two onboarding checklist tables stay apart', () => {
  it('are genuinely different tables, which is why the name collision bites', () => {
    expect(getTableConfig(equipmentOnboardingChecklists).name).toBe(
      'equipment_onboarding_checklists',
    );
    expect(getTableConfig(onboardingChecklists).name).toBe('onboarding_checklists');

    const equipmentCols = getTableConfig(equipmentOnboardingChecklists).columns.map((c) => c.name);
    const lifecycleCols = getTableConfig(onboardingChecklists).columns.map((c) => c.name);

    expect(equipmentCols).toContain('checklist_title');
    expect(equipmentCols).toContain('installation_type');
    expect(equipmentCols).not.toContain('items');

    expect(lifecycleCols).toContain('items');
    expect(lifecycleCols).toContain('total_items');
    expect(lifecycleCols).not.toContain('checklist_title');
  });

  it('the user-lifecycle table requires columns the equipment checklist never has', () => {
    const required = getTableConfig(onboardingChecklists)
      .columns.filter((c) => c.notNull && !c.hasDefault)
      .map((c) => c.name);
    // These are what an equipment-shaped insert would violate.
    expect(required).toContain('user_id');
    expect(required).toContain('items');
    expect(required).toContain('total_items');
  });
});

describe('QUALITY-002: storage checklist methods use the equipment table', () => {
  it.each([
    ['getOnboardingChecklists', () => storage.getOnboardingChecklists('T1')],
    ['getOnboardingChecklist', () => storage.getOnboardingChecklist('c1', 'T1')],
    ['deleteOnboardingChecklist', () => storage.deleteOnboardingChecklist('c1', 'T1')],
    [
      'updateOnboardingChecklist',
      () => storage.updateOnboardingChecklist('c1', 'T1', { checklistTitle: 'x' }),
    ],
  ])('%s', async (_name, call) => {
    await call();
    expect(sql()).toContain('"equipment_onboarding_checklists"');
    expect(sql()).not.toMatch(/(from|into|update|delete from) "onboarding_checklists"/);
  });

  it('createOnboardingChecklist inserts into the equipment table', async () => {
    await storage.createOnboardingChecklist({
      tenantId: 'T1',
      customerId: 'cust-1',
      checklistTitle: 'Install at Acme',
      installationType: 'new_installation',
      createdBy: 'user-1',
    });
    expect(sql()).toContain('insert into "equipment_onboarding_checklists"');
  });
});

describe('QUALITY-002: the export endpoint reads the equipment table', () => {
  it('exportChecklistPDF selects equipment_onboarding_checklists', async () => {
    const res = {
      status: () => res,
      json: () => res,
      setHeader: () => undefined,
      send: () => undefined,
    } as unknown as Parameters<typeof exportChecklistPDF>[1];
    const req = {
      params: { id: 'c1' },
      user: { tenantId: 'T1' },
    } as unknown as Parameters<typeof exportChecklistPDF>[0];

    await exportChecklistPDF(req, res);
    expect(sql()).toContain('from "equipment_onboarding_checklists"');
    expect(sql()).not.toContain('from "onboarding_checklists"');
  });
});

describe('QUALITY-002: the route validates against the equipment insert schema', () => {
  it('accepts an equipment checklist payload', () => {
    const parsed = insertEquipmentOnboardingChecklistSchema.parse({
      tenantId: 'T1',
      customerId: 'cust-1',
      checklistTitle: 'Install at Acme',
      installationType: 'new_installation',
      createdBy: 'user-1',
    });
    expect(parsed.checklistTitle).toBe('Install at Acme');
  });

  it('rejects one that is missing installationType, which is NOT NULL', () => {
    expect(() =>
      insertEquipmentOnboardingChecklistSchema.parse({
        tenantId: 'T1',
        customerId: 'cust-1',
        checklistTitle: 'Install at Acme',
        createdBy: 'user-1',
      }),
    ).toThrow();
  });
});
