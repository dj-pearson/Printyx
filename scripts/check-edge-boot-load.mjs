#!/usr/bin/env node
/**
 * check-edge-boot-load.mjs — edge-function boot-load guard (WF-G-01).
 *
 * THE INVARIANT: every supabase/functions/<fn>/index.ts must import cleanly.
 *
 * The Coolify dispatcher (supabase/functions/server.ts:82-99) loads each function
 * with `await import(entry)` inside a try/catch and, on failure, logs to stderr and
 * OMITS the function from its map. Every later request then falls into the
 * "Function not found" branch (:268-278) and answers 404 with the list of the
 * functions that did load. Nothing else reports it: the container is healthy, the
 * health check is green, and if the prefix is not in `crmProxies` then dev is served
 * by Express and the file is never exercised at all.
 *
 * equipment-lifecycle shipped that way (WF-L-01): it imported canTransition,
 * getAvailableTransitions and getValidationRequirements from the shared transitions
 * module AND re-declared all three as local functions. In a module that is a plain
 * JavaScript SyntaxError — "Identifier 'canTransition' has already been declared" —
 * so /api/equipment-lifecycle/* was a permanent 404 in production for the life of
 * the file, while PA-052 recorded two of its endpoints as done.
 *
 * Usage:
 *   node scripts/check-edge-boot-load.mjs                 # static check (CI)
 *   node scripts/check-edge-boot-load.mjs --list          # list what was scanned
 *   node scripts/check-edge-boot-load.mjs --host <url>    # runtime check vs a deploy
 *
 * ── Why this is a static analysis and not `deno check` ──────────────────────────
 * There is no Deno in CI (or in the dev container), and `tsc` cannot typecheck this
 * tree either: tsconfig.json's `include` is client/shared/server only, the edge code
 * imports `npm:` and `https://` specifiers tsc cannot resolve, and a full semantic
 * pass over 285 functions that use `any` everywhere would drown a real finding in
 * thousands of unrelated diagnostics. So this reproduces the three things that
 * actually stop a module from LOADING, using the TypeScript parser only:
 *
 *   A. PARSE — grammar errors in any file reachable from an entrypoint.
 *   B. RESOLVE — a RELATIVE import specifier that names no file on disk. (Bare,
 *      `npm:`, `jsr:`, `node:` and `https:` specifiers are skipped: this script
 *      cannot see the deploy's import map, and guessing would produce noise.)
 *   C. BIND — a top-level identifier bound twice in a way JS forbids, which is what
 *      WF-L-01 was. Type-only declarations (type/interface/`import type`) are erased
 *      before the module runs, so they are not conflicts; duplicate `function`
 *      declarations are legal and are not reported either. What IS reported: any name
 *      given more than one VALUE binding where at least one binding is lexical
 *      (import / const / let / class) — precisely the set that throws at load.
 *
 * The walk is TRANSITIVE, because `await import()` is: a broken file under _shared/
 * takes down every function that imports it, not just itself.
 *
 * BLIND SPOTS, stated so a pass is never read as proof the tree boots: this does not
 * execute module top-level code, so a throw at import time (a missing env var read at
 * module scope, a failing top-level await) is invisible here. Use --host against a
 * running dispatcher for that — /health returns the list it actually loaded.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const hostIdx = args.indexOf('--host');
const HOST = hostIdx !== -1 ? args[hostIdx + 1] : null;

/** Directories the dispatcher will try to load, mirroring server.ts:81-93. */
function deployableFunctions() {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !name.startsWith('_'))
    .filter((name) => {
      const dir = join(FUNCTIONS_DIR, name);
      if (!statSync(dir).isDirectory()) return false;
      const entry = join(dir, 'index.ts');
      return existsSync(entry) && statSync(entry).isFile();
    })
    .sort();
}

