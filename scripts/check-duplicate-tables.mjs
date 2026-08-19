#!/usr/bin/env node
// Duplicate physical-table ratchet.
//
// Two Drizzle schemas that declare pgTable('same_name', ...) with DIFFERENT
// columns are describing one physical table two incompatible ways. Nothing in
// the type system objects: each file compiles, and `shared/schema.ts` re-exports
// both, so an explicit named re-export silently decides which definition every
// consumer of `@shared/schema` actually gets.
//
// This is not hypothetical. blog_posts is declared by BOTH
// content-marketing-schema.ts and blog-schema.ts. Migration 0000 (journaled,
// always applied) creates it with the content-marketing shape; the hand-run
// _backfill_blog_tables.sql creates the blog-schema shape with CREATE TABLE IF
// NOT EXISTS, so it is skipped in silence — leaving the US-BLOG platform-admin
// blog system querying columns (body_markdown, brief_id, cms_target_key, ...)
// that do not exist on the table it actually hits.
//
// Shrink the baseline, never grow it:
//   node scripts/check-duplicate-tables.mjs --update-baseline

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const sharedDir = join(repo, 'shared');
const baselinePath = join(repo, 'docs', 'duplicate-tables-baseline.json');

const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

// `shared/schema.ts` is the aggregator that re-exports the others, so it is not
// itself a declaration site.
const files = readdirSync(sharedDir).filter((f) => f.endsWith('.ts') && f !== 'schema.ts');

const byTable = new Map();
for (const file of files) {
  const src = stripComments(readFileSync(join(sharedDir, file), 'utf8'));
  for (const m of src.matchAll(
    /export const (\w+)\s*=\s*pgTable\(\s*\n?\s*['"]([a-z0-9_]+)['"]/g,
  )) {
    const [, exportName, table] = m;
    const line = src.slice(0, m.index).split('\n').length;
    if (!byTable.has(table)) byTable.set(table, []);
    byTable.get(table).push({ file, exportName, line });
  }
}

const dupes = [];
for (const [table, sites] of byTable) {
  const distinctFiles = [...new Set(sites.map((s) => s.file))];
  if (distinctFiles.length < 2) continue;
  dupes.push({ table, sites, id: `${table} :: ${distinctFiles.slice().sort().join('|')}` });
}
dupes.sort((a, b) => a.id.localeCompare(b.id));

if (list) {
  console.log(`${dupes.length} physical table(s) declared in more than one schema file:\n`);
  for (const d of dupes) {
    console.log(`  ${d.table}`);
    for (const s of d.sites) console.log(`      shared/${s.file}:${s.line}  ${s.exportName}`);
  }
  process.exit(0);
}

if (update) {
  const allowed = dupes.map((d) => d.id).sort();
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note: 'Duplicate physical-table ratchet. scripts/check-duplicate-tables.mjs fails CI when a table name is newly declared by two different shared/*.ts Drizzle schemas. Both compile, shared/schema.ts re-exports both, and an explicit named re-export silently decides which definition consumers of @shared/schema receive — while only one shape can exist in the database. Run with --list to see the declaration sites. Shrink this list, never grow it: node scripts/check-duplicate-tables.mjs --update-baseline',
        allowed,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${allowed.length} duplicated table(s) recorded.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing baseline ${baselinePath}. Create it with --update-baseline.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const added = dupes.filter((d) => !allowed.has(d.id));
const current = new Set(dupes.map((d) => d.id));
const resolved = [...allowed].filter((k) => !current.has(k));

if (added.length > 0) {
  console.error(`✗ ${added.length} table(s) newly declared by two different schema files:`);
  for (const d of added) {
    console.error(`    ${d.table}`);
    for (const s of d.sites) console.error(`      shared/${s.file}:${s.line}  ${s.exportName}`);
  }
  console.error(
    '  Only one shape can exist in the database. Rename one table, or make one schema the owner.',
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(`✓ No new duplicate tables. ${resolved.length} baselined entr(y/ies) now resolve:`);
  for (const k of resolved) console.log(`    ${k}`);
  console.log('  Tighten with: node scripts/check-duplicate-tables.mjs --update-baseline');
} else {
  console.log(`✓ No new duplicate table declarations (${allowed.size} baselined).`);
}
