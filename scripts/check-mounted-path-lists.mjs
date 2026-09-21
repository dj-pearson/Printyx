#!/usr/bin/env node
/**
 * A path literal compared against `req.path` inside a middleware mounted at a
 * prefix that literal starts with (LAUNCH-008, round 117).
 *
 * Express rewrites `req.url` inside a handler mounted with a path: under
 * `app.use('/api', mw)` a request for `/api/health` arrives with
 * `req.path === '/health'`. So a list written as `/api/health` and compared to
 * `req.path` matches NOTHING, silently, and the failure is invisible in both
 * directions - it made one gate refuse every path it was meant to allow, and a
 * registration lock allow every path it was meant to block.
 *
 * WHAT IT READS. Mount sites are resolved from the files that call `app.use`,
 * not guessed: for each `app.use('<prefix>', <arg>)` with a non-root prefix,
 * the body searched is either the INLINE arrow at that call site or, when the
 * argument is an identifier, the module that identifier was imported from. A
 * finding is a string literal starting with that same prefix appearing in a
 * body that also reads `req.path`.
 *
 * WHAT IT CANNOT SEE, stated so a clean run is never read as proof:
 *  - a middleware reached through a wrapper or a factory whose body lives in a
 *    third file;
 *  - a path assembled at runtime rather than written as a literal;
 *  - `req.url`, which is rewritten the same way but is rarely compared to a
 *    list here;
 *  - a mount whose prefix is itself a variable.
 *
 * `req.originalUrl` and `req.baseUrl` are NOT rewritten, so a body using either
 * is exempt - that is the correct spelling and reporting it would push people
 * back toward the broken one.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Files that mount middleware with a path prefix. */
const MOUNT_FILES = ['server/routes.ts', 'server/routes-registry.ts', 'server/index.ts'];

const read = (p) => readFileSync(join(REPO, p), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Resolve a relative import specifier to a file under the repo. */
function resolveModule(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = join(REPO, dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate.slice(REPO.length + 1);
  }
  return null;
}

/** identifier -> module path, from this file's static imports. */
function importMap(file, src) {
  const map = new Map();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'([^']+)'/g)) {
    const target = resolveModule(file, m[2]);
    if (!target) continue;
    for (const raw of m[1].split(',')) {
      const name = raw
        .split(/\s+as\s+/)
        .pop()
        .trim();
      if (name) map.set(name, target);
    }
  }
  return map;
}

/** The balanced body starting at the `(` of an app.use call. */
function callBody(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(openParen + 1, i);
    }
  }
  return '';
}

/**
 * Every (prefix, body, label) a mount contributes.
 *
 * An inline arrow contributes its own text; an identifier contributes the
 * module it was imported from.
 */
export function mountedBodies() {
  const out = [];
  for (const file of MOUNT_FILES) {
    if (!existsSync(join(REPO, file))) continue;
    const raw = read(file);
    const src = stripComments(raw);
    const imports = importMap(file, src);
    for (const m of src.matchAll(/app\.use\(\s*'(\/[^']*)'\s*,/g)) {
      const prefix = m[1].replace(/\/$/, '');
      if (!prefix || prefix === '/') continue;
      const body = callBody(src, src.indexOf('(', m.index));
      const args = body.slice(body.indexOf(',') + 1);
      const ident = args.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (ident && imports.has(ident[1])) {
        const target = imports.get(ident[1]);
        out.push({
          prefix,
          label: `${file} -> ${target}`,
          file: target,
          body: stripComments(read(target)),
        });
      } else {
        out.push({ prefix, label: `${file} (inline at ${prefix})`, file, body: args });
      }
    }
  }
  return out;
}

/**
 * A body that reconstructs the unstripped path is spelling it correctly.
 *
 * `req.originalUrl` and `req.baseUrl` are not rewritten by a mount, and
 * `fullApiPath(req)` is the shared helper that joins the second to `req.path` -
 * server/lib/public-api-paths.ts. Exempting the helper by name matters: without
 * it the guard reports the sanctioned fix and pushes the next reader back
 * toward the broken spelling.
 */
const USES_UNSTRIPPED = /req\.(originalUrl|baseUrl)|fullApiPath\(/;

export function findings() {
  const out = [];
  // Keyed across mounts, not just within one: a module mounted twice (both
  // api-versioning entry points are) otherwise reports and BASELINES every
  // literal twice, and a list with duplicates in it is one nobody trusts.
  const emitted = new Set();
  for (const mount of mountedBodies()) {
    if (!/req\.path/.test(mount.body)) continue;
    if (USES_UNSTRIPPED.test(mount.body)) continue;
    const seen = new Set();
    for (const lit of mount.body.matchAll(/'((?:\/[\w:.\-*]+)+)'/g)) {
      const value = lit[1];
      if (value === mount.prefix) continue;
      if (!value.startsWith(mount.prefix + '/')) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      const key = `${mount.label}::${value}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      out.push({ mount: mount.label, prefix: mount.prefix, literal: value, key });
    }
  }
  return out;
}

const BASELINE = 'docs/mounted-path-lists-baseline.json';

function existingNote() {
  try {
    return JSON.parse(read(BASELINE)).note ?? null;
  } catch {
    return null;
  }
}

function main() {
  const found = findings();
  const mounts = mountedBodies();
  // A floor: a walk that resolves no mounts cannot report anything, and would
  // pass in silence exactly when the parser has stopped matching.
  if (mounts.length < 5) {
    console.error(
      `check:mounted-path-lists - resolved only ${mounts.length} mount(s); the walk is broken.`,
    );
    process.exit(2);
  }

  let baseline = { note: '', entries: [] };
  try {
    baseline = JSON.parse(read(BASELINE));
  } catch {
    /* first run */
  }

  if (process.argv.includes('--update-baseline')) {
    const note =
      existingNote() ??
      'Path literals compared against req.path inside a middleware mounted at a prefix those literals start with. Express strips the mount prefix, so the comparison matches nothing - a gate that refuses everything it meant to allow, or a lock that blocks nothing. Each entry needs a reason, not a line. See scripts/check-mounted-path-lists.mjs.';
    const payload = { note, entries: [...new Set(found.map((f) => f.key))].sort() };
    writeFileSync(join(REPO, BASELINE), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Baseline updated: ${payload.entries.length} entr(ies).`);
    return;
  }

  const known = new Set(baseline.entries ?? []);
  const novel = found.filter((f) => !known.has(f.key));
  if (novel.length > 0) {
    console.error(`✗ ${novel.length} path literal(s) compared against a stripped req.path:\n`);
    for (const f of novel) {
      console.error(`    ${f.mount}`);
      console.error(
        `      '${f.literal}' can never match req.path under the '${f.prefix}' mount\n`,
      );
    }
    console.error(
      'Compare `req.baseUrl + req.path` (see server/lib/public-api-paths.ts), or write the\n' +
        'literal without the mount prefix. A list that matches nothing fails silently.',
    );
    process.exit(1);
  }
  console.log(
    `✓ No path literal compared against a stripped req.path (${mounts.length} mount(s) walked, ${known.size} baselined).`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) await main();
