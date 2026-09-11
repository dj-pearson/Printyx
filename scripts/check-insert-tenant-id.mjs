#!/usr/bin/env node
/**
 * Every write to a tenant-scoped table must be bound to a tenant - in the
 * PAYLOAD for an insert or an upsert, and in the FILTER for an update or a
 * delete. Those are two different rules for two different failures and the
 * script checks both (SEC-TENANT-005).
 *
 * When the column is NOT NULL the insert simply fails, so the endpoint is
 * permanently broken and nobody notices until a user hits it: PUT
 * /user/accessibility omitted it, so the FIRST save of accessibility settings
 * returned 500 for every user, and only someone who already had a user_settings
 * row from another path could save at all. Its two sibling handlers in the same
 * file both resolve the tenant correctly.
 *
 * When the column is nullable it is worse - the row is written and then no
 * tenant-filtered read can ever see it, so the user is told it saved and it is
 * gone.
 *
 * RESOLVES SPREADS, which is the whole difficulty. Two blog handlers here build
 * `const payload = { tenant_id: tenantId, ... }` and insert `{ ...payload,
 * created_by_user_id: userId }`. A guard that reads only the inline literal
 * reports both as defects, and a baseline holding two known non-defects is
 * where a real one hides.
 *
 * UPSERT is the insert rule. An upsert missing tenant_id on a NOT NULL column
 * fails exactly like an insert, and on a nullable one writes the same
 * unreadable row.
 *
 * UPDATE AND DELETE ARE THE FILTER RULE, and it is the more serious of the two.
 * They do not need tenant_id in the payload; they need it in the WHERE, or the
 * write reaches ANOTHER TENANT'S ROW. That is what SEC-TENANT-001 found in
 * parts-orders. An id is not a substitute: these ids are uuids, so guessing one
 * is impractical, but they travel in URLs, exports and support tickets, and
 * "hard to guess" is not an authorisation check.
 *
 * WHAT IT CANNOT RESOLVE IS COUNTED, NOT SKIPPED. A payload built by a function
 * call, a chain assembled across branches (`let q = ...; if (x) q = q.eq(...)`),
 * an object spread it cannot follow - each is reported as UNRESOLVED with its
 * location. A clean run means "nothing resolvable is wrong", which is a weaker
 * claim than "nothing is wrong", and the difference is the whole point of
 * printing the number.
 *
 * A table absent from every Drizzle schema is not classified at all. Hard gate
 * at zero findings; the unresolved count is a ratchet, reported and not gated.
 */
import fs from 'node:fs';
import path from 'node:path';

