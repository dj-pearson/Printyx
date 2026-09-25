// Round 213. TaskBoardView took `groupedTasks` while its only caller passed
// `tasks`, so `groupedTasks.forEach` threw and choosing the Board view crashed
// (tsc reported it; the error sat in the typecheck ratchet as debt). Behind it,
// `task.watchers.length` and `priorityConfig[task.priority]` would have thrown
// on any row without watchers or with an unexpected priority. The empty-column
// "Add task" had no handler; it opens TaskHub's create dialog in that column.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/'"`])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const BOARD = strip(readFileSync('client/src/components/tasks/TaskBoardView.tsx', 'utf8'));
const ALL = strip(readFileSync('client/src/components/tasks/AllTasksView.tsx', 'utf8'));
const HUB = strip(readFileSync('client/src/pages/TaskHub.tsx', 'utf8'));
const DIALOG = strip(readFileSync('client/src/components/tasks/TaskDialogs.tsx', 'utf8'));

describe('TaskBoardView', () => {
  it('takes the tasks its caller passes', () => {
    expect(BOARD).not.toContain('groupedTasks');
    expect(BOARD).toMatch(/export function TaskBoardView\(\{\s*tasks,/);
    expect(ALL).toMatch(/<TaskBoardView\s+tasks=\{filteredTasks\}/);
  });

  it('reads optional row fields with a fallback', () => {
    expect(BOARD).not.toMatch(/task\.watchers\.length/);
    expect(BOARD).not.toMatch(/\{task\.commentCount > 0/);
    expect(BOARD).toMatch(
      /priorityConfig\[task\.priority as keyof typeof priorityConfig\] \?\? priorityConfig\.medium/,
    );
  });

  it('shows Add task only when it can do something, and passes the column status', () => {
    expect(BOARD).toMatch(
      /\{onAddTask && \(\s*<Button[\s\S]{0,300}onClick=\{\(\) => onAddTask\(id\)\}/,
    );
  });
});

describe('TaskHub wiring', () => {
  it('opens the create dialog in the column status and clears it on close', () => {
    expect(ALL).toContain('onAddTask={onAddTask}');
    expect(HUB).toMatch(
      /onAddTask=\{\(status\) => \{\s*setNewTaskStatus\(status\);\s*setIsCreateTaskOpen\(true\);/,
    );
    expect(HUB).toMatch(/if \(!open\) setNewTaskStatus\(null\);/);
    expect(HUB).toContain('initialStatus={newTaskStatus ?? undefined}');
  });

  it('uses the column status only as the dialog starting value', () => {
    expect(DIALOG).toMatch(
      /if \(open && initialStatus\)\s*setFormData\(\(prev\) => \(\{ \.\.\.prev, status: initialStatus/,
    );
  });
});