// ── Pass B helper: resolve one relative specifier the way Deno does ──────────────
// Deno requires the extension, so the specifier is normally a real path already.
// The fallbacks cover the handful of extensionless imports in the tree.
function resolveRelative(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}.js`,
    join(base, 'index.ts'),
    join(base, 'mod.ts'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const EXTERNAL = /^(npm:|jsr:|node:|https?:|data:)/;

/**
 * Every import/export specifier in a source file that survives to runtime.
 *
 * `import type` / `export type` declarations are skipped: TypeScript erases them
 * before the module runs, so the path they name is never fetched and a wrong one
 * cannot break the boot. (It is still a real defect — conversion-engine.ts imported
 * a type from './vendors/_shared/options', a directory that does not exist — but it
 * belongs to a typecheck, not to this guard, and reporting it here would be a false
 * positive on the one thing this script claims to measure.)
 */
function specifiersOf(sourceFile) {
  const out = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) &&
      !(ts.isExportDeclaration(node) && node.isTypeOnly)
    ) {
      out.push({ text: node.moduleSpecifier.text, pos: node.moduleSpecifier.getStart(sourceFile) });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push({ text: node.arguments[0].text, pos: node.arguments[0].getStart(sourceFile) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

// ── Pass C: top-level value bindings, and which of them are lexical ──────────────
// LEXICAL bindings (import, const, let, class) throw on redeclaration. `var` and
// `function` are hoisted and may repeat among themselves, but still collide with a
// lexical binding of the same name.
function topLevelBindings(sourceFile) {
  /** @type {Map<string, {kind: string, lexical: boolean, line: number}[]>} */
  const bindings = new Map();

  const add = (name, kind, lexical, node) => {
    if (!name) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    if (!bindings.has(name)) bindings.set(name, []);
    bindings.get(name).push({ kind, lexical, line: line + 1 });
  };

  const addFromBindingName = (nameNode, kind, lexical) => {
    if (ts.isIdentifier(nameNode)) {
      add(nameNode.text, kind, lexical, nameNode);
    } else if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
      for (const el of nameNode.elements) {
        if (ts.isBindingElement(el)) addFromBindingName(el.name, kind, lexical);
      }
    }
  };

  for (const stmt of sourceFile.statements) {
    // `declare` is types-only — erased before the module runs.
    const isAmbient = ts.canHaveModifiers(stmt)
      ? (ts.getModifiers(stmt) ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
      : false;
    if (isAmbient) continue;

    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause;
      if (!clause || clause.isTypeOnly) continue; // `import type` is erased
      if (clause.name) add(clause.name.text, 'import', true, clause.name);
      const nb = clause.namedBindings;
      if (nb) {
        if (ts.isNamespaceImport(nb)) {
          add(nb.name.text, 'import', true, nb.name);
        } else {
          for (const el of nb.elements) {
            if (el.isTypeOnly) continue; // `import { type X }` is erased
            add(el.name.text, 'import', true, el.name);
          }
        }
      }
    } else if (ts.isVariableStatement(stmt)) {
      const flags = stmt.declarationList.flags;
      const isLexical = !!(flags & (ts.NodeFlags.Const | ts.NodeFlags.Let));
      const kind = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
      for (const d of stmt.declarationList.declarations)
        addFromBindingName(d.name, kind, isLexical);
    } else if (ts.isFunctionDeclaration(stmt)) {
      if (!stmt.body) continue; // overload signature — no runtime binding
      if (stmt.name) add(stmt.name.text, 'function', false, stmt.name);
    } else if (ts.isClassDeclaration(stmt)) {
      if (stmt.name) add(stmt.name.text, 'class', true, stmt.name);
    } else if (ts.isEnumDeclaration(stmt)) {
      // A const enum is erased; a plain enum creates a real binding.
      const isConstEnum = (ts.getModifiers(stmt) ?? []).some(
        (m) => m.kind === ts.SyntaxKind.ConstKeyword,
      );
      if (!isConstEnum && stmt.name) add(stmt.name.text, 'enum', true, stmt.name);
    }
    // interface / type alias / module declarations: erased, never a runtime conflict.
  }

  const conflicts = [];
  for (const [name, decls] of bindings) {
    if (decls.length < 2) continue;
    // Legal: repeated `function`/`var` among themselves.
    if (!decls.some((d) => d.lexical)) continue;
    conflicts.push({ name, decls });
  }
  return conflicts;
}

// ── The walk ────────────────────────────────────────────────────────────────────
const failures = []; // { fn, file, pass, message }
const scanned = new Set();
const fileCache = new Map();

function parse(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  fileCache.set(file, sf);
  return sf;
}

function checkFile(fn, file, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  scanned.add(file);

  const rel = relative(ROOT, file);
  let sf;
  try {
    sf = parse(file);
  } catch (e) {
    failures.push({ fn, file: rel, pass: 'parse', message: `unreadable: ${e.message}` });
    return;
  }

  // A. PARSE
  for (const d of sf.parseDiagnostics ?? []) {
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    failures.push({
      fn,
      file: rel,
      pass: 'parse',
      message: `${rel}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
    });
  }

  // C. BIND
  for (const c of topLevelBindings(sf)) {
    const where = c.decls.map((d) => `${d.kind} at line ${d.line}`).join(', ');
    failures.push({
      fn,
      file: rel,
      pass: 'bind',
      message: `${rel}: '${c.name}' is declared more than once at module scope (${where}) — "Identifier '${c.name}' has already been declared" at load`,
    });
  }

  // B. RESOLVE, then recurse
  for (const spec of specifiersOf(sf)) {
    if (EXTERNAL.test(spec.text)) continue;
    if (!spec.text.startsWith('.')) continue; // bare specifier — import map, not ours to judge
    const target = resolveRelative(file, spec.text);
    if (!target) {
      const { line } = sf.getLineAndCharacterOfPosition(spec.pos);
      failures.push({
        fn,
        file: rel,
        pass: 'resolve',
        message: `${rel}:${line + 1} imports '${spec.text}', which resolves to no file on disk`,
      });
      continue;
    }
    checkFile(fn, target, seen);
  }
}

