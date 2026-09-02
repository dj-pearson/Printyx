/**
 * WF-P-08: a task belongs to the record it is about.
 *
 * TWO DEFECTS, and the second is the one that stopped the feature working at
 * all.
 *
 * tasks.customer_id has existed since migration 0002 and the mapper NEVER READ
 * OR WROTE IT, and there was no deal or handoff link. Every task in the system
 * was a floating to-do with an assignee and no subject, which is why
 * DealDetail's Tasks tab rendered "Task links are not wired yet" - and why the
 * note beside it, saying tasks attach through crm_associations, was a guess:
 * nothing ever associated a task that way either.
 *
 * AND FIVE OF THE COLUMNS THE MAPPER DID WRITE DO NOT EXIST. Migration 0002
 * dropped parent_task_id, start_date, dependencies, watchers and custom_fields,
 * and the mapper kept setting them. PostgREST rejects an unknown column with
 * PGRST204 and fails the WHOLE write, and the create dialog sent four of the
 * five on every submit - so CreateTaskDialog could not create a task. The
 * dialog's Workflow tab held a dependency picker and its Custom tab said
 * "Custom fields will be available in future updates", both over columns the
 * database had already dropped.
 *
 * check:phantom-cols could not see any of it: the mapper builds its row through
 * `r[col] = v`, and that guard reads inline object literals and named payload
 * variables, not computed keys. AC4's getTableColumns pin is what closes that.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { tasks } from '../../../shared/schema';
import {
  UNPERSISTED_TASK_FIELDS,
  mapTask,
  unpersistedTaskFields,
} from '../../../supabase/functions/tasks/handlers/_task-mapper';

/**
 * Comments out, INCLUDING JSX ones.
 *
 * The line-oriented stripper this repo uses elsewhere only drops lines starting
 * with //, /* or *, and a `{/* ... *\/}` block's continuation lines start with
 * neither - so the comment above explaining that `dependencies` was removed
 * counted as a use of `dependencies`. That is the third time in this session an
 * absence assertion has read its own explanation as the defect; CLAUDE.md names
 * the trap and it keeps finding a new shape.
 */
const strip = (src: string) =>
  src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

const COLUMNS = new Set(Object.values(getTableColumns(tasks)).map((c) => c.name));

