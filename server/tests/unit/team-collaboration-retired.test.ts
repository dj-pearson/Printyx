/**
 * AUDIT-035: the team-collaboration router is retired, and the guard that was
 * supposed to notice routers like it had a bracket-shaped blind spot.
 *
 * NINE HANDLERS, ZERO DATABASE CALLS, ZERO CALLERS. Every path the router
 * answered - /api/teams, /api/teams/:id[members|capacity|insights],
 * /api/projects/:id/assignments/optimize, /api/projects/:id/dependencies,
 * /api/collaboration/templates, /api/collaboration/analytics - has no caller in
 * any of the eight client trees, and supabase/functions/teams/ names this file
 * as the thing it replaces and covers all of them over real tables. Production
 * was already being served correctly while dev got the mocks.
 *
 * THE SERVICE WENT TOO, and the reasoning is the part worth keeping. AUDIT-021
 * had made `analyzeTeamCapacity` and `getTeamMembers` genuinely real; the other
 * thirteen methods were mocks (`getTeamProjects` returned a hardcoded "Q4 Sales
 * Campaign" at 75% complete). A real island inside an unreachable file whose
 * live counterpart already computes the same thing is not the "unwired work
 * that WORKS" PROD-008c kept advanced-billing-routes for. What the richer
 * version could do and the edge one cannot - per-member analytics, named
 * bottlenecks, recommendations - is on the story, not lost with the file.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the Express duplicate is gone', () => {
  it('the router, its service and three dead migration runners are deleted', () => {
    for (const path of [
      'server/routes/team-collaboration-routes.ts',
      'server/services/team-collaboration-service.ts',
      // Each read a migrations/*.sql that is not in the repo, so each would
      // have thrown on readFileSync before touching the database.
      'server/run-team-collaboration-migration.ts',
      'server/run-advanced-workflows-migration.ts',
      'server/run-ai-documentation-migration.ts',
    ]) {
      expect({ path, exists: existsSync(join(repo, path)) }).toEqual({ path, exists: false });
    }
  });

  it('every surviving migration runner points at SQL that exists', () => {
    // The general shape: a runner whose DDL was never committed cannot work,
    // and a feature whose migration never landed has to be mocked on every
    // host. MEETINGS-READS-001 found the first one; this is the sweep.
    const missing: string[] = [];
    for (const entry of readdirSync(join(repo, 'server'))) {
      if (!/^run-.*\.ts$/.test(entry)) continue;
      const src = read(`server/${entry}`);
      const m = /['"`]\.\.\/(migrations\/[A-Za-z0-9_.-]+\.sql)['"`]/.exec(src);
      if (m && !existsSync(join(repo, m[1]))) missing.push(`server/${entry} -> ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('the registry unmounts it and says why at the mount site', () => {
    const registry = read('server/routes-registry.ts');
    expect(stripComments(registry)).not.toMatch(/routes\/team-collaboration-routes/);
    expect(registry).toMatch(/team-collaboration-routes retired \(AUDIT-035\)/);
  });

  it('nothing imports the deleted service', () => {
    const offenders: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(join(repo, dir))) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const rel = `${dir}/${entry}`;
        if (statSync(join(repo, rel)).isDirectory()) visit(rel);
        else if (
          /\.tsx?$/.test(entry) &&
          /team-collaboration-service/.test(stripComments(read(rel)))
        ) {
          offenders.push(rel);
        }
      }
    };
    visit('server');
    // server/tests is excluded by rule: a test asserting the file is absent
    // necessarily names it.
    expect(offenders.filter((f) => !f.startsWith('server/tests/'))).toEqual([]);
  });
});

describe('the edge function that replaces it is real', () => {
  it('names the file it supersedes, which is what makes the deletion evidence', () => {
    // AUDIT-024's method: grep every tree for an importer, THEN look for a
    // comment in the replacement naming the file. The second half is what
    // turns "nobody calls this" into "this was deliberately superseded".
    expect(read('supabase/functions/teams/index.ts')).toMatch(
      /Replaces:[\s\S]{0,120}team-collaboration-routes\.ts/,
    );
  });

  it('covers every path the router answered', () => {
    const idx = read('supabase/functions/teams/index.ts');
    for (const bucket of ['teams', 'projects', 'templates', 'analytics']) {
      expect({ bucket, routed: idx.includes(`case '${bucket}':`) }).toEqual({
        bucket,
        routed: true,
      });
    }
    const teams = stripComments(read('supabase/functions/teams/handlers/teams.ts'));
    for (const sub of ['capacity', 'insights']) {
      expect({ sub, served: teams.includes(`sub === '${sub}'`) }).toEqual({ sub, served: true });
    }
  });

  it('and reads tables rather than answering from constants', () => {
    for (const [handler, min] of [
      ['teams', 6],
      ['projects', 4],
      ['analytics', 4],
    ] as const) {
      const code = stripComments(read(`supabase/functions/teams/handlers/${handler}.ts`));
      const reads = [...code.matchAll(/\.from\('/g)].length;
      expect({ handler, reads: reads >= min }).toEqual({ handler, reads: true });
    }
  });

  it('the one stub left declares itself, which is the difference that matters', () => {
    // A built-in catalogue of workflow templates is a product decision; the
    // meeting TYPES this session retired claimed to be a dealer's own
    // configuration. This one answers `stub: true` and its header says there is
    // no collaboration_templates table.
    const templates = read('supabase/functions/teams/handlers/templates.ts');
    expect(templates).toMatch(/no collaboration_templates table/);
    expect(stripComments(templates)).toMatch(/stub: true/);
  });
});

describe('a bracket in a comment hid twenty-five routers from check:uncalled-express', () => {
  const parity = read('scripts/lib/route-parity.mjs');

  it('strips comments before matching the mount array', () => {
    // The array body is captured non-greedily up to the first `]`, so
    // `/api/teams/:id[/members|/capacity|/insights]` inside an unmount note cut
    // the capture short and every module path after it vanished. The guard's
    // count fell 72 -> 47 as if 25 routers had acquired callers - a ratchet
    // improving a lot is a parse failure until proven otherwise.
    const at = parity.indexOf('const registryRaw = readFileSync(registryPath');
    expect(at).toBeGreaterThan(-1);
    const body = parity.slice(at, parity.indexOf('app.use(', at));
    expect(body).toMatch(/registryRaw\s*\n?\s*\.replace\(\/\\\/\\\*/);
    expect(body).toMatch(/const registrySrc = registryRaw/);
  });

  it('throws rather than reporting fewer domains when no root router resolves', () => {
    // The floor is what turns the silent miscount into a failure: without it,
    // a future parse break looks like progress.
    const at = parity.indexOf('if (rootMounted === 0)');
    expect(at).toBeGreaterThan(-1);
    expect(parity.slice(at, at + 400)).toMatch(/throw new Error\(/);
    expect(parity).toMatch(/rootMounted\+\+;/);
  });

  it('and the registry really does still mount root routers, so the floor is live', () => {
    const registry = stripComments(read('server/routes-registry.ts'));
    const arr = /asyncRootApiMounts: string\[\] = \[([\s\S]*?)\]/.exec(registry);
    expect(arr).not.toBeNull();
    const modules = [...arr![1].matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);
    expect(modules.length).toBeGreaterThan(3);
    for (const mod of modules) {
      expect({ mod, exists: existsSync(join(repo, 'server', `${mod}.ts`)) }).toEqual({
        mod,
        exists: true,
      });
    }
  });
});

describe('nothing called it', () => {
  const TREES = [
    'client/src',
    'printyx-client',
    'printyx-desktop',
    'mobile-app',
    'mobile',
    'browser-extensions',
    'printyx-extension',
    'ios',
  ];
  const sources: string[] = [];
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
      else if (/\.(ts|tsx|js|jsx|swift|kt)$/.test(entry)) sources.push(read(rel));
    }
  };
  for (const tree of TREES) visit(tree);

  it('all eight trees were walked', () => {
    expect(sources.length).toBeGreaterThan(900);
  });

  it('no client calls /api/teams or /api/collaboration', () => {
    for (const path of ['/api/teams', '/api/collaboration']) {
      const callers = sources.filter((s) => s.includes(path)).length;
      expect({ path, callers }).toEqual({ path, callers: 0 });
    }
  });

  it('/api/projects keeps its four callers and its real owner', () => {
    // The two /projects handlers a live page depends on were never this
    // router's: routes-tasks.ts registers them first over the real table.
    expect(sources.filter((s) => s.includes('/api/projects')).length).toBeGreaterThan(2);
    expect(read('server/routes-tasks.ts')).toMatch(/app\.get\('\/api\/projects'/);
  });
});
