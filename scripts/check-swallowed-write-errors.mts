/**
 * A write that reports success and saves nothing (AUDIT-038).
 *
 * PostgREST does not throw. `await admin.from('t').insert(row)` resolves to
 * `{ data, error }` whether the row landed or the table does not exist, so a
 * handler that never looks at `error` carries on and answers 200. The caller is
 * told it saved. Nothing did.
 *
 * A TRY/CATCH AROUND A POSTGREST CALL IS EVIDENCE OF NOTHING, and this is the
 * part that makes the shape hard to see by eye. public-booking wrapped five
 * linkCrm steps in `catch { /* ignore *\/ }`, which reads as considered
 * tolerance - deliberately not failing a booking because a CRM link failed. It
 * tolerated something else entirely: the catch can only fire on a network
 * fault, and the real failure came back in an `error` nobody destructured. A
 * linkage failing on every booking was indistinguishable from a booking with
 * nothing to link. So a surrounding try/catch is not counted as surfacing.
 *
 * WHY THE TYPESCRIPT PARSER AND NOT A LINE WINDOW (AC1). A fixed window after
 * the destructure bleeds into the next statement. supabase/functions/import/
 * index.ts destructures `{ count }` off a SELECT and the statement after it is
 * an `.update(...)`, so a window-based first cut reported a READ as a swallowed
 * write. The binding has to be attached to its own call chain, which means
 * walking it.
 *
 * WHAT COUNTS AS SURFACED (AC3), stated so a passing run is not read as more
 * than it is. The error identifier has to appear somewhere it can change what
 * the caller sees or what an operator reads:
 *
 *   - tested in a condition (`if (error)`, `error ? ... : ...`, `!error`)
 *   - thrown, or returned in a response
 *   - passed to console.* / a logger
 *   - read for .message / .code / .details / .hint
 *   - assigned to something outside the block (a collected-failures array)
 *
 * A LOGGED-AND-CONTINUED ERROR IN A PER-ROW LOOP counts as surfaced, because
 * partial success is a real design - but only halfway. Logging tells an
 * operator; it does not tell the caller. A response reporting
 * `{ processed: 12 }` with no failure count is still claiming twelve rows
 * landed. This guard cannot see that far (it would have to model the response
 * body), so a logged error passes here and the reviewer still owes the
 * question: does the RESPONSE distinguish the failures? client-metrics answered
 * `{ success: true, received: 12, processed: 0 }` and that is the shape to
 * recognise.
 *
 * SCOPE IS WRITES ONLY (AC2). A read falling back to `[]` is frequently
 * deliberate - `check:phantom-cols` documents the empty-dashboard failure mode
 * that comes of it, and that is a different story. A write reporting success
 * while failing is never right.
 *
 * OVERLAP WITH check:phantom-tables (AC6). That guard's swallow rule keys on
 * the 42P01/PGRST205 literal, so it only sees a handler that TESTED the error
 * and chose to ignore a missing relation. A handler that discards the error
 * entirely slips past it - which is how client-metrics' write to
 * `discovered_devices` (the table is client_discovered_devices) avoided a hard
 * gate. This guard is the half that sees those.
 *
 * Shrink-only ratchet, keyed by file + table + write method rather than line
 * number, so moving code does not churn the baseline. The baseline is a TODO
 * list, not settled debt.
 */
import ts from 'typescript';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const repo = join(import.meta.dirname, '..');
const root = join(repo, 'supabase', 'functions');
const BASELINE = join(repo, 'docs', 'swallowed-write-errors-baseline.json');
const UNREFERENCED = join(repo, 'docs', 'unreferenced-edge-fns-baseline.json');

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

type Finding = {
  key: string;
  file: string;
  line: number;
  table: string;
  method: string;
  reason: 'no-error-binding' | 'error-never-surfaced' | 'result-discarded';
};

/**
 * Walk a call chain back to its root, collecting the method names called on it
 * and the first string argument handed to `.from(...)`.
 */
