#!/usr/bin/env node
/**
 * What each edge function's Express predecessor enforced (SEC-EDGE-001 AC4).
 *
 * The story asked for this inventory BEFORE the gating work, as the source of
 * truth for which permission each endpoint should carry. It was never built,
 * and the gating went ahead on a different basis - mirroring
 * navigation-permissions.ts with a LEVEL check. Producing it now answers two
 * questions the story could not otherwise close: was that basis wrong, and is
 * there an endpoint whose predecessor deliberately gated it while the edge
 * function serving production does not?
 *
 * SEC-EDGE-002 IS WHY THIS IS EVIDENCE ABOUT INTENT AND NOT A LIST TO COPY.
 * There are two permission vocabularies here: the PERMISSIONS constant the
 * Express gates reference, and the codes the seeder actually writes to the
 * `permissions` table. They overlap by about a third, so a gate copied verbatim
 * from Express onto an edge function can be unsatisfiable - a 403 for everyone
 * below platform admin, forever, with nothing saying so. That is exactly the
 * mistake this inventory exists to prevent, so every row states whether the
 * code is seeded. `npm run check:permission-vocab` is the guard for the Express
 * side and is at zero; this is the cross-host view it does not take.
 *
 * WHAT IT READS
 *   - Live server/routes*.ts and server/routes/*.ts: the /api/<segment> literals
 *     each names, and the permission codes it gates with.
 *   - DELETED routers, at their last committed version, from git history - most
 *     predecessors were retired by PROD-008b and QUALITY-002, so the live tree
 *     alone answers a fraction of the question.
 *   - supabase/functions/*: which directory serves each segment, including the
 *     crmProxies aliases and the server.ts overrides where the names differ.
 *   - docs/edge-rbac-triage.json and check-edge-rbac's classification: what the
 *     edge function enforces today.
 *
 * WHAT IT CANNOT SEE, so a clean report is never read as proof: a gate applied
 * by a middleware mounted above the router (that is check:session-auth's and
 * check:edge-rbac's job), a permission named through a variable, and a
 * predecessor deleted before its prefix ever reached an edge function.
 *
 *   node scripts/edge-rbac-predecessors.mjs            # write the doc
 *   node scripts/edge-rbac-predecessors.mjs --check    # fail on an ungated gap
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'edge-rbac-express-predecessors.md');
const CHECK = process.argv.includes('--check');

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** 'INVENTORY.ITEM.VIEW' -> 'inventory.item.view', from the gates' own constant. */
export function helperValues(src) {
  const start = src.indexOf('PERMISSIONS = {');
  const out = new Map();
  if (start === -1) return out;
  const path = [];
  for (const rawLine of src.slice(start).split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '');
    const leaf = /^\s*([A-Z][A-Z0-9_]*):\s*['"]([a-z_]+\.[a-z_.]+)['"]/.exec(line);
    if (leaf) {
      out.set([...path, leaf[1]].join('.'), leaf[2]);
      continue;
    }
    const group = /^\s*([A-Z][A-Z0-9_]*):\s*\{/.exec(line);
    if (group) {
      path.push(group[1]);
      continue;
    }
    if (/^\s*\}/.test(line)) {
      if (path.length === 0) break;
      path.pop();
    }
  }
  return out;
}

