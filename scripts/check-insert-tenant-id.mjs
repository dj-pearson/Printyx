#!/usr/bin/env node
/**
 * An edge-function insert into a tenant-scoped table must set tenant_id.
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
 * Limits: a payload built by a function call or assembled across branches is
 * still invisible, and a table absent from every Drizzle schema is not
 * classified at all. Hard gate at zero.
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

  const re = /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)\s*\.insert\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    if (!tenantTables.has(table)) continue;

    const start = src.indexOf('{', m.index + m[0].length - 1);
    let d = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}' && --d === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) continue;
    const payload = src.slice(start, end + 1);
    if (/tenant_id/.test(payload)) continue;

    // Resolve `...name` spreads against a const declared earlier in the file.
    let satisfied = false;
    for (const sm of payload.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)) {
      const decl = new RegExp(`const\\s+${sm[1]}\\s*(?::[^=]*)?=\\s*\\{`);
      const dm = decl.exec(src);
      if (!dm) continue;
      const ds = src.indexOf('{', dm.index + dm[0].length - 1);
      let dd = 0;
      let de = -1;
      for (let i = ds; i < src.length; i++) {
        if (src[i] === '{') dd++;
        else if (src[i] === '}' && --dd === 0) {
          de = i;
          break;
        }
      }
      if (de > 0 && /tenant_id/.test(src.slice(ds, de))) satisfied = true;
    }
    if (satisfied) continue;

    findings.push(`${file}:${src.slice(0, m.index).split('\n').length}  ${table}`);
  }
}

if (findings.length) {
  console.error('Insert into a tenant-scoped table with no tenant_id:\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    `\n${findings.length} finding(s). A NOT NULL column fails the write; a nullable one writes a row no tenant can read.`,
  );
  process.exit(1);
}
console.log(
  `check:insert-tenant-id - ${files.length} files, every insert sets tenant_id (${tenantTables.size} tenant-scoped tables).`,
);
