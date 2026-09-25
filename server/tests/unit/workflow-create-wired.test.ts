import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 200. WorkflowAutomation's create dialog was unbound over a dead
 * "Create & Configure"; Run Now and Duplicate had no handlers; never-run
 * workflows showed a 1970 last-execution date; and the workflows edge
 * function it now calls had no role gate at all.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/WorkflowAutomation.tsx'), 'utf8'));
const FN = strip(readFileSync(join(root, 'supabase/functions/workflows/index.ts'), 'utf8'));
const PROXY = readFileSync(join(root, 'server/middleware/edge-function-proxy.ts'), 'utf8');

describe('create', () => {
  it('posts a draft to the workflows function', () => {
    expect(PAGE).toMatch(/apiRequest\('\/api\/workflows', 'POST'/);
    expect(PAGE).toMatch(/status: 'draft'/);
    expect(PAGE).toMatch(/onClick=\{\(\) => createWorkflow\.mutate\(\)\}/);
    expect(PAGE).toMatch(/value=\{draft\.name\}/);
  });
  it('dev reaches the same function production does', () => {
    expect(PROXY).toContain("'/api/workflows': 'workflows',");
  });
});

describe('the workflows function', () => {
  it('gates every write at manager before routing', () => {
    const gate = FN.indexOf("req.method !== 'GET' && req.method !== 'HEAD'");
    expect(gate).toBeGreaterThan(-1);
    expect(FN.slice(gate, gate + 600)).toContain('ROLE_LEVEL.MANAGER');
    expect(gate).toBeLessThan(FN.indexOf("req.method === 'POST' && !workflowId"));
  });
  it('still refuses manual execution', () => {
    expect(FN).toContain("code: 'USE_WORKFLOW_RUNTIME'");
  });
});

describe('the page', () => {
  it('shows Never rather than 1970 for a workflow that has not run', () => {
    expect(PAGE).toMatch(
      /lastExecution: workflow\.lastExecution \? new Date\(workflow\.lastExecution\) : null/,
    );
    expect(PAGE).toMatch(/: 'Never'/);
  });
  it('has no Run Now or Duplicate controls', () => {
    expect(PAGE).not.toContain('Run Now');
    expect(PAGE).not.toContain('Duplicate');
    expect(PAGE).not.toContain('Create & Configure');
  });
});