/** table -> does it declare tenant_id */
const tenantTables = new Set();
for (const f of fs.readdirSync('shared').filter((f) => f.endsWith('.ts'))) {
  const s = fs.readFileSync(path.join('shared', f), 'utf8');
  const re = /pgTable\(\s*['"]([a-z0-9_]+)['"]\s*,\s*\{/g;
  let m;
  while ((m = re.exec(s))) {
    const start = re.lastIndex - 1;
    let d = 0;
    let end = -1;
    for (let i = start; i < s.length; i++) {
      if (s[i] === '{') d++;
      else if (s[i] === '}' && --d === 0) {
        end = i;
        break;
      }
    }
    // The platform_* tables are Printyx's OWN CRM about its tenants, so they
    // are cross-tenant by design. platform_business_records.tenant_id is a
    // LINKAGE filled after a prospect converts into a tenant, not a tenancy
    // boundary - inserting a prospect with no tenant_id is correct, and
    // baselining it would put a known non-defect in the list where a real one
    // could hide. Excluded by rule.
    if (m[1].startsWith('platform_')) continue;
    if (end > 0 && /['"]tenant_id['"]/.test(s.slice(start, end))) tenantTables.add(m[1]);
  }
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.ts')) files.push(p);
  }
})('supabase/functions');

const findings = [];
const filterFindings = [];
const unresolved = [];
let guarded = 0;
let userScoped = 0;

/** Text of the balanced {...} starting at `start`, or null. */
function braced(src, start) {
  let d = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}' && --d === 0) return src.slice(start, i + 1);
  }
  return null;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** The `{...}` of `const name = {` / `let name: T = {` in this file, or null. */
function declaredObject(src, name) {
  const decl = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*\\{`).exec(src);
  if (!decl) return null;
  return braced(src, src.indexOf('{', decl.index + decl[0].length - 1));
}

for (const file of files) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  src = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

  // ── payload rule: insert and upsert ────────────────────────────────────
  const payloadRe =
    /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)\s*\.(insert|upsert)\(\s*(?:(\{)|([A-Za-z_$][\w$]*)\s*[,)])?/g;
  let m;
  while ((m = payloadRe.exec(src))) {
    const [, table, op, brace, ident] = m;
    if (!tenantTables.has(table)) continue;
    const line = lineOf(src, m.index);

    let payload;
    if (brace) {
      payload = braced(src, src.indexOf('{', m.index + m[0].length - 1));
    } else if (ident) {
      // `.insert(payload)` - by far the commonest shape here, and the old
      // version matched only a literal so it never saw any of them. Resolve the
      // declaration the same way a spread is resolved.
      payload = declaredObject(src, ident);
      if (payload === null) {
        unresolved.push(
          `${file}:${line}  ${table}.${op}(${ident}) - "${ident}" is not an object literal declared in this file`,
        );
        continue;
      }
    } else {
      // `.insert(rows.map(...))`, `.insert(buildPayload(x))` - built inline.
      unresolved.push(`${file}:${line}  ${table}.${op}(...) - payload is built by an expression`);
      continue;
    }
    if (payload === null) continue;
    if (/tenant_id/.test(payload)) continue;

    // Resolve `...name` spreads against a const declared earlier in the file.
    let satisfied = false;
    let unresolvedSpread = null;
    for (const sm of payload.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)) {
      const body = declaredObject(src, sm[1]);
      if (body === null) {
        unresolvedSpread = sm[1];
        continue;
      }
      if (/tenant_id/.test(body)) satisfied = true;
    }
    if (satisfied) continue;
    if (unresolvedSpread) {
      unresolved.push(
        `${file}:${line}  ${table}.${op}({ ...${unresolvedSpread} }) - spread source not found in this file`,
      );
      continue;
    }

    findings.push(`${file}:${line}  ${table}.${op}() sets no tenant_id`);
  }

  // ── filter rule: update and delete ─────────────────────────────────────
  const filterRe = /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)\s*(?:\r?\n\s*)?\.(update|delete)\(/g;
  while ((m = filterRe.exec(src))) {
    const [, table, op] = m;
    if (!tenantTables.has(table)) continue;
    const line = lineOf(src, m.index);

    // The chain runs to the end of its statement.
    const stop = src.indexOf(';', m.index);
    const chain = stop > 0 ? src.slice(m.index, stop) : src.slice(m.index, m.index + 1200);
    if (/tenant_id/.test(chain)) continue;

    // A WRITE BOUND TO THE AUTHENTICATED USER IS ALREADY TENANT-BOUND, and more
    // tightly. `mfa_backup_codes.delete().eq('user_id', user.id)` and
    // `users.update().eq('id', userId)` cannot reach another tenant, because
    // the user cannot be in two. The value has to come from the token, not from
    // the request - a `user_id` read off the body would be the defect this
    // exists to catch, so the pattern is anchored to the names the auth layer
    // produces. `auth.userId` is one of them: sso's own logout and mfa's
    // self-disable were reported until it was listed, and a reported non-defect
    // is how a real one gets waved through.
    if (
      /\.eq\(\s*['"](?:user_id|id)['"]\s*,\s*(?:user\.id|user\?\.id|userId|authUserId|currentUserId|auth\.userId|auth\.user\.id|ctx\.userId)\s*\)/.test(
        chain,
      )
    ) {
      userScoped++;
      continue;
    }

    // AN OWNERSHIP CHECK AHEAD OF THE WRITE COUNTS. The commonest correct shape
    // here reads the row first - `.from(T).select(...).eq('id', x)
    // .eq('tenant_id', tenantId)` - 404s when it is absent, checks the owner,
    // and only then writes filtered by id alone. saved-views does exactly this
    // for both its update and its delete. That IS an authorisation check, so
    // reporting it would put dozens of known non-defects in front of the real
    // ones. Filtering the write too is still better, and cheaper than proving
    // the check, but it is a preference rather than a defect.
    const before = src.slice(Math.max(0, m.index - 1800), m.index);
    const guard = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,400}?tenant_id`);
    if (guard.test(before)) {
      guarded++;
      continue;
    }

    // A chain assigned to a variable is extended elsewhere - PostgREST builders
    // accumulate, so the filter may well be added in a later branch.
    const head = src.slice(Math.max(0, m.index - 200), m.index);
    const assigned = /(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*[^;]*$/.exec(head);
    if (assigned) {
      const name = assigned[1];
      // Look for `name = name.eq('tenant_id'` or `name.eq('tenant_id'` after it.
      if (new RegExp(`${name}[\\s\\S]{0,600}?tenant_id`).test(src.slice(m.index))) continue;
      unresolved.push(
        `${file}:${line}  ${table}.${op}() via builder "${name}" - filters added outside this statement`,
      );
      continue;
    }

    filterFindings.push({ key: `${file}  ${table}.${op}`, line });
  }
}

// ── the filter rule is a shrink-only ratchet, not a hard gate ────────────
//
// It cannot be zero today: 30 writes remain that are neither tenant-filtered,
// user-scoped, nor preceded by an ownership read, and each needs its own call -
// blog-pipeline is an internal job runner, public-booking is deliberately
// unauthenticated and works off a booking token, and several others fetch the
// row far enough above the write that no fixed lookback will see it. Gating at
// the current number stops new ones while those are triaged; baselining them
// silently would be the thing SEC-TENANT-005 warns about, so they are PRINTED
// on every run.
const BASELINE_PATH = 'docs/tenant-write-filter-baseline.json';
const counted = {};
for (const f of filterFindings) counted[f.key] = (counted[f.key] ?? 0) + 1;

if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note: 'update/delete on a tenant-scoped table with no tenant_id filter, no user scope and no preceding ownership read. SHRINK ONLY.',
        entries: Object.fromEntries(Object.entries(counted).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${filterFindings.length} unfiltered update/delete write(s).`);
  process.exit(0);
}

let baseline = { entries: {} };
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  // No baseline yet - every finding is new.
}
const regressions = [];
for (const [key, n] of Object.entries(counted)) {
  const allowed = baseline.entries?.[key] ?? 0;
  if (n > allowed) regressions.push(`${key} - ${n} unfiltered write(s), baseline ${allowed}`);
}

if (filterFindings.length) {
  console.log(
    `update/delete not bound to a tenant (${filterFindings.length}, baselined - these are a TODO list, not settled):\n`,
  );
  for (const f of filterFindings.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`  ${f.key} (line ${f.line})`);
  }
  console.log('');
}

if (regressions.length) {
  console.error('New update/delete write with no tenant binding:\n');
  for (const r of regressions) console.error('  ' + r);
  console.error(
    '\nFilter the write by tenant_id, scope it to the authenticated user, or read the row' +
      ' first with a tenant-filtered select and 404 when it is absent.',
  );
  process.exit(1);
}

if (unresolved.length) {
  console.log('Could not resolve (not gated, and not evidence of correctness):\n');
  for (const u of unresolved) console.log('  ' + u);
  console.log('');
}

if (findings.length) {
  console.error('Write to a tenant-scoped table that is not bound to a tenant:\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    `\n${findings.length} finding(s). On an insert or upsert a NOT NULL column fails the write and` +
      ` a nullable one writes a row no tenant can read. On an update or delete the write reaches` +
      ` another tenant's row.`,
  );
  process.exit(1);
}
console.log(
  `check:insert-tenant-id - ${files.length} files, every resolvable insert/upsert is tenant-bound` +
    ` (${tenantTables.size} tenant-scoped tables; of the update/delete writes, ${guarded} are` +
    ` guarded by a preceding ownership check and ${userScoped} are bound to the authenticated` +
    ` user; ${unresolved.length} unresolved).`,
);
