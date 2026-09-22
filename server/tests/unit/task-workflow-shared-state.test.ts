/**
 * TWF / EDGE-024 - one state machine, two hosts.
 *
 * shared/task-workflow-state.ts is the stage math: which stage is current,
 * whether a completion cascades into an advance, what the step statuses look
 * like after an advance or a regress. Both headers that cite it used to claim
 * server/tests/unit/task-workflow-state.test.ts "pins the transitions", and it
 * did not: that suite exercises the shared module and nothing compared it to
 * what either host runs. The edge function carried a 40-line REPLICA under a
 * note saying Deno could not import from shared/ (it can - a dozen edge
 * functions do), and the Express engine imported three of the ten exports and
 * hand-inlined the rest. So three implementations existed and the test pinned
 * the one neither host executed.
 *
 * This suite asserts the arrangement that makes the other suite meaningful:
 * both hosts IMPORT the module, neither redeclares a transition, and the
 * completion cascade on both sides is completionOutcome's answer rather than a
 * local re-derivation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const SHARED = 'shared/task-workflow-state.ts';
const ENGINE = 'server/services/task-workflow/engine.ts';
const EDGE = 'supabase/functions/task-workflows/index.ts';

const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

/**
 * Line comments first, then block comments - the other order reads a line
 * comment ending in `/*` as a block opener and blanks the rest of the file.
 * The lookbehind keeps `https://` intact.
 */