describe('AC4: the mapper writes only columns the table has', () => {
  it('a full body maps to real columns and nothing else', () => {
    const row = mapTask({
      title: 'Confirm the install date',
      description: 'Call the site contact',
      status: 'todo',
      priority: 'high',
      assignedTo: 'user-1',
      projectId: 'proj-1',
      customerId: 'acct-1',
      dealId: 'deal-1',
      handoffId: 'handoff-1',
      dueDate: '2026-09-10',
      estimatedHours: 2,
      actualHours: 0,
      completionPercentage: 0,
      tags: ['install'],
      completedAt: null,
    });
    const phantom = Object.keys(row).filter((k) => !COLUMNS.has(k));
    expect(phantom).toEqual([]);
    expect(row).toMatchObject({
      customer_id: 'acct-1',
      deal_id: 'deal-1',
      handoff_id: 'handoff-1',
      project_id: 'proj-1',
    });
  });

  it('the five dropped columns are never written, whatever the caller sends', () => {
    const row = mapTask({
      title: 'x',
      parentTaskId: 'task-9',
      startDate: '2026-09-01',
      dependencies: ['task-8'],
      watchers: ['user-2'],
      customFields: { anything: true },
    });
    expect(Object.keys(row)).toEqual(['title']);
    for (const k of ['parent_task_id', 'start_date', 'dependencies', 'watchers', 'custom_fields']) {
      expect(COLUMNS.has(k)).toBe(false);
    }
  });

  it('and they are REPORTED rather than silently dropped', () => {
    const reasons = unpersistedTaskFields({ title: 'x', parentTaskId: 'task-9', watchers: [] });
    expect(reasons).toHaveLength(2);
    expect(reasons.join(' ')).toContain('migration 0002');
    expect(unpersistedTaskFields({ title: 'x' })).toEqual([]);
    // Snake case too - a caller sending start_date learns the same thing.
    expect(unpersistedTaskFields({ start_date: '2026-09-01' })).toHaveLength(1);
    expect(Object.keys(UNPERSISTED_TASK_FIELDS)).toEqual([
      'parentTaskId',
      'startDate',
      'dependencies',
      'watchers',
      'customFields',
    ]);
  });

  it('a null link DETACHES the task rather than being ignored', () => {
    // `?? undefined` would drop it, so a task could be attached and never
    // un-attached.
    expect(mapTask({ dealId: null })).toEqual({ deal_id: null });
    expect(mapTask({ customerId: null })).toEqual({ customer_id: null });
    // An absent key is still absent, so a partial PATCH does not wipe links.
    expect(mapTask({ title: 'x' })).toEqual({ title: 'x' });
  });

  it('accepts snake_case for the links, like every other field', () => {
    expect(mapTask({ customer_id: 'acct-1', deal_id: 'deal-1' })).toEqual({
      customer_id: 'acct-1',
      deal_id: 'deal-1',
    });
  });

  it('the columns exist because the migration adds them', () => {
    expect(COLUMNS.has('deal_id')).toBe(true);
    expect(COLUMNS.has('handoff_id')).toBe(true);
    const sql = readFileSync('drizzle/migrations/0079_wf_p08_task_record_links.sql', 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "deal_id"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "handoff_id"');
    expect(sql).toContain('tasks_tenant_deal_idx');
    expect(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')).toContain(
      '0079_wf_p08_task_record_links',
    );
  });
});

describe('AC2: the list filters by what the task is about', () => {
  const handler = strip(readFileSync('supabase/functions/tasks/handlers/tasks.ts', 'utf8'));

  it('customerId, dealId, handoffId and projectId', () => {
    for (const filter of ['customer_id', 'deal_id', 'handoff_id', 'project_id']) {
      expect(handler).toContain(`q.eq('${filter}',`);
    }
  });

  it('the parentTaskId filter is gone - it was a 42703, not an empty result', () => {
    expect(handler).not.toContain('parent_task_id');
  });
});

describe('AC3: the dialog and the record pages', () => {
  const dialog = readFileSync('client/src/components/tasks/TaskDialogs.tsx', 'utf8');

  it('the create dialog offers a related-record picker', () => {
    expect(dialog).toContain('customerId: value');
    expect(dialog).toContain('dealId: value');
    expect(dialog).toContain('Not about a customer');
  });

  it('and no longer sends the four fields that failed the write', () => {
    // Scoped to CreateTaskDialog: CreateProjectDialog in the same file has its
    // own startDate, and projects.start_date is a real column. A whole-file
    // assertion would report working code.
    const code = strip(dialog);
    const from = code.indexOf('export function CreateTaskDialog');
    const to = code.indexOf('export function CreateProjectDialog');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const taskDialog = code.slice(from, to);
    for (const dead of ['parentTaskId', 'startDate', 'customFields', 'dependencies']) {
      expect(`${dead}: ${taskDialog.includes(dead)}`).toBe(`${dead}: false`);
    }
    // The tabs those fields lived on are gone with them.
    expect(taskDialog).not.toContain('value="workflow"');
    expect(taskDialog).not.toContain('value="custom"');
  });

  it('TaskHub feeds the picker real accounts and deals', () => {
    const hub = readFileSync('client/src/pages/TaskHub.tsx', 'utf8');
    expect(hub).toContain('customers={customerOptions}');
    expect(hub).toContain('deals={dealOptions}');
  });

  it('DealDetail lists and creates its own tasks, pre-linked', () => {
    const page = readFileSync('client/src/pages/DealDetail.tsx', 'utf8');
    expect(page).toContain('/api/tasks?dealId=${dealId}');
    expect(page).toContain('dealId,');
    // The placeholder this story exists to replace.
    expect(page).not.toContain('Task links are not wired yet');
    expect(page).not.toContain('crm_associations layer');
  });

  it('the handoff screen creates tasks carrying the handoff AND its customer', () => {
    const page = readFileSync('client/src/pages/SalesHandoffs.tsx', 'utf8');
    expect(page).toContain('handoffId: handoff.id');
    expect(page).toContain('customerId: handoff.customer_id');
  });
});
