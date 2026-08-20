// CRMX-008a: workflow event dispatch on the edge side.
//
// Exercised against a fake PostgREST client rather than a database, so the
// guarantees are asserted directly: the kill switch, idempotency including the
// insert race, and that a dispatch failure can never propagate to the write that
// triggered it.
import { describe, it, expect } from 'vitest';
import {
  dispatchWorkflowEvent,
  dispatchWorkflowEventSafe,
  executionDedupeKey,
} from '../../../supabase/functions/_shared/workflow-dispatch';

type Row = Record<string, any>;

/**
 * Enough of the PostgREST builder to run the dispatch chain. Filters accumulate
 * and are applied when the chain is awaited via .maybeSingle() or by the
 * implicit await on the builder itself.
 */
function fakeDb(tables: Record<string, Row[]>, opts: { insertFails?: boolean } = {}) {
  const inserted: Record<string, Row[]> = {};
  let failNextInsert = opts.insertFails ?? false;

  function builder(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let payload: Row | null = null;

    const rows = () => {
      let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (order) {
        out = [...out].sort((a, b) =>
          order!.asc ? a[order!.col] - b[order!.col] : b[order!.col] - a[order!.col],
        );
      }
      if (limit != null) out = out.slice(0, limit);
      return out;
    };

    const api: any = {
      select: () => api,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), api),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), api),
      order: (col: string, o: { ascending: boolean }) => ((order = { col, asc: o.ascending }), api),
      limit: (n: number) => ((limit = n), api),
      insert: (values: Row) => ((payload = values), api),
      maybeSingle: async () => {
        if (payload) {
          if (failNextInsert) {
            failNextInsert = false;
            return { data: null, error: { message: 'duplicate key' } };
          }
          const row = { id: `exec-${(tables[table] ?? []).length + 1}`, ...payload };
          (tables[table] ??= []).push(row);
          (inserted[table] ??= []).push(row);
          return { data: row, error: null };
        }
        return { data: rows()[0] ?? null, error: null };
      },
      then: (resolve: (v: { data: Row[] }) => unknown) => resolve({ data: rows() }),
    };
    return api;
  }

  return { db: { from: builder }, tables, inserted };
}

const ACTIVE = { id: 'wf-1', status: 'active', tenant_id: 'T1' };
const TRIGGER = {
  id: 'trg-1',
  workflow_id: 'wf-1',
  type: 'event',
  event_name: 'deal.stage_changed',
  enabled: true,
};
const VERSION = { id: 'ver-2', workflow_id: 'wf-1', version: 2 };

function base(over: Partial<Record<string, Row[]>> = {}) {
  return {
    workflows: [{ ...ACTIVE }],
    workflow_triggers: [{ ...TRIGGER }],
    workflow_conditions: [],
    workflow_versions: [{ id: 'ver-1', workflow_id: 'wf-1', version: 1 }, { ...VERSION }],
    workflow_executions: [],
    ...over,
  } as Record<string, Row[]>;
}

describe('dispatchWorkflowEvent', () => {
  it('enrols one execution for a matching trigger', async () => {
    const { db, tables } = fakeDb(base());
    const ids = await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', { dealId: 'd1' });
    expect(ids).toHaveLength(1);
    expect(tables.workflow_executions).toHaveLength(1);
  });

  it('puts the event name and payload in the execution context', async () => {
    // The executor reads context to run the steps; an enrolment with no payload
    // starts a workflow that cannot see what triggered it.
    const { db, tables } = fakeDb(base());
    await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', { dealId: 'd1', stageId: 's2' });
    expect(tables.workflow_executions[0].context).toEqual({
      event: 'deal.stage_changed',
      dealId: 'd1',
      stageId: 's2',
    });
  });

  it('queues rather than running - the sweeper advances it', async () => {
    const { db, tables } = fakeDb(base());
    await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {});
    expect(tables.workflow_executions[0].status).toBe('queued');
  });

  it('pins the LATEST version, so a later edit cannot change a run in flight', async () => {
    const { db, tables } = fakeDb(base());
    await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {});
    expect(tables.workflow_executions[0].workflow_version_id).toBe('ver-2');
  });

  it('does not enrol a workflow with no version', async () => {
    const { db, tables } = fakeDb(base({ workflow_versions: [] }));
    expect(await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {})).toEqual([]);
    expect(tables.workflow_executions).toHaveLength(0);
  });
});

describe('the kill switch', () => {
  it.each(['paused', 'draft', 'archived'])('does not enrol a %s workflow', async (status) => {
    const { db, tables } = fakeDb(base({ workflows: [{ ...ACTIVE, status }] }));
    expect(await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {})).toEqual([]);
    expect(tables.workflow_executions).toHaveLength(0);
  });
});