function stripComments(src: string): string {
  return src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Every `export const|function|interface NAME` in the shared module. */
function sharedExports(src: string): string[] {
  return [...src.matchAll(/^export (?:const|function|interface) ([A-Za-z0-9_]+)/gm)].map(
    (m) => m[1],
  );
}

/**
 * Exports with no call site in either host, NAMED rather than counted, because
 * a count says how many are unused and a list says which - and each of these
 * is a building block the exported decisions use internally and the sibling
 * suite tests directly. An entry leaving this list must gain a caller, and a
 * new unused export must be justified here rather than quietly tolerated.
 */
const INTERNAL_ONLY: Record<string, string> = {
  StateStep: 'the row shape both hosts map onto; a type, not a decision',
  TERMINAL_STEP_STATUSES: 'the terminal set isTerminal reads',
  isTerminal: 'used by computeCurrentStageIndex/isStageComplete/stepsToActivate',
  stepsInStage: 'used by isStageComplete and stepsToActivate',
  isStageComplete: 'used by completionOutcome, which is what the hosts call',
};

/** The decisions a host is allowed to make, and must not re-implement. */
const TRANSITIONS = [
  'computeCurrentStageIndex',
  'completionOutcome',
  'applyStepCompletion',
  'applyStageSkip',
  'applyRegress',
  'stepsToActivate',
];

describe('task-workflow shared state machine', () => {
  const shared = read(SHARED);
  const engineRaw = read(ENGINE);
  const edgeRaw = read(EDGE);
  const engine = stripComments(engineRaw);
  const edge = stripComments(edgeRaw);
  const exports = sharedExports(shared);

  it('the shared module is dependency-free, so Deno can import it as-is', () => {
    // A single import of anything Node-only is what would force a replica back.
    expect(shared).not.toMatch(/^import /m);
    expect(shared).not.toMatch(/\brequire\(/);
    expect(shared).not.toMatch(/\bprocess\.env\b/);
    expect(shared).not.toMatch(/\bDeno\.env\b/);
  });

  it('resolves enough exports to be checking something', () => {
    // Floor: a walk that stops matching must fail rather than pass in silence.
    expect(exports.length).toBeGreaterThanOrEqual(10);
    for (const t of TRANSITIONS) expect(exports).toContain(t);
  });

  it('the Express engine imports the transitions from the shared module', () => {
    const block = /import \{([\s\S]*?)\} from '@shared\/task-workflow-state';/.exec(engine);
    expect(block, 'engine must import @shared/task-workflow-state').not.toBeNull();
    const imported = block![1];
    for (const t of TRANSITIONS) {
      expect(imported, `engine must import ${t}`).toMatch(
        new RegExp(`(^|[^A-Za-z0-9_])${t}([^A-Za-z0-9_]|$)`),
      );
    }
  });

  it('the edge function imports the transitions, and the specifier resolves', () => {
    const block = /import \{([\s\S]*?)\} from '(\.\.[^']*task-workflow-state\.ts)';/.exec(edge);
    expect(block, 'edge fn must import shared/task-workflow-state.ts').not.toBeNull();
    // Assert the PATH RESOLVES rather than pinning its depth: a handler one
    // directory deeper needs four `..`, and a wrong depth is a silent prod 404.
    const target = resolve(dirname(resolve(ROOT, EDGE)), block![2]);
    expect(existsSync(target), `${block![2]} must resolve`).toBe(true);
    expect(target).toBe(resolve(ROOT, SHARED));
    for (const t of TRANSITIONS) {
      expect(block![1], `edge fn must import ${t}`).toMatch(
        new RegExp(`(^|[^A-Za-z0-9_])${t}([^A-Za-z0-9_]|$)`),
      );
    }
  });

  it('neither host redeclares a transition locally', () => {
    for (const t of TRANSITIONS) {
      const decl = new RegExp(
        `(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(?:function\\s+${t}\\b|(?:const|let)\\s+${t}\\s*=)`,
      );
      expect(engine.match(decl), `engine must not declare ${t}`).toBeNull();
      expect(edge.match(decl), `edge fn must not declare ${t}`).toBeNull();
    }
    // The replica's own internals are gone too - keeping one is how the next
    // transition gets re-inlined beside it.
    for (const name of ['isTerminal', 'stepsInStage', 'isStageComplete']) {
      const decl = new RegExp(`(?:^|\\n)\\s*(?:function\\s+${name}\\b|const\\s+${name}\\s*=)`);
      expect(edge.match(decl), `edge fn must not declare ${name}`).toBeNull();
    }
    expect(edge).not.toMatch(/const TERMINAL_STEP_STATUSES\s*=/);
  });

  it('both hosts decide the completion cascade with completionOutcome', () => {
    // Bind to the CALL, not to the identifier: an import that nothing invokes
    // reads as wired and decides nothing.
    for (const [label, src] of [
      ['engine', engine],
      ['edge', edge],
    ] as const) {
      expect(src, `${label} must call completionOutcome`).toMatch(/completionOutcome\s*\(/);
      expect(src, `${label} must branch on stageAdvanced`).toMatch(
        /\.stageAdvanced|outcome\.stageAdvanced/,
      );
      expect(src, `${label} must branch on workflowDone`).toMatch(/workflowDone/);
    }
  });

  it('every shared export is either called by a host or named as internal', () => {
    const unused = exports.filter(
      (name) =>
        !new RegExp(`(^|[^A-Za-z0-9_])${name}\\s*[(<]`).test(engine) &&
        !new RegExp(`(^|[^A-Za-z0-9_])${name}\\s*[(<]`).test(edge),
    );
    for (const name of unused) {
      expect(
        INTERNAL_ONLY[name],
        `${name} has no caller in either host and no reason recorded in INTERNAL_ONLY`,
      ).toBeTruthy();
    }
    // And the list cannot rot: an entry that gained a caller must leave it.
    for (const name of Object.keys(INTERNAL_ONLY)) {
      expect(exports, `${name} is listed as an export and is not one`).toContain(name);
      expect(unused, `${name} now has a caller - drop it from INTERNAL_ONLY`).toContain(name);
    }
  });

  it('the engine writes a stage in one statement, not one per step', () => {
    // Three loops of `await db.update(...).where(eq(id))` became three batched
    // updates. A per-step loop is an N+1 on a path a 20-step stage walks.
    expect(engine).toMatch(/import \{[^}]*\binArray\b[^}]*\} from 'drizzle-orm'/);
    const perStepLoop =
      /for \(const \w+ of [^)]*\) \{\s*await db\s*\n?\s*\.update\(taskWorkflowSteps\)/;
    expect(engine.match(perStepLoop)).toBeNull();
  });

  it('the stale "Deno cannot import from shared/" claim is gone from all three', () => {
    for (const [label, src] of [
      ['shared', shared],
      ['engine', engineRaw],
      ['edge', edgeRaw],
    ] as const) {
      expect(src, `${label} still claims Deno cannot import from shared/`).not.toMatch(
        /Deno cannot import from/,
      );
    }
  });
});
