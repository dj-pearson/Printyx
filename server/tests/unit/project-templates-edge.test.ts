/**
 * Round 159: /api/templates.
 *
 * The edge function production runs read and wrote `templates`, a table in no
 * schema and no migration, so the Templates view listed nothing in production
 * while Express (dev) read the real `project_templates`. Instantiating a
 * template also inserted its tasks with no created_by (NOT NULL), a status
 * outside the tasks vocabulary, and a discarded result - so every project made
 * from a template had no tasks and nothing said so.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = stripComments(readFileSync('supabase/functions/templates/index.ts', 'utf8'));

describe('templates edge function', () => {
  it('reads and writes project_templates, never the phantom `templates`', () => {
    expect(fn).not.toMatch(/from\('templates'\)/);
    expect((fn.match(/from\('project_templates'\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('writes only columns project_templates has', () => {
    expect(fn).toMatch(/task_template:/);
    expect(fn).not.toMatch(/\bmilestones:/);
    expect(fn).not.toMatch(/\bis_active:/);
    expect(fn).not.toMatch(/set\.updated_at/);
  });

  describe('instantiate', () => {
    const at = fn.indexOf("action === 'instantiate'");
    const branch = fn.slice(at, fn.indexOf("req.method === 'DELETE'", at));

    it('inserts tasks with created_by and a status in the tasks vocabulary', () => {
      const tasks = branch.slice(branch.indexOf('const taskInserts'));
      expect(tasks).toMatch(/created_by: user\.id/);
      expect(tasks).toMatch(/status: 'todo'/);
      expect(tasks).not.toMatch(/status: 'pending'/);
    });

    it('checks the task insert and reports what landed', () => {
      expect(branch).toMatch(
        /const \{ data: inserted, error: insertError \} = await admin\s*\.from\('tasks'\)/,
      );
      expect(branch).toMatch(/tasksCreated,/);
      expect(branch).toMatch(/tasksExpected: templateTasks\.length/);
    });

    it("starts the project in 'planning'", () => {
      expect(branch).toMatch(/status: 'planning'/);
    });
  });

  it('dev runs it too', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/templates': 'templates'/);
    expect(existsSync('server/routes-templates.ts')).toBe(false);
  });
});