/** Permission codes the seeder writes to the `permissions` table. */
export function seededCodes(src) {
  return new Set([...src.matchAll(/code: ['"]([a-z_]+\.[a-z_.]+)['"]/g)].map((m) => m[1]));
}

/**
 * The permission codes a router file gates with, and the /api segments it names.
 *
 * A TODO comment naming requirePermission is NOT a gate, which is the whole
 * distinction this inventory turns on - deal-desk-copilot carries one and the
 * code it names has never run. Comments are stripped first.
 */
export function analyzeRouter(source, permissionMap) {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const codes = new Set();
  for (const m of src.matchAll(/requirePermission\(\s*\[([^\]]*)\]/g)) {
    for (const ref of m[1].matchAll(/PERMISSIONS\.([A-Z0-9_.]+)/g)) {
      const resolved = permissionMap.get(ref[1]);
      codes.add(resolved ?? `PERMISSIONS.${ref[1]} (unresolved)`);
    }
    for (const lit of m[1].matchAll(/['"]([a-z_]+\.[a-z_.]+)['"]/g)) codes.add(lit[1]);
  }

  const segments = new Set();
  for (const m of src.matchAll(/['"]\/api\/([a-z0-9-]+)/g)) segments.add(m[1]);

  return { codes: [...codes].sort(), segments: [...segments].sort() };
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/^routes.*\.ts$/.test(entry) || dir.endsWith('/routes')) out.push(full);
  }
  return out;
}

/**
 * Is this segment a gap? A segment whose Express predecessor deliberately gated
 * it, where the edge function serving production does not, and the triage did
 * not decide it was open on purpose.
 *
 * ROW-SCOPED COUNTS AS UNGATED WHEN THE PREDECESSOR GATED A WRITE. The first
 * version looked only for "open to all roles" and missed technician-management,
 * which check:edge-rbac files as row-scoped because its roster READ narrows to
 * the caller - a statement about which rows you can see that says nothing about
 * whether you may create, edit or delete one. Its five writes had no role check
 * while the predecessor gated exactly those on a seeded service.technician.manage.
 *
 * Pure and exported so the rule can be tested against a row-scoped row whose
 * predecessor gated a write. Fixing the tree removed the only live example, so
 * a mutant disabling this branch survived until a fixture carried one.
 */
export const WRITE_SHAPED = /\.(manage|create|update|delete|approve|assign|publish)$/;

const DECIDED_OPEN = ['open-by-design', 'public', 'internal', 'headless'];

export function isGap(row) {
  if (!row.fn) return false;
  if (DECIDED_OPEN.includes(row.verdict)) return false;
  if (/open to all roles|no role/i.test(row.enforces)) return true;
  return /row-scoped/i.test(row.enforces) && (row.codes ?? []).some((c) => WRITE_SHAPED.test(c));
}

/**
 * ENTRY-POINT GUARD. Everything below reads the repo and WRITES the doc, so
 * importing this module for its pure helpers - which the unit test does, since
 * reading a regex proves it is present and only calling it proves what comes
 * out - must not regenerate a committed file as a side effect. `import.meta.main`
 * is a Deno API and is always undefined in Node (CLAUDE.md records a seeder that
 * silently did nothing for exactly that reason), so the check is argv-based.
 */
const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

function main() {
  const permissionMap = helperValues(
    readFileSync(join(ROOT, 'server/middleware/rbac-route-helper.ts'), 'utf8'),
  );
  const seeded = seededCodes(
    readFileSync(join(ROOT, 'server/database-updater/seeders/rbac-seeder.ts'), 'utf8'),
  );

  // ---- live routers -------------------------------------------------------
  const liveFiles = [
    ...walkFiles(join(ROOT, 'server')).filter((f) => /\/routes[^/]*\.ts$/.test(f)),
    ...walkFiles(join(ROOT, 'server/routes')),
  ]
    .filter((f) => !f.includes('/tests/'))
    .filter((f) => !/rbac-route-helper|enhanced-rbac-middleware/.test(f));

  const records = new Map(); // segment -> { codes:Set, sources:Set }
  const note = (segment, code, source) => {
    if (!records.has(segment)) records.set(segment, { codes: new Set(), sources: new Set() });
    const r = records.get(segment);
    r.codes.add(code);
    r.sources.add(source);
  };

  for (const file of new Set(liveFiles)) {
    const { codes, segments } = analyzeRouter(readFileSync(file, 'utf8'), permissionMap);
    if (codes.length === 0) continue;
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    for (const seg of segments) for (const c of codes) note(seg, c, `${rel} (live)`);
  }

  // ---- deleted routers, at their last committed version --------------------
  const deleted = new Set(
    git('log', '--diff-filter=D', '--name-only', '--pretty=format:', '--', 'server/')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^server\/routes.*\.ts$/.test(l) || /^server\/routes\/.*\.ts$/.test(l)),
  );

  for (const path of deleted) {
    if (existsSync(join(ROOT, path))) continue; // came back
    let source;
    try {
      const rev = git('rev-list', '-n', '1', 'HEAD', '--', path).trim();
      if (!rev) continue;
      source = git('show', `${rev}^:${path}`);
    } catch {
      continue;
    }
    const { codes, segments } = analyzeRouter(source, permissionMap);
    if (codes.length === 0) continue;
    for (const seg of segments) for (const c of codes) note(seg, c, `${path} (deleted)`);
  }

  // ---- what serves each segment today -------------------------------------
  const edgeDirs = new Set(
    readdirSync(join(ROOT, 'supabase/functions')).filter(
      (d) => !d.startsWith('_') && statSync(join(ROOT, 'supabase/functions', d)).isDirectory(),
    ),
  );

  const proxySrc = readFileSync(join(ROOT, 'server/middleware/edge-function-proxy.ts'), 'utf8');
  const aliases = new Map(); // segment -> edge dir
  for (const m of proxySrc.matchAll(/'\/api\/([a-z0-9-]+)[^']*':\s*\{[^}]*fn:\s*'([a-z0-9-]+)'/g)) {
    aliases.set(m[1], m[2]);
  }
  const serverSrc = readFileSync(join(ROOT, 'supabase/functions/server.ts'), 'utf8');
  for (const m of serverSrc.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/g)) {
    if (edgeDirs.has(m[2])) aliases.set(m[1], m[2]);
  }

  const edgeFor = (segment) => {
    if (aliases.has(segment)) return aliases.get(segment);
    return edgeDirs.has(segment) ? segment : null;
  };

  // ---- what the edge function enforces today ------------------------------
  const rbacList = execFileSync('node', [join(ROOT, 'scripts/check-edge-rbac.mjs'), '--list'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  /**
   * --list prints three SECTIONS, and the section is the answer - only the GATED
   * one annotates each name with which signal it matched. Reading the annotation
   * alone left `crm` and `technician-management` as "no classification" when they
   * are row-scoped and ungated respectively, which would have read as a gap in
   * this tool rather than a fact about them.
   */
  const enforcement = new Map();
  let section = null;
  for (const line of rbacList.split('\n')) {
    if (/^[A-Z]/.test(line)) {
      if (line.startsWith('GATED')) section = 'gated';
      else if (line.startsWith('ROW-SCOPED')) section = 'row-scoped';
      else if (line.startsWith('OPEN TO EVERY ROLE')) section = 'open to all roles';
      continue;
    }
    const m = /^\s+([a-z0-9-]+)\s*(.*)$/.exec(line);
    if (!m || !section || !edgeDirs.has(m[1])) continue;
    enforcement.set(m[1], m[2].trim() ? `${section} ${m[2].trim()}` : section);
  }
  if (enforcement.size < 100) {
    console.error(`✗ Only ${enforcement.size} function(s) classified - --list stopped parsing.`);
    process.exit(2);
  }

  const triage = JSON.parse(readFileSync(join(ROOT, 'docs/edge-rbac-triage.json'), 'utf8'));
  const verdicts = new Map(triage.triage.map((e) => [e.fn, e.verdict]));

  // ---- report -------------------------------------------------------------
  const rows = [];
  for (const [segment, r] of [...records].sort()) {
    const fn = edgeFor(segment);
    rows.push({
      segment,
      codes: [...r.codes].sort(),
      unseeded: [...r.codes].filter((c) => !seeded.has(c)).sort(),
      sources: [...r.sources].sort(),
      fn,
      enforces: fn ? (enforcement.get(fn) ?? 'no classification') : 'no edge function',
      verdict: fn ? (verdicts.get(fn) ?? '-') : '-',
    });
  }

  const gaps = rows.filter(isGap);

  if (CHECK) {
    if (rows.length < 5) {
      console.error(
        `✗ Only ${rows.length} predecessor(s) resolved - the extraction stopped matching.`,
      );
      process.exit(2);
    }
    if (gaps.length > 0) {
      console.error(`✗ ${gaps.length} segment(s) gated in Express and ungated on the edge:\n`);
      for (const g of gaps) console.error(`    /api/${g.segment} -> ${g.fn} (${g.verdict})`);
      process.exit(1);
    }
    console.log(
      `✓ ${rows.length} Express-gated segment(s); none is served by an edge function that ` +
        `enforces nothing without a recorded reason.`,
    );
    process.exit(0);
  }

  const lines = [];
  lines.push("# What each edge function's Express predecessor enforced");
  lines.push('');
  lines.push('<!-- GENERATED by scripts/edge-rbac-predecessors.mjs. Do not edit by hand. -->');
  lines.push('');
  lines.push('SEC-EDGE-001 AC4. Read the script header first: this is evidence about INTENT,');
  lines.push('not a list of gates to copy. SEC-EDGE-002 established that the Express gates and');
  lines.push('the seeded `permissions` table use different vocabularies, so a code copied');
  lines.push('verbatim can deny everyone below platform admin - the "seeded" column is the');
  lines.push('whole reason each row carries it.');
  lines.push('');
  lines.push(`Regenerate: \`node scripts/edge-rbac-predecessors.mjs\`. Guard: \`--check\`.`);
  lines.push('');
  lines.push(`${rows.length} URL segments had a permission gate in Express.`);
  lines.push('');
  lines.push(
    '| /api segment | edge function | Express permission(s) | seeded? | edge enforces | triage |',
  );
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const seededMark =
      r.codes.length === 0 ? '-' : r.unseeded.length === 0 ? 'yes' : `no: ${r.unseeded.join(', ')}`;
    lines.push(
      `| \`/api/${r.segment}\` | ${r.fn ? `\`${r.fn}\`` : '_none_'} | ${r.codes.join('<br>')} | ${seededMark} | ${r.enforces} | ${r.verdict} |`,
    );
  }
  lines.push('');
  lines.push('## Where each predecessor was read');
  lines.push('');
  for (const r of rows) {
    lines.push(`- \`/api/${r.segment}\`: ${r.sources.join(', ')}`);
  }
  lines.push('');
  writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${relative(ROOT, OUT)}: ${rows.length} segment(s), ${gaps.length} gap(s).`);
  for (const g of gaps) console.log(`  GAP /api/${g.segment} -> ${g.fn} (${g.verdict})`);
}

if (isEntryPoint) main();
