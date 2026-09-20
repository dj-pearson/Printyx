/**
 * Five write gates, and the one whose absence a comment had already denied
 * (SEC-EDGE-001 round 85).
 *
 * Nothing typechecks the edge tree, so these assertions read source. Each one
 * is bound to the BRANCH it is about rather than to a window of characters
 * after it: a fixed window ran past `bulk-assign` into the next branch two
 * rounds ago and let an ungating mutant survive, and a brace at a guessed
 * indentation did the same to `countFamily` last round.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments blanked: several of these files discuss the gap they closed. */
const stripComments = (src: string) =>
  src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the catalogue family is gated to the last member', () => {
  /**
   * DERIVED FROM WHAT THE FUNCTIONS IMPORT, not from a hand-written list.
   *
   * `software-products` was found because someone compared it to the twin it
   * most resembled; `service-products` survived that sweep because nobody
   * asked what the whole family was. The family is the set of functions
   * sharing the catalogue import runner, and asking the tree for it is what
   * makes a seventh member impossible to miss.
   */
  const FAMILY = readdirSync(join(repo, 'supabase/functions'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      try {
        return read(`supabase/functions/${name}/index.ts`).includes('catalog-import-runner');
      } catch {
        return false;
      }
    });

  it('finds the family rather than matching nothing', () => {
    // A floor: a walk that stops matching must fail, not pass in silence.
    expect(FAMILY.length).toBeGreaterThanOrEqual(7);
    expect(FAMILY).toContain('service-products');
    expect(FAMILY).toContain('software-products');
  });

  it('every member gates its writes on the same permission', () => {
    const ungated: string[] = [];
    for (const fn of FAMILY) {
      const code = stripComments(read(`supabase/functions/${fn}/index.ts`));
      const gated =
        code.includes("'operations.inventory.manage'") &&
        /denyWithoutPermission\(/.test(code) &&
        // The check must actually reject: a call whose answer goes nowhere is
        // the `dashboard-widgets` shape this guard's own history records.
        /if \(denied\) return/.test(code);
      if (!gated) ungated.push(fn);
    }
    expect(ungated).toEqual([]);
  });

  it('service-products applies it before it routes, so no branch can escape', () => {
    const code = stripComments(read('supabase/functions/service-products/index.ts'));
    const gate = code.indexOf('denyWithoutPermission(');
    const route = code.indexOf("normalizePath(url.pathname, 'service-products')");
    expect(gate).toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(route);
  });

  it('enabled-products gates its three writes and leaves the picker read open', () => {
    const code = stripComments(read('supabase/functions/enabled-products/index.ts'));
    expect(code).toMatch(/req\.method !== 'GET' && req\.method !== 'HEAD'/);
    expect(code).toContain("'operations.inventory.manage'");
    // The GET the quote builder uses must not sit behind it.
    const gate = code.indexOf('denyWithoutPermission(');
    const firstGet = code.indexOf("req.method === 'GET' && !productId");
    expect(gate).toBeLessThan(firstGet);
  });
});

