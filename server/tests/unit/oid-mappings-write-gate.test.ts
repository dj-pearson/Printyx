/**
 * SEC-EDGE-001: the shared OID catalogue and the predictive-failure agent.
 *
 * `oid_mappings` decides which SNMP OIDs printer monitoring polls for toner
 * level and meter counts. A wrong or deleted mapping does not raise an error -
 * the machine simply stops reporting - and every write branch was open to any
 * authenticated tenant member while /oid-management sits at minLevel 4.
 *
 * `predictive-failure` is the other half: POST /score creates draft service
 * tickets, /predictions/:id/approve dispatches one to a customer site, and PUT
 * /settings carries the agent kill switch and the confidence threshold. All of
 * it was ungated behind a page at minLevel 3.
 *
 * THE SECOND PROPERTY HERE IS DESIGNED TO EXPIRE. `oid_mappings` has no
 * tenant_id, so a manager gate does not stop one dealer editing another's
 * custom mapping. That is recorded rather than papered over, and the assertion
 * FAILS the day a tenant_id column lands - which is the point (AUDIT-034).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { oidMappings } from '../../../shared/printyx-client-schema';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments blanked: both files discuss the behaviour being asserted, and an
 *  absence check that reads its own explanation reports the fix as the defect. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const OID = strip(read('supabase/functions/oid-mappings/index.ts'));
const PREDICTIVE = strip(read('supabase/functions/predictive-failure/index.ts'));
const NAV = read('client/src/lib/navigation-permissions.ts');

describe('oid-mappings gates the writes and nothing else', () => {
  it('has a corpus to check', () => {
    expect(OID.length).toBeGreaterThan(2000);
    expect(OID).toContain("from('oid_mappings')");
  });

  it('the gate mirrors its page, which is minLevel 4', () => {
    // The nav rule is the evidence for the level, not a number somebody liked.
    const at = NAV.indexOf("'/oid-management'");
    expect(at).toBeGreaterThan(-1);
    expect(NAV.slice(at, at + 160)).toContain('minLevel: 4');
    expect(OID).toContain('ROLE_LEVEL.MANAGER');
  });

  it('refuses every write verb, and refuses before the branch reads a body', () => {
    const gate = OID.indexOf("req.method !== 'GET'");
    expect(gate).toBeGreaterThan(-1);
    // Placed above the first write branch: a check that runs after the write
    // is not a check.
    for (const branch of [
      "req.method === 'POST' && !mappingId",
      "req.method === 'PUT' && mappingId",
      "req.method === 'DELETE' && mappingId",
      "mappingId === 'bulk'",
      "mappingId === 'import'",
    ]) {
      const at = OID.indexOf(branch);
      expect({ branch, found: at > -1 }).toEqual({ branch, found: true });
      expect({ branch, gatedFirst: gate < at }).toEqual({ branch, gatedFirst: true });
    }
  });

  it('exempts the two POSTs that do not write', () => {
    // export is a read the page sends as a POST; test answers 501. Refusing a
    // read on the strength of its verb is not a gate, it is a bug.
    expect(OID).toMatch(/READ_ONLY_POSTS = new Set\(\['export', 'test'\]\)/);
    expect(OID).toContain('!READ_ONLY_POSTS.has(mappingId)');
  });

  it('answers 403 for a role refusal and rethrows anything else', () => {
    // A catch that 403s on any failure turns a database outage into "your role
    // is too low".
    const deny = OID.slice(OID.indexOf('const denyManager'));
    expect(deny.slice(0, 600)).toContain('err instanceof RbacError');
    expect(deny.slice(0, 600)).toContain('INSUFFICIENT_ROLE');
    expect(deny.slice(0, 600)).toContain('throw err;');
  });
});

describe('what the role gate does NOT close, stated so it cannot be forgotten', () => {
  it('oid_mappings still has no tenant_id, so writes cross dealers', () => {
    // DESIGNED TO FAIL when the column lands: at that point the write branches
    // want a tenant filter and this assertion has served its purpose.
    const columns = Object.keys(
      getTableConfig(oidMappings).columns.reduce<Record<string, true>>((acc, c) => {
        acc[c.name] = true;
        return acc;
      }, {}),
    );
    expect(columns).not.toContain('tenant_id');
    // The consequence, asserted structurally rather than by grepping the
    // comment that explains it: no write in this function can filter on a
    // column that does not exist, so none of them does.
    expect(OID).not.toContain("eq('tenant_id'");
  });

  it('is_custom is the only available guard and protects presets, not tenants', () => {
    // Bound to the write chains rather than the file: the string appears in
    // reads too, and a presence check would survive its removal from a write.
    for (const verb of ['.update(updateData)', '.delete()']) {
      const at = OID.indexOf(verb);
      expect({ verb, found: at > -1 }).toEqual({ verb, found: true });
      expect({ verb, guarded: OID.slice(at, at + 260).includes("eq('is_custom', true)") }).toEqual({
        verb,
        guarded: true,
      });
    }
  });

  it('created_by cannot record an author either, so it is written null', () => {
    // integer column against a uuid users.id - AUDIT-032's shape. Coercing it
    // would be a 22P02 or, worse, a leading-digits match on another user.
    const col = getTableConfig(oidMappings).columns.find((c) => c.name === 'created_by');
    expect(col?.getSQLType()).toBe('integer');
    // The insert payloads do not name it at all.
    const inserts = [...OID.matchAll(/\.insert\(/g)];
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    expect(OID).not.toMatch(/created_by:\s*user\.id/);
  });
});

describe('predictive-failure gates scoring, dispatch and the kill switch', () => {
  it('has a corpus to check', () => {
    expect(PREDICTIVE.length).toBeGreaterThan(2000);
    expect(PREDICTIVE).toContain('handlePredictionAction');
  });

  it('the gate mirrors its page, which is minLevel 3', () => {
    const at = NAV.indexOf("'/service/predictions'");
    expect(at).toBeGreaterThan(-1);
    expect(NAV.slice(at, at + 200)).toContain('minLevel: 3');
    expect(PREDICTIVE).toContain('ROLE_LEVEL.SUPERVISOR');
  });

  it('every write route sits below the gate', () => {
    const gate = PREDICTIVE.indexOf("method !== 'GET'");
    expect(gate).toBeGreaterThan(-1);
    for (const branch of [
      "method === 'POST' && first === 'score'",
      "method === 'POST' && first === 'predictions' && second && third",
      "method === 'PUT' && first === 'settings'",
    ]) {
      const at = PREDICTIVE.indexOf(branch);
      expect({ branch, found: at > -1 }).toEqual({ branch, found: true });
      expect({ branch, gatedFirst: gate < at }).toEqual({ branch, gatedFirst: true });
    }
  });

  it('leaves the reads open, because the board has to render', () => {
    for (const branch of [
      "method === 'GET' && first === 'predictions'",
      "method === 'GET' && first === 'settings'",
      "method === 'GET' && first === 'accuracy'",
    ]) {
      expect({ branch, found: PREDICTIVE.includes(branch) }).toEqual({ branch, found: true });
    }
    // The gate itself must not catch GET, or all three break.
    expect(PREDICTIVE).toMatch(/method !== 'GET' && method !== 'HEAD'/);
  });

  it('answers 403 for a role refusal and rethrows anything else', () => {
    const deny = PREDICTIVE.slice(PREDICTIVE.indexOf('const denySupervisor'));
    expect(deny.slice(0, 600)).toContain('err instanceof RbacError');
    expect(deny.slice(0, 600)).toContain('INSUFFICIENT_ROLE');
    expect(deny.slice(0, 600)).toContain('throw err;');
  });

  it('the kill switch still short-circuits scoring, gate or no gate', () => {
    // A role check in front of POST /score must not become the only control -
    // a supervisor scoring a paused agent would dispatch technicians the
    // tenant has deliberately stopped.
    expect(PREDICTIVE).toContain("reason: 'agent_disabled'");
  });
});

describe('both functions are recorded, with the paths that were read', () => {
  type TriageEntry = { fn: string; verdict: string; reason?: string; pathsRead?: string };
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: TriageEntry[];
  };
  const byFn = new Map<string, TriageEntry>(triage.triage.map((e) => [e.fn, e]));

  it('carries a verdict, a reason and the paths behind it', () => {
    for (const fn of ['oid-mappings', 'predictive-failure']) {
      const entry = byFn.get(fn);
      expect({ fn, verdict: entry?.verdict }).toEqual({ fn, verdict: 'gated-branch' });
      expect((entry?.reason ?? '').length).toBeGreaterThan(80);
      // A verdict from reading SOME paths is indistinguishable from one that
      // read them all unless the entry says which.
      expect((entry?.pathsRead ?? '').length).toBeGreaterThan(30);
    }
  });

  it('the four read-only functions examined in the same pass say why they are open', () => {
    for (const fn of ['validate', 'service-analytics', 'performance', 'workflow-automation']) {
      const entry = byFn.get(fn);
      expect({ fn, verdict: entry?.verdict }).toEqual({ fn, verdict: 'open-by-design' });
      expect((entry?.pathsRead ?? '').length).toBeGreaterThan(30);
    }
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    // A floor, so emptying the worklist by reclassification cannot pass quietly.
    // Round 91 emptied the unexamined worklist by settling the last entry
    // (handoff-task-templates). The floor here used to be `> 0`, guarding
    // against clearing the list by GUESSING verdicts rather than reading the
    // handlers. That property does not depend on the list being non-empty, so
    // it is asserted once over every entry in
    // server/tests/unit/edge-rbac-triage-integrity.test.ts.
    expect(triage.counts.unexamined ?? 0).toBe(0);
  });
});