async function runtimeCheck(host) {
  const base = host.replace(/\/+$/, '');
  const url = `${base}/health`;
  let payload;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ${url} answered ${res.status} ${res.statusText}`);
      process.exit(1);
    }
    payload = await res.json();
  } catch (e) {
    console.error(`✗ could not reach ${url}: ${e.message}`);
    process.exit(1);
  }

  const loaded = new Set(payload.functions ?? []);
  const onDisk = deployableFunctions();
  const missing = onDisk.filter((f) => !loaded.has(f));
  const extra = [...loaded].filter((f) => !onDisk.includes(f));

  if (extra.length > 0) {
    console.log(
      `note: ${extra.length} function(s) loaded on the host but absent from this checkout ` +
        `(the deploy is ahead of, or behind, this tree): ${extra.join(', ')}`,
    );
  }

  if (missing.length > 0) {
    console.error(
      `✗ ${missing.length} of ${onDisk.length} function(s) failed to load on ${base}:\n`,
    );
    for (const m of missing) console.error(`  ${m}`);
    console.error(
      `\nThe dispatcher swallows an import failure and omits the function, so every\n` +
        `request to it answers 404 "Function not found". Check the container's boot log\n` +
        `for the matching "❌ Failed to load <fn>" line.\n`,
    );
    process.exit(1);
  }

  console.log(`✓ all ${onDisk.length} on-disk function(s) are loaded on ${base}`);
}

if (HOST) {
  await runtimeCheck(HOST);
} else {
  const fns = deployableFunctions();
  for (const fn of fns) checkFile(fn, join(FUNCTIONS_DIR, fn, 'index.ts'), new Set());

  if (LIST) {
    console.log(
      `${fns.length} deployable function(s); ${scanned.size} file(s) in the import graph`,
    );
    for (const fn of fns) console.log(`  ${fn}`);
  }

  if (failures.length > 0) {
    const broken = [...new Set(failures.map((f) => f.fn))];
    console.error(
      `✗ ${broken.length} edge function(s) will not import cleanly (${failures.length} problem(s)):\n`,
    );
    for (const fn of broken) {
      console.error(`  ${fn}`);
      for (const f of failures.filter((x) => x.fn === fn)) {
        console.error(`    [${f.pass}] ${f.message}`);
      }
    }
    console.error(
      `\nsupabase/functions/server.ts loads each function with await import() inside a\n` +
        `try/catch and omits the ones that throw, so every request to a function listed\n` +
        `above answers 404 "Function not found" in production — silently, and invisibly\n` +
        `in dev when the prefix is served by Express instead.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓ all ${fns.length} edge function(s) import cleanly (${scanned.size} files in the graph).`,
  );
}
