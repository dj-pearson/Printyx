/**
 * WF-C-06: the sales-to-operations handoff, which nothing reachable did.
 *
 * Three real tables shipped in migration 0000. server/routes-sales-handoff.ts
 * served them correctly and had no caller anywhere in any client tree. Meanwhile
 * supabase/functions/sales-handoffs, which production actually reaches, queried
 * `sales_handoffs` - a relation named by no schema, no migration and no other
 * file in the tree - so all six of its endpoints were a 42P01, and its embedded
 * selects named deal_id, implementation_lead_id and users.full_name, none of
 * which exist either. Two implementations of one feature, one unreachable and
 * one broken, and nothing in between. Operations found out a deal had closed by
 * being told.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import {
  handoffTaskTemplates,
  handoffTasks,
  salesHandoffChecklists,
} from '../../../shared/sales-handoff-schema';
import {
  DEFAULT_HANDOFF_TASKS,
  HANDOFF_TYPES,
  buildHandoffChecklist,
  defaultTemplateRow,
  handoffProgress,
  handoffTypeFor,
  instantiateHandoffTasks,
  normalizeHandoffType,
} from '../../../supabase/functions/_shared/sales-handoff';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const NOW = '2026-09-02T00:00:00.000Z';

describe('which checklist a sale gets', () => {
  it('follows the deal motion when the deal has one', () => {
    expect(handoffTypeFor({ dealMotion: 'renewal' })).toBe('renewal');
    expect(handoffTypeFor({ dealMotion: 'expansion' })).toBe('expansion');
    expect(handoffTypeFor({ dealMotion: 'new_logo' })).toBe('new_customer');
    // A fleet refresh, a lease rollover and a takeaway all replace machines that
    // are already on site, which is a migration however it was sold.
    expect(handoffTypeFor({ dealMotion: 'fleet_refresh' })).toBe('migration');
    expect(handoffTypeFor({ dealMotion: 'lease_rollover' })).toBe('migration');
    expect(handoffTypeFor({ dealMotion: 'competitive_takeaway' })).toBe('migration');
  });

  it('falls back to whether the account already had a contract', () => {
    // Not defaulted to new_customer: an existing account would get the wrong
    // checklist, starting with "handoff meeting" for a customer operations knows.
    expect(handoffTypeFor({ existingContractCount: 0 })).toBe('new_customer');
    expect(handoffTypeFor({ existingContractCount: 2 })).toBe('expansion');
    expect(handoffTypeFor({ dealMotion: null, existingContractCount: 1 })).toBe('expansion');
  });

  it('rejects a type outside the vocabulary', () => {
    expect(normalizeHandoffType('new_customer')).toBe('new_customer');
    expect(normalizeHandoffType(' RENEWAL ')).toBe('renewal');
    expect(normalizeHandoffType('whatever')).toBeNull();
    expect(HANDOFF_TYPES).toEqual(['new_customer', 'expansion', 'renewal', 'migration']);
  });
});

describe('the default template, and why one is bootstrapped', () => {
  it('ships a checklist for every handoff type', () => {
    for (const type of HANDOFF_TYPES) {
      expect(DEFAULT_HANDOFF_TASKS[type].length).toBeGreaterThan(0);
      // Order indices are what the instantiation sorts on.
      const indices = DEFAULT_HANDOFF_TASKS[type].map((t) => t.orderIndex);
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    }
  });

  it('supplies every NOT NULL column the template table has no default for', () => {
    // COP-M07's lazy bootstrap omitted one NOT NULL column and could therefore
    // never succeed on any tenant. Same pattern here, so the same check.
    const row = defaultTemplateRow('tenant-1', 'new_customer', 'user-1', NOW);
    const columns = getTableColumns(handoffTaskTemplates);
    const missing = Object.values(columns)
      .filter((c) => c.notNull && !c.hasDefault && !c.primary)
      .map((c) => c.name)
      .filter((name) => row[name] === undefined || row[name] === null);
    expect(missing).toEqual([]);
    expect(row.is_default).toBe(true);
  });

  it('names only real columns', () => {
    const names = new Set(Object.values(getTableColumns(handoffTaskTemplates)).map((c) => c.name));
    expect(
      Object.keys(defaultTemplateRow('t', 'renewal', null, NOW)).filter((k) => !names.has(k)),
    ).toEqual([]);
  });
});

describe('the checklist and its tasks', () => {
  const checklist = buildHandoffChecklist(
    {
      tenantId: 'tenant-1',
      customerId: 'acct-1',
      contractId: 'contract-1',
      opportunityId: 'deal-1',
      salesRepId: 'rep-1',
      salesRepName: 'A Rep',
      handoffType: 'new_customer',
      contractSummary: { contractValue: 24750 },
    },
    NOW,
  );

  it('is a real sales_handoff_checklists row', () => {
    const columns = getTableColumns(salesHandoffChecklists);
    const names = new Set(Object.values(columns).map((c) => c.name));
    expect(Object.keys(checklist).filter((k) => !names.has(k))).toEqual([]);
    const missing = Object.values(columns)
      .filter((c) => c.notNull && !c.hasDefault && !c.primary)
      .map((c) => c.name)
      .filter((name) => checklist[name] === undefined || checklist[name] === null);
    expect(missing).toEqual([]);
    expect(checklist).toMatchObject({
      status: 'pending',
      handoff_type: 'new_customer',
      contract_id: 'contract-1',
      completion_percentage: 0,
      ready_for_implementation: false,
    });
  });

  it('turns the template into dated tasks, in order', () => {
    const rows = instantiateHandoffTasks(
      DEFAULT_HANDOFF_TASKS.new_customer,
      'handoff-1',
      'tenant-1',
      NOW,
    );
    expect(rows).toHaveLength(DEFAULT_HANDOFF_TASKS.new_customer.length);
    expect(rows[0]).toMatchObject({
      tenant_id: 'tenant-1',
      handoff_id: 'handoff-1',
      task_name: 'Confirm signed contract and payment terms',
      status: 'pending',
      is_required: true,
      is_blocking: true,
    });
    // dueInDays 1 off 2026-09-02.
    expect(rows[0].due_date).toBe('2026-09-03T00:00:00.000Z');
    const columns = new Set(Object.values(getTableColumns(handoffTasks)).map((c) => c.name));
    expect(Object.keys(rows[0]).filter((k) => !columns.has(k))).toEqual([]);
  });

  it('sorts by orderIndex rather than trusting the array order', () => {
    const rows = instantiateHandoffTasks(
      [
        {
          taskName: 'B',
          description: '',
          assignToRole: 'x',
          category: 'y',
          isRequired: true,
          orderIndex: 2,
          dueInDays: 0,
        },
        {
          taskName: 'A',
          description: '',
          assignToRole: 'x',
          category: 'y',
          isRequired: true,
          orderIndex: 1,
          dueInDays: 0,
        },
      ],
      'h',
      't',
      NOW,
    );
    expect(rows.map((r) => r.task_name)).toEqual(['A', 'B']);
  });

  it('makes an optional task non-blocking', () => {
    const rows = instantiateHandoffTasks(
      [
        {
          taskName: 'Training',
          description: '',
          assignToRole: 'csm',
          category: 'training',
          isRequired: false,
          orderIndex: 1,
          dueInDays: 5,
        },
      ],
      'h',
      't',
      NOW,
    );
    expect(rows[0].is_required).toBe(false);
    expect(rows[0].is_blocking).toBe(false);
  });

  it('handles a template with no tasks without inventing any', () => {
    expect(instantiateHandoffTasks(null, 'h', 't', NOW)).toEqual([]);
    expect(instantiateHandoffTasks([], 'h', 't', NOW)).toEqual([]);
  });
});

describe('progress, and what "complete" means', () => {
  it('counts done and skipped tasks alike', () => {
    expect(
      handoffProgress([
        { status: 'completed', is_required: true },
        { status: 'skipped', is_required: false },
        { status: 'pending', is_required: true },
        { status: 'in_progress', is_required: true },
      ]),
    ).toEqual({ completionPercentage: 50, requiredComplete: false });
  });

  it('is required-complete only when every required task is done', () => {
    expect(
      handoffProgress([
        { status: 'completed', is_required: true },
        { status: 'pending', is_required: false },
      ]).requiredComplete,
    ).toBe(true);
  });

  it('a checklist with no required tasks is not "all required tasks done"', () => {
    // That is a different claim: the template said nothing was mandatory.
    expect(handoffProgress([{ status: 'completed', is_required: false }]).requiredComplete).toBe(
      false,
    );
    expect(handoffProgress([])).toEqual({ completionPercentage: 0, requiredComplete: false });
  });
});

describe('the phantom table is gone and one backend serves both hosts', () => {
  const edge = strip(readFileSync('supabase/functions/sales-handoffs/index.ts', 'utf8'));

  it('the edge function reads the real table', () => {
    expect(edge).not.toContain("from('sales_handoffs')");
    expect(edge).toContain("from('sales_handoff_checklists')");
    // The embedded selects it used to carry named columns that do not exist.
    expect(edge).not.toContain('implementation_lead_id');
    expect(edge).not.toContain('full_name');
  });

  it('refuses to complete a handoff with a required task still open', () => {
    // An install going out with no site survey and no billing set up is the exact
    // gap this queue exists to close.
    expect(edge).toContain('HANDOFF_TASKS_OUTSTANDING');
    expect(edge).toContain("t.is_required !== false && t.status !== 'completed'");
  });

  it('the three prefixes are proxied and the Express handlers are gone', () => {
    const proxy = readFileSync('server/middleware/edge-function-proxy.ts', 'utf8');
    for (const prefix of [
      '/api/sales-handoffs',
      '/api/handoff-tasks',
      '/api/handoff-task-templates',
    ]) {
      expect(proxy).toContain(`'${prefix}'`);
    }
    // The Express router is GONE now, not merely emptied of these three
    // prefixes. WF-C-06 left /api/implementation-projects behind in it, on the
    // grounds that no edge function served that prefix; WF-P-07 retired the
    // model instead, so the file went with it and nothing under this domain is
    // served twice.
    expect(existsSync('server/routes-sales-handoff.ts')).toBe(false);
    expect(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8')).not.toContain(
      "'/api/implementation-projects'",
    );
  });

  /**
   * CR-024 lives on. Its Express handler wrapped the checklist and its tasks in
   * one transaction, because a checklist with no tasks is a partial write
   * reported as success - and worse than that, it looks worked-through, since
   * every one of its zero tasks is done. PostgREST cannot span two inserts with a
   * transaction, so the edge equivalent is a compensating delete.
   */
  it('a failed task insert leaves no empty handoff behind', () => {
    const create = strip(readFileSync('supabase/functions/_shared/handoff-create.ts', 'utf8'));
    const at = create.indexOf('taskError');
    expect(at).toBeGreaterThan(-1);
    const block = create.slice(at, at + 500);
    expect(block).toContain("from('sales_handoff_checklists')");
    expect(block).toContain('.delete()');
    expect(create).toContain('handoff: null');
  });

  it('creation is idempotent on the contract', () => {
    // Acceptance and the closed-won move fire from the same sale seconds apart.
    // Without this, operations gets every deal twice.
    const create = strip(readFileSync('supabase/functions/_shared/handoff-create.ts', 'utf8'));
    expect(create).toContain("eq('contract_id', input.contractId)");
    expect(create).toContain('existing: true');
  });
});

