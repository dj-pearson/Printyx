/**
 * WF-P-07. One project model, and what it covers.
 *
 * This repo carried two: `projects`, which TaskHub reads and tasks.project_id
 * points at, and `implementation_projects`, which had the richer columns and no
 * caller anywhere - no client tree named /api/implementation-projects, its edge
 * function sat in docs/unreferenced-edge-fns-baseline.json and the Express
 * router serving it had no importer. `projects` survives.
 *
 * The assertions below cover the two things that can silently be wrong: a write
 * naming a column the table does not have (PGRST204 fails the WHOLE insert), and
 * an empty equipment list standing in for "we cannot answer that", which is the
 * failure shape docs/unwritten-tables-baseline.json exists to name.
 *
 * Comments are stripped before any absence assertion. A test that a source does
 * NOT contain something otherwise matches the comment explaining why it went.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { projects } from '../../../shared/schema';
import {
  DEFAULT_INSTALL_MILESTONES,
  completionFromTasks,
  defaultMilestonesFor,
  mapProject,
  milestoneProgress,
  projectRow,
  projectTypeForHandoff,
  serialsForProject,
  taskCounts,
} from '../../../supabase/functions/projects/_project-scope';

const repo = join(__dirname, '..', '..', '..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the surviving project model', () => {
  it('carries the four columns the losing model had that it needed', () => {
    const columns = getTableColumns(projects);
    for (const name of ['contract_id', 'handoff_id', 'project_type', 'milestones']) {
      expect(Object.values(columns).map((c) => c.name)).toContain(name);
    }
  });

  it('writes nothing that is not a column on projects', () => {
    const columnNames = new Set(Object.values(getTableColumns(projects)).map((c) => c.name));
    const row = projectRow({
      name: 'Acme install',
      description: 'six units',
      status: 'planning',
      customerId: 'cust-1',
      contractId: 'contract-1',
      handoffId: 'handoff-1',
      projectType: 'installation',
      startDate: '2026-09-10',
      endDate: '2026-10-01',
      budget: '4200.5',
      estimatedHours: '40.9',
      actualHours: 12,
      completionPercentage: 10,
      milestones: [{ name: 'Site survey', status: 'pending' }],
      // Fields the losing model had. They must not reach the write.
      projectManagerId: 'user-9',
      teamMembers: ['user-9'],
      risks: [{ description: 'no power' }],
      lessonsLearned: 'none',
    });
    for (const key of Object.keys(row)) {
      expect(columnNames, `projectRow emitted ${key}`).toContain(key);
    }
    expect(row).not.toHaveProperty('project_manager_id');
    expect(row).not.toHaveProperty('risks');
  });

  it('rounds money to cents and truncates hours', () => {
    const row = projectRow({ name: 'x', budget: '4200.555', estimatedHours: '40.9' });
    expect(row.budget).toBe(4200.56);
    expect(row.estimated_hours).toBe(40);
  });

  it('leaves a column alone on PATCH when the caller did not send it', () => {
    const row = projectRow({ status: 'completed' }, { partial: true });
    expect(row).toEqual({ status: 'completed' });
    expect(row).not.toHaveProperty('name');
    expect(row).not.toHaveProperty('customer_id');
  });

  it('defaults status on create but never on patch', () => {
    expect(projectRow({ name: 'x' }).status).toBe('planning');
    expect(projectRow({ name: 'x' }, { partial: true })).not.toHaveProperty('status');
  });

  it("turns an unset Select's 'none' into null rather than writing it as an id", () => {
    const row = projectRow({ name: 'x', customerId: 'none', contractId: 'none' });
    expect(row.customer_id).toBeNull();
    expect(row.contract_id).toBeNull();
  });

  it('clears a link when the caller explicitly sends null', () => {
    const row = projectRow({ handoffId: null }, { partial: true });
    expect(row).toHaveProperty('handoff_id');
    expect(row.handoff_id).toBeNull();
  });
});

describe('project type and milestones', () => {
  it.each([
    ['new_customer', 'installation'],
    ['expansion', 'expansion'],
    ['migration', 'migration'],
    ['renewal', 'installation'],
    ['', 'installation'],
    [undefined, 'installation'],
  ])('maps handoff type %s to %s', (handoffType, expected) => {
    expect(projectTypeForHandoff(handoffType)).toBe(expected);
  });

  it('starts an install with the phases an install actually has', () => {
    const milestones = defaultMilestonesFor('installation');
    expect(milestones.map((m) => m.name)).toEqual(DEFAULT_INSTALL_MILESTONES.map((m) => m.name));
    expect(milestones.every((m) => m.status === 'pending')).toBe(true);
  });

  it('hands back a fresh array, so editing one project does not edit the template', () => {
    const first = defaultMilestonesFor('installation');
    first[0].status = 'completed';
    expect(defaultMilestonesFor('installation')[0].status).toBe('pending');
  });

  it('gives training its own shorter list', () => {
    expect(defaultMilestonesFor('training')).toHaveLength(3);
  });

  it('counts a milestone done from either its status or its completed date', () => {
    expect(
      milestoneProgress([
        { name: 'a', status: 'completed' },
        { name: 'b', status: 'pending', completedDate: '2026-09-01' },
        { name: 'c', status: 'pending' },
      ]),
    ).toEqual({ total: 3, completed: 2 });
  });

  it('survives a milestones column that is null or junk', () => {
    expect(milestoneProgress(null)).toEqual({ total: 0, completed: 0 });
    expect(milestoneProgress([null, 'nonsense'])).toEqual({ total: 2, completed: 0 });
  });
});

describe('completion', () => {
  it('is null with no tasks, not zero', () => {
    // 0% asserts the work has not started. A project nobody has broken into
    // tasks has not made that statement.
    expect(completionFromTasks({ taskCount: 0, completedTaskCount: 0 })).toBeNull();
  });

  it('is the completed share once there are tasks', () => {
    expect(completionFromTasks(taskCounts([{ status: 'completed' }, { status: 'todo' }]))).toBe(50);
  });
});

describe('mapProject', () => {
  it('answers camelCase for every key the panel reads', () => {
    const mapped = mapProject(
      {
        id: 'p1',
        name: 'Acme install',
        status: 'planning',
        project_type: 'installation',
        customer_id: 'c1',
        contract_id: 'k1',
        handoff_id: 'h1',
        milestones: [{ name: 'Site survey', status: 'completed' }],
        created_at: '2026-09-01T00:00:00Z',
      },
      taskCounts([{ status: 'completed' }]),
    );
    expect(mapped.projectType).toBe('installation');
    expect(mapped.contractId).toBe('k1');
    expect(mapped.handoffId).toBe('h1');
    expect(mapped.milestoneProgress).toEqual({ total: 1, completed: 1 });
    expect(mapped.completionPercentage).toBe(100);
  });
});

describe('the equipment a project covers', () => {
  const equipment = [
    { id: 'e1', serial_number: 'ABC123', purchase_order_id: 'po1', model_number: 'C750' },
    { id: 'e2', serial_number: 'DEF456', purchase_order_id: 'po1' },
    { id: 'e3', serial_number: 'ZZZ999', purchase_order_id: 'po-other' },
  ];
  const purchaseOrders = [
    { id: 'po1', po_number: 'PO-1001', source_contract_id: 'k1' },
    { id: 'po-other', po_number: 'PO-2002', source_contract_id: 'k2' },
  ];

  it('is the units ordered against this project contract, and no others', () => {
    const result = serialsForProject({ contract_id: 'k1' }, { purchaseOrders, equipment });
    expect(result.serials.map((s) => s.serialNumber)).toEqual(['ABC123', 'DEF456']);
    expect(result.serials[0].poNumber).toBe('PO-1001');
    expect(result.unbacked).toEqual([]);
  });

  it('says WHY it is empty rather than returning a bare empty list', () => {
    // An empty list on this panel reads as "nothing was ordered". Three
    // different states produce no serials and only one of them means that.
    const noContract = serialsForProject({ contract_id: null }, { purchaseOrders, equipment });
    expect(noContract.serials).toEqual([]);
    expect(noContract.unbacked[0]).toMatch(/no contract/i);

    const noOrders = serialsForProject({ contract_id: 'k9' }, { purchaseOrders, equipment });
    expect(noOrders.unbacked[0]).toMatch(/purchase order/i);

    const notReceived = serialsForProject({ contract_id: 'k1' }, { purchaseOrders, equipment: [] });
    expect(notReceived.unbacked[0]).toMatch(/not been received/i);
  });

  it('ignores equipment with no purchase order at all', () => {
    const result = serialsForProject(
      { contract_id: 'k1' },
      {
        purchaseOrders,
        equipment: [{ id: 'e4', serial_number: 'LOOSE', purchase_order_id: null }],
      },
    );
    expect(result.serials).toEqual([]);
  });
});

describe('the losing model is gone', () => {
  it('has no edge function left', () => {
    expect(existsSync(join(repo, 'supabase/functions/implementation-projects'))).toBe(false);
  });

  it('has no Express router left', () => {
    expect(existsSync(join(repo, 'server/routes-sales-handoff.ts'))).toBe(false);
  });

  it('is declared by no schema file', () => {
    for (const file of ['shared/schema.ts', 'shared/sales-handoff-schema.ts']) {
      const source = strip(readFileSync(join(repo, file), 'utf8'));
      expect(source, file).not.toMatch(/pgTable\(\s*'implementation_projects'/);
      expect(source, file).not.toContain('implementationProjects');
    }
  });

  it('is dropped by a migration that keeps rows if there are any', () => {
    const sql = readFileSync(
      join(repo, 'drizzle/migrations/0080_wf_p07_project_model.sql'),
      'utf8',
    );
    expect(sql).toMatch(/DROP TABLE public\.implementation_projects/);
    expect(sql).toMatch(/RENAME TO implementation_projects_retired_wf_p_07/);
    expect(sql).toMatch(/SELECT count\(\*\) FROM public\.implementation_projects/);
  });

  it('has the decision written down', () => {
    const doc = readFileSync(join(repo, 'docs/WF-P-07-project-model-decision.md'), 'utf8');
    expect(doc).toMatch(/`projects` survives/);
  });
});

describe('both hosts answer the same shape', () => {
  const edge = strip(readFileSync(join(repo, 'supabase/functions/projects/index.ts'), 'utf8'));
  const express = strip(readFileSync(join(repo, 'server/routes-tasks.ts'), 'utf8'));

  it('shares the row builder rather than each writing its own', () => {
    // /api/projects is not proxied, so Express serves dev and the edge function
    // serves production. Two hand-written mappers is how the two drift.
    for (const source of [edge, express]) {
      expect(source).toMatch(/projectRow/);
      expect(source).toMatch(/mapProject/);
      expect(source).toMatch(/serialsForProject/);
    }
  });

  it('reads the id from the FIRST path segment, not the last', () => {
    // /projects/:id/anything would otherwise come out as the id 'anything'.
    expect(edge).toMatch(/normalizePath\(url\.pathname, 'projects'\)/);
    expect(edge).not.toMatch(/pathParts\[pathParts\.length - 1\]/);
  });

  it('offers the same filters on both', () => {
    for (const source of [edge, express]) {
      for (const filter of ['handoffId', 'contractId', 'customerId']) {
        expect(source, filter).toContain(filter);
      }
    }
  });
});
