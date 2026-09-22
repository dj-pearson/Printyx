/**
 * Two more surfaces where the writes decided things tenant-wide
 * (SEC-EDGE-001's unexamined worklist).
 *
 * Picked by DERIVING which unexamined functions write at all rather than by
 * reading names - a function with no writes is usually open-by-design, and a
 * verdict reasoned from a name is the same undifferentiated list wearing a
 * category. Both of these are branch-level, and pipeline-config is the clearest
 * case in the tree:
 *
 *   - webhooks: an outbound webhook sends this tenant's data to a URL the
 *     caller chooses, so CREATE is an exfiltration primitive, regenerate-secret
 *     breaks whatever live integration verifies signatures, and test fires a
 *     real delivery.
 *   - pipeline-config: eight template/stage writes change the deals board for
 *     every rep. The two DEAL branches in the same function are what a rep does
 *     all day on that board, so gating the file would have broken drag and drop.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const HOOKS = strip(read('supabase/functions/webhooks/index.ts'));
const BOARD = strip(read('supabase/functions/pipeline-config/index.ts'));

/**
 * Each branch bounded to ITSELF, per last round's surviving mutant: a fixed
 * character window runs past the end of a short branch into the next one, which
 * has its own gate, so an ungated branch passes. Stop at the next branch header.
 */
function branchOf(src: string, header: string, nextHeaderPattern: RegExp): string {
  const at = src.indexOf(header);
  expect(at, `branch not found: ${header}`).toBeGreaterThan(0);
  const rest = src.slice(at + header.length);
  const m = nextHeaderPattern.exec(rest);
  return m ? rest.slice(0, m.index) : rest;
}

const NEXT_HOOK = /\n\s*if \(req\.method ===/;
const NEXT_BOARD =
  /\n\s*if \((?:path|tplGet|tplClone|stagesList|dealMove|dealTransition|dealHistory)\b/;

describe('managing an outbound webhook requires a role', () => {
  const WRITES = [
    "if (req.method === 'POST' && !webhookId) {",
    "if (req.method === 'PUT' && webhookId && !subResource) {",
    "if (req.method === 'POST' && webhookId && subResource === 'test') {",
    "if (req.method === 'POST' && webhookId && subResource === 'regenerate-secret') {",
    "if (req.method === 'DELETE' && webhookId) {",
  ];

  it('every write branch is gated, checked within its own body', () => {
    for (const header of WRITES) {
      const branch = branchOf(HOOKS, header, NEXT_HOOK);
      expect(branch, `ungated: ${header}`).toContain('requireIntegrationAdmin()');
    }
  });

  it('mirrors the lower of the two pages that reach it', () => {
    // /integration-hub is minLevel 3, /system-integrations is 4. Gating at 4
    // would break the page at 3.
    expect(HOOKS).toContain('ROLE_LEVEL.SUPERVISOR');
    const nav = read('client/src/lib/navigation-permissions.ts');
    expect(
      nav.slice(nav.indexOf("'/integration-hub': {"), nav.indexOf("'/integration-hub': {") + 200),
    ).toContain('minLevel: 3');
    // A LEVEL check, not the permission code the page names (SEC-EDGE-002).
    expect(HOOKS).not.toContain('admin.settings.integrations');
  });

  it('reads stay open and never select the secret', () => {
    // A caller may see which hooks exist and where they point without the
    // material to forge a delivery.
    const list = branchOf(HOOKS, "if (req.method === 'GET' && !webhookId) {", NEXT_HOOK);
    expect(list).not.toContain('requireIntegrationAdmin()');
    expect(list).not.toMatch(/select\([^)]*\bsecret\b/);
  });

  it('a non-role failure is rethrown rather than answered 403', () => {
    const fn = HOOKS.slice(HOOKS.indexOf('const denyIntegrationAdmin'));
    expect(fn.slice(0, 600)).toContain('err instanceof RbacError');
    expect(fn.slice(0, 600)).toContain('throw err;');
  });
});

describe('changing the deals board requires a role, moving a deal does not', () => {
  const CONFIG_WRITES = [
    "if (path === '/templates' && method === 'POST') {",
    "if (tplGet && method === 'PUT') {",
    "if (tplGet && method === 'DELETE') {",
    "if (tplClone && method === 'POST') {",
    "if (path === '/stages/reorder' && method === 'PUT') {",
    "if (path === '/stages' && method === 'POST') {",
    "if (stagesList && method === 'PUT') {",
    "if (stagesList && method === 'DELETE') {",
  ];

  it('all eight configuration writes are gated', () => {
    for (const header of CONFIG_WRITES) {
      const branch = branchOf(BOARD, header, NEXT_BOARD);
      expect(branch, `ungated: ${header}`).toContain('requireBoardAdmin()');
    }
  });

  it('the deal branches are NOT gated, because that is a rep working the board', () => {
    // This is the whole reason the gate goes on the branch. A file-level check
    // would have taken drag-and-drop with it.
    for (const header of ['if (dealMove && method === ', 'if (dealTransition && method === ']) {
      const at = BOARD.indexOf(header);
      expect(at, `deal branch missing: ${header}`).toBeGreaterThan(0);
      const branch = branchOf(BOARD, header, NEXT_BOARD);
      expect(branch, `${header} was gated`).not.toContain('requireBoardAdmin()');
    }
  });

  it('reads stay open, because a rep must fetch stages to render the columns', () => {
    for (const header of [
      "if (path === '/templates' && method === 'GET') {",
      "if (stagesList && method === 'GET') {",
      "if (path === '/board' && method === 'GET') {",
    ]) {
      const branch = branchOf(BOARD, header, NEXT_BOARD);
      expect(branch, `${header} was gated`).not.toContain('requireBoardAdmin()');
    }
  });

  it('mirrors the page level, as a level check', () => {
    expect(BOARD).toContain('ROLE_LEVEL.MANAGER');
    const nav = read('client/src/lib/navigation-permissions.ts');
    const at = nav.indexOf("'/pipeline-config': {");
    expect(nav.slice(at, at + 200)).toContain('minLevel: 4');
  });

  it('a non-role failure is rethrown here too', () => {
    const fn = BOARD.slice(BOARD.indexOf('const denyBoardAdmin'));
    expect(fn.slice(0, 700)).toContain('err instanceof RbacError');
    expect(fn.slice(0, 700)).toContain('throw err;');
  });
});

describe('both verdicts are recorded', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const byFn = new Map(triage.triage.map((e: { fn: string }) => [e.fn, e]));

  it('neither is marked unexamined any more', () => {
    for (const fn of ['webhooks', 'pipeline-config']) {
      const entry = byFn.get(fn) as { verdict: string } | undefined;
      expect(entry, `${fn} missing from triage`).toBeTruthy();
      expect(entry!.verdict).toBe('gated-branch');
    }
  });

  it('the pipeline-config reason records why the deal branches stay open', () => {
    const entry = byFn.get('pipeline-config') as { reason: string };
    expect(entry.reason).toContain('NOT gated');
  });

  it('the unexamined worklist shrank and is still honest about what is left', () => {
    // Round 91 emptied the unexamined worklist by settling the last entry
    // (handoff-task-templates). The floor here used to be `> 0`, guarding
    // against clearing the list by GUESSING verdicts rather than reading the
    // handlers. That property does not depend on the list being non-empty, so
    // it is asserted once over every entry in
    // server/tests/unit/edge-rbac-triage-integrity.test.ts.
    expect(triage.counts.unexamined ?? 0).toBe(0);
  });
});
