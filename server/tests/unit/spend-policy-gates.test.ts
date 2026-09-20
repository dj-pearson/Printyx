/**
 * SEC-EDGE-001: the spend limit is a manager decision, spending inside it is not.
 *
 * Two more of the unexamined functions, picked the way this story settled on -
 * derive which ones WRITE and read the top of that list, rather than reasoning
 * from a name.
 *
 * `toner-replenish` and `renewal-autoquote` share a shape worth naming: each
 * has a handful of branches that set POLICY for the whole tenant, and a much
 * larger surface that is a coordinator or rep doing their job inside that
 * policy. A file-level gate would take the second with the first and break the
 * page; leaving both open lets anyone raise the ceiling the system spends
 * without asking.
 *
 * Asserted by reading source, because nothing typechecks the edge tree, and
 * each assertion is bound to its own branch - a fixed window runs past a
 * branch into the next one, which is how an ungated `bulk-assign` survived a
 * mutant earlier in this story.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');

const toner = read('supabase/functions/toner-replenish/index.ts');
const renewal = read('supabase/functions/renewal-autoquote/index.ts');

/** The source between one marker and the next, so a check cannot drift. */
function between(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  return src.slice(start, end > start ? end : start + 900);
}

describe('toner-replenish gates the ceiling, not the shipping', () => {
  it('the tenant settings PUT requires a manager', () => {
    const branch = between(toner, "if (method === 'PUT') {", "if (resource === 'machines'");
    expect(branch).toContain('requireManager()');
    expect(branch).toContain('denyManager(err)');
  });

  it('the per-machine override does too, because it is the same ceiling', () => {
    const branch = between(
      toner,
      "if (method === 'PUT' && third === 'settings')",
      'return createCorsResponse({ message: ',
    );
    expect(branch).toContain('requireManager()');
  });

  it('shipping, cancelling and running the pipeline stay open', () => {
    // A service coordinator watching toner levels is exactly who does these,
    // and the ceiling they operate under is set by the gated branch above.
    const ship = between(toner, "third === 'ship')", "third === 'cancel')");
    expect(ship).not.toContain('requireManager');
    const run = between(
      toner,
      "resource === 'run'",
      "if (method === 'GET' && resource === 'levels')",
    );
    expect(run).not.toContain('requireManager');
  });

  it('denyManager rethrows anything that is not a role refusal', () => {
    // Or a database outage answers "your role is too low".
    expect(toner).toContain('err instanceof RbacError');
    const deny = between(toner, 'const denyManager', 'const url = new URL');
    expect(deny).toContain('throw err;');
  });
});

describe('renewal-autoquote gates policy, not a rep own renewals', () => {
  it('the settings PUT requires a manager', () => {
    const branch = between(renewal, "if (req.method === 'PUT') {", 'renewal_autoquote_settings');
    expect(branch).toContain('requireManager()');
  });

  it('adding a suppression requires a manager', () => {
    // A suppressed customer never receives a renewal quote again, and nothing
    // on the drafts board shows the absence.
    const branch = between(
      renewal,
      "if (!second && req.method === 'POST') {",
      'customerId is required',
    );
    expect(branch).toContain('requireManager()');
  });

  it('and so does lifting one', () => {
    const branch = between(renewal, "if (second && req.method === 'DELETE') {", 'UNSUPPRESS');
    expect(branch).toContain('requireManager()');
  });

  it('mark-sent, dismiss and outcome stay open', () => {
    const branch = between(renewal, "second === 'mark-sent'", "second === 'outcome'");
    expect(branch).not.toContain('requireManager');
  });
});

describe('the triage records what was read, not just a verdict', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const entries: Array<Record<string, string>> = triage.triage;

  it('the two gated functions have left the open-to-all list', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of ['toner-replenish', 'renewal-autoquote']) {
      expect(baseline.openToAllRoles).not.toContain(fn);
      expect(entries.some((e) => e.fn === fn)).toBe(false);
    }
  });

  it('user is examined, with the paths that were read named', () => {
    const entry = entries.find((e) => e.fn === 'user');
    expect(entry?.verdict).toBe('open-by-design');
    // A verdict from reading SOME paths looks identical to one that read them
    // all, which is why this field exists.
    expect(entry?.pathsRead).toBeTruthy();
    expect(entry?.reason).toContain('user_id: user.id');
  });

  it('every entry still carries a reason', () => {
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.filter((e) => !e.reason || !e.verdict)).toEqual([]);
  });
});
