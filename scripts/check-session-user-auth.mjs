#!/usr/bin/env node
/**
 * Handlers that authenticate against a field nothing assigns.
 *
 * `req.session.user` is read by 12 registered Express routers as their ONLY
 * source of identity - `const user = req.session?.user; if (!user) return 401`,
 * or `const tenantId = req.session.user?.tenantId`. Nothing in this codebase
 * ever assigns it. Session login sets the flat `req.session.userId` /
 * `req.session.tenantId`, and the JWT path sets `req.user`; a grep for an
 * assignment finds only tests. So every handler in those files answers 401,
 * always, in dev as well as production - they have never run.
 *
 * server/types/express-session.d.ts recorded this in 2026 as a "KNOWN LATENT
 * BUG" while declaring the type that makes it compile, and nothing measured it
 * afterwards. That is the gap: the augmentation makes `req.session.user.tenantId`
 * typecheck, so tsc reports a clean file, and no test mounts these routers.
 *
 * WHY IT FAILS CLOSED, AND WHY THAT IS NOT THE END OF IT. Every instance found
 * guards before using the value, so the failure is a 401 rather than a query
 * scoped to `undefined` - no tenant leak. But a whole feature that answers 401
 * still looks, from the outside, exactly like a permissions problem, and 12
 * routers' worth of it has been read as "Express serves this in dev" in more
 * than one place.
 *
 * THE RULE. A file under server/ is reported when it reads `req.session.user`
 * and has NO other identity source: no `req.user`, no isAuthenticated /
 * requireAuth / protectedRoute middleware, and no getUserId/getTenantId helper.
 * A file with a fallback is fine and is not reported - apollo-routes.ts reads
 * req.session.user three times for an activity write while gating every route
 * on isAuthenticated, and it works.
 *
 * THE FIX, when you take one of these on, is the one express-session.d.ts
 * names: move the handler to getUserId/getTenantId from utils/auth-helpers, or
 * retire the router if an edge function already covers it. Populating
 * req.session.user in the login path is the third option and touches
 * security-sensitive code, which is why nobody has.
 *
 *   node scripts/check-session-user-auth.mjs
 *   node scripts/check-session-user-auth.mjs --update-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'session-user-auth-baseline.json');
const update = process.argv.includes('--update-baseline');

/**
 * Comments stripped before matching, in both directions. A file explaining why
 * it no longer reads req.session.user would otherwise still be reported, and a
 * comment mentioning isAuthenticated would clear a file that does not use it.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const READS_SESSION_USER = /req\.session\??\.user\b/;
// `(req as any).user` is the same fallback written through a cast, and the
// plain word-boundary pattern does not match it, because the cast sits between
// the two words. That over-reported server/middleware/mfa-enforcement.ts, which reads
// req.user FIRST and falls back to the session, so mounting it would have
// authenticated a JWT request rather than denying everyone.
const HAS_FALLBACK =
  /req\.user\b|\(req as [^)]+\)\.user\b|isAuthenticated|requireAuth|protectedRoute|requireSupabaseAuth|getUserId\(|getTenantId\(/;

const findings = [];
for (const file of walk(join(repo, 'server'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  if (!READS_SESSION_USER.test(src)) continue;
  if (HAS_FALLBACK.test(src)) continue;
  const reads = (src.match(/req\.session\??\.user\b/g) ?? []).length;
  findings.push({ file: relative(repo, file).replace(/\\/g, '/'), reads });
}
findings.sort((a, b) => b.reads - a.reads);

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'Server files whose only identity source is req.session.user, which nothing assigns. ' +
          'Every handler in them answers 401. See scripts/check-session-user-auth.mjs. ' +
          'This is a todo list, not settled debt - do not grow it.',
        generated: new Date().toISOString().slice(0, 10),
        totalReads: findings.reduce((n, f) => n + f.reads, 0),
        files: findings.map((f) => f.file),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: ${findings.length} file(s), ${findings.reduce((n, f) => n + f.reads, 0)} read(s).`,
  );
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).files ?? [])
  : new Set();

const added = findings.filter((f) => !baseline.has(f.file));
if (added.length > 0) {
  console.error(`✗ ${added.length} file(s) authenticate only against req.session.user:\n`);
  for (const f of added) console.error(`  ${f.file}  (${f.reads} read(s))`);
  console.error(
    '\nNothing assigns req.session.user, so every handler in these answers 401 - in dev as\n' +
      'well as production. Use getUserId/getTenantId from server/utils/auth-helpers, or gate\n' +
      'the router on isAuthenticated and read req.user.',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((b) => !findings.some((f) => f.file === b));
if (fixed.length > 0) {
  console.log(`✓ No new session-only auth. ${fixed.length} baselined file(s) resolved:`);
  for (const f of fixed) console.log(`    ${f}`);
  console.log('  Tighten with: node scripts/check-session-user-auth.mjs --update-baseline');
} else {
  console.log(
    `✓ No new session-only auth (${findings.length} baselined, ` +
      `${findings.reduce((n, f) => n + f.reads, 0)} reads).`,
  );
}
