/**
 * TaskHub's list queries must unwrap the edge function's envelope.
 *
 * supabase/functions/tasks/handlers/tasks.ts answers GET / with
 * { data, total, page, limit }. TaskHub handed that object straight to
 * MyTasksView, whose first statement is `tasks.filter(...)` - and an object has
 * no .filter, so the default tab threw on load. Six routes reach this page
 * (/tasks, /task-hub, /task-management, /basic-tasks, /my-tasks and
 * /ai-task-scheduling), and /api/tasks is proxied in dev, so both environments
 * hit it.
 *
 * Nothing else would catch this: apiRequest returns `any`, so tsc sees no
 * mismatch, and no test renders the page. The assertions below are on the
 * source, which is the only place the contract is visible.
 *
 * Comments are stripped first. An assertion that a source does NOT contain
 * something otherwise matches the comment explaining why it was removed - this
 * repo has produced that bug three times.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const taskHub = stripComments(readFileSync(join(repo, 'client/src/pages/TaskHub.tsx'), 'utf8'));
const tasksHandler = stripComments(
  readFileSync(join(repo, 'supabase/functions/tasks/handlers/tasks.ts'), 'utf8'),
);

describe('TaskHub list queries', () => {
  it.each(['/api/tasks', '/api/projects', '/api/users'])(
    'unwraps %s through extractRecords',
    (path) => {
      const call = new RegExp(`extractRecords\\(await apiRequest\\('${path}'\\)\\)`);
      expect(taskHub).toMatch(call);
    },
  );

  it('never hands a bare apiRequest list result to a view', () => {
    // A queryFn of the form `async () => apiRequest('/api/<list>')` is the bug.
    // Item fetches are not list fetches, so only paths with no interpolation and
    // no path segment beyond the resource are checked.
    const bare = [...taskHub.matchAll(/queryFn:\s*async\s*\(\)\s*=>\s*apiRequest\('([^']+)'\)/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes('${') && p.split('/').length === 3);
    expect(bare).toEqual([]);
  });

  it('imports extractRecords rather than reimplementing the unwrap', () => {
    expect(taskHub).toMatch(/import \{[^}]*extractRecords[^}]*\} from '@\/lib\/queryClient'/);
  });
});

describe('tasks edge function read shape', () => {
  it('camelCases every response the components read', () => {
    // task.dueDate, task.completionPercentage, task.timeTracked and
    // task.assignedTo are read across the tasks components; PostgREST returns
    // due_date, completion_percentage, time_tracked and assigned_to.
    expect(tasksHandler).toMatch(/import \{ toCamel \} from '\.\.\/\.\.\/_shared\/case\.ts'/);
    const responses = [...tasksHandler.matchAll(/jsonResponse\(\s*([^,]+),/g)].map((m) =>
      m[1].trim(),
    );
    const uncamelled = responses.filter((r) => /^data$/.test(r));
    expect(uncamelled).toEqual([]);
  });

  it('still accepts camelCase on writes, so the round trip is symmetric', () => {
    // WF-P-08 moved the mapper into handlers/_task-mapper.ts, because tasks.ts
    // imports _shared/http.ts, which reads Deno.env at module load and cannot be
    // loaded by vitest - so the mapper could not be tested where it stood.
    const mapper = readFileSync(
      join(repo, 'supabase/functions/tasks/handlers/_task-mapper.ts'),
      'utf8',
    );
    expect(mapper).toMatch(/const src = \(c: string, s: string\) => body\[c\] \?\? body\[s\]/);
    expect(tasksHandler).toMatch(/from '\.\/_task-mapper\.ts'/);
  });
});
