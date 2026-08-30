#!/usr/bin/env node
/**
 * Server-side orphaned-file ratchet.
 *
 * check:orphan-files answers "can a user reach this file?" for client/src and
 * has paid for itself repeatedly. The server had no equivalent, and the cost of
 * that shows up over and over:
 *
 *   - Ten *-reporting-service.ts files, 5,839 lines, that nothing imported and
 *     that supabase/functions/reports/ had explicitly superseded.
 *   - server/services/team-alert-service.ts, 629 lines over four real tables,
 *     with no route, no cron and no importer.
 *   - server/middleware/security-index.ts, which is the ONLY thing that mounts
 *     session-timeout, ip-whitelist and mfa-enforcement - and which nothing
 *     imports, so three security controls are written and never applied.
 *
 * Each was found by hand, by grepping for importers, and each walk was thrown
 * away afterwards. That is exactly the history AUDIT-018 records for the client
 * side before check:orphan-files existed.
 *
 * TRANSITIVE REACHABILITY IS THE WHOLE POINT. session-timeout.ts has an
 * importer, so a one-level grep says it is used. Its importer is security-index,
 * which has none. Only a walk from the real entry point answers this.
 *
 * THE ROOT is server/index.ts - the process entry. Everything the server runs
 * is reachable from it, through registerRoutes and the registry.
 *
 * DYNAMIC MOUNTS ARE COLLECTED HEURISTICALLY. routes-registry.ts mounts a dozen
 * routers through `for (const [path, mod] of table) await import(mod)`, where
 * the specifier is a VARIABLE - a scan for import(' would miss every one. So in
 * any file containing a dynamic import(, every relative-looking string literal
 * is treated as a possible specifier. That over-approximates reachability,
 * which is the safe direction: this guard should never call a live file dead.
 *
 * WHAT IT CANNOT SEE, so a pass is never read as proof:
 *   - A specifier assembled at runtime from a non-literal.
 *   - Reachable-but-never-mounted: a router imported by the registry and never
 *     app.use()d passes this check. That is check:shadowed-express' and
 *     check:routes' job.
 *   - Whether a reached file's handlers can actually run - a router whose only
 *     identity source is req.session.user is reachable AND answers 401
 *     (SEC-SESSION-001).
 *
 * TEST-ONLY FILES ARE MARKED, NOT EXCUSED, matching the client ratchet: source
 * reached only from server/tests is dead product code that cannot be deleted
 * without touching a test, which is a different remedy.
 *
 *   node scripts/check-server-orphans.mjs
 *   node scripts/check-server-orphans.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SERVER = join(ROOT, 'server');
const BASELINE = join(ROOT, 'docs', 'server-orphans-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const ENTRY = join(SERVER, 'index.ts');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js'];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function resolveSpecifier(specifier, fromFile) {
  let base;
  if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else if (specifier.startsWith('@shared/')) {
    base = join(ROOT, 'shared', specifier.slice('@shared/'.length));
  } else if (specifier.startsWith('@server/')) {
    base = join(SERVER, specifier.slice('@server/'.length));
  } else {
    return null; // a package
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function specifiersIn(source) {
  const out = new Set();
  for (const m of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) out.add(m[1]);
  for (const m of source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) out.add(m[1]);
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.add(m[1]);
  for (const m of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) out.add(m[1]);
  // Dynamic mounts: the registry holds specifiers in arrays and imports them
  // through a variable, so any relative string literal in such a file counts.
  if (/\bimport\(\s*[A-Za-z_$]/.test(source)) {
    for (const m of source.matchAll(/['"](\.\.?\/[^'"]+)['"]/g)) out.add(m[1]);
  }
  return out;
}

function walk(roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let source;
    try {
      source = stripComments(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const specifier of specifiersIn(source)) {
      const resolved = resolveSpecifier(specifier, file);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

function allServerSources() {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        visit(full);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
        files.push(full);
      }
    }
  };
  visit(SERVER);
  return files;
}

const reachable = walk([ENTRY]);

// A second walk from the test tree, to mark test-only files rather than excuse
// them - source reached only from a test is dead product code with a different
// remedy, exactly as the client ratchet treats it.
const testRoots = allServerSources().filter((f) => f.includes(`${'tests'}/`));
const reachableFromTests = walk(testRoots);

const orphans = [];
for (const file of allServerSources()) {
  if (reachable.has(file)) continue;
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('server/tests/')) continue; // tests are roots, not orphans
  orphans.push(reachableFromTests.has(file) ? `${rel} (test-only)` : rel);
}
orphans.sort();

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'server/*.ts files not reachable from server/index.ts by any static or dynamic import. ' +
          'Dead product code: it cannot run. "(test-only)" marks a file reached only from ' +
          'server/tests, which is dead product code a test still pins. A TODO list, not settled ' +
          'debt - each entry is wire it, delete it, or record why it is loaded some other way. ' +
          'See scripts/check-server-orphans.mjs.',
        total: orphans.length,
        orphans,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${orphans.length} unreachable server file(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).orphans ?? [])
  : new Set();

const added = orphans.filter((f) => !baseline.has(f));
if (added.length > 0) {
  console.error(`✗ ${added.length} NEW server file(s) nothing can reach:\n`);
  for (const file of added) console.error(`    ${file}`);
  console.error(
    '\nNothing imports these from server/index.ts, so none of it runs. Wire it, delete it,\n' +
      'or record why it loads another way:\n' +
      '    node scripts/check-server-orphans.mjs --update-baseline',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((f) => !orphans.includes(f));
if (fixed.length > 0) {
  console.log(
    `✓ No new server orphans. ${fixed.length} baselined entr(ies) resolved.\n` +
      '  Tighten with: node scripts/check-server-orphans.mjs --update-baseline',
  );
} else {
  console.log(`✓ No new server orphans (${orphans.length} baselined).`);
}
