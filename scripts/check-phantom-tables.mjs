#!/usr/bin/env node
/**
 * Phantom table checker (PROD-008b, hardened by WF-G-02).
 *
 * check:phantom-cols verifies the COLUMNS an edge function names. Nothing
 * verified the TABLE. That gap cost the notification bell: the notifications
 * edge function queried `.from('notifications')`, a relation in no Drizzle
 * schema and no migration — the real table is `user_notifications` — and every
 * branch caught the resulting 42P01/PGRST205 and returned an empty list. So the
 * bell showed nothing, permanently, while three server-side producers kept
 * writing real rows. A silent fallback around a phantom relation converts a
 * loud deploy failure into a feature that quietly does nothing.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 * It proves a name is absent from the two sources the repository controls:
 * `pgTable(...)`/`pgView(...)` in shared/, and CREATE TABLE/VIEW in
 * drizzle/{migrations,functions,rls}. It does NOT prove the relation is missing
 * from the database. COP-M00 counted 107 tables that exist live and are in no
 * Drizzle schema, created by db:push before the migration workflow landed. So a
 * name on this list is a QUESTION, not a defect.
 *
 * database-schema-report.json is not usable as the authority: it is a June
 * snapshot that predates web_forms, among others.
 *
 * ── WHY THE BASELINE BECAME AN ALLOW-LIST (WF-G-02) ────────────────────────────
 *
 * The old shape was a flat array of "table (file)" strings under one blanket
 * note, and `--update-baseline` swept every finding into it. That is a ratchet,
 * not a gate: sales_handoffs, work_orders, appointments, lead_routing_rules,
 * maintenance_schedules and purchase_order_line_items all sat in it, green, and
 * every one of the six turned out to have an open story explaining that the
 * feature behind it cannot work. A question nobody is required to answer stops
 * being a question.
 *
 * So `allowed` is now an OBJECT keyed by table, and an entry is rejected unless
 * it carries a non-empty `reason` and the `story` that owns it. `--update-baseline`
 * only ever SHRINKS — it prunes entries whose references are gone and never adds
 * one — so a new undeclared relation cannot enter without somebody writing down
 * why it is acceptable. The failure message prints the JSON to paste.
 *
 * `unreviewed` carries the 96 pre-existing entries that predate this contract,
 * verbatim and shrink-only. They are NOT allow-listed and NOT justified; they are
 * a triage queue. Do not add to it. Writing 79 plausible-sounding reasons in one
 * pass would have been the same fabrication this guard exists to catch, so the
 * six with an identified owner were promoted and the rest were labelled honestly.
 *
 * ── EVIDENCE ATTACHED TO EACH FINDING ─────────────────────────────────────────
 *
 * Triage needs to know how a missing relation would SURFACE, so each finding
 * carries `discardsError`: the file destructures a PostgREST result as
 * `const { data } = ...` with no `error`, anywhere. PostgREST leaves `.data` null
 * on failure and this codebase writes `|| []` around it, so that combination
 * renders an empty list at 200 and reports nothing — the notification-bell shape.
 * technician-management's /:id/schedule is the worked example: `const { data:
 * schedule } = await query` over `work_orders`, then `schedule || []`.
 *
 * ── BLIND SPOT IN THE 42P01 GATE, stated so a pass is not read as proof ───────
 *
 * The swallow gate below keys on the literal `42P01`/`PGRST205` appearing in the
 * file. EDGE-002g moved that predicate into _shared/postgrest-errors.ts
 * (`isMissingTableError`), so every function using the shared helper is invisible
 * to it. That was left alone rather than widened, because the helper is used to
 * answer 503 — an HONEST report that the relation is missing — and a gate that
 * cannot tell 503 from a silent empty list would fire on the correct code and not
 * on the broken code. `discardsError` is the signal that actually separates them.
 *
 * Usage:
 *   node scripts/check-phantom-tables.mjs
 *   node scripts/check-phantom-tables.mjs --update-baseline   # prunes only
 *   node scripts/check-phantom-tables.mjs --list
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const baselinePath = join(repo, 'docs', 'phantom-tables-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Relations the repository declares: Drizzle definitions plus raw SQL DDL. */
function knownRelations() {
  const known = new Set();
  for (const file of walk(join(repo, 'shared'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/pgTable\(\s*'([^']+)'/g)) known.add(m[1]);
    for (const m of src.matchAll(/pgView\(\s*'([^']+)'/g)) known.add(m[1]);
  }
  for (const dir of ['drizzle/migrations', 'drizzle/functions', 'drizzle/rls']) {
    const abs = join(repo, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs)) {
      if (!entry.endsWith('.sql')) continue;
      const src = readFileSync(join(abs, entry), 'utf8');
      for (const m of src.matchAll(
        /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi,
      )) {
        known.add(m[1]);
      }
    }
  }
  return known;
}

const known = knownRelations();
const findings = [];
const swallowing = [];
const fabricating = [];

/**
 * An error branch that answers with invented rows.
 *
 * The swallowing rule above keys on the 42P01/PGRST205 literal, and the two
 * worst instances in this tree did not test the code at all: `if (error) {` and
 * then a 200 carrying a hand-written array of objects. auto-lead-routing
 * returned two "sample" routing rules for `lead_routing_rules`, a relation
 * named by no schema, no migration and no other file in the repository, so the
 * routing UI listed rules that did not exist and could not be edited.
 * commission returned a "Sales Rep Standard" plan with 5%/6.5%/8% tiers, which
 * is a rep reading fabricated numbers as their own pay structure.
 *
 * This is a hard gate at zero rather than a baseline: a caller cannot tell
 * invented data from real data, so there is no version of it that is merely
 * debt. Matching is deliberately narrow - an `if (error)` block whose body
 * returns an array-of-objects literal - which misses a fabricated SINGLE object
 * and anything returned via a named constant. Both would be worth catching; the
 * narrow form is what has actually occurred.
 *
 * The block end is the first closing brace at ANY indent, not the one matching
 * the `if`. A version anchored to the outer brace missed the commission case
 * entirely: its fabricated plan runs ~60 lines and the block never closed
 * inside the scan window. Ending early is safe here because the array literal
 * that decides the finding opens before any brace can close.
 */
const ERROR_BRANCH = /if\s*\(\s*(?:\w+\.)?error\s*\)\s*\{([\s\S]{0,600}?)\n\s*\}/g;
const RETURNS_ROW_LITERAL = /return[\s\S]{0,160}?\[\s*\{/;

/**
 * A PostgREST result destructured without its error (WF-G-02).
 *
 * `const { data: schedule } = await query` discards the failure entirely, and
 * `.data` is null when the query failed, so the `|| []` two lines down renders an
 * empty list at 200. This is the shape that makes a phantom table invisible, and
 * it is what the `auth.getUser` destructuring at the top of every handler
 * deliberately does NOT do — hence the exclusion of the `data: { user }` form,
 * which always carries `error: userError`.
 */
const DISCARDS_ERROR = /const\s*\{\s*data(?:\s*:\s*(?!\{)[A-Za-z0-9_]+)?\s*\}\s*=/g;

/**
 * PA-031: strip comments before matching. `_shared/case.ts` documents its usage
 * with `db.from('t')` inside a JSDoc block, and that produced a phantom table
 * called `t` — a finding about a code sample, baselined as though it were a
 * defect. Same limitation the nav-target checker had.
 *
 * Deliberately crude: it does not parse, so a `//` inside a string literal takes
 * the rest of that line with it. A `.from('x')` is never to the right of one in
 * this codebase, and over-stripping loses a finding rather than inventing one.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const file of walk(join(repo, 'supabase', 'functions'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const swallows = /42P01|PGRST205/.test(src);
  const discardsError = [...src.matchAll(DISCARDS_ERROR)].length;
  const rel = relative(repo, file).replace(/\\/g, '/');
  const seen = new Set();
  for (const m of src.matchAll(/\.from\(\s*'([a-zA-Z0-9_]+)'\s*\)/g)) {
    const table = m[1];
    if (known.has(table) || seen.has(table)) continue;
    seen.add(table);
    findings.push({ table, file: rel, discardsError });
    if (swallows) swallowing.push({ table, file: rel });
  }

  for (const m of src.matchAll(ERROR_BRANCH)) {
    if (RETURNS_ROW_LITERAL.test(m[1])) {
      fabricating.push(rel);
      break;
    }
  }
}

const key = (f) => `${f.table} (${f.file})`;

if (list) {
  const byTable = new Map();
  for (const f of findings) {
    if (!byTable.has(f.table)) byTable.set(f.table, []);
    byTable.get(f.table).push(f);
  }
  for (const [table, fs] of [...byTable].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${table}  (${fs.length} function(s))`);
    for (const f of fs) {
      console.log(
        `    ${f.file}${f.discardsError ? `  [discards error x${f.discardsError}]` : ''}`,
      );
    }
  }
  console.log(`\n${findings.length} reference(s) to ${byTable.size} undeclared relation(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const allowed = baseline.allowed ?? {};
const unreviewed = new Set(baseline.unreviewed ?? []);

// An allow-list entry with no reason is a baseline wearing an allow-list's name.
const unjustified = Object.entries(allowed).filter(
  ([, v]) => !v || !String(v.reason ?? '').trim() || !String(v.story ?? '').trim(),
);
if (unjustified.length > 0) {
  console.error(`✗ ${unjustified.length} allow-list entr(ies) with no reason or owning story:\n`);
  for (const [t] of unjustified) console.error(`  ${t}`);
  console.error(
    '\nEvery entry in `allowed` must carry a non-empty `reason` and the `story` that owns\n' +
      'the decision. That requirement is the whole difference between this and the ratchet\n' +
      'it replaced.',
  );
  process.exit(1);
}

const isAllowed = (f) => {
  const entry = allowed[f.table];
  return !!entry && (entry.files ?? []).includes(f.file);
};

if (update) {
  // Prune only. Adding an entry is a decision with a reason attached, so it is
  // done by hand — see the header.
  const present = new Set(findings.map(key));
  const nextAllowed = {};
  for (const [table, entry] of Object.entries(allowed)) {
    const files = (entry.files ?? []).filter((file) => present.has(`${table} (${file})`));
    if (files.length > 0) nextAllowed[table] = { ...entry, files };
  }
  const nextUnreviewed = [...unreviewed].filter((k) => present.has(k)).sort();
  const removed =
    Object.values(allowed).reduce((n, e) => n + (e.files ?? []).length, 0) -
    Object.values(nextAllowed).reduce((n, e) => n + e.files.length, 0) +
    (unreviewed.size - nextUnreviewed.length);

  writeFileSync(
    baselinePath,
    JSON.stringify({ ...baseline, allowed: nextAllowed, unreviewed: nextUnreviewed }, null, 2) +
      '\n',
  );
  console.log(`✓ Pruned ${removed} entr(ies) that no longer occur. Nothing was added.`);
  process.exit(0);
}

// Invented rows on an error path, checked before the allow-list for the reason in
// the ERROR_BRANCH comment: the caller cannot tell them from real ones.
if (fabricating.length > 0) {
  console.error(`✗ ${fabricating.length} error branch(es) returning fabricated rows:\n`);
  for (const f of fabricating) console.error(`  ${f}`);
  console.error(
    '\nA 200 carrying hand-written objects is indistinguishable from real data to every\n' +
      'caller. Return the error. This is how a commission page showed invented 5%/6.5%/8%\n' +
      'tiers and a routing page listed rules that did not exist.',
  );
  process.exit(1);
}

// A handler that swallows 42P01 CANNOT report a missing table, so this pairing is
// never acceptable regardless of the allow-list.
if (swallowing.length > 0) {
  console.error(
    `✗ ${swallowing.length} undeclared table(s) queried by a function that swallows 42P01/PGRST205:\n`,
  );
  for (const f of swallowing) console.error(`  ${f.table}  ${f.file}`);
  console.error(
    '\nA missing relation here is reported to the caller as an empty result, so the failure is\n' +
      'invisible. Either confirm the table exists and drop the catch, or point the query at the\n' +
      'relation that does exist. This is how the notification bell stayed empty for months.',
  );
  process.exit(1);
}

const novel = findings.filter((f) => !isAllowed(f) && !unreviewed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} undeclared table reference(s) with no recorded reason:\n`);
  for (const f of novel) {
    console.error(
      `  ${f.table}  ${f.file}${f.discardsError ? '  [discards the PostgREST error]' : ''}`,
    );
  }
  const byTable = new Map();
  for (const f of novel) {
    if (!byTable.has(f.table)) byTable.set(f.table, []);
    byTable.get(f.table).push(f.file);
  }
  console.error(
    '\nAdd the table to a Drizzle schema and a migration, or point the query at the relation\n' +
      'that exists. If it is a live db:push table, record it in docs/phantom-tables-baseline.json\n' +
      'under "allowed" WITH a reason and the story that owns it — --update-baseline will not add\n' +
      'it for you:\n',
  );
  for (const [table, files] of byTable) {
    console.error(
      `  ${JSON.stringify(table)}: { "story": "<STORY-ID>", "reason": "<why this is acceptable>", ` +
        `"files": ${JSON.stringify(files)} },`,
    );
  }
  process.exit(1);
}

const present = new Set(findings.map(key));
const goneAllowed = Object.entries(allowed).flatMap(([t, e]) =>
  (e.files ?? []).filter((file) => !present.has(`${t} (${file})`)).map((file) => `${t} (${file})`),
);
const goneUnreviewed = [...unreviewed].filter((k) => !present.has(k));
const gone = [...goneAllowed, ...goneUnreviewed];

if (gone.length > 0) {
  console.log(`✓ No unrecorded undeclared tables. ${gone.length} recorded entr(ies) are gone:`);
  for (const g of gone.slice(0, 10)) console.log(`    ${g}`);
  if (gone.length > 10) console.log(`    …and ${gone.length - 10} more`);
  console.log('  Tighten with: node scripts/check-phantom-tables.mjs --update-baseline');
  process.exit(0);
}

const allowedCount = Object.values(allowed).reduce((n, e) => n + (e.files ?? []).length, 0);
console.log(
  `✓ No undeclared tables behind a silent catch, and none unrecorded ` +
    `(${allowedCount} allow-listed with a reason, ${unreviewed.size} awaiting triage).`,
);
