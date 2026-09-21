/**
 * SEC-005: Command Injection Audit Scanner
 *
 * Scans the codebase for patterns that may indicate command injection risks:
 * - child_process.exec/execSync with template literals
 * - shell: true in spawn options
 * - eval(), new Function(), vm.runIn* with user input
 *
 * Outputs results in structured JSON format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// This file is ESM (package.json "type": "module"), so __filename and __dirname
// do not exist. The guard below used both and threw a ReferenceError before
// reading a single line, so this scanner had never run once - which is worse
// than a guard nobody wired, because the npm script would have "failed" for a
// reason that has nothing to do with the code it audits.
const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);

interface AuditFinding {
  file: string;
  line: number;
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  snippet: string;
}

interface AuditResult {
  scanDate: string;
  totalFilesScanned: number;
  totalFindings: number;
  findings: AuditFinding[];
  summary: Record<string, number>;
}

// Patterns to detect potential command injection vulnerabilities
const PATTERNS: Array<{
  name: string;
  regex: RegExp;
  severity: AuditFinding['severity'];
  description: string;
}> = [
  {
    name: 'eval-call',
    // `(?<![$\w.])` and not `\b`: Playwright's page.$eval / page.$$eval are DOM
    // query helpers, and `\b` sits between `$` and `e`, so the bare word
    // boundary reported ten of them as code injection. A leading `.` is a
    // method call on some object, which is not the global eval either.
    regex: /(?<![$\w.])eval\s*\(/,
    severity: 'critical',
    description: 'eval() usage detected - potential code injection',
  },
  {
    name: 'new-function',
    regex: /new\s+Function\s*\(/,
    severity: 'critical',
    description: 'new Function() usage detected - potential code injection',
  },
  {
    name: 'vm-runInContext',
    regex: /\bvm\s*\.\s*runIn(NewContext|ThisContext|Context)\s*\(/,
    severity: 'high',
    description: 'vm.runIn*() usage detected - potential code execution with user input',
  },
  {
    name: 'vm-compileFunction',
    regex: /\bvm\s*\.\s*compileFunction\s*\(/,
    severity: 'high',
    description: 'vm.compileFunction() usage detected - potential code execution',
  },
];

/**
 * `exec` is not one function. `RegExp.prototype.exec` and
 * `String.prototype.match` share the name with child_process, and a
 * name-only rule reported 151 regex calls in this repo's own guards as command
 * injection - a report at that signal ratio is one nobody reads, which is the
 * same reason `check:drift` had to collapse its enum comparison.
 *
 * So the callable names are DERIVED per file from what it imports. A file that
 * never binds child_process cannot call it, and a file that binds it under a
 * name is matched on THAT name. Nothing else can reach these functions.
 */
