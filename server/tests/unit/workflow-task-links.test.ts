/**
 * Round 246: the workflow create_task action stored its link to the
 * workflow in a `customFields` key `tasks` does not have. Drizzle dropped it,
 * so every workflow-created task had no link to its workflow, deal or account.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tasks } from '../../../shared/schema';

vi.mock('../../db', () => ({ db: {} }));
const { taskLinksFromContext } = await import('../../services/workflow-execution-service');

describe('taskLinksFromContext', () => {
  it('links a deal event to the deal and records the execution', () => {
    expect(taskLinksFromContext('exec-1', { dealId: 'deal-1', recordId: 'deal-1' })).toEqual({
      dealId: 'deal-1',
      tags: ['workflow-execution:exec-1'],
    });
  });

  it('links a record event to the account', () => {
    expect(taskLinksFromContext('exec-2', { businessRecordId: 'br-1' })).toEqual({
      customerId: 'br-1',
      tags: ['workflow-execution:exec-2'],
    });
  });

  it('invents nothing when the context names no subject', () => {
    expect(taskLinksFromContext(undefined, { dealId: '  ', other: 1 })).toEqual({});
  });

  it('only ever emits real tasks columns', () => {
    const cols = new Set(
      getTableConfig(tasks).columns.map((c) =>
        c.name.replace(/_([a-z])/g, (_, x) => x.toUpperCase()),
      ),
    );
    const all = taskLinksFromContext('e', { dealId: 'd', businessRecordId: 'b' });
    for (const k of Object.keys(all)) expect(cols.has(k), k).toBe(true);
  });

  it('the create_task insert no longer writes customFields', () => {
    const src = readFileSync('server/services/workflow-execution-service.ts', 'utf8')
      .replace(/(?<![:/])\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/customFields:/);
    expect(src).toMatch(
      /\.\.\.taskLinksFromContext\(context\.executionId, context\.workflowContext\)/,
    );
  });
});
