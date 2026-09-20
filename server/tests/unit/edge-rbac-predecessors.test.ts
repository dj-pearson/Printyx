/**
 * The Express-predecessor inventory, and the gap it found (SEC-EDGE-001 AC4).
 *
 * That criterion asked for this inventory BEFORE the gating work, as the source
 * of truth for which permission each endpoint should carry. It was never built,
 * and the gating went ahead on a different basis - mirroring
 * navigation-permissions.ts with a LEVEL check. Building it now says that basis
 * was right, for a reason the story could not have known when it was written:
 * SEC-EDGE-002 established that the Express gates and the seeded `permissions`
 * table use different vocabularies, so copying a code verbatim can be
 * unsatisfiable. /api/crm is the worked example - all four codes its predecessor
 * named are unseeded, so that gate denied everyone below platform admin.
 *
 * The extraction is exercised as a FUNCTION against real inputs. A source
 * assertion proves a regex is present; only calling it proves the right thing
 * comes out, and this file's own history is three rounds of mutants hiding
 * behind constants that were still in the file.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyzeRouter,
  helperValues,
  isGap,
  seededCodes,
} from '../../../scripts/edge-rbac-predecessors.mjs';
import { isGenerated } from '../../../scripts/check-prd-references.mjs';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');
const DOC = read('docs/edge-rbac-express-predecessors.md');

describe('a permission gate is read from code, not from a comment about one', () => {
  const values = helperValues(read('server/middleware/rbac-route-helper.ts'));

  it('resolves a PERMISSIONS reference through its full path', () => {
    // Keying on the leaf name alone makes every module's CREATE collide, which
    // is a defect check:permission-vocab already had to fix once.
    expect(values.get('INVENTORY.ITEM.VIEW')).toBe('operations.inventory.view');
    expect(values.get('SERVICE.TECHNICIAN.MANAGE')).toBe('service.schedule.manage');
    expect(values.get('INVENTORY.ITEM.CREATE')).not.toBe(values.get('PLATFORM.TENANT.CREATE'));
  });

  it('ignores a requirePermission named only in a comment', () => {
    // server/routes-deal-desk-copilot.ts carries exactly this shape - a TODO
    // naming a gate that has never run. Counting it would report a control
    // that does not exist.
    const { codes } = analyzeRouter(
      [
        "// TODO(rbac): requirePermission(['sales.quote.view_margin'])",
        '/* requirePermission([PERMISSIONS.INVENTORY.ITEM.DELETE]) */',
        "router.get('/api/thing', handler);",
      ].join('\n'),
      values,
    );
    expect(codes).toEqual([]);
  });

  it('reads both a PERMISSIONS reference and a bare string literal', () => {
    const { codes, segments } = analyzeRouter(
      [
        "router.post('/api/widgets', requirePermission([PERMISSIONS.SERVICE.TECHNICIAN.MANAGE]), h);",
        "router.get('/api/widgets/:id', requirePermission(['operations.po.view']), h);",
      ].join('\n'),
      values,
    );
    expect(codes).toEqual(['operations.po.view', 'service.schedule.manage']);
    expect(segments).toEqual(['widgets']);
  });

  it('says so rather than guessing when a reference does not resolve', () => {
    const { codes } = analyzeRouter(
      "router.get('/api/x', requirePermission([PERMISSIONS.NOT.A.REAL.PATH]), h);",
      values,
    );
    expect(codes).toEqual(['PERMISSIONS.NOT.A.REAL.PATH (unresolved)']);
  });

  it('a router with no gate contributes nothing', () => {
    expect(analyzeRouter("router.get('/api/open', handler);", values).codes).toEqual([]);
  });
});

