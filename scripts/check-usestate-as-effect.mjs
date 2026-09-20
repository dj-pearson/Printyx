#!/usr/bin/env node
/**
 * `useState` called as a statement (QUALITY-002).
 *
 * `useState(fn)` runs `fn` ONCE, during the first render, to compute an initial
 * value. Called as a bare statement the value is thrown away, so what is left is
 * a callback that fires once at mount - which reads like `useEffect(..., [])`
 * and is not one. Two live instances, with two different outcomes:
 *
 *   - WhiteLabelDashboard used it to copy the loaded config into its form. The
 *     initializer runs BEFORE the query resolves, so its `if (config)` never
 *     fired: the form kept its blank defaults whatever the tenant had saved, and
 *     Save wrote those blanks over the real branding.
 *   - SalesRepAssignments used it to fetch zip centroids at mount, which happens
 *     to be what an initializer does - correct by accident, and still a state
 *     slot nobody reads plus a fetch started during render.
 *
 * So the rule is not "this callback runs at the wrong time" - sometimes it runs
 * at the right one. The rule is that a `useState` whose value goes nowhere is
 * never what was meant. Lazy initialisation (`const [x] = useState(() => ...)`)
 * is consumed and is correct; this guard only reports the unconsumed form.
 *
 * HARD GATE AT ZERO across every client tree.
 *
 * BLIND SPOT, stated so a clean run is not read as proof: a `useState` result
 * assigned to a variable and then ignored is consumed as far as this scan is
 * concerned, and a hook called through an alias (`const s = useState; s(...)`)
 * is invisible.
 *
 * Usage:
 *   node scripts/check-usestate-as-effect.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every client tree, the same set `check:unreferenced-edge-fns` walks. */
const TREES = [
  'client/src',
  'printyx-client',
  'printyx-desktop',
  'mobile-app',
  'mobile',
  'browser-extensions',
  'printyx-extension',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.git']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Blank comments and string bodies while keeping every character position, so a
 * finding's line number is the real one. Line comments go FIRST and the
 * `https://` lookbehind stays: running the block pass first reads the `/*` in a
 * trailing line comment as an opener and swallows the code after it, which is
 * the trap `check:shared-helper-imports` already carries. This file's own header
 * names `useState(fn)` in prose, so a scan that does not strip comments reports
 * its own explanation.
 */
function blankNonCode(src) {
  let out = src.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/'(?:\\.|[^'\\\n])*'/g, (m) => "'" + ' '.repeat(m.length - 2) + "'");
  out = out.replace(/"(?:\\.|[^"\\\n])*"/g, (m) => '"' + ' '.repeat(m.length - 2) + '"');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, (m) => '`' + m.slice(1, -1).replace(/[^\n]/g, ' ') + '`');
  return out;
}

/**
 * Is this `useState(` call's value consumed by something? Walk back over
 * whitespace to the character that precedes it. A statement starts after `;`,
 * `{`, `}` or the start of the file; anything else (`=`, `(`, `,`, `return`,
 * `=>`, an operator) means the value goes somewhere.
 */
function isBareStatement(code, index) {
  let i = index - 1;
  // `React.useState` / `this.useState` - step back over the member access so the
  // qualifier, not the dot, decides.
  while (i >= 0 && /[\s]/.test(code[i])) i--;
  if (i >= 0 && code[i] === '.') {
    i--;
    while (i >= 0 && /[\s]/.test(code[i])) i--;
    while (i >= 0 && /[A-Za-z0-9_$]/.test(code[i])) i--;
    while (i >= 0 && /[\s]/.test(code[i])) i--;
  }
  if (i < 0) return true;
  if (';{}'.includes(code[i])) return true;
  // A statement can also follow a line with no terminator (ASI). Treat a
  // newline-only gap as a statement boundary when the previous code character
  // is one that can end an expression.
  const prevIsCloser = /[)\]]/.test(code[i]) || /[A-Za-z0-9_$]/.test(code[i]);
  if (prevIsCloser && code.slice(i + 1, index).includes('\n')) return true;
  return false;
}

const findings = [];
for (const tree of TREES) {
  const root = join(repo, tree);
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    const code = blankNonCode(readFileSync(file, 'utf8'));
    const pattern = /\buseState\s*\(/g;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (!isBareStatement(code, match.index)) continue;
      findings.push({
        file: relative(repo, file),
        line: code.slice(0, match.index).split('\n').length,
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} useState call(s) whose value is discarded:\n`);
  for (const f of findings) console.error(`    ${f.file}:${f.line}`);
  console.error(
    '\n  A useState initializer is not an effect. It runs once, during the first\n' +
      '  render, before any query has resolved - so a callback that reads fetched\n' +
      '  data sees nothing, and one that only needs mount timing should say so with\n' +
      '  useEffect(..., []) rather than leaving a state slot nobody reads.',
  );
  process.exit(1);
}

console.log(`✓ No useState call discards its value across ${TREES.length} client trees.`);
