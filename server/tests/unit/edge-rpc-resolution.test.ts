/**
 * Round 139 - an edge function can call SQL that exists in no file.
 *
 * `drizzle/functions/*.sql` is applied BY HAND (`\i`), never by `db:migrate`,
 * so the only thing connecting an edge function's `.rpc('name')` to a real
 * Postgres function is that somebody wrote the SQL and somebody else ran it.
 * `geocode-leads` called `exec_sql`, which nothing in this repo defines, and
 * built `WHERE tenant_id = '${tenantId}'` by interpolation inside it - safe
 * ONLY because the function does not exist, which is the worst reason for
 * code to be safe. Its result was destructured and never read, so the queries
 * below it were the only path rather than a fallback.
 *
 * These assert the properties, not the wording: the guard's rules are exported
 * as pure functions and called against fixtures AND against the real tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyze,
  edgeFiles,
  interpolatedSql,
  rpcCalls,
  stripComments,
  undocumentedSqlFiles,
  MIN_EDGE_FILES,
  MIN_DEFINITIONS,
} from '../../../scripts/check-edge-rpc.mjs';

const ROOT = resolve(__dirname, '../../..');
const FN_DIR = resolve(ROOT, 'drizzle/functions');

describe('edge RPC resolution', () => {
  it('every .rpc() name resolves to a function this repo defines', () => {
    const r = analyze();
    expect(r.unresolved.map((c: { file: string; name: string }) => `${c.file}: ${c.name}`)).toEqual(
      [],
    );
  });

  it('no edge file builds SQL by interpolation', () => {
    expect(analyze().interpolated).toEqual([]);
  });

  it('every hand-applied SQL file is listed in its README', () => {
    expect(undocumentedSqlFiles()).toEqual([]);
  });

  it('the walk and the definition scan reach the real tree', () => {
    const r = analyze();
    // Floors that FAIL rather than pass when a pattern stops matching.
    expect(r.fileCount).toBeGreaterThanOrEqual(MIN_EDGE_FILES);
    expect(r.definitionCount).toBeGreaterThanOrEqual(MIN_DEFINITIONS);
    // And the floors themselves have to mean something: a floor of 0 is the
    // vacuous pass it exists to prevent.
    expect(MIN_EDGE_FILES).toBeGreaterThan(100);
    expect(MIN_DEFINITIONS).toBeGreaterThan(5);
  });

  it('finds the .rpc() calls that are really there', () => {
    const names = new Set(rpcCalls(edgeFiles()).map((c: { name: string }) => c.name));
    // Spot anchors from three different files, so a walk that silently
    // narrowed to one directory fails.
    expect(names.has('sales_pipeline_summary')).toBe(true);
    expect(names.has('dashboard_widget_data')).toBe(true);
    expect(names.has('global_search')).toBe(true);
    expect(names.has('exec_sql')).toBe(false);
  });
});

describe('the exec_sql removal', () => {
  const src = readFileSync(resolve(ROOT, 'supabase/functions/geocode-leads/index.ts'), 'utf8');
  const code = stripComments(src);

  it('the dead RPC and its interpolated SQL are gone from the CODE', () => {
    expect(code).not.toMatch(/\.rpc\(\s*['"`]exec_sql/);
    expect(code).not.toContain('${tenantId}');
  });

  it('but the explanation survives in a comment', () => {
    // The comment necessarily quotes what it removed. That is exactly why
    // every rule here strips comments first - a scan that reads them reports
    // its own explanation as the defect.
    expect(src).toContain('exec_sql');
    expect(src).toMatch(/injection sink/);
  });

  it('the counts it used to shadow still use tenant-scoped PostgREST filters', () => {
    expect(code).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(code).toMatch(/count: 'exact', head: true/);
  });
});

describe('the rules reject what they are for', () => {
  function withFixture(files: Record<string, string>, fn: (dir: string) => void) {
    const dir = mkdtempSync(join(tmpdir(), 'edge-rpc-'));
    try {
      for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('reports an interpolated SQL literal', () => {
    withFixture(
      {
        'bad.ts': 'const q = `SELECT * FROM t WHERE id = ${x}`;\n',
      },
      (dir) => {
        expect(interpolatedSql([join(dir, 'bad.ts')])).toHaveLength(1);
      },
    );
  });

  it('does not report English prose that happens to contain a verb', () => {
    withFixture(
      {
        // No FROM/INTO/SET/WHERE clause keyword, so this is not SQL.
        'ok.ts': 'const msg = `Update the baseline for ${name}`;\n',
      },
      (dir) => {
        expect(interpolatedSql([join(dir, 'ok.ts')])).toEqual([]);
      },
    );
  });

  it('does not report an interpolated SQL literal that sits in a comment', () => {
    withFixture(
      {
        'commented.ts': '// was: `SELECT * FROM t WHERE id = ${x}`\nconst a = 1;\n',
      },
      (dir) => {
        expect(interpolatedSql([join(dir, 'commented.ts')])).toEqual([]);
      },
    );
  });

  it('strips line comments before block comments', () => {
    // The other order reads the trailing `/*` of a line comment as a block
    // opener and blanks everything to the next `*/`. The fixture MUST contain
    // a real block comment below that line, or both orders behave identically
    // and the mutant survives - round 131 recorded this exact trap.
    const src = [
      '// a path like /reports/sales/*',
      "const keep = 'visible';",
      '/* an ordinary block comment */',
      "const alsoKeep = 'second';",
    ].join('\n');
    const out = stripComments(src);
    expect(out).toContain('visible');
    expect(out).toContain('second');
    expect(out).not.toContain('ordinary block comment');
  });

  it('does not report a SQL literal that interpolates nothing', () => {
    // `SELECT 1` as a plain template literal is not a sink. Without this the
    // interpolation test is unexercised: the real tree has no such literal,
    // so dropping the check is indistinguishable from keeping it.
    withFixture(
      {
        'static.ts': 'const q = `SELECT id FROM tenants WHERE active = true`;\n',
      },
      (dir) => {
        expect(interpolatedSql([join(dir, 'static.ts')])).toEqual([]);
      },
    );
  });

  it('reports a SQL file the README does not name', () => {
    // The real directory is fully documented, so this rule can only be
    // exercised against a fixture - otherwise a disabled rule and a working
    // one both answer [].
    withFixture(
      {
        'README.md': '| `listed.sql` | does a thing | somewhere |\n',
        'listed.sql': 'CREATE FUNCTION listed() RETURNS void AS $$ BEGIN END $$;\n',
        'forgotten.sql': 'CREATE FUNCTION forgotten() RETURNS void AS $$ BEGIN END $$;\n',
      },
      (dir) => {
        expect(undocumentedSqlFiles(dir)).toEqual(['forgotten.sql']);
      },
    );
  });

  it('reports every SQL file when the README is missing entirely', () => {
    withFixture(
      { 'orphan.sql': 'CREATE FUNCTION orphan() RETURNS void AS $$ BEGIN END $$;\n' },
      (dir) => {
        expect(undocumentedSqlFiles(dir)).toEqual(['orphan.sql']);
      },
    );
  });

  it('keeps https:// intact while stripping line comments', () => {
    expect(stripComments("const u = 'https://x.test/a'; // note")).toContain('https://x.test/a');
  });
});

describe('both callers of lead_assignment_bump_rep_load read their result', () => {
  // The RPC lives in a hand-applied file, so "the function is not there" is a
  // real state. _engine.ts threw on failure and handlers/assign.ts discarded
  // the result, so one path failed loudly and the other answered 201 with the
  // counter unmoved - the rep keeps their previous load and round-robin keeps
  // handing them the next lead. Two call sites of one RPC disagreeing about
  // whether its failure matters is the shape this pins shut.
  const DIR = resolve(ROOT, 'supabase/functions/lead-assignment');

  function callSites(): { file: string; after: string }[] {
    const out: { file: string; after: string }[] = [];
    const walkDir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walkDir(p);
        else if (e.name.endsWith('.ts')) {
          const src = stripComments(readFileSync(p, 'utf8'));
          let i = src.indexOf("rpc('lead_assignment_bump_rep_load'");
          while (i !== -1) {
            // Bound on the next statement boundary that always follows one of
            // these chains, not on a character count - a window is not a scope.
            out.push({ file: p, after: src.slice(i, i + 600) });
            i = src.indexOf("rpc('lead_assignment_bump_rep_load'", i + 1);
          }
        }
      }
    };
    walkDir(DIR);
    return out;
  }

  it('finds both call sites', () => {
    expect(callSites()).toHaveLength(2);
  });

  it('neither discards the result', () => {
    // The property is that the result is BOUND to a name. A bare
    // `await db.rpc(...)` throws the PostgREST error away; `const x = await
    // db.rpc(...)` at least makes it reachable, and the two assertions below
    // check what each caller then does with it.
    for (const site of callSites()) {
      const body = stripComments(readFileSync(site.file, 'utf8'));
      const at = body.indexOf("rpc('lead_assignment_bump_rep_load'");
      // Look back over the call chain to the start of the statement.
      const lead = body.slice(Math.max(0, at - 80), at);
      expect(lead, `${site.file} discards the bump result`).toMatch(
        /(?:const|let)\s+\w+\s*=\s*await\s+db\s*\.$/,
      );
    }
  });

  it('the assign handler reports the failure instead of failing the assignment', () => {
    const body = stripComments(readFileSync(resolve(DIR, 'handlers/assign.ts'), 'utf8'));
    expect(body).toMatch(/const bump = await db\.rpc\(/);
    // Bind to the CONDITION, not to the two literals: a spread rewritten to
    // `...(false ? ... : ...)` leaves both `repLoadUpdated` branches in the
    // file while shipping the success one unconditionally.
    expect(body).toMatch(/\.\.\.\(bump\.error\s*\?/);
    expect(body).toMatch(/repLoadUpdated: false/);
    expect(body).toMatch(/repLoadUpdated: true/);
    // And the warning has to carry the server's own reason.
    expect(body).toMatch(/bump\.error\.message/);
    // It must NOT convert a counter failure into an error response: the
    // history row is already written by then.
    const at = body.indexOf('const bump = await db.rpc(');
    const tail = body.slice(at);
    expect(tail).not.toMatch(/errorResponse\(5\d\d/);
  });

  it('the engine still throws, because it runs before the row is written', () => {
    const body = stripComments(readFileSync(resolve(DIR, '_engine.ts'), 'utf8'));
    expect(body).toMatch(/rpcResult\.error/);
    expect(body).toMatch(/throw new Error\(`Rep capacity counter update failed/);
  });
});

describe('the README describes every file', () => {
  const readme = readFileSync(join(FN_DIR, 'README.md'), 'utf8');
  const sqlFiles = readdirSync(FN_DIR).filter((f) => f.endsWith('.sql'));

  it('names each SQL file', () => {
    expect(sqlFiles.length).toBeGreaterThanOrEqual(9);
    for (const f of sqlFiles) expect(readme, `${f} missing from README`).toContain(f);
  });

  it('says which functions have no fallback, since those 500 when unapplied', () => {
    expect(readme).toMatch(/NO fallback/);
    expect(readme).toContain('pipeline_deal_transition');
  });

  it('records that lead_assignment_reset_counters has no caller', () => {
    // Assert the FACT as well as the prose, so the note cannot outlive it.
    const callers: string[] = [];
    for (const f of edgeFiles()) {
      if (stripComments(readFileSync(f, 'utf8')).includes('lead_assignment_reset_counters')) {
        callers.push(f);
      }
    }
    for (const f of readdirSync(resolve(ROOT, 'drizzle/cron')).filter((f) => f.endsWith('.sql'))) {
      const body = readFileSync(resolve(ROOT, 'drizzle/cron', f), 'utf8');
      if (body.includes('lead_assignment_reset_counters')) callers.push(f);
    }
    // The Node host could schedule it too, so the absence claim has to cover
    // server/ as well - a note that says "nothing calls this" while one host
    // does is worse than no note.
    const serverFiles: string[] = [];
    const walkServer = (dir: string) => {
      for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
        if (e.name === 'tests' || e.name === 'node_modules') continue;
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walkServer(rel);
        else if (e.name.endsWith('.ts')) serverFiles.push(rel);
      }
    };
    walkServer('server');
    expect(serverFiles.length).toBeGreaterThan(100);
    for (const f of serverFiles) {
      if (
        stripComments(readFileSync(resolve(ROOT, f), 'utf8')).includes(
          'lead_assignment_reset_counters',
        )
      ) {
        callers.push(f);
      }
    }
    expect(callers).toEqual([]);
    expect(readme).toContain('lead_assignment_reset_counters');
  });
});