describe('the two vocabularies, which is why this is intent and not a list to copy', () => {
  const seeded = seededCodes(read('server/database-updater/seeders/rbac-seeder.ts'));

  it('reads the codes the seeder actually writes', () => {
    expect(seeded.size).toBeGreaterThan(100);
    expect(seeded.has('service.schedule.manage')).toBe(true);
  });

  it('the /api/crm predecessor named four codes no seeded role can hold', () => {
    // Copying that gate onto the edge function would have exported a lockout,
    // not closed a hole. The doc has to say so on the row.
    for (const code of [
      'sales.report.view_own',
      'sales.report.view_team',
      'sales.report.view_company',
      'sales.report.view_location',
    ]) {
      expect(seeded.has(code), `${code} unexpectedly seeded`).toBe(false);
    }
    const row = DOC.split('\n').find((l) => l.startsWith('| `/api/crm`'));
    expect(row).toBeDefined();
    expect(row).toContain('no: sales.report.view_company');
  });
});

describe('the gap rule, against rows the tree no longer contains', () => {
  // Fixing technician-management removed the only live row-scoped example, so a
  // mutant disabling that branch survived until these fixtures existed. A
  // fixture can only distinguish implementations it contains an example of.
  const row = (over: Record<string, unknown> = {}) => ({
    segment: 'x',
    fn: 'x',
    verdict: '-',
    enforces: 'gated (shared-rbac)',
    codes: ['service.schedule.manage'],
    ...over,
  });

  it('a row-scoped function whose predecessor gated a WRITE is a gap', () => {
    // This is exactly what technician-management was: reads narrowed to the
    // caller, five writes with no role check at all.
    expect(isGap(row({ enforces: 'row-scoped' }))).toBe(true);
  });

  it('a row-scoped function whose predecessor gated only READS is not', () => {
    expect(isGap(row({ enforces: 'row-scoped', codes: ['service.schedule.view_team'] }))).toBe(
      false,
    );
  });

  it('an ungated function is a gap whatever its predecessor gated', () => {
    expect(isGap(row({ enforces: 'open to all roles', codes: ['sales.lead.view_own'] }))).toBe(
      true,
    );
  });

  it('a recorded reason settles it', () => {
    for (const verdict of ['open-by-design', 'public', 'internal', 'headless']) {
      expect(isGap(row({ enforces: 'open to all roles', verdict })), verdict).toBe(false);
    }
    // needs-gate is the worklist, not a decision that it is fine.
    expect(isGap(row({ enforces: 'open to all roles', verdict: 'needs-gate' }))).toBe(true);
  });

  it("a segment no edge function serves is not this tool's problem", () => {
    expect(isGap(row({ fn: null, enforces: 'no edge function' }))).toBe(false);
  });

  it('a gated function is never a gap', () => {
    expect(isGap(row())).toBe(false);
  });
});

describe('row-scoped is not gated, which is the gap it found', () => {
  const SRC = read('supabase/functions/technician-management/index.ts');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /** The body of one branch, stopping at the next - a window is not a scope. */
  function branch(head: string): string {
    const at = CODE.indexOf(head);
    expect(at, `branch not found: ${head}`).toBeGreaterThan(-1);
    const rest = CODE.slice(at + head.length);
    const next = rest.indexOf('if (req.method');
    return next === -1 ? rest : rest.slice(0, next);
  }

  it.each([
    ["if (req.method === 'POST' && !techId) {", 'creating a technician'],
    ["if (req.method === 'PUT' && techId && !subResource) {", 'editing one'],
    ["if (req.method === 'POST' && techId && subResource === 'skills') {", 'adding a skill'],
    ["if (req.method === 'POST' && techId && subResource === 'availability') {", 'availability'],
    ["if (req.method === 'DELETE' && techId) {", 'deleting one'],
  ])('%s requires a supervisor (%s)', (head) => {
    expect(branch(head)).toContain('requireSupervisor()');
  });

  it('leaves the roster reads open, because row scoping is their control', () => {
    expect(branch("if (req.method === 'GET' && !techId) {")).not.toContain('requireSupervisor');
    expect(CODE).toContain("applyUserScope(query, 'user_id', scope)");
  });

  it('mirrors the page rather than picking a level', () => {
    expect(CODE).toContain('ROLE_LEVEL.SUPERVISOR');
    const nav = read('client/src/lib/navigation-permissions.ts');
    const rule = nav.slice(nav.indexOf("'/technician-management': {"));
    expect(rule.slice(0, 160)).toMatch(/minLevel:\s*3/);
  });

  it('rethrows anything that is not a role refusal', () => {
    expect(CODE).toMatch(/if \(!\(err instanceof RbacError\)\) throw err;/);
  });
});