describe('carving up the sales organisation needs a manager', () => {
  const SRC = read('supabase/functions/sales-territories/index.ts');
  const CODE = stripComments(SRC);

  /** The branch's own text, ending where the next branch begins. */
  const branch = (opener: string) => {
    const at = CODE.indexOf(opener);
    expect({ opener, found: at > -1 }).toEqual({ opener, found: true });
    const rest = CODE.slice(at + opener.length);
    const next = rest.search(/\n\s{4}if \(req\.method/);
    return rest.slice(0, next === -1 ? rest.length : next);
  };

  it.each([
    ["if (req.method === 'POST' && !territoryId) {", 'create'],
    ["if (req.method === 'PUT' && territoryId) {", 'update'],
    ["if (req.method === 'DELETE' && territoryId) {", 'delete'],
  ])('%s is gated', (opener, _label) => {
    const body = branch(opener);
    expect(body).toContain('requireManager()');
    expect(body).toContain('denyManager(err)');
  });

  it('refuses BEFORE it reads the body or touches the table', () => {
    // A check that runs after the write is not a refusal.
    for (const opener of [
      "if (req.method === 'POST' && !territoryId) {",
      "if (req.method === 'PUT' && territoryId) {",
    ]) {
      const body = branch(opener);
      expect(body.indexOf('requireManager()')).toBeLessThan(body.indexOf('req.json()'));
    }
    const del = branch("if (req.method === 'DELETE' && territoryId) {");
    expect(del.indexOf('requireManager()')).toBeLessThan(del.indexOf('.delete()'));
  });

  it('leaves every read open, because the page is meant to be', () => {
    for (const opener of [
      "if (territoryId === 'coverage' && req.method === 'GET') {",
      "if (req.method === 'GET' && !territoryId) {",
      "if (req.method === 'GET' && territoryId === 'mine') {",
    ]) {
      expect(branch(opener)).not.toContain('requireManager()');
    }
  });

  it('rethrows what is not an RBAC refusal', () => {
    // A catch that 403s on anything turns a database outage into "your role is
    // too low".
    const deny = CODE.slice(CODE.indexOf('const denyManager'));
    expect(deny.slice(0, 400)).toMatch(/if \(!\(err instanceof RbacError\)\) throw err;/);
  });

  it('the nav table no longer asserts a gate it cannot see', () => {
    /**
     * The claim and the missing check were in different files, so neither read
     * as wrong on its own. This asserts the correction stays attached to the
     * claim - a comment that says "gated in the edge function" is exactly the
     * evidence a reader would accept without checking.
     */
    const nav = read('client/src/lib/navigation-permissions.ts');
    const at = nav.indexOf("'/territories': {");
    expect(at).toBeGreaterThan(-1);
    const preamble = nav.slice(Math.max(0, at - 600), at);
    expect(preamble).toMatch(/gated in the edge function/);
    expect(preamble).toMatch(/round 85 actually BUILT that gate|actually BUILT/);
  });
});

describe('two tenant-wide settings a rep could have rewritten', () => {
  it('federation consent needs a manager, and searching does not', () => {
    const code = stripComments(read('supabase/functions/service/index.ts'));
    const at = code.indexOf("method === 'PUT' && second === 'settings'");
    expect(at).toBeGreaterThan(-1);
    // Bound to the branch: it ends at its own `putSettings` call.
    const body = code.slice(at, code.indexOf('putSettings(req', at));
    expect(body).toContain('ROLE_LEVEL.MANAGER');
    expect(body).toContain('INSUFFICIENT_ROLE');

    // The technician's daily work is NOT behind it.
    for (const open of [
      "method === 'POST' && !second",
      "method === 'GET' && second === 'stats'",
      "method === 'GET' && second === 'settings'",
    ]) {
      const i = code.indexOf(open);
      expect({ open, found: i > -1 }).toEqual({ open, found: true });
      expect(code.slice(i, i + 160)).not.toContain('ROLE_LEVEL.MANAGER');
    }
  });

  it('the gross profit floor needs a manager, and reading it does not', () => {
    const code = stripComments(read('supabase/functions/deal-desk-copilot/index.ts'));
    const at = code.indexOf("if (req.method === 'PUT') {");
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at, code.indexOf('gp_floor_pct:', at));
    expect(body).toContain('ROLE_LEVEL.MANAGER');
    // Before the body is read, and before the update.
    expect(body.indexOf('ROLE_LEVEL.MANAGER')).toBeLessThan(body.indexOf('req.json()'));

    const get = code.indexOf("if (req.method === 'GET') {");
    expect(code.slice(get, get + 200)).not.toContain('ROLE_LEVEL.MANAGER');
  });
});

describe('the triage file says what was read, not what the name suggested', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const byFn = new Map<string, any>(triage.triage.map((e: any) => [e.fn, e]));

  it('every function gated this round is recorded as gated-branch', () => {
    for (const fn of [
      'sales-territories',
      'service-products',
      'enabled-products',
      'service',
      'deal-desk-copilot',
    ]) {
      expect({ fn, verdict: byFn.get(fn)?.verdict }).toEqual({ fn, verdict: 'gated-branch' });
    }
  });

  it('every verdict filed this round names the paths it read', () => {
    // A verdict from reading SOME paths is indistinguishable in the file from
    // one that read all of them, unless it says.
    const round85 = triage.triage.filter((e: any) => e.reason?.includes('round 85'));
    // 17 when round 85 closed. handoff-task-templates left the set in round 91,
    // which re-filed it with its own reason - so the corpus floor is 16, not a
    // relaxation. The floor exists at all because a filter that stops matching
    // would otherwise pass over an empty list.
    expect(round85.length).toBeGreaterThanOrEqual(16);
    const silent = round85
      .filter((e: any) => !/Paths read:|NARROWED, NOT SETTLED/.test(e.reason))
      .map((e: any) => e.fn);
    expect(silent).toEqual([]);
  });

  it('settled the honest unexamined entry by reading it, not by guessing', () => {
    // Round 85 filed handoff-task-templates as unexamined rather than guessing
    // open-by-design from its shape, and left the open question in the reason:
    // does SalesHandoffs.tsx let a rep edit templates inline? Round 91 answered
    // it (one GET, no write caller anywhere) and gated the writes. The property
    // that matters is not that some entry stays unexamined - it is that an
    // entry leaves that state by being READ, so the reason must say what was.
    const e = byFn.get('handoff-task-templates');
    expect(e.verdict).toBe('gated-branch');
    expect(e.reason).toMatch(/Paths read:/);
    expect(e.pathsRead).toMatch(/SalesHandoffs\.tsx/);
  });

  it('the counts block matches the entries it summarises', () => {
    const counts: Record<string, number> = {};
    for (const e of triage.triage) counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(counts);
  });
});
