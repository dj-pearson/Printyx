import { describe, it, expect, vi } from 'vitest';
import {
  buildTemplateTasks,
  createHandoffWithTasks,
  type HandoffTxExecutor,
} from '../../lib/sales-handoff-create';

const NOW = 1_700_000_000_000; // fixed for deterministic due dates

describe('buildTemplateTasks (CR-024)', () => {
  it('maps template tasks to insertable rows with derived due dates', () => {
    const rows = buildTemplateTasks(
      [{ taskName: 'Kickoff', category: 'onboarding', isRequired: true, dueInDays: 3 }],
      { tenantId: 'tenant-1', handoffId: 'ho-1', now: NOW },
    );
    expect(rows).toEqual([
      {
        tenantId: 'tenant-1',
        handoffId: 'ho-1',
        taskName: 'Kickoff',
        description: undefined,
        category: 'onboarding',
        assignedToRole: undefined,
        isRequired: true,
        isBlocking: true,
        dueDate: new Date(NOW + 3 * 24 * 60 * 60 * 1000),
      },
    ]);
  });
});

/** Fake transaction executor recording writes; second insert can be made to throw. */
function makeTx(opts: { failSecondInsert?: boolean; templateTasks?: any[] }): {
  tx: HandoffTxExecutor;
  inserts: unknown[][];
} {
  const inserts: unknown[][] = [];
  let insertCount = 0;
  const tx: HandoffTxExecutor = {
    insert: () => ({
      values: (rows: unknown) => {
        insertCount += 1;
        const thisCall = insertCount;
        const record = () => {
          if (opts.failSecondInsert && thisCall === 2) {
            throw new Error('simulated failure on second write');
          }
          inserts.push([rows]);
        };
        return {
          returning: async () => {
            record();
            return [{ id: 'ho-1' }];
          },
          then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
            try {
              record();
              return Promise.resolve(resolve(undefined));
            } catch (e) {
              return Promise.resolve(reject(e));
            }
          },
        } as any;
      },
    }),
    query: {
      handoffTaskTemplates: {
        findFirst: async () => ({ tasks: opts.templateTasks ?? [] }),
      },
    },
  };
  return { tx, inserts };
}

describe('createHandoffWithTasks transaction flow (CR-024)', () => {
  const baseParams = {
    checklistTable: {},
    taskTable: {},
    templateWhere: () => ({}),
    handoffData: { tenantId: 'tenant-1', title: 'Acme handoff' },
    tenantId: 'tenant-1',
    now: NOW,
  };

  it('inserts checklist then template tasks through the same executor', async () => {
    const { tx, inserts } = makeTx({ templateTasks: [{ taskName: 'A', dueInDays: 1 }] });
    const handoff = await createHandoffWithTasks(tx, { ...baseParams, templateId: 'tmpl-1' });
    expect(handoff).toEqual({ id: 'ho-1' });
    expect(inserts).toHaveLength(2); // checklist + tasks
  });

  it('propagates a failure on the second write so the transaction rolls back', async () => {
    const { tx, inserts } = makeTx({
      failSecondInsert: true,
      templateTasks: [{ taskName: 'A', dueInDays: 1 }],
    });
    await expect(
      createHandoffWithTasks(tx, { ...baseParams, templateId: 'tmpl-1' }),
    ).rejects.toThrow('simulated failure on second write');
    // Only the checklist insert was recorded; the tasks insert threw before
    // recording — a real DB transaction would roll the checklist back too.
    expect(inserts).toHaveLength(1);
  });

  it('skips the task insert when no template is specified', async () => {
    const { tx, inserts } = makeTx({});
    await createHandoffWithTasks(tx, { ...baseParams, templateId: null });
    expect(inserts).toHaveLength(1);
  });
});
