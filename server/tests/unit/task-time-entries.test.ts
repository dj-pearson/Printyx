// PROD-008b: the task time-tracking surface.
//
// TaskTimeTracker.tsx is live - TaskBoardView and TaskDialogs both render it -
// and calls five endpoints. /api/tasks is proxied to the tasks edge function,
// which served only two of them, so start timer, stop timer, delete entry and
// the manual-entry POST were 404s on BOTH hosts while Express's working
// implementations sat shadowed behind the proxy.
//
// These read the sources and exercise the pure elapsed-minutes rule, so they
// need no database and no edge runtime.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { elapsedMinutes } from '../../../supabase/functions/_shared/time-entry-math';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');
const stripComments = (src: string) =>
  src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

const DISPATCH = stripComments(read('supabase/functions/tasks/index.ts'));
const HANDLER = stripComments(read('supabase/functions/tasks/handlers/time-entries.ts'));
const COMPONENT = stripComments(read('client/src/components/tasks/TaskTimeTracker.tsx'));

describe('every endpoint TaskTimeTracker calls is dispatched', () => {
  it('the component still calls the five paths this covers', () => {
    // If a path here disappears the component changed shape - re-derive the
    // list rather than deleting the assertion.
    for (const path of [
      '/time-entries`',
      '/timer/start`',
      '/timer/stop`',
      '/time`',
      '/time-entries/${entryId}`',
    ]) {
      expect(COMPONENT, `component no longer calls ${path}`).toContain(path);
    }
  });

  it('routes /:id/time as well as /:id/time-entry to create', () => {
    expect(DISPATCH).toMatch(/parts\[1\] === 'time-entry' \|\| parts\[1\] === 'time'/);
  });

  it('routes the timer verbs, and only the two that exist', () => {
    expect(DISPATCH).toMatch(/parts\[1\] === 'timer'/);
    // This used to assert `timer-${parts[2]}`, which interpolated any third
    // segment into the op name and relied on the handler returning null for the
    // ones it did not know. PA-052 enumerated the verbs instead, so they are
    // named somewhere a reader - and check:edge-coverage - can see them.
    expect(DISPATCH).toMatch(
      /parts\[2\] === 'start' \? 'start' : parts\[2\] === 'stop' \? 'stop' : null/,
    );
    expect(DISPATCH).toContain('`timer-${verb}`');
    expect(HANDLER).toContain("op === 'timer-start'");
    expect(HANDLER).toContain("op === 'timer-stop'");
  });

  it('carries the entry id through to delete instead of dropping it', () => {
    // The old dispatcher forwarded ['list', taskId] for EVERY /time-entries
    // path, so the entryId never reached a handler.
    expect(DISPATCH).toContain("pathParts: ['delete', parts[0], parts[2]]");
    expect(HANDLER).toContain("op === 'delete'");
    expect(HANDLER).toContain('const entryId = pathParts[2];');
  });

  it('the delete branch is matched before the list branch', () => {
    // Both test parts[1] === 'time-entries'; the 3-part form must come first or
    // a delete is answered with a list.
    const del = DISPATCH.indexOf("pathParts: ['delete', parts[0], parts[2]]");
    const list = DISPATCH.indexOf("pathParts: ['list', parts[0]]");
    expect(del).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(-1);
    expect(del).toBeLessThan(list);
  });
});

describe('the list returns what the component reads', () => {
  it('maps rows to camelCase', () => {
    // The component types isRunning/startedAt/entryDate and does
    // `entries.find(e => e.isRunning)`. Raw snake_case rows made that never
    // match, so a running timer could not be shown even when one existed.
    for (const field of ['isRunning:', 'startedAt:', 'entryDate:', 'taskId:', 'userName']) {
      expect(HANDLER).toContain(field);
    }
  });

  it('resolves userName without assuming a PostgREST embed', () => {
    // time_entries has no declared FK to users, so an embed is unavailable -
    // one .in() lookup per page instead.
    expect(HANDLER).toContain("from('users')");
    expect(HANDLER).toContain('.in(');
  });
});

describe('elapsedMinutes', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('rounds to the nearest minute', () => {
    expect(elapsedMinutes('2026-08-20T11:30:00.000Z', now)).toBe(30);
    expect(elapsedMinutes('2026-08-20T11:59:10.000Z', now)).toBe(1);
    expect(elapsedMinutes('2026-08-20T11:00:20.000Z', now)).toBe(60);
  });

  it('floors at one minute, matching the Express rule it replaces', () => {
    // A timer started and stopped immediately still logs a minute rather than
    // a zero-length entry.
    expect(elapsedMinutes('2026-08-20T12:00:00.000Z', now)).toBe(1);
    expect(elapsedMinutes('2026-08-20T12:05:00.000Z', now)).toBe(1);
  });

  it('does not throw on a missing or unparseable start', () => {
    expect(elapsedMinutes(null, now)).toBe(1);
    expect(elapsedMinutes('not a date', now)).toBe(1);
  });
});

describe('the manual entry accepts what the page sends', () => {
  it('takes `minutes`, not only `hours`', () => {
    // `hours` is the column name but the unit is MINUTES
    // (shared/task-schema.ts:154). The page posts { minutes, description, date }
    // and the old handler required `hours`, rejecting every entry with a 400.
    expect(COMPONENT).toContain('minutes: number');
    expect(HANDLER).toContain('body?.minutes ?? body?.hours');
  });
});
