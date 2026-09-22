/**
 * Handoff task templates: the write path (SEC-EDGE-001 round 91).
 *
 * This function carried the last `unexamined` verdict in docs/edge-rbac-triage.json.
 * Settling it found three defects in branches no client tree calls, which is
 * COP-B03's setup - harmless until somebody wires an edit form, at which point
 * every one of them is a 500 or a silently wrong answer.
 *
 * The plan builder is exercised as a FUNCTION rather than read as text. A source
 * assertion proves a string is present; only calling it proves the value comes
 * out, and rounds 89 and 90 each lost a mutant to that difference. The gate and
 * the branch structure are necessarily source assertions - nothing typechecks or
 * executes the edge tree here - so those are bound to the branch they describe
 * and read from a comment-stripped copy.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTemplateUpdate,
  HANDOFF_TYPES,
  DEFAULT_HANDOFF_TASKS,
} from '../../../supabase/functions/_shared/sales-handoff';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');

/** Absence assertions must not match the comment explaining the fix. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const HANDLER = 'supabase/functions/handoff-task-templates/index.ts';
const SRC = read(HANDLER);
const CODE = stripComments(SRC);
const CREATE = stripComments(read('supabase/functions/_shared/handoff-create.ts'));

/** The body of one `if (req.method === 'X' ...)` branch, stopping at the next. */
function branch(method: string, withId: boolean): string {
  const head = withId
    ? `if (req.method === '${method}' && templateId) {`
    : `if (req.method === '${method}' && !templateId) {`;
  const start = CODE.indexOf(head);
  expect(start, `branch not found: ${head}`).toBeGreaterThan(-1);
  const rest = CODE.slice(start + head.length);
  const next = rest.indexOf('if (req.method');
  return next === -1 ? rest : rest.slice(0, next);
}

describe('a partial PUT writes only the fields it was sent', () => {
  it('sends no handoff_type at all when the caller did not name one', () => {
    // The defect this whole round turned on. normalizeHandoffType(undefined) is
    // null, and JSON.stringify drops an undefined key while keeping a null one,
    // so the old blanket object sent exactly `handoff_type = NULL` into a NOT
    // NULL column - a 23502 reproduced on Postgres 16 and returned as a 500.
    const { update, refused } = buildTemplateUpdate({ templateName: 'Renamed' });
    expect(refused).toEqual([]);
    expect(update).toEqual({ template_name: 'Renamed' });
    expect('handoff_type' in update).toBe(false);
    // And the serialised body a PostgREST update would carry has no null in it.
    expect(JSON.stringify(update)).not.toContain('null');
  });

  it('leaves tasks alone when the caller did not name it', () => {
    const { update } = buildTemplateUpdate({ isActive: false });
    expect(update).toEqual({ is_active: false });
    expect('tasks' in update).toBe(false);
  });

  it('accepts either spelling of every field', () => {
    const camel = buildTemplateUpdate({
      templateName: 'A',
      handoffType: 'renewal',
      isActive: true,
      isDefault: true,
    });
    const snake = buildTemplateUpdate({
      template_name: 'A',
      handoff_type: 'renewal',
      is_active: true,
      is_default: true,
    });
    expect(camel).toEqual(snake);
    expect(camel.update).toEqual({
      template_name: 'A',
      handoff_type: 'renewal',
      is_active: true,
      is_default: true,
    });
  });

  it('can set and clear is_default, which the old map could not express at all', () => {
    expect(buildTemplateUpdate({ isDefault: true }).update).toEqual({ is_default: true });
    expect(buildTemplateUpdate({ isDefault: false }).update).toEqual({ is_default: false });
  });

  it('writes an explicit null description, because that column is nullable', () => {
    const { update, refused } = buildTemplateUpdate({ description: null });
    expect(refused).toEqual([]);
    expect(update).toEqual({ description: null });
  });
});

describe('a NOT NULL column refuses bad input here, not at the database', () => {
  it.each([
    ['an explicit null name', { templateName: null }, 'templateName'],
    ['a blank name', { templateName: '   ' }, 'templateName'],
    ['a non-string name', { templateName: 7 }, 'templateName'],
    ['an unrecognised handoff type', { handoffType: 'onboarding' }, 'handoffType'],
    ['a null handoff type', { handoff_type: null }, 'handoffType'],
    ['tasks that are not a list', { tasks: { a: 1 } }, 'tasks'],
  ])('refuses %s', (_label, body, field) => {
    const { update, refused } = buildTemplateUpdate(body as Record<string, unknown>);
    expect(refused).toContain(field);
    expect(update).toEqual({});
  });

  it('accepts every handoff type the vocabulary declares', () => {
    for (const type of HANDOFF_TYPES) {
      expect(buildTemplateUpdate({ handoffType: type }).update.handoff_type).toBe(type);
    }
  });

  it('an empty body yields an empty plan, which the handler answers 400', () => {
    expect(buildTemplateUpdate({})).toEqual({ update: {}, refused: [] });
    const put = branch('PUT', true);
    expect(put).toMatch(/Object\.keys\(update\)\.length === 0/);
    expect(put).toMatch(/No updatable fields in request body/);
  });
});

