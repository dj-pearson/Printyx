/**
 * No server handler invents a measurement any more (AUDIT-021).
 *
 * A fabricated number that changes on every request is worse than a fixed one:
 * a literal eventually reads as a placeholder, while a random one behaves
 * exactly like real telemetry, so refreshing appears to confirm it. That is why
 * check:no-random-metrics exists and why its baseline is now empty rather than
 * shrinking.
 *
 * The two files this closed were not edge cases. Team capacity invented every
 * member's allocation, task count and overdue count, then read its own invented
 * utilisation back out and recommended "redistribute tasks from <user> to
 * prevent burnout" - a claim about a named colleague. Meeting scheduling
 * invented a fatigue risk and a flexibility score and raised CONFLICTS from
 * them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Line comments first: a prose path like `/api/*` otherwise opens a block
// comment that runs to the next `*/` and swallows the code being asserted on.
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const team = read('server/services/team-collaboration-service.ts');
const meetings = read('server/services/meeting-scheduling-service.ts');

describe('the ratchet is a gate, not a backlog', () => {
  it('has an empty baseline', () => {
    const baseline = JSON.parse(read('docs/random-metrics-baseline.json'));
    expect(baseline.total).toBe(0);
    expect(baseline.offenders).toEqual({});
  });
});

describe('team capacity is counted', () => {
  it('takes no capacity number from Math.random()', () => {
    const code = stripComments(team);
    for (const prop of [
      'aiPredictedWorkload',
      'aiEfficiencyScore',
      'projectsCount',
      'tasksCount',
      'overdueTasksCount',
      'allocatedHours',
    ]) {
      const at = code.indexOf(`${prop}:`);
      expect(at, prop).toBeGreaterThan(-1);
      expect(code.slice(at, at + 120), prop).not.toMatch(/Math\.random/);
    }
  });

  it('derives the counts from the tasks table', () => {
    expect(team).toMatch(/from\(tasksTable\)/);
    expect(team).toMatch(/inArray\(tasksTable\.status, \['todo', 'in_progress', 'review'\]\)/);
    expect(team).toMatch(/estimatedHours \?\? 0/);
  });

  it('reads real team membership, tenant-scoped', () => {
    // getTeamMembers returned 'user-1' and 'user-2', so every per-member number
    // was about someone who does not exist.
    // Scoped to getTeamMembers: getTeamProjects in the same file is still a
    // mock and still names 'user-1'. That is a separate finding, recorded on
    // the story rather than quietly cleared by a whole-file assertion here.
    const code = stripComments(team);
    const from = code.indexOf('private async getTeamMembers');
    const to = code.indexOf('private async getTeamProjects');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const members = code.slice(from, to);
    expect(members).not.toMatch(/'user-1'/);
    expect(members).not.toMatch(/'member-1'/);
    expect(team).toMatch(/eq\(users\.teamId, teamId\)/);
    expect(team).toMatch(/eq\(users\.tenantId, tenantId\)/);
  });

  it('says nothing rather than 0 when there is no team', () => {
    // 0% utilisation reads as an idle team, which is a different claim from
    // "nobody is on this team" and from "the read failed".
    expect(team).toMatch(/totalCapacity > 0 \? \(totalAllocated \/ totalCapacity\) \* 100 : null/);
    expect(team).toMatch(/averageUtilization: null/);
  });

  it('names what it cannot measure', () => {
    expect(team).toMatch(/UNBACKED_CAPACITY_FIELDS/);
    expect(team).toMatch(/unbacked: UNBACKED_CAPACITY_FIELDS/);
  });
});

describe('meeting availability says nothing rather than something invented', () => {
  it('scores neither fatigue nor flexibility', () => {
    const code = stripComments(meetings);
    expect(code).toMatch(/meetingFatigueRisk: null/);
    expect(code).toMatch(/flexibility: null/);
    expect(code).not.toMatch(/Math\.random/);
  });

  it('raises no conflict against a person from an unmeasured score', () => {
    const code = stripComments(meetings);
    expect(code).not.toMatch(/High meeting fatigue risk/);
    expect(code).not.toMatch(/Limited scheduling flexibility/);
  });

  it('does not invent a participant conflict', () => {
    // "Random conflict for demo": a 30% chance of telling a user that somebody
    // has a clash. check:no-random-metrics excludes jitter inside an `if`, so
    // this survived the sweep that emptied its baseline.
    const code = stripComments(meetings);
    expect(code).not.toMatch(/participant_conflict/);
    expect(code).not.toMatch(/potential scheduling conflict/);
  });

  it('offers no invented free slot', () => {
    // A confident window gets a real invitation sent to a time somebody is busy.
    const code = stripComments(meetings);
    expect(code).not.toMatch(/9 AM tomorrow|Lunch break/);
    expect(code).not.toMatch(/bestProductivityHours: \['9 AM'/);
    expect(meetings).toMatch(/UNBACKED_AVAILABILITY_FIELDS/);
  });
});