const CHILD_PROCESS_SOURCE = /['"](?:node:)?child_process['"]/;

/**
 * Only these two take a COMMAND STRING and hand it to a shell, so only these
 * two can be injected through their first argument. `execFileSync(cmd, [args])`
 * is the fix this scanner recommends - reporting it as a finding would argue
 * against the remedy, which is how a guard teaches people to ignore it.
 */
const SHELL_SPAWNERS = ['exec', 'execSync'];
/** Safe by construction on their first argument; only `shell: true` matters. */
const ARG_SPAWNERS = ['execFile', 'execFileSync', 'spawn', 'spawnSync'];
const SPAWNERS = [...SHELL_SPAWNERS, ...ARG_SPAWNERS];

export interface ChildProcessBindings {
  /** Local names bound to a SHELL spawner, e.g. `import { exec as run }`. */
  direct: Set<string>;
  /** Local names bound to any spawner at all, shell-interpreting or not. */
  anySpawner: Set<string>;
  /** Namespace aliases, e.g. `import cp from 'child_process'` -> "cp". */
  namespaces: Set<string>;
}

export function childProcessBindings(source: string): ChildProcessBindings {
  const direct = new Set<string>();
  const anySpawner = new Set<string>();
  const namespaces = new Set<string>();

  // import { exec, execSync as run } from 'child_process'
  // const { exec } = require('child_process')
  const destructured =
    /(?:import\s*\{([^}]*)\}\s*from\s*|(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:require|import)\s*\(\s*)['"](?:node:)?child_process['"]/g;
  for (const m of source.matchAll(destructured)) {
    for (const part of (m[1] ?? m[2] ?? '').split(',')) {
      const [imported, local] = part.split(/\bas\b/).map((x) => x.trim());
      if (!imported) continue;
      if (!SPAWNERS.includes(imported)) continue;
      anySpawner.add(local || imported);
      if (SHELL_SPAWNERS.includes(imported)) direct.add(local || imported);
    }
  }

  // import cp from / import * as cp from / const cp = require(...)
  const namespaced =
    /(?:import\s+(?:\*\s*as\s+)?([A-Za-z_$][\w$]*)\s+from\s*|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:require|import)\s*\(\s*)['"](?:node:)?child_process['"]/g;
  for (const m of source.matchAll(namespaced)) {
    const alias = m[1] ?? m[2];
    if (alias) namespaces.add(alias);
  }

  return { direct, anySpawner, namespaces };
}

/** Escapes a binding name for use inside a RegExp. */
const esc = (name: string) => name.replace(/[$]/g, '\\$$');

/**
 * The call shapes that are a finding, built from the names this file actually
 * bound. Order matters only for reporting; every pattern is tested.
 */
export function bindingPatterns(
  bindings: ChildProcessBindings,
): Array<{ name: string; regex: RegExp; severity: AuditFinding['severity']; description: string }> {
  const callables: string[] = [];
  for (const name of bindings.direct) callables.push(esc(name));
  for (const ns of bindings.namespaces) {
    for (const fn of SHELL_SPAWNERS) callables.push(`${esc(ns)}\\s*\\.\\s*${fn}`);
  }

  // `shell: true` is a finding wherever ANY spawner is bound, because it turns
  // an argument array back into a shell string.
  const shellOption = {
    name: 'spawn-shell-true',
    regex: /shell\s*:\s*true/,
    severity: 'high' as const,
    description: 'spawn/spawnSync called with shell: true - enables shell interpretation.',
  };
  const boundAnything = bindings.anySpawner.size > 0 || bindings.namespaces.size > 0;
  if (callables.length === 0) return boundAnything ? [shellOption] : [];

  const call = `(?:${callables.join('|')})\\s*\\(`;
  return [
    {
      name: 'spawn-template-literal',
      regex: new RegExp(`(?<![\\w$.])${call}\\s*\``),
      severity: 'critical',
      description:
        'A child_process call built from a template literal - the interpolated value reaches a shell.',
    },
    {
      name: 'spawn-string-concat',
      regex: new RegExp(`(?<![\\w$.])${call}\\s*[A-Za-z_$][\\w$]*\\s*\\+`),
      severity: 'high',
      description:
        'A child_process call built by string concatenation - the concatenated value reaches a shell.',
    },
    {
      name: 'spawn-variable',
      regex: new RegExp(`(?<![\\w$.])${call}\\s*[A-Za-z_$][\\w$.]*\\s*[,)]`),
      severity: 'medium',
      description:
        'A child_process call with a variable command - review where that value comes from.',
    },
    shellOption,
  ];
}

/**
 * Files exempt BY NAME, not by a `scripts/` or `tests/` glob: a real offence in
 * a helper should still be reported, and a blanket exemption is how one hides.
 * Each of these necessarily CONTAINS the patterns it is about - this scanner
 * carries them as its own pattern descriptions, the prevention test quotes them
 * to prove they are gone, and the audit test feeds them to the scanner as
 * fixtures to prove it still catches them.
 */
const SELF_REFERENTIAL_FILES = new Set([
  'command-injection-audit.ts',
  'command-injection-audit.test.ts',
  'command-injection-prevention.test.ts',
]);

// File extensions to scan
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next']);

function getAllFiles(dirPath: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

export function scanFile(filePath: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (SELF_REFERENTIAL_FILES.has(path.basename(filePath))) return findings;

  const content = fs.readFileSync(filePath, 'utf-8');
  const perFile = CHILD_PROCESS_SOURCE.test(content)
    ? bindingPatterns(childProcessBindings(content))
    : [];
  const patterns = [...PATTERNS, ...perFile];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          snippet: line.trim().substring(0, 200),
        });
      }
    }
  }

  return findings;
}

export function runAudit(rootDir: string): AuditResult {
  const files = getAllFiles(rootDir);
  const allFindings: AuditFinding[] = [];

  for (const file of files) {
    try {
      const findings = scanFile(file);
      allFindings.push(...findings);
    } catch {
      // Skip files that can't be read
    }
  }

  // Build severity summary
  const summary: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const finding of allFindings) {
    summary[finding.severity]++;
  }

  return {
    scanDate: new Date().toISOString(),
    totalFilesScanned: files.length,
    totalFindings: allFindings.length,
    findings: allFindings,
    summary,
  };
}

/** Stable key for a finding, independent of the line it sits on. */
export function findingKey(finding: AuditFinding, rootDir: string): string {
  const rel = path.relative(rootDir, finding.file).split(path.sep).join('/');
  return `${rel}::${finding.pattern}`;
}

interface Baseline {
  note: string;
  /** key -> why this call is accepted. A list with no reasons reads the same
   *  whether it was decided or overlooked. */
  accepted: Record<string, string>;
}

const BASELINE_PATH = path.resolve(THIS_DIR, '../../docs/command-injection-baseline.json');

/**
 * Below this, the walk is broken and a clean run means nothing. The repo has
 * ~2,700 scannable files; 500 is a floor, not a target.
 */
