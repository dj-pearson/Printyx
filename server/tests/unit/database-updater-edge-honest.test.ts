// Round 166: the database-updater edge function answered 200 success:true to
// every control the two admin pages call while doing nothing - the updater is
// an in-process Node scheduler (server/database-updater/) and cannot run in a
// Deno isolate. These assertions keep production from claiming a start, an
// execution or a config change that never happened.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const EDGE = strip(read('supabase/functions/database-updater/index.ts'));
const MGMT = strip(read('client/src/pages/DatabaseManagement.tsx'));
const PAGE = strip(read('client/src/pages/admin/DatabaseUpdaterPage.tsx'));

// Every path a client tree calls, plus the three GETs and PUT nobody calls.
const CLIENT_CONTROLS = ['start', 'stop', 'execute', 'enable', 'disable', 'dry-run'];

describe('database-updater edge function does not fabricate control outcomes', () => {
  it('claims success on exactly one branch: the status read, which says unavailable', () => {
    const successes = EDGE.match(/success:\s*true/g) ?? [];
    expect(successes).toHaveLength(1);
    const statusAt = EDGE.indexOf("endpoint === 'status'");
    const nextIf = EDGE.indexOf('if (', statusAt + 10);
    const statusBranch = EDGE.slice(statusAt, nextIf);
    expect(statusBranch).toMatch(/success:\s*true/);
    expect(statusBranch).toMatch(/available:\s*false/);
    expect(statusBranch).toMatch(/code:\s*UPDATER_UNAVAILABLE_CODE/);
    // A stopped system is a claim the page renders with a Start button.
    expect(statusBranch).not.toMatch(/isRunning/);
  });

  it('answers 501 with the shared code for every control a page calls', () => {
    const post = EDGE.match(/POST:\s*\[([^\]]*)\]/);
    expect(post).not.toBeNull();
    const listed = [...post![1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    for (const c of CLIENT_CONTROLS) expect(listed).toContain(c);
    expect(EDGE).toMatch(/PUT:\s*\['config'\]/);
    const branchAt = EDGE.indexOf('CONTROLS[req.method]?.includes(endpoint)');
    expect(branchAt).toBeGreaterThan(0);
    const branch = EDGE.slice(branchAt, EDGE.indexOf("'Endpoint not found'", branchAt));
    expect(branch).toMatch(/code:\s*UPDATER_UNAVAILABLE_CODE/);
    expect(branch).toMatch(/\n\s*501,/);
  });

  it('keeps the root-admin gate in front of both', () => {
    const gate = EDGE.indexOf("'Root admin access required'");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(EDGE.indexOf("endpoint === 'status'"));
  });

  it('every client call is one of the refused controls', () => {
    const called = new Set<string>();
    for (const src of [MGMT, PAGE]) {
      for (const m of src.matchAll(/\/api\/database-updater\/([a-z-]+)/g)) called.add(m[1]);
    }
    called.delete('status');
    expect(called.size).toBeGreaterThan(0);
    for (const c of called) expect(CLIENT_CONTROLS).toContain(c);
  });
});

describe('both admin pages say so and disable Start', () => {
  it('DatabaseManagement', () => {
    expect(MGMT).toMatch(/const updaterUnavailable = updaterStatus\?\.available === false;/);
    expect(MGMT).toMatch(/\{updaterUnavailable && \(/);
    expect(MGMT).toMatch(/disabled=\{\s*updaterUnavailable \|\|\s*startUpdaterMutation\.isPending/);
    expect(MGMT).toMatch(/disabled=\{updaterUnavailable \|\| stopUpdaterMutation\.isPending\}/);
  });

  it('DatabaseUpdaterPage', () => {
    expect(PAGE).toMatch(/const unavailable = status\?\.available === false;/);
    expect(PAGE).toMatch(/\{unavailable && \(/);
    expect(PAGE).toMatch(
      /disabled=\{unavailable \|\| status\?\.isRunning \|\| startMutation\.isPending\}/,
    );
  });
});
