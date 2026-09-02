/**
 * Duplicate keys in an object literal, across supabase/functions.
 *
 * WHY THIS TREE AND NOT THE WHOLE REPO. Everything under supabase/functions is
 * checked by no typechecker and no linter. tsconfig does not include it, and
 * `deno check` / `deno lint` appear in no CI workflow and no npm script - the
 * eslint config ignores the directory outright, with a comment pointing at deno
 * as the thing that covers it. Nothing does. So a grammar-level mistake TS
 * reports as TS1117 in any other file survives here indefinitely, in 273 edge
 * functions that are the entire production backend.
 *
 * WHAT IT COSTS WHEN IT SURVIVES. AUDIT-037 found this in the deleted
 * client-metrics heartbeat:
 *
 *     .update({
 *       last_heartbeat: new Date().toISOString(),
 *       last_heartbeat: { timestamp, version, device_count, status },
 *     })
 *
 * The second wins, so it wrote an object into a timestamp column. No other
 * guard here can see it: check:phantom-cols is satisfied because both names are
 * the same REAL column, and the value is not a column name at all.
 *
 * The check uses the TypeScript parser rather than a regex, because getting
 * nesting, computed keys and spreads right by pattern-matching is not something
 * to trust on a hard gate. Only literal keys are compared - an identifier, a
 * string or a number. A computed key is skipped: `[k]: 1, [j]: 1` may or may not
 * collide and the parser cannot say which.
 *
 * A getter and a setter for the same name are legal and are not reported. Two
 * getters are not, and neither is a property beside an accessor.
 *
 * Hard gate at zero. If a duplicate is ever deliberate - it is not, in an
 * object handed to PostgREST - delete one of them instead of baselining it.
 */
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const repo = join(import.meta.dirname, '..');
const root = join(repo, 'supabase', 'functions');

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

type Finding = { file: string; line: number; key: string; firstLine: number };

/** An accessor pair (get x / set x) is legal; anything else repeating is not. */
function kindOf(p: ts.ObjectLiteralElementLike): 'get' | 'set' | 'value' | null {
  if (ts.isGetAccessorDeclaration(p)) return 'get';
  if (ts.isSetAccessorDeclaration(p)) return 'set';
  if (
    ts.isPropertyAssignment(p) ||
    ts.isShorthandPropertyAssignment(p) ||
    ts.isMethodDeclaration(p)
  ) {
    return 'value';
  }
  return null; // spread
}

function literalKey(p: ts.ObjectLiteralElementLike): string | null {
  const name = p.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null; // computed
}

const files = walk(root);
const findings: Finding[] = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rel = relative(repo, file);

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Map<string, { line: number; kinds: Set<string> }>();
      for (const prop of node.properties) {
        const kind = kindOf(prop);
        if (!kind) continue;
        const key = literalKey(prop);
        if (key === null) continue;
        const line = sf.getLineAndCharacterOfPosition(prop.getStart(sf)).line + 1;
        const prev = seen.get(key);
        if (!prev) {
          seen.set(key, { line, kinds: new Set([kind]) });
          continue;
        }
        const legalAccessorPair =
          (kind === 'get' && prev.kinds.has('set') && !prev.kinds.has('get')) ||
          (kind === 'set' && prev.kinds.has('get') && !prev.kinds.has('set'));
        if (legalAccessorPair) {
          prev.kinds.add(kind);
          continue;
        }
        findings.push({ file: rel, line, key, firstLine: prev.line });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (findings.length === 0) {
  console.log(
    `\n✓ No duplicate object-literal keys in supabase/functions (${files.length} file(s)).`,
  );
  process.exit(0);
}

console.error(`\n✗ ${findings.length} duplicate object-literal key(s) in supabase/functions:\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  '${f.key}' — already set at line ${f.firstLine}`);
}
console.error(
  '\n  The later value silently wins. Delete one of them; do not baseline a duplicate key.\n',
);
process.exit(1);