function describeChain(expr: ts.Expression): { methods: string[]; table: string } | null {
  const methods: string[] = [];
  let table = '?';
  let node: ts.Node = expr;

  while (true) {
    if (ts.isAwaitExpression(node)) {
      node = node.expression;
      continue;
    }
    if (ts.isParenthesizedExpression(node)) {
      node = node.expression;
      continue;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const name = callee.name.text;
        methods.push(name);
        if (name === 'from' && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
          table = node.arguments[0].text;
        }
        node = callee.expression;
        continue;
      }
      node = callee;
      continue;
    }
    if (ts.isPropertyAccessExpression(node)) {
      node = node.expression;
      continue;
    }
    break;
  }
  return methods.length ? { methods, table } : null;
}

/** Whether an initializer is (or wraps) an await - i.e. it is a RESULT, not a builder. */
function isAwaited(expr: ts.Expression): boolean {
  let node: ts.Node = expr;
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isAwaitExpression(node)) return true;
  // `db.from('t').insert(row).then(...)` is a result too.
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    return node.expression.name.text === 'then';
  }
  return false;
}

/**
 * How the error can be reached from this declaration, if at all.
 *
 * Two bindings are in use across this tree and only one of them destructures:
 *
 *   const { data, error } = await db.from('t').insert(row);   -> 'error'
 *   const res = await db.from('t').insert(row); if (res.error) -> 'res', member
 *
 * The second was 41 of the first cut's 112 findings and every one of them was a
 * false positive - `insertLineItemRows` in proposals, the stage insert in
 * pipeline-config, the stage-change update in sales-pipeline, all of which test
 * the error one line later. Sampling by hand is what caught it (AC4); the count
 * alone looked plausible.
 */
type ErrorAccess =
  | { kind: 'destructured'; name: string }
  | { kind: 'result'; name: string }
  | { kind: 'none' };

function errorAccess(pattern: ts.BindingName): ErrorAccess {
  if (ts.isIdentifier(pattern)) return { kind: 'result', name: pattern.text };
  if (!ts.isObjectBindingPattern(pattern)) return { kind: 'none' };
  for (const el of pattern.elements) {
    const source = el.propertyName ?? el.name;
    const label = ts.isIdentifier(source) ? source.text : null;
    if (label === 'error' && ts.isIdentifier(el.name)) {
      return { kind: 'destructured', name: el.name.text };
    }
    // `const { data, ...rest } = ...` keeps the error reachable through rest.
    if (el.dotDotDotToken && ts.isIdentifier(el.name)) {
      return { kind: 'result', name: el.name.text };
    }
  }
  return { kind: 'none' };
}

/** Whether `<name>.error` is read anywhere in scope after the declaration. */
function readsErrorMember(
  name: string,
  scope: ts.Node,
  declEnd: number,
  sf: ts.SourceFile,
): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name &&
      node.name.text === 'error' &&
      node.getStart(sf) > declEnd
    ) {
      found = true;
      return;
    }
    // Destructured later: `const { error } = res;`
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === name &&
      ts.isObjectBindingPattern(node.name) &&
      errorAccess(node.name).kind !== 'none'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

const SURFACING_MEMBERS = new Set(['message', 'code', 'details', 'hint', 'status']);

/**
 * Whether `name` is used somewhere that can change what the caller sees or what
 * an operator reads. Deliberately generous: this guard exists to find writes
 * that look at the error NOWHERE, and a false finding on a hard-to-read
 * surfacing costs more than a miss.
 */