export const MIN_CORPUS = 500;

export interface BaselineProblem {
  kind: 'new' | 'unreasoned' | 'stale';
  key: string;
}

/**
 * The comparison, as a pure function, because a source-level assertion that the
 * CLI "exits 1 on a new key" cannot tell a working rule from a deleted one -
 * the constant it matches is still in the file either way. Three mutants
 * survived that shape before this was extracted.
 */
export function compareToBaseline(
  foundKeys: Iterable<string>,
  accepted: Record<string, string>,
): BaselineProblem[] {
  const problems: BaselineProblem[] = [];
  const found = new Set(foundKeys);
  for (const key of found) {
    const why = accepted[key];
    if (why === undefined) problems.push({ kind: 'new', key });
    else if (!why) problems.push({ kind: 'unreasoned', key });
  }
  // A key that no longer matches is debt that was deleted rather than accepted;
  // leaving it pre-forgives whatever returns under that name.
  for (const key of Object.keys(accepted)) {
    if (!found.has(key)) problems.push({ kind: 'stale', key });
  }
  return problems;
}

const DEFAULT_NOTE = [
  'Accepted child_process call sites, each with the reason it is accepted.',
  'Shrink-only: a new key fails `npm run check:command-injection`.',
  'Regenerate with `npm run check:command-injection -- --update-baseline` and',
  'write a reason for every new key - an entry with no reason is refused.',
].join(' ');

function readBaseline(): Baseline {
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Partial<Baseline>;
    return { note: parsed.note || DEFAULT_NOTE, accepted: parsed.accepted ?? {} };
  } catch {
    return { note: DEFAULT_NOTE, accepted: {} };
  }
}

/** Keeps a hand-written note rather than regenerating the default over it. */
function existingNote(fallback: string): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Partial<Baseline>;
    return parsed.note || fallback;
  } catch {
    return fallback;
  }
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  const args = process.argv.slice(2);
  const update = args.includes('--update-baseline');
  const check = args.includes('--check') || update;
  const rootDir = args.find((a) => !a.startsWith('--')) || path.resolve(THIS_DIR, '../..');
  const result = runAudit(rootDir);

  if (!check) {
    console.log(JSON.stringify(result, null, 2));
    console.error(
      result.totalFindings > 0
        ? `\nFound ${result.totalFindings} child_process call sites ` +
            `(${result.summary.critical} critical, ${result.summary.high} high, ` +
            `${result.summary.medium} medium, ${result.summary.low} low)`
        : '\nNo child_process call sites found.',
    );
    process.exit(0);
  }

  // A corpus that collapses reports nothing, which is indistinguishable from a
  // clean run - so refuse to answer rather than pass.
  if (result.totalFilesScanned < MIN_CORPUS) {
    console.error(
      `check:command-injection scanned only ${result.totalFilesScanned} files - the walk is ` +
        'broken, so a clean run would mean nothing.',
    );
    process.exit(2);
  }

  const baseline = readBaseline();
  const keys = new Map<string, AuditFinding[]>();
  for (const finding of result.findings) {
    const key = findingKey(finding, rootDir);
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key)!.push(finding);
  }

  if (update) {
    const accepted: Record<string, string> = {};
    for (const key of [...keys.keys()].sort()) {
      accepted[key] = baseline.accepted[key] ?? '';
    }
    fs.writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ note: existingNote(DEFAULT_NOTE), accepted }, null, 2)}\n`,
      'utf-8',
    );
    const unreasoned = Object.entries(accepted).filter(([, why]) => !why);
    console.log(`Wrote ${BASELINE_PATH} with ${Object.keys(accepted).length} entries.`);
    if (unreasoned.length > 0) {
      console.error(
        `\n${unreasoned.length} entr(ies) have no reason. Write one for each, or the check ` +
          `refuses them:\n${unreasoned.map(([k]) => `  ${k}`).join('\n')}`,
      );
      process.exit(1);
    }
    process.exit(0);
  }

  const problems = compareToBaseline(keys.keys(), baseline.accepted).map((p) => {
    if (p.kind === 'new') {
      const findings = keys.get(p.key)!;
      return (
        `NEW  ${p.key}\n     ${findings[0].description}\n` +
        findings.map((f) => `     ${path.relative(rootDir, f.file)}:${f.line}`).join('\n')
      );
    }
    if (p.kind === 'unreasoned') {
      return `UNREASONED  ${p.key}\n     accepted with no reason - say why, or fix it.`;
    }
    return `STALE  ${p.key}\n     no longer found - remove it.`;
  });

  if (problems.length === 0) {
    console.log(
      `\u2713 Command injection: ${keys.size} accepted child_process call site(s), each with a ` +
        `reason (${result.totalFilesScanned} files scanned).`,
    );
    process.exit(0);
  }

  console.error(`check:command-injection found ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}
