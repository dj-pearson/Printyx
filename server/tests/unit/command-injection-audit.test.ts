import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  childProcessBindings,
  bindingPatterns,
  scanFile,
  findingKey,
  compareToBaseline,
  MIN_CORPUS,
} from '../../scripts/command-injection-audit';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Writes a fixture file and scans it, so the rules are exercised, not read. */
function scanSource(source: string, name = 'fixture.ts') {
  const dir = mkdtempSync(join(tmpdir(), 'cmdi-'));
  try {
    const file = join(dir, name);
    writeFileSync(file, source, 'utf8');
    return scanFile(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CP = "import { execSync } from 'child_process';\n";

/**
 * SEC-005 shipped this scanner and marked itself COMPLETE. It had never run
 * once: the CLI guard used __filename, which does not exist in an ESM module,
 * so it threw a ReferenceError before reading a line. It also exited 0 with
 * findings, so wiring it into CI would have gated nothing either.
 */
describe('the scanner can run at all (SEC-005)', () => {
  const src = read('server/scripts/command-injection-audit.ts');

  it('uses import.meta.url, not the CommonJS globals', () => {
    const code = stripComments(src);
    expect(code).toContain('fileURLToPath(import.meta.url)');
    expect(code).not.toMatch(/(?<![\w.])__filename(?![\w])/);
    expect(code).not.toMatch(/(?<![\w.])__dirname(?![\w])/);
  });

  it('exits non-zero when a finding is not accepted', () => {
    expect(stripComments(src)).toContain('process.exit(1)');
  });

  it('refuses to answer when the walk collapses', () => {
    expect(stripComments(src)).toContain('process.exit(2)');
    // The number matters as much as the branch: this repo has ~2,700 scannable
    // files, so a floor of 0 is the vacuous pass the branch exists to close.
    expect(MIN_CORPUS).toBeGreaterThan(100);
  });
});

describe('the baseline comparison, against fixtures', () => {
  // Asserted by CALLING it. A source check for `process.exit(1)` passed while
  // the stale rule and the unreasoned rule were both gutted - the constant is
  // still in the file either way.
  it('passes when every found key is accepted with a reason', () => {
    expect(compareToBaseline(['a::p'], { 'a::p': 'because' })).toEqual([]);
  });

  it('reports a key the baseline has never seen', () => {
    expect(compareToBaseline(['a::p', 'b::q'], { 'a::p': 'because' })).toEqual([
      { kind: 'new', key: 'b::q' },
    ]);
  });

  it('reports a key accepted with an empty reason', () => {
    expect(compareToBaseline(['a::p'], { 'a::p': '' })).toEqual([
      { kind: 'unreasoned', key: 'a::p' },
    ]);
  });

  it('reports a key that is no longer found', () => {
    // Four of check:error-shape's baselined files did not exist by the time it
    // first ran, so a file returning under that name arrived pre-forgiven.
    expect(compareToBaseline([], { 'gone::p': 'because' })).toEqual([
      { kind: 'stale', key: 'gone::p' },
    ]);
  });
});

describe('callable names are derived from the file, not guessed', () => {
  it('reads a named import', () => {
    const b = childProcessBindings("import { exec, execFileSync } from 'child_process';");
    expect([...b.direct]).toEqual(['exec']);
    expect([...b.anySpawner].sort()).toEqual(['exec', 'execFileSync']);
  });

  it('follows an alias', () => {
    const b = childProcessBindings("import { execSync as run } from 'node:child_process';");
    expect([...b.direct]).toEqual(['run']);
  });

  it('reads a namespace import and a require', () => {
    expect([...childProcessBindings("import * as cp from 'child_process';").namespaces]).toEqual([
      'cp',
    ]);
    expect([
      ...childProcessBindings("const childProcess = require('child_process');").namespaces,
    ]).toEqual(['childProcess']);
  });

  it('reads a destructured dynamic import', () => {
    const b = childProcessBindings("const { execSync } = await import('child_process');");
    expect([...b.direct]).toEqual(['execSync']);
  });

  it('finds nothing in a file that never names the module', () => {
    const b = childProcessBindings('const m = /x/.exec(s);');
    expect(b.direct.size + b.namespaces.size).toBe(0);
    expect(bindingPatterns(b)).toEqual([]);
  });
});

describe('a regex is not a subprocess', () => {
  it('ignores RegExp.prototype.exec', () => {
    // 151 of the scanner's first 172 findings were this, in the repo's own
    // guards. A report at that ratio is one nobody reads.
    expect(scanSource('const m = /a(b)/.exec(line);\nwhile ((m = re.exec(src))) {}\n')).toEqual([]);
  });

  it('still reports a real shell call in a file that also uses regexes', () => {
    const out = scanSource(`${CP}const m = /a/.exec(s);\nexecSync(\`ls \${dir}\`);\n`);
    expect(out.map((f) => f.pattern)).toEqual(['spawn-template-literal']);
  });

  it('reports a call through a namespace alias', () => {
    const out = scanSource("import * as cp from 'child_process';\ncp.exec(`ls ${d}`);\n");
    expect(out.map((f) => f.pattern)).toEqual(['spawn-template-literal']);
  });

  it('reports a call through an alias name', () => {
    const out = scanSource("import { exec as run } from 'child_process';\nrun(`ls ${d}`);\n");
    expect(out).toHaveLength(1);
  });
});

describe('the recommended fix is not reported as the defect', () => {
  it('accepts execFileSync with an argument array', () => {
    // Reporting the remedy is how a guard teaches people to ignore it.
    const src =
      "import { execFileSync } from 'child_process';\nexecFileSync('sc', ['query', n]);\n";
    expect(scanSource(src)).toEqual([]);
  });

  it('still reports shell: true beside an argument array', () => {
    const src = "import { spawn } from 'child_process';\nspawn('node', a, { shell: true });\n";
    expect(scanSource(src).map((f) => f.pattern)).toEqual(['spawn-shell-true']);
  });
});

describe('a DOM query helper is not eval', () => {
  it('ignores page.$eval and page.$$eval', () => {
    // Ten Playwright calls were reported as code injection: \b sits between
    // `$` and `e`, so the word boundary matched $eval.
    expect(scanSource('await page.$eval("body", (el) => el.textContent);\n')).toEqual([]);
    expect(scanSource('await page.$$eval("form", (els) => els.length);\n')).toEqual([]);
  });

  it('still reports the global function', () => {
    const out = scanSource('const r = ' + 'ev' + 'al(userInput);\n');
    expect(out.map((f) => f.pattern)).toEqual(['eval-call']);
  });
});

describe('self-referential files are exempt by name', () => {
  it('skips the scanner and the prevention test', () => {
    // Both necessarily contain the patterns they are about. Five of the SQL
    // scanner's first six findings were exactly this, including its CRITICAL
    // and its HIGH, which is why the one real finding sat unread.
    const src = `${CP}execSync(\`ls \${d}\`);\n`;
    expect(scanSource(src, 'command-injection-audit.ts')).toEqual([]);
    expect(scanSource(src, 'command-injection-prevention.test.ts')).toEqual([]);
    expect(scanSource(src, 'something-else.ts')).toHaveLength(1);
  });
});

describe('the baseline is a worklist, not a list', () => {
  const baseline = JSON.parse(read('docs/command-injection-baseline.json')) as {
    note: string;
    accepted: Record<string, string>;
  };

  it('has a note explaining what is in it', () => {
    expect(baseline.note.length).toBeGreaterThan(200);
  });

  it('gives every accepted call site a reason', () => {
    const entries = Object.entries(baseline.accepted);
    expect(entries.length).toBeGreaterThan(0);
    let checked = 0;
    for (const [key, why] of entries) {
      expect(why, `${key} is accepted with no reason`).toBeTruthy();
      expect(why.length, `${key}'s reason is too thin to be one`).toBeGreaterThan(40);
      checked += 1;
    }
    expect(checked).toBe(entries.length);
  });

  it('accepts only developer tooling, never anything under server/ or supabase/', () => {
    for (const key of Object.keys(baseline.accepted)) {
      expect(key.startsWith('server/'), `${key} answers requests`).toBe(false);
      expect(key.startsWith('supabase/'), `${key} answers requests`).toBe(false);
      expect(key.startsWith('client/'), `${key} ships to a browser`).toBe(false);
    }
  });

  it('keys a finding by file and pattern, not by line', () => {
    const key = findingKey(
      {
        file: resolve(repoRoot, 'a/b.ts'),
        line: 9,
        pattern: 'p',
        severity: 'high',
        description: '',
        snippet: '',
      },
      repoRoot,
    );
    expect(key).toBe('a/b.ts::p');
  });
});

describe('the desktop service no longer builds a shell string (SEC-005)', () => {
  const src = read('printyx-desktop/src/main/services/windows-service.ts');
  const code = stripComments(src);

  it('calls sc and net through execFileSync with argument arrays', () => {
    expect(code).toContain("execFileSync('sc', ['query', this.serviceName]");
    expect(code).toContain("execFileSync('net', ['start', this.serviceName]");
    expect(code).toContain("execFileSync('net', ['stop', this.serviceName]");
  });

  it('interpolates nothing into a command string', () => {
    expect(code).not.toMatch(/execSync\s*\(\s*`/);
    expect(code).not.toMatch(/shell\s*:\s*true/);
  });
});

describe('both scanners are wired, not merely runnable (CR-023)', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const ci = read('.github/workflows/ci.yml');

  it.each(['check:sqli', 'check:command-injection'])('%s is an npm script', (name) => {
    expect(pkg.scripts[name]).toBeTruthy();
  });

  it.each(['check:sqli', 'check:command-injection'])('%s runs in CI', (name) => {
    // A guard nobody executes accumulates a baseline that rots - four of
    // check:error-shape's files did not exist by the time it first ran.
    expect(ci).toContain(`npm run ${name}`);
  });
});

describe('the migration lock parameterises its timeout (SEC-001)', () => {
  const code = stripComments(read('server/lib/migrate.ts'));

  it('multiplies a bound parameter by a fixed unit', () => {
    expect(code).toContain("($3 * INTERVAL '1 millisecond')");
    expect(code).toContain('LOCK_TIMEOUT_MS]');
  });

  it('interpolates nothing into the INTERVAL', () => {
    expect(code).not.toMatch(/INTERVAL\s+'\$\{/);
  });
});

describe('safe-exec is the only way into a subprocess from server/ (SEC-005)', () => {
  /**
   * `server/lib/safe-exec.ts` wraps execFile behind a binary allowlist, an
   * argument-metacharacter check and a timeout, and NOTHING imports it -
   * because nothing under `server/` spawns anything at all. That is the right
   * state, not a gap: the wrapper is there for the first caller that needs one.
   *
   * This assertion fails the day a second file reaches for child_process, so
   * whoever writes it is pointed at the wrapper instead of rediscovering it.
   */
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (entry.name.endsWith('.ts')) out.push(rel);
    }
    return out;
  };

  const files = walk('server').filter(
    (f) => !f.startsWith('server/tests/') && !f.includes('command-injection-audit'),
  );

  it('walks a real corpus, so this cannot pass by finding nothing', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has exactly one child_process importer', () => {
    const spawners = files.filter((f) => /['"](?:node:)?child_process['"]/.test(read(f)));
    expect(spawners).toEqual(['server/lib/safe-exec.ts']);
  });

  it('keeps the wrapper shell-free and allowlisted', () => {
    const code = stripComments(read('server/lib/safe-exec.ts'));
    expect(code).toContain('execFile as nodeExecFile');
    expect(code).toContain('ALLOWED_BINARIES');
    expect(code).not.toMatch(/shell\s*:\s*true/);
  });
});