function isSurfaced(name: string, scope: ts.Node, declEnd: number, sf: ts.SourceFile): boolean {
  let surfaced = false;

  const visit = (node: ts.Node): void => {
    if (surfaced) return;
    if (ts.isIdentifier(node) && node.text === name && node.getStart(sf) > declEnd) {
      const parent = node.parent;

      // error.message / error.code / ...
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
        if (SURFACING_MEMBERS.has(parent.name.text)) surfaced = true;
        else surfaced = true; // any member read is a look at the error
        return;
      }
      // if (error) / !error / error ? a : b / error && ... / error === null
      if (
        ts.isIfStatement(parent) ||
        ts.isConditionalExpression(parent) ||
        ts.isPrefixUnaryExpression(parent) ||
        ts.isBinaryExpression(parent) ||
        ts.isWhileStatement(parent)
      ) {
        surfaced = true;
        return;
      }
      // throw error / return error / f(error) / [...errors, error] / {error}
      if (
        ts.isThrowStatement(parent) ||
        ts.isReturnStatement(parent) ||
        ts.isCallExpression(parent) ||
        ts.isArrayLiteralExpression(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isShorthandPropertyAssignment(parent) ||
        ts.isTemplateSpan(parent) ||
        ts.isSpreadElement(parent) ||
        ts.isVariableDeclaration(parent)
      ) {
        surfaced = true;
        return;
      }
      // Anything else that mentions it at all - be generous.
      surfaced = true;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(scope);
  return surfaced;
}

function enclosingScope(node: ts.Node): ts.Node {
  let cur: ts.Node = node;
  while (cur.parent) {
    const p = cur.parent;
    if (
      ts.isBlock(p) ||
      ts.isSourceFile(p) ||
      ts.isCaseClause(p) ||
      ts.isDefaultClause(p) ||
      ts.isModuleBlock(p)
    ) {
      return p;
    }
    cur = p;
  }
  return node.getSourceFile();
}

const files = walk(root);
const findings: Finding[] = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rel = relative(repo, file).split('\\').join('/');
  const builderVars = new Map<string, { methods: string[]; table: string }>();

  const visit = (node: ts.Node): void => {
    // A DECLARATION WHOSE INITIALIZER IS AWAITED. A builder assigned without
    // await is not a result and must not be reported: deals/index.ts builds
    // `let query = admin.from('crm_associations').delete()...`, adds a filter,
    // and awaits it three lines later into `{ data, error }`. The first cut
    // called that a swallowed write. The await site below catches the real one.
    if (ts.isVariableDeclaration(node) && node.initializer && isAwaited(node.initializer)) {
      const chain = describeChain(node.initializer);
      if (chain) {
        const writeMethod = chain.methods.find((m) => WRITE_METHODS.has(m));
        // `.delete()` also names an array method and a Map method; require the
        // chain to be a PostgREST one, i.e. to carry a .from(...).
        if (writeMethod && chain.methods.includes('from')) {
          const access = errorAccess(node.name);
          const scope = enclosingScope(node);
          let reason: Finding['reason'] | null = null;
          if (access.kind === 'none') {
            reason = 'no-error-binding';
          } else if (access.kind === 'result') {
            if (!readsErrorMember(access.name, scope, node.getEnd(), sf)) {
              reason = 'no-error-binding';
            }
          } else if (!isSurfaced(access.name, scope, node.getEnd(), sf)) {
            reason = 'error-never-surfaced';
          }
          if (reason) {
            findings.push({
              key: `${rel}::${chain.table}::${writeMethod}`,
              file: rel,
              line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
              table: chain.table,
              method: writeMethod,
              reason,
            });
          }
        }
      }
    }
    // AN AWAITED WRITE WHOSE RESULT IS DISCARDED ENTIRELY. `await
    // admin.from('lead_assignment_history').insert(rows);` as a statement is
    // the strictest form of this defect - there is no binding to look at, so
    // nothing can ever have looked. sales-rep-assignments does it twice in one
    // function: a bulk territory reassignment and the history rows that record
    // it, both of which can fail without anyone finding out.
    if (ts.isExpressionStatement(node) && ts.isAwaitExpression(node.expression)) {
      const chain = describeChain(node.expression);
      const viaBuilder = ts.isIdentifier(node.expression.expression)
        ? builderVars.get(node.expression.expression.text)
        : undefined;
      const resolved = chain?.methods.includes('from') ? chain : viaBuilder;
      const writeMethod = resolved?.methods.find((m) => WRITE_METHODS.has(m));
      if (resolved && writeMethod) {
        findings.push({
          key: `${rel}::${resolved.table}::${writeMethod}`,
          file: rel,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          table: resolved.table,
          method: writeMethod,
          reason: 'result-discarded',
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  // Builder variables: `let upd = admin.from('t').update({...})` with no await.
  // Collected before the main walk so `await upd;` can resolve what it writes.
  const collectBuilders = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer && !isAwaited(node.initializer)) {
      const chain = describeChain(node.initializer);
      if (chain?.methods.includes('from') && chain.methods.some((m) => WRITE_METHODS.has(m))) {
        if (ts.isIdentifier(node.name)) builderVars.set(node.name.text, chain);
      }
    }
    ts.forEachChild(node, collectBuilders);
  };
  collectBuilders(sf);

  visit(sf);
}

const updating = process.argv.includes('--update-baseline');
const listing = process.argv.includes('--list');

let baseline: string[] = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? [];
} catch {
  baseline = [];
}

let unreferenced = new Set<string>();
try {
  const raw = JSON.parse(readFileSync(UNREFERENCED, 'utf8'));
  const names: string[] = Array.isArray(raw)
    ? raw
    : (raw.unreferenced ?? raw.functions ?? raw.entries ?? []);
  unreferenced = new Set(names.map((n: string) => String(n).replace(/^supabase\/functions\//, '')));
} catch {
  /* the cross-reference is a convenience, not a requirement */
}

const reachable = (f: Finding) => {
  const dir = f.file.split('/')[2];
  return !unreferenced.has(dir);
};

const keys = [...new Set(findings.map((f) => f.key))].sort();

if (updating) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'AUDIT-038. PostgREST returns { data, error } instead of throwing, so a write ' +
          'whose error is never read answers 200 while saving nothing. Shrink-only: keyed ' +
          'by file + table + write method, not line. This is a TODO list, not settled debt - ' +
          'work the entries in functions something actually calls first.',
        generatedBy: 'npm run check:swallowed-writes -- --update-baseline',
        count: keys.length,
        entries: keys,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline written: ${keys.length} entr(ies).`);
  process.exit(0);
}

if (listing) {
  const sorted = [...findings].sort(
    (a, b) => Number(reachable(b)) - Number(reachable(a)) || a.file.localeCompare(b.file),
  );
  for (const f of sorted) {
    console.log(
      `${reachable(f) ? 'REACHABLE  ' : 'no-caller  '}${f.file}:${f.line}  ${f.table}.${f.method}()  ${f.reason}`,
    );
  }
  console.log(
    `\n${findings.length} site(s); ${findings.filter(reachable).length} in functions a client tree calls.`,
  );
  process.exit(0);
}

const known = new Set(baseline);
const added = keys.filter((k) => !known.has(k));
const fixed = baseline.filter((k) => !keys.includes(k));

if (added.length) {
  console.error(`\n✗ ${added.length} new swallowed write error(s) in supabase/functions:\n`);
  for (const key of added) {
    const f = findings.find((x) => x.key === key)!;
    console.error(`  ${f.file}:${f.line}  ${f.table}.${f.method}()  ${f.reason}`);
  }
  console.error(
    '\n  PostgREST returns { data, error } rather than throwing, so this answers 200 while\n' +
      '  saving nothing. Read the error and let the caller know. A surrounding try/catch\n' +
      '  does not count - it can only fire on a network fault.\n',
  );
  process.exit(1);
}

console.log(
  `check:swallowed-writes - ${files.length} edge files, ${keys.length} write site(s) ` +
    `do not surface their PostgREST error (baseline ${baseline.length}` +
    `${fixed.length ? `, ${fixed.length} fixed - tighten with --update-baseline` : ''}).`,
);
