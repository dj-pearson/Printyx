#!/usr/bin/env node
/**
 * Every edge function resolves the caller's tenant through one helper
 * (SEC-TENANT-003, AC4).
 *
 * The shape was settled three separate times - CR-010's tenantFromJwt,
 * PA-002/PA-003's _shared/tenant.ts, and the private resolver in
 * _shared/auth.ts - and adopted by four functions out of 161. The other 157
 * carried a five-line `||` chain ending in req.headers.get('x-tenant-id'), a
 * value the web client sets from localStorage. It held for anyone whose JWT
 * carried a tenantId, because the earlier terms win, which is exactly why it
 * survived three rulings.
 *
 * This reports any edge function that reads the header or a metadata bag for
 * tenancy outside supabase/functions/_shared/resolve-tenant.ts. Hard gate at
 * zero, with two documented exemption classes rather than a baseline, because a
 * baseline of known-fine entries is where a real one hides.
 *
 * TWO THINGS THIS SCRIPT HAS TO DO THAT ARE EASY TO GET WRONG, both of which
 * cost a real failure while it was being written:
 *
 *   - STRIP COMMENTS BEFORE ASSERTING AN ABSENCE. Every file fixed by this
 *     story carries a comment explaining the fix, and those comments name the
 *     header. A scan that does not strip them reports its own explanation as
 *     the defect. Line comments are stripped BEFORE block comments, because a
 *     header like `// foo /* bar` otherwise opens a block that swallows the
 *     next forty lines (the check:shared-helper-imports lesson).
 *
 *   - READ FILES AS UTF-8, NOT THROUGH grep. blog-content-platform/index.ts
 *     holds four literal NUL bytes as glossary sentinels, so `grep -r`
 *     classifies it as binary and prints "binary file matches" instead of the
 *     line. It was invisible to the first count.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FUNCTIONS = join(ROOT, 'supabase/functions');
const HELPER = 'supabase/functions/_shared/resolve-tenant.ts';

// Exempt BY RULE, each for a stated reason.
const EXEMPT = new Map([
  [HELPER, 'the helper itself'],
  // A caller presenting the service role key already holds every tenant, so a
  // header or body field there selects a target rather than granting access.
  ['supabase/functions/companies/index.ts', 'service-role branch selects a target'],
  ['supabase/functions/dedup-companies/index.ts', 'service-role branch selects a target'],
]);

// The hardened family reads the header deliberately, to 403 on a mismatch and
// to let a platform admin switch tenant. They are recognised by that pair, not
// exempted wholesale: a file that reads the header without both is reported.
const MISMATCH_GUARD = /headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId/;
const ADMIN_GATE = /isPlatformAdmin \? \(?headerTenantId/;

function stripComments(src) {
  // Line comments first - see the header.
  const noLine = src.replace(/(?<!:)\/\/[^\n]*/g, '');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

const findings = [];
let scanned = 0;
let adopters = 0;

for (const abs of walk(FUNCTIONS)) {
  const rel = relative(ROOT, abs).split('\\').join('/');
  scanned += 1;
  const raw = readFileSync(abs, 'utf8');
  if (raw.includes("_shared/resolve-tenant.ts")) adopters += 1;
  if (EXEMPT.has(rel)) continue;

  const code = stripComments(raw);

  if (code.includes("req.headers.get('x-tenant-id')")) {
    const hardened = MISMATCH_GUARD.test(code) && ADMIN_GATE.test(code);
    if (!hardened) {
      findings.push([rel, "reads x-tenant-id without the mismatch guard and platform-admin gate"]);
      continue;
    }
  }

  // A tenant taken from user_metadata is taken from a bag the session holder
  // can write with supabase.auth.updateUser. Scoped to the TENANT keys on
  // purpose: role, roleLevel and customer_id are read from the same bag in a
  // dozen files and are a different story (they are checked against the
  // database by the RBAC layer, and widening this rule would bury the tenancy
  // finding in them).
  if (/user_metadata\?\.(?:tenantId|tenant_id)/.test(code)) {
    findings.push([rel, 'resolves tenancy from user_metadata, which the session holder can write']);
  }
}

if (findings.length) {
  console.error(`check:tenant-resolution - ${findings.length} edge file(s) resolve tenancy outside ${HELPER}:\n`);
  for (const [f, why] of findings) console.error(`  ${f}\n    ${why}`);
  console.error(`\nUse resolveTenantId(req, user, admin) from ${HELPER}.`);
  process.exit(1);
}

console.log(
  `check:tenant-resolution - ${scanned} edge files, ${adopters} import the shared resolver, ` +
    `no function resolves tenancy from a caller-controlled source.`,
);
