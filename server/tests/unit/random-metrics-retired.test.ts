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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Line comments first: a prose path like `/api/*` otherwise opens a block
// comment that runs to the next `*/` and swallows the code being asserted on.
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every source file under the given roots, comments stripped.
 *
 * Shared by both absence checks below. Two stories in a row deleted a file a
 * per-file assertion named, and the repair each time was the same: assert the
 * property over the tree instead. One walk rather than two copies.
 */
function walk(roots: string[]): { path: string; code: string }[] {
  const files: { path: string; code: string }[] = [];
  const visit = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(join(repo, dir));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const rel = `${dir}/${entry}`;
      if (statSync(join(repo, rel)).isDirectory()) visit(rel);
      else if (/\.tsx?$/.test(entry)) files.push({ path: rel, code: stripComments(read(rel)) });
    }
  };
  for (const root of roots) visit(root);
  return files;
}

describe('the ratchet is a gate, not a backlog', () => {
  it('has an empty baseline', () => {
    const baseline = JSON.parse(read('docs/random-metrics-baseline.json'));
    expect(baseline.total).toBe(0);
    expect(baseline.offenders).toEqual({});
  });
});

/**
 * AUDIT-035 deleted server/services/team-collaboration-service.ts, so the
 * capacity assertions that read it by name have no subject either.
 *
 * That file's real half - the per-member capacity analysis AUDIT-021 rewrote -
 * is superseded by supabase/functions/teams/handlers/teams.ts, which counts the
 * same open and overdue tasks and is what production runs. The PROPERTY these
 * assertions protected is that a capacity or utilisation figure is counted
 * rather than invented, so it moves to the live implementation, plus a
 * tree-wide absence check for the phrases the mock produced.
 */
describe('team capacity is counted, on the host that serves it', () => {
  const EDGE = read('supabase/functions/teams/handlers/teams.ts');

  it('counts open and overdue tasks rather than generating them', () => {
    const code = stripComments(EDGE);
    expect(code).toMatch(/from\('tasks'\)/);
    expect(code).toMatch(/count: 'exact', head: true/);
    expect(code).not.toMatch(/Math\.random/);
  });

  it('scopes every capacity count to the tenant and the team members', () => {
    // analyzeTeamCapacity took a teamId straight off the URL with no tenant
    // until AUDIT-021 threaded one; the replacement must not reopen that.
    const code = stripComments(EDGE);
    const at = code.indexOf('async function teamCapacity');
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at, code.indexOf('async function', at + 30));
    expect(body).toMatch(/\.eq\('tenant_id', auth\.tenantId\)/);
    expect(body).toMatch(/\.in\('assigned_to', members\)/);
  });

  it('says so rather than reporting zero when a team has no members', () => {
    // 0 open tasks across 0 members reads as an idle team, which is a different
    // claim from "we could not resolve who is on this team".
    expect(stripComments(EDGE)).toMatch(/membership model pending/);
  });

  it("nothing recommends redistributing a named person's workload from an invented number", () => {
    // The mock read its own invented utilisation back out and produced
    // "redistribute tasks from <user> to prevent burnout" - a claim about a
    // real person, regenerated per request.
    const offenders = walk(['server/services', 'supabase/functions']).filter((f) =>
      /prevent burnout|redistribute tasks from/.test(f.code),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('the service that invented all of it is gone', () => {
    expect(existsSync(join(repo, 'server/services/team-collaboration-service.ts'))).toBe(false);
  });
});

describe('invented meeting availability stays gone, everywhere', () => {
  const files = walk(['server/services', 'supabase/functions']);

  it('there are files to check, so this cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(400);
  });

  it('no file scores meeting fatigue or scheduling flexibility', () => {
    const offenders = files
      .filter((f) => /High meeting fatigue risk|Limited scheduling flexibility/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('no file invents a participant conflict', () => {
    const offenders = files
      .filter((f) => /participant_conflict|potential scheduling conflict/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('no file offers an invented free slot', () => {
    const offenders = files
      .filter((f) => /9 AM tomorrow|Lunch break|bestProductivityHours: \['9 AM'/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('the service that carried all four is gone', () => {
    expect(existsSync(join(repo, 'server/services/meeting-scheduling-service.ts'))).toBe(false);
  });
});