describe('both events create one', () => {
  it('proposal acceptance creates a handoff', () => {
    const proposals = strip(readFileSync('supabase/functions/proposals/index.ts', 'utf8'));
    expect(proposals).toContain('createHandoff(db, {');
    expect(proposals).toContain('handoffTypeFor({');
    // Never fails an acceptance the customer already made.
    expect(proposals).toContain('handoff_create_failed');
  });

  it('closed won creates a handoff, and skips a deal with no account', () => {
    const pipeline = strip(readFileSync('supabase/functions/pipeline-config/index.ts', 'utf8'));
    expect(pipeline).toContain('toStage?.is_closed_won && deal.customer_id');
    expect(pipeline).toContain('createHandoff(db, {');
    expect(pipeline).toContain('handoff_create_failed');
  });
});

describe('the page', () => {
  const page = readFileSync('client/src/pages/SalesHandoffs.tsx', 'utf8');

  it('is routed and gated', () => {
    expect(readFileSync('client/src/App.tsx', 'utf8')).toContain(
      '<Route path="/handoffs" component={SalesHandoffs} />',
    );
    const nav = readFileSync('client/src/lib/navigation-permissions.ts', 'utf8');
    expect(nav).toContain("'/handoffs': {");
    expect(nav).toMatch(/'\/handoffs': \{[^}]*minLevel: 3/s);
  });

  it('claims, completes tasks and completes the handoff against real endpoints', () => {
    expect(page).toContain(
      "apiRequest(`/api/sales-handoffs/${id}`, 'PATCH', { status: 'in_progress' })",
    );
    expect(page).toContain('/api/handoff-tasks/${taskId}');
    expect(page).toContain('/api/sales-handoffs/${id}/complete');
  });

  it('offers the purchase order the handoff leads to', () => {
    expect(page).toContain('Create purchase order');
    expect(page).toContain('/purchase-orders?contractId=');
  });

  it('says the queue is empty rather than showing anything invented', () => {
    expect(page).toContain('Nothing in the queue');
    expect(page).not.toMatch(/\|\| \[\s*\{/);
  });
});
