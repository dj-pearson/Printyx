/**
 * Two writes that decided things for other people, open to everyone
 * (SEC-EDGE-001's unexamined worklist).
 *
 * `docs/edge-rbac-triage.json` carried 53 functions marked `unexamined` -
 * "authenticated, reachable, and nobody has decided whether every tenant member
 * should have it". Reading a batch of them turned up two where the answer was
 * clearly no, and both are the branch-level shape rather than the file-level
 * one, because in each case the READS are what the surface exists for:
 *
 *   - sales-rep-assignments: six reads are a territory map a rep needs. The
 *     three POSTs move an account, its pipeline and whatever commission follows
 *     it from one rep to another. One bulk-assign call could take a colleague's
 *     whole book.
 *   - churn-risk: the console is a rep's view of their own accounts. PUT
 *     /settings is tenant-wide - the weights and thresholds that decide which
 *     customers the WHOLE COMPANY sees as at risk.
 *
 * Read from source: nothing typechecks the edge tree, and an ordering mistake
 * (gating after the body is read, or catching too broadly) is invisible to tsc.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const ASSIGN = strip(read('supabase/functions/sales-rep-assignments/index.ts'));
const CHURN = strip(read('supabase/functions/churn-risk/index.ts'));

describe('reassigning an account requires a role', () => {
  /**
   * EACH BRANCH BOUNDED TO ITSELF. The first version took a fixed 260-character
   * window, and the mutant that ungated `bulk-assign` - the worst of the three,
   * since it moves a whole book in one call - SURVIVED, because the window ran
   * past the end of that branch into `assign-by-area`, which has its own gate.
   * A window that can reach the next case is not a per-case assertion.
   */
  const branchOf = (src: string, header: string): string => {
    const at = src.indexOf(header);
    expect(at, `${header} not found`).toBeGreaterThan(0);
    const rest = src.slice(at + header.length);
    // The next branch starts at the next `if (req.method`; stop there.
    const end = rest.indexOf('if (req.method');
    return rest.slice(0, end === -1 ? rest.length : end);
  };

  it('all three write branches are gated, each checked within its own body', () => {
    for (const endpoint of ['assign', 'bulk-assign', 'assign-by-area']) {
      const branch = branchOf(ASSIGN, `req.method === 'POST' && endpoint === '${endpoint}'`);
      expect(branch, `${endpoint} is ungated`).toContain('requireAssigner()');
      // And the gate precedes the handler call, not follows it.
      expect(branch.indexOf('requireAssigner()')).toBeLessThan(branch.indexOf('return await'));
    }
  });

  it('gates before the handler reads the body', () => {
    // A check that runs after the write is not a check (the deal-desk
    // self-approval lesson). Here: before `return await assignOne(...)`.
    const at = ASSIGN.indexOf("endpoint === 'assign')");
    const branch = ASSIGN.slice(at, at + 300);
    expect(branch.indexOf('requireAssigner()')).toBeLessThan(branch.indexOf('await assignOne'));
  });

  it('mirrors the page level, as a LEVEL check not a permission code', () => {
    // /sales-rep-assignments is minLevel 3. Per SEC-EDGE-002 the codes the
    // Express gates name are not the codes any seeder creates, so a copied
    // permission gate denies everyone below platform admin.
    expect(ASSIGN).toContain('ROLE_LEVEL.SUPERVISOR');
    expect(ASSIGN).not.toContain('sales.territory.manage_assignments');
  });

  it('the reads stay open, because a territory map is what a rep needs', () => {
    for (const endpoint of ['reps', 'accounts', 'unassigned', 'zip-summary', 'history']) {
      const branch = branchOf(ASSIGN, `req.method === 'GET' && endpoint === '${endpoint}'`);
      expect(branch, `${endpoint} was gated too`).not.toContain('requireAssigner()');
    }
  });

  it('a non-role failure is rethrown, not answered 403', () => {
    // A catch that 403s on any failure turns a database outage into "your role
    // is too low".
    const fn = ASSIGN.slice(ASSIGN.indexOf('const denyAssigner'));
    expect(fn.slice(0, 600)).toContain('err instanceof RbacError');
    expect(fn.slice(0, 600)).toContain('throw err;');
  });
});

describe('redefining "at risk" for the company requires a role', () => {
  it('the settings write is gated at manager', () => {
    const at = CHURN.indexOf("method === 'PUT' && first === 'settings'");
    expect(at).toBeGreaterThan(0);
    const branch = CHURN.slice(at, at + 900);
    expect(branch).toContain('ROLE_LEVEL.MANAGER');
    // Before the body, so a refusal costs no parse and no partial work.
    expect(branch.indexOf('requireRoleLevel')).toBeLessThan(branch.indexOf('await safeJson'));
  });

  it('reading the settings and the scores stays open', () => {
    const at = CHURN.indexOf("method === 'GET' && first === 'settings'");
    expect(at).toBeGreaterThan(0);
    expect(CHURN.slice(at, at + 220)).not.toContain('requireRoleLevel');
  });

  it('a non-role failure is rethrown here too', () => {
    const at = CHURN.indexOf("method === 'PUT' && first === 'settings'");
    const branch = CHURN.slice(at, at + 1200);
    expect(branch).toContain('err instanceof RbacError');
    expect(branch).toContain('throw err;');
  });
});

describe('the triage records a verdict for everything examined', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
  const byFn = new Map(triage.triage.map((e: { fn: string }) => [e.fn, e]));

  it('no function examined this round is still marked unexamined', () => {
    for (const fn of [
      'users',
      'sales-forecasts',
      'quote-line-items',
      'pipeline-forecast',
      'sales-rep-assignments',
      'churn-risk',
      'contract-tiered-rates',
    ]) {
      const entry = byFn.get(fn) as { verdict: string } | undefined;
      expect(entry, `${fn} has no triage entry`).toBeTruthy();
      expect(entry!.verdict, `${fn} still unexamined`).not.toBe('unexamined');
    }
  });

  it('every verdict carries a reason, since a category without one is the same flat list', () => {
    const thin = triage.triage.filter(
      (e: { reason?: string }) => !e.reason || e.reason.length < 40,
    );
    expect(thin).toEqual([]);
  });

  it('needs-gate stays a worklist and says why it was not gated', () => {
    // contract-tiered-rates is deliberately NOT gated: its page is minLevel 2,
    // so a mirrored gate would constrain nobody while a higher one would lock
    // out the billing staff it exists for. Recorded rather than papered over.
    const entry = byFn.get('contract-tiered-rates') as { verdict: string; reason: string };
    expect(entry.verdict).toBe('needs-gate');
    expect(entry.reason).toContain('NOT GATED');
  });

  it('the unexamined count went down and is still stated honestly', () => {
    expect(triage.counts.unexamined).toBeLessThan(53);
    expect(triage.counts.unexamined).toBeGreaterThan(0);
  });
});