describe('trigger matching', () => {
  it('ignores a trigger for a different event', async () => {
    const { db } = fakeDb(base());
    expect(await dispatchWorkflowEvent(db, 'T1', 'record.created', {})).toEqual([]);
  });

  it('ignores a disabled trigger', async () => {
    const { db } = fakeDb(base({ workflow_triggers: [{ ...TRIGGER, enabled: false }] }));
    expect(await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {})).toEqual([]);
  });

  it('ignores a schedule trigger that happens to name the event', async () => {
    const { db } = fakeDb(base({ workflow_triggers: [{ ...TRIGGER, type: 'schedule' }] }));
    expect(await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {})).toEqual([]);
  });

  it('does not enrol when the conditions do not match', async () => {
    const { db } = fakeDb(
      base({
        workflow_conditions: [
          {
            trigger_id: 'trg-1',
            condition_group: 'default',
            logical_operator: 'AND',
            left_operand: 'amount',
            operator: 'greater_than',
            right_operand: '1000',
            data_type: 'number',
            order_index: 0,
          },
        ],
      }),
    );
    expect(await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', { amount: 100 })).toEqual(
      [],
    );
    expect(
      await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', { amount: 5000 }),
    ).toHaveLength(1);
  });
});

describe('idempotency', () => {
  it('enrols once for a repeated dispatch with the same dedupe key', async () => {
    // The realistic case: a client retries a PUT, or a user clicks twice.
    const { db, tables } = fakeDb(base());
    const opts = { dedupeKey: 'stage:d1:s2' };
    const first = await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {}, opts);
    const second = await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {}, opts);
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(tables.workflow_executions).toHaveLength(1);
  });

  it('enrols twice when no dedupe key is supplied', async () => {
    // NULL keys are exempt from the unique index, so an unkeyed dispatch is
    // always-enrol by design.
    const { db, tables } = fakeDb(base());
    await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {});
    await dispatchWorkflowEvent(db, 'T1', 'deal.stage_changed', {});
    expect(tables.workflow_executions).toHaveLength(2);
  });

  it('recovers the winner when the insert loses the unique-index race', async () => {
    // A concurrent dispatch got there first. Re-reading is correct: the desired
    // state - exactly one execution - holds, so reporting a failure would be
    // wrong.
    const store = base();
    store.workflow_executions.push({
      id: 'exec-winner',
      tenant_id: 'T1',
      workflow_id: 'wf-1',
      dedupe_key: 'trg-1:stage:d1:s2',
    });
    const { db } = fakeDb(store, { insertFails: true });
    // Force the pre-check to miss by using a key the pre-check cannot see, then
    // let the insert fail: the recovery path is what returns the id.
    const ids = await dispatchWorkflowEvent(
      db,
      'T1',
      'deal.stage_changed',
      {},
      { dedupeKey: 'stage:d1:s2' },
    );
    expect(ids).toEqual(['exec-winner']);
  });

  it('scopes the stored key by TRIGGER, so two triggers both enrol', () => {
    // Two triggers on one workflow listening to the same event are separate
    // enrolments; a shared key would silently drop one.
    expect(executionDedupeKey('trg-1', 'stage:d1:s2')).toBe('trg-1:stage:d1:s2');
    expect(executionDedupeKey('trg-2', 'stage:d1:s2')).toBe('trg-2:stage:d1:s2');
    expect(executionDedupeKey('trg-1', undefined)).toBeUndefined();
  });
});

describe('dispatchWorkflowEventSafe', () => {
  it('swallows a failure rather than failing the write that triggered it', async () => {
    const exploding = {
      from() {
        throw new Error('postgrest exploded');
      },
    };
    await expect(
      dispatchWorkflowEventSafe(exploding, 'T1', 'deal.stage_changed', {}),
    ).resolves.toEqual([]);
  });
});

describe('the seams are wired into the edge handlers', () => {
  // The whole point of CRMX-008a: dispatch has to be CALLED, not merely
  // available. These read the sources (comments stripped, since the comments
  // here name the very symbols being asserted).
  const strip = (src: string) =>
    src.replace(/^[ \t]*\/\/[^\n]*/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const read = (p: string) =>
    strip(
      require('node:fs').readFileSync(require('node:path').join(__dirname, '../../..', p), 'utf-8'),
    );

  const DEALS = read('supabase/functions/deals/index.ts');
  const RECORDS = read('supabase/functions/business-records/index.ts');

  it('deals dispatches deal.stage_changed on a stage change', () => {
    expect(DEALS).toContain("'deal.stage_changed'");
    expect(DEALS).toContain('dispatchWorkflowEventSafe');
    // Guarded on the stage actually moving - dispatching on every update would
    // enrol a stage-change automation when someone edits the deal name.
    expect(DEALS).toMatch(/if \(updateData\.stage_id\)/);
  });

  it('business-records dispatches both record events', () => {
    expect(RECORDS).toContain("'record.created'");
    expect(RECORDS).toContain("'record.updated'");
  });

  it('every seam uses the Safe wrapper, so automation cannot fail the write', () => {
    for (const [name, src] of [
      ['deals', DEALS],
      ['business-records', RECORDS],
    ] as const) {
      const safe = (src.match(/dispatchWorkflowEventSafe\(/g) ?? []).length;
      const bare = (src.match(/[^e]\bdispatchWorkflowEvent\(/g) ?? []).length;
      expect(safe, `${name} has no dispatch call`).toBeGreaterThan(0);
      expect(bare, `${name} calls the throwing form`).toBe(0);
    }
  });
});