describe('importing the module has no side effects', () => {
  it('does not regenerate the committed doc', () => {
    // Importing it for the pure helpers used to RUN it, rewriting a tracked
    // file from whatever the test tree happened to hold. import.meta.main is a
    // Deno API and is always undefined in Node, so the guard is argv-based.
    const before = read('docs/edge-rbac-express-predecessors.md');
    expect(analyzeRouter('', helperValues(''))).toEqual({ codes: [], segments: [] });
    expect(read('docs/edge-rbac-express-predecessors.md')).toBe(before);
    const src = read('scripts/edge-rbac-predecessors.mjs');
    expect(src).toContain('if (isEntryPoint) main();');
    // Strip comments: the script's own header explains why import.meta.main is
    // wrong here, so an absence assertion against the raw source reports its
    // explanation as the defect.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toContain('import.meta.main');
  });
});

describe('the guard reports a gap rather than a count', () => {
  const runCheck = () => {
    try {
      return {
        code: 0,
        out: execFileSync('node', [join(repo, 'scripts/edge-rbac-predecessors.mjs'), '--check'], {
          cwd: repo,
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        }),
      };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  it('passes on the current tree and says how much it looked at', () => {
    const { code, out } = runCheck();
    expect(code).toBe(0);
    expect(out).toMatch(/\d+ Express-gated segment\(s\)/);
  });

  it('is wired into CI, not merely runnable', () => {
    // A guard nobody executes accumulates a baseline that rots - check:error-shape
    // had four files in its baseline that no longer existed.
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:edge-predecessors');
    expect(read('package.json')).toContain('"check:edge-predecessors"');
  });

  it('the doc names every predecessor it read, so a row can be checked', () => {
    expect(DOC).toContain('## Where each predecessor was read');
    // Deleted routers are recovered from git history; the live tree alone
    // answers a fraction of the question.
    expect(DOC).toContain('(deleted)');
    expect(DOC).toContain('(live)');
    const rows = DOC.split('\n').filter((l) => l.startsWith('| `/api/'));
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) expect(row.split('|').length).toBe(8);
  });
});

describe('a generated doc is machine-managed, not guidance', () => {
  /**
   * check:prd-refs scans CLAUDE.md plus the prose docs it sends you to, and this
   * doc is one of those now. Its unresolved paths are its POINT - the deleted
   * Express routers it recovered from git history, each annotated `(deleted)` -
   * so baselining three permanently-correct entries would put known non-defects
   * in a list whose value is that every entry is a prompt to re-read something.
   * The exclusion is a RULE, and the rule has to be narrow enough that a
   * hand-written doc cannot fall into it by accident.
   */
  it('excuses a doc that declares itself generated, near the top', () => {
    expect(isGenerated('# Title\n\n<!-- GENERATED by scripts/x.mjs -->\n')).toBe(true);
    expect(isGenerated(read('docs/edge-rbac-express-predecessors.md'))).toBe(true);
  });

  it('does not excuse a doc that merely talks about generated files', () => {
    expect(isGenerated('# Notes\n\nThis explains how a file is GENERATED by hand.')).toBe(false);
    // The marker must be the document's own claim, not a word buried in prose.
    const buried =
      '# Notes\n' + 'filler line\n'.repeat(200) + '<!-- GENERATED by scripts/x.mjs -->';
    expect(isGenerated(buried)).toBe(false);
  });

  it('still scans CLAUDE.md, which is the file the guard exists for', () => {
    expect(isGenerated(read('CLAUDE.md'))).toBe(false);
  });
});
