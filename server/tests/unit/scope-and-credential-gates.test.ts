/**
 * A gate on the SCOPE, a gate on the credentials, and one deliberately absent
 * (SEC-EDGE-001's unexamined worklist).
 *
 * Three more of the write-heaviest unexamined functions, read rather than
 * reasoned about. Two got gates and the third did not, which is the part worth
 * keeping:
 *
 *   - outreach: PUT /business-context takes scope: 'tenant' | 'user'. The user
 *     row is a rep's own override; the TENANT row is the company-wide default
 *     every generated prospect email falls back to. Gating the branch would
 *     have taken the personal override with it, so the gate is on the scope.
 *   - signatures: the four integration-credential writes are the DocuSign /
 *     Adobe / HelloSign credentials this tenant signs contracts with.
 *   - manufacturer-orders: NOT gated. Its credentials are already redacted on
 *     every read, and its only caller sits on a page with no minLevel, so a
 *     mirrored gate constrains nobody while a higher one breaks the dialog.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const CONTEXT = strip(read('supabase/functions/outreach/handlers/business-context.ts'));
const SPECIALIZATIONS = strip(read('supabase/functions/outreach/handlers/specializations.ts'));
const CREDS = strip(read('supabase/functions/signatures/handlers/credentials.ts'));
const MFG = strip(read('supabase/functions/manufacturer-orders/handlers/connections.ts'));

describe("the company-wide outreach voice needs a role; a rep's own does not", () => {
  it('the gate keys off the scope, not the branch', () => {
    expect(CONTEXT).toContain("parsed.scope !== 'user'");
    expect(CONTEXT).toContain('ROLE_LEVEL.MANAGER');
  });

  it('it runs before the row is written', () => {
    // A check that runs after the upsert is not a check (the deal-desk
    // self-approval lesson). Anchored on the write calls themselves rather
    // than on a formatted multi-line chain, which prettier can rewrap.
    const fn = CONTEXT.slice(CONTEXT.indexOf('export async function upsert'));
    const gateAt = fn.indexOf('requireRoleLevel');
    expect(gateAt).toBeGreaterThan(0);
    for (const write of ['.update(', '.insert(']) {
      const writeAt = fn.indexOf(write);
      expect(writeAt, `no ${write} in upsert`).toBeGreaterThan(0);
      expect(gateAt, `gate runs after ${write}`).toBeLessThan(writeAt);
    }
  });

  it('a user-scoped write stays open', () => {
    // The whole reason the gate is on the scope: reps use the personal
    // override, and gating the branch would have removed it.
    const fn = CONTEXT.slice(CONTEXT.indexOf('export async function upsert'));
    const guard = fn.slice(fn.indexOf("parsed.scope !== 'user'"));
    expect(guard.slice(0, 80)).toContain('{');
  });

  it('specializations is per-user already and was left alone', () => {
    // Checked rather than assumed - it looked like the same shape from the
    // router line. replaceMine filters on the caller.
    expect(SPECIALIZATIONS).toContain("eq('user_id', ctx.userId)");
    expect(SPECIALIZATIONS).not.toContain('requireRoleLevel');
  });

  it('a non-role failure is rethrown', () => {
    expect(CONTEXT).toContain('err instanceof RbacError');
    expect(CONTEXT).toContain('throw err;');
  });
});

describe('signature-provider credentials need a role', () => {
  const WRITES = [
    "if (method === 'POST' && id && sub === 'test') {",
    "if (method === 'POST' && !id) {",
    "if ((method === 'PATCH' || method === 'PUT') && id && !sub) {",
    "if (method === 'DELETE' && id && !sub) {",
  ];

  it('all four writes are gated, each within its own body', () => {
    for (const header of WRITES) {
      const at = CREDS.indexOf(header);
      expect(at, `branch missing: ${header}`).toBeGreaterThan(0);
      const rest = CREDS.slice(at + header.length);
      const next = /\n\s*if \((?:method|\(method)/.exec(rest);
      const branch = next ? rest.slice(0, next.index) : rest;
      expect(branch, `ungated: ${header}`).toContain('requireCredentialAdmin()');
    }
  });

  it('mirrors the page and is a level check', () => {
    expect(CREDS).toContain('ROLE_LEVEL.SUPERVISOR');
    const nav = read('client/src/lib/navigation-permissions.ts');
    const at = nav.indexOf("'/esignature-integration': {");
    expect(nav.slice(at, at + 200)).toContain('minLevel: 3');
  });

  it('reads stay open because they are redacted at source', () => {
    expect(CREDS).toContain('redactCredentials');
    const at = CREDS.indexOf("if (method === 'GET'");
    if (at > 0) {
      const rest = CREDS.slice(at + 20);
      const next = /\n\s*if \((?:method|\(method)/.exec(rest);
      expect(next ? rest.slice(0, next.index) : rest).not.toContain('requireCredentialAdmin()');
    }
  });
});

describe('manufacturer-orders is left open on purpose, and the reason is recorded', () => {
  it('its connection reads redact the credentials', () => {
    // This is what makes NOT gating defensible rather than an omission: the
    // table holds api_key, api_secret, client_secret, access_token and
    // refresh_token, and no read path returns them.
    expect(MFG).toContain('redactConnections');
    expect(MFG).toContain('redactConnection(');
  });

  it('is filed needs-gate with the tension named, not quietly left unexamined', () => {
    const triage = JSON.parse(read('docs/edge-rbac-triage.json'));
    const entry = triage.triage.find((e: { fn: string }) => e.fn === 'manufacturer-orders');
    expect(entry.verdict).toBe('needs-gate');
    expect(entry.reason).toContain('NOT GATED');
    // The control it wants is a spend limit, not a role.
    expect(entry.reason).toMatch(/spend limit|approval/);
  });
});

describe('the triage keeps shrinking honestly', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json'));

  it('all three examined functions have a verdict', () => {
    for (const fn of ['outreach', 'signatures', 'manufacturer-orders']) {
      const e = triage.triage.find((x: { fn: string }) => x.fn === fn);
      expect(e, `${fn} missing`).toBeTruthy();
      expect(e.verdict).not.toBe('unexamined');
    }
  });

  it('unexamined shrank and the counts match the entries', () => {
    expect(triage.counts.unexamined).toBeLessThan(44);
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
  });
});
