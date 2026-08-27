#!/usr/bin/env node
/**
 * QUALITY-002: `db.query.<table>` for a table that is not in the drizzle
 * relational schema.
 *
 * db is constructed as drizzle({ client, schema }) with `schema` being
 * shared/schema.ts, so db.query only carries the tables that file exports. Ask
 * for one it does not and you get `undefined`, and the very next `.findFirst`
 * throws "Cannot read properties of undefined". tsc does report it, but as one
 * TS2339 among hundreds in a 470-error backlog it reads as type noise rather
 * than as an endpoint that cannot return 200.
 *
 * It has cost real features. shared/gdpr-core-schema.ts was not re-exported at
 * all, so every relational read in contact-deduplication-service,
 * consent-management-service and dpa-management-service threw;
 * shared/lead-scoring-schema.ts likewise, which is how auto-lead-routing-service
 * ended up importing the platform_* tables of similar names instead; and
 * shared/accessibility-schema.ts, which took out /api/accessibility.
 *
 * Deliberately narrow: it judges db.query only. db.select().from(table) works
 * whether or not the table is registered, so an unregistered table is not by
 * itself a defect and 77 of them are not reported here.
 */
import fs from 'node:fs';
import path from 'node:path';

const SHARED = 'shared';
const ROOTS = ['server'];

const main = fs.readFileSync(path.join(SHARED, 'schema.ts'), 'utf8');
// `export * from './x'` registers everything x declares.
const starred = new Set(
  [...main.matchAll(/export \* from '\.\/([\w-]+)'/g)].map((m) => `${m[1]}.ts`),
);

const registered = new Set();
for (const file of fs.readdirSync(SHARED).filter((f) => f.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join(SHARED, file), 'utf8');
  for (const m of source.matchAll(/^export const (\w+) = pgTable\(/gm)) {
    const name = m[1];
    const namedExport = new RegExp(`(^|[\\s,{])${name}([\\s,}]|$)`, 'm');
    if (file === 'schema.ts' || starred.has(file) || namedExport.test(main)) registered.add(name);
  }
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|dist|\.git/.test(p)) walk(p);
    } else if (p.endsWith('.ts') && !p.endsWith('.example.ts')) {
      // .example.ts is illustration, not a code path.
      files.push(p);
    }
  }
})(ROOTS[0]);

/** Strip comments so a db.query.x written INSIDE an explanatory note (several
 *  of these files carry one) is not reported as a live call. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const findings = [];
for (const file of files) {
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  for (const m of source.matchAll(/\bdb\.query\.(\w+)/g)) {
    if (registered.has(m[1])) continue;
    const line = source.slice(0, m.index).split('\n').length;
    findings.push({ file, line, table: m[1] });
  }
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} db.query call(s) on a table the relational schema has no:\n`);
  for (const f of findings) console.error(`    ${f.file}:${f.line}  db.query.${f.table}`);
  console.error(
    '\n  db.query only carries what shared/schema.ts exports, so each of these is\n' +
      '  undefined at runtime and the .findFirst/.findMany after it throws.\n' +
      '  Either re-export the table from shared/schema.ts (which is what the\n' +
      '  relational API needs), or use db.select().from(table), which does not.\n',
  );
  process.exit(1);
}

console.log(`✓ Every db.query call names a registered table (${registered.size} registered).`);
