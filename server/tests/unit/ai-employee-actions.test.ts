import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assignTaskBody, createEmployeeBody, TASK_PRIORITIES } from '@/lib/ai-employee-forms';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const DASH = strip(read('client/src/pages/AIEmployeeDashboard.tsx'));
const HUB = strip(read('client/src/pages/AIHub.tsx'));
const EMP = read('supabase/functions/ai-employee/handlers/employees.ts');
const TASKS = read('supabase/functions/ai-employee/handlers/tasks.ts');

/** The keys a zod object literal in a handler declares. */
function schemaKeys(src: string, name: string): string[] {
  const at = src.indexOf(`const ${name} = z.object({`);
  const body = src.slice(at, src.indexOf('\n});', at));
  return [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
}

const TEMPLATE = {
  id: 'sales_assistant',
  name: 'Sales Assistant',
  capabilities: ['lead_scoring'],
  expertiseAreas: ['pricing_strategies'],
  autonomyLevel: 'supervised',
};

describe('AI employee create and assign bodies (round 220)', () => {
  it('create sends only keys the server schema declares, and every required one', () => {
    const body = createEmployeeBody(TEMPLATE, '  Sam  ')!;
    const keys = schemaKeys(EMP, 'createEmployeeSchema');
    expect(keys.length).toBeGreaterThan(4);
    for (const k of Object.keys(body)) expect(keys).toContain(k);
    expect(body).toMatchObject({
      employeeName: 'Sam',
      employeeType: 'sales_assistant',
      employeeRole: 'Sales Assistant',
    });
  });

  it('create refuses a blank name or no template, and never guesses autonomy upward', () => {
    expect(createEmployeeBody(TEMPLATE, '   ')).toBeNull();
    expect(createEmployeeBody(null, 'Sam')).toBeNull();
    expect(
      createEmployeeBody({ ...TEMPLATE, autonomyLevel: 'godlike' }, 'Sam')!.autonomyLevel,
    ).toBe('supervised');
    expect(
      createEmployeeBody({ ...TEMPLATE, autonomyLevel: 'autonomous' }, 'Sam')!.autonomyLevel,
    ).toBe('autonomous');
  });

  it('assign sends only keys the task schema declares and a priority it accepts', () => {
    const body = assignTaskBody('e1', {
      taskType: 'lead_scoring',
      taskTitle: ' Score leads ',
      taskDescription: '',
      taskPriority: 'extreme',
    })!;
    const keys = schemaKeys(TASKS, 'assignTaskSchema');
    for (const k of Object.keys(body)) expect(keys).toContain(k);
    expect(body.taskTitle).toBe('Score leads');
    expect(body.taskPriority).toBe('medium');
    for (const p of TASK_PRIORITIES) expect(TASKS).toContain(`'${p}'`);
  });

  it('assign refuses a missing employee, type or title', () => {
    const ok = { taskType: 't', taskTitle: 'x', taskDescription: '', taskPriority: 'low' };
    expect(assignTaskBody(null, ok)).toBeNull();
    expect(assignTaskBody('e', { ...ok, taskType: ' ' })).toBeNull();
    expect(assignTaskBody('e', { ...ok, taskTitle: '' })).toBeNull();
  });
});

describe('AI employee and AI hub pages (round 220)', () => {
  it('both dashboard buttons post to the real endpoints', () => {
    expect(DASH).toMatch(/onClick=\{\(\) => setCreateOpen\(true\)\}/);
    expect(DASH).toMatch(/apiRequest\('\/api\/ai-employees', 'POST', body\)/);
    expect(DASH).toMatch(/apiRequest\('\/api\/ai-employees\/tasks', 'POST', body\)/);
    expect(DASH).toMatch(/setAssignTarget\(selectedEmployee\)/);
    expect(DASH).not.toMatch(/>\s*Configure\s*</);
  });

  it('the hub opens the create dialog through ?action=new, and the dashboard reads it', () => {
    expect(HUB).toContain('href="/ai-employees?action=new"');
    expect(DASH).toMatch(/if \(action === 'new'\) setCreateOpen\(true\)/);
  });

  it('the hub carries none of its typed-in metrics or handlerless actions', () => {
    for (const s of [
      'totalAIActions',
      'averageAccuracy',
      'timeSaved',
      'usageCount',
      'accuracy:',
      'lastUsed',
      'Smart Schedule',
      'AI Analysis',
      'AI Settings',
      'View Analytics',
    ]) {
      expect(HUB).not.toContain(s);
    }
  });
});

describe('check:edge-coverage reads whole-prefix renames (round 220)', () => {
  it('a bare functionName rename counts, a subPath-conditional one does not', async () => {
    const { wholeAliasTargets } = await import('../../../scripts/check-edge-path-coverage.mjs');
    const src = [
      "if (functionName === 'a-plural') {",
      "  functionName = 'a-single';",
      '  stripSegments = 0;',
      '}',
      "if (functionName === 'b' && subPath[0] === 'x') {",
      "  functionName = 'b-x';",
      '}',
    ].join('\n');
    expect(wholeAliasTargets(src)).toEqual({ 'a-plural': 'a-single' });
  });

  it('the real server.ts sends /api/ai-employees to ai-employee, which serves all three paths', async () => {
    const { wholeAliasTargets } = await import('../../../scripts/check-edge-path-coverage.mjs');
    expect(wholeAliasTargets()['ai-employees']).toBe('ai-employee');
    expect(EMP).toMatch(/method === 'POST' && !employeeIdOrSub/);
    expect(EMP).toMatch(/employeeIdOrSub === 'templates'/);
    expect(TASKS).toMatch(/method === 'POST' && seg1 === 'tasks'/);
  });
});