describe('the write branches are gated and the read branches are not', () => {
  it.each([
    ['POST', false],
    ['PUT', true],
    ['DELETE', true],
  ])('%s requires a supervisor before it reads a body', (method, withId) => {
    const body = branch(method, withId as boolean);
    expect(body).toContain('requireSupervisor()');
    expect(body).toContain('denySupervisor(err)');
    // The gate runs BEFORE the payload is read; one that runs after is not a gate.
    const gateAt = body.indexOf('requireSupervisor()');
    const jsonAt = body.indexOf('req.json()');
    if (jsonAt !== -1) expect(gateAt).toBeLessThan(jsonAt);
  });

  it('mirrors /handoffs rather than picking a level', () => {
    expect(CODE).toContain('ROLE_LEVEL.SUPERVISOR');
    const nav = read('client/src/lib/navigation-permissions.ts');
    const rule = nav.slice(nav.indexOf("'/handoffs': {"));
    expect(rule.slice(0, 120)).toMatch(/minLevel:\s*3/);
  });

  it('rethrows anything that is not a role refusal', () => {
    // A catch that 403s on any failure turns a database outage into "your role
    // is too low".
    expect(CODE).toMatch(/if \(!\(err instanceof RbacError\)\) throw err;/);
  });

  it.each([
    ['list', false],
    ['single', true],
  ])('leaves the %s read open', (_label, withId) => {
    expect(branch('GET', withId as boolean)).not.toContain('requireSupervisor');
  });
});

describe('one default per tenant and handoff type', () => {
  it('clears the others on both write paths, scoped and excluding the kept row', () => {
    const clear = CODE.slice(
      CODE.indexOf('const clearOtherDefaults'),
      CODE.indexOf('const url = new URL'),
    );
    expect(clear).toContain(".eq('tenant_id', tenantId)");
    expect(clear).toContain(".eq('handoff_type', handoffType)");
    expect(clear).toContain(".eq('is_default', true)");
    expect(clear).toContain(".neq('id', keepId)");
    // A clear that fails in silence turns a schema fault into a wrong default.
    expect(clear).toMatch(/warning:/);
    expect(branch('POST', false)).toContain('clearOtherDefaults(');
    expect(branch('PUT', true)).toContain('clearOtherDefaults(');
  });

  it('the reader is deterministic without depending on the writers', () => {
    const select = CREATE.slice(
      CREATE.indexOf("from('handoff_task_templates')"),
      CREATE.indexOf('const existing'),
    );
    for (const column of ['is_default', 'updated_at', 'id']) {
      expect(select, `no tiebreak on ${column}`).toMatch(new RegExp(`\\.order\\('${column}'`));
    }
  });
});

describe('an empty task list is not a usable template', () => {
  it('falls back to the default tasks without inserting a second row', () => {
    // An empty array is truthy, so the old `if (existing?.tasks)` handed
    // operations a checklist with nothing on it. Bootstrapping instead would
    // insert a row per handoff for as long as the empty one stayed active.
    const body = CREATE.slice(
      CREATE.indexOf('const existing = templates?.[0]'),
      CREATE.indexOf('const row = defaultTemplateRow'),
    );
    expect(body).toMatch(/storedTasks\.length > 0/);
    expect(body).toMatch(/if \(existing\) return DEFAULT_HANDOFF_TASKS\[handoffType\];/);
    expect(body).not.toContain('.insert(');
  });

  it('every handoff type has default tasks to fall back to', () => {
    for (const type of HANDOFF_TYPES) {
      expect(DEFAULT_HANDOFF_TASKS[type].length).toBeGreaterThan(0);
    }
  });
});

describe('the triage entry records the answer', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));

  it('no entry is left unexamined', () => {
    const entries = Object.values(triage.triage) as Array<{ fn: string; verdict: string }>;
    expect(entries.length).toBeGreaterThan(100);
    expect(entries.filter((e) => e.verdict === 'unexamined')).toEqual([]);
  });

  it('counts match the entries they summarise', () => {
    const counts: Record<string, number> = {};
    for (const e of Object.values(triage.triage) as Array<{ verdict: string }>) {
      counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
    }
    expect(triage.counts).toEqual(counts);
  });

  it('files handoff-task-templates as gated with its reason', () => {
    const entry = (
      Object.values(triage.triage) as Array<{ fn: string; verdict: string; reason: string }>
    ).find((e) => e.fn === 'handoff-task-templates');
    expect(entry?.verdict).toBe('gated-branch');
    expect(entry?.reason).toMatch(/23502/);
  });
});
