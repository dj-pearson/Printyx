#!/usr/bin/env node
/**
 * An outbound `fetch()` in an edge function whose URL is not a constant
 * (SEC-002).
 *
 * Edge functions run inside the deployment's network with the service-role key
 * in scope, so a request to a URL the caller chose is a request from there to
 * anywhere the cluster can reach - and several of these endpoints hand the
 * RESPONSE back, which turns it from a blind request into a read primitive.
 * supabase/functions/_shared/safe-fetch.ts is the control: scheme allowlist,
 * private and reserved ranges, DNS resolution (which is what stops a public
 * hostname pointing at 127.0.0.1), a timeout, and all of it re-run on every
 * redirect hop.
 *
 * WHAT COUNTS AS SAFE, so the guard does not argue against its own fix:
 *   - `safeFetch(...)`, or a `fetch(` preceded within the same function by an
 *     `assertSafeUrl(...)` - the second is for a caller that must OBSERVE a
 *     redirect rather than follow one.
 *   - a URL that is a string literal, or built from one by interpolation whose
 *     leading text is a literal scheme (`https://api.example.com/${id}`).
 *   - a URL from a module-level constant whose value is a literal, and the
 *     same for `Deno.env.get(...)` - an operator setting an endpoint is not a
 *     caller choosing one.
 *
 * WHAT IT CANNOT SEE, stated so a clean run is never read as proof: a URL
 * assembled through several variables, a constant reassigned at runtime, and
 * anything reached through a helper in a third file. The baseline is a
 * worklist with a verdict per entry, not a list of settled debt.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(REPO, 'supabase/functions');
const BASELINE = 'docs/ssrf-fetch-baseline.json';

const read = (p) => readFileSync(p, 'utf8');
const stripComments = (src) =>
  // LINE COMMENTS FIRST. A line comment ending in `/*` - which any prose
  // mentioning a glob does - is read as a block opener by a block-first pass,
  // and everything up to the next `*/` is blanked. That cost this guard its
  // first run: ai-gpt5's OPENAI_RESPONSES_URL constant vanished and the fetch
  // beside it reported as a caller-supplied URL. CLAUDE.md records the same
  // failure in check:shared-helper-imports. The lookbehind keeps `https://`
  // intact, which is the mirror-image bug.
  //
  // Block comments are blanked to spaces rather than removed, so line numbers
  // stay honest in the report.
  src
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Every .ts under supabase/functions. Exported so the corpus floor is testable:
 * a floor inside main() is not exercised by importing the module, and a walk
 * that returns nothing reports nothing - which is what a clean run looks like. */
export function edgeFiles() {
  return walk(ROOT);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Module-level `const NAME = '<literal>'` or `= Deno.env.get(...)`. */
function constantUrls(src) {
  const names = new Set();
  // Not anchored to the line start: a URL constant is as often a local inside
  // the function that uses it as a module-level one, and requiring column zero
  // reported `const url = \`https://places.googleapis.com/...\`` as a caller's
  // choice.
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*['"]https?:\/\//g))
    names.add(m[1]);
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*`https?:\/\//g)) names.add(m[1]);
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*Deno\.env\.get\(/g))
    names.add(m[1]);
  // A local built from one of those by interpolation is still an operator's
  // endpoint, not a caller's: `const url = `${STRIPE_API}${path}``. Resolved
  // one level only - a chain of three is what the header says it cannot see.
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*`\$\{([A-Za-z_$][\w$]*)\}/g)) {
    if (names.has(m[2])) names.add(m[1]);
  }
  return names;
}

/** The argument text of a `fetch(` call, up to the balancing paren. */
function firstArg(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(openParen + 1, i);
    } else if (ch === ',' && depth === 1) return src.slice(openParen + 1, i);
  }
  return '';
}

export function findings() {
  const out = [];
  for (const file of walk(ROOT)) {
    const rel = relative(REPO, file);
    if (rel.endsWith('_shared/safe-fetch.ts')) continue;
    const raw = read(file);
    const src = stripComments(raw);
    if (!/\bfetch\(/.test(src)) continue;
    const constants = constantUrls(src);

    for (const m of src.matchAll(/(^|[^.\w])fetch\(/g)) {
      // The match ends ON the paren; computing its position any other way
      // drifts with the leading boundary character and silently reads the
      // wrong argument.
      const open = m.index + m[0].length - 1;
      const arg = firstArg(src, open).trim();
      if (!arg) continue;
      // A literal, or a template whose leading text is a scheme.
      if (/^['"]https?:\/\//.test(arg)) continue;
      if (/^`https?:\/\//.test(arg)) continue;
      const ident = arg.match(/^([A-Za-z_$][\w$]*)$/);
      if (ident && constants.has(ident[1])) continue;
      if (/^`\$\{([A-Za-z_$][\w$]*)\}/.test(arg)) {
        const name = arg.match(/^`\$\{([A-Za-z_$][\w$]*)\}/)[1];
        if (constants.has(name)) continue;
      }
      // Guarded: safeFetch, or an assertSafeUrl above it in the same file.
      const before = src.slice(0, m.index);
      const lastAssert = before.lastIndexOf('assertSafeUrl(');
      const lastFnStart = Math.max(
        before.lastIndexOf('\nasync function'),
        before.lastIndexOf('\nfunction'),
        before.lastIndexOf('\nexport default async function'),
      );
      if (lastAssert > -1 && lastAssert > lastFnStart) continue;

      const line = src.slice(0, m.index).split('\n').length;
      out.push({
        file: rel,
        line,
        arg: arg.split('\n')[0].slice(0, 60),
        key: `${rel}::${arg.split('\n')[0].trim().slice(0, 60)}`,
      });
    }
  }
  return out;
}

function existingNote() {
  try {
    return JSON.parse(read(join(REPO, BASELINE))).note ?? null;
  } catch {
    return null;
  }
}

function main() {
  const found = findings();
  const files = edgeFiles();
  if (files.length < 100) {
    console.error(`check:ssrf-fetch - walked only ${files.length} file(s); the walk is broken.`);
    process.exit(2);
  }

  let baseline = { note: '', entries: [] };
  try {
    baseline = JSON.parse(read(join(REPO, BASELINE)));
  } catch {
    /* first run */
  }

  if (process.argv.includes('--update-baseline')) {
    const note =
      existingNote() ??
      'Outbound fetches in edge functions whose URL is not a constant. Each is a request from inside the cluster to somewhere a caller or a tenant chose; several hand the response back. Wrap with safeFetch from _shared/safe-fetch.ts, or assertSafeUrl when the caller must observe a redirect. Each entry needs a verdict, not a line. See scripts/check-ssrf-fetch.mjs for what it cannot see.';
    writeFileSync(
      join(REPO, BASELINE),
      `${JSON.stringify({ note, entries: [...new Set(found.map((f) => f.key))].sort() }, null, 2)}\n`,
    );
    console.log(`Baseline updated: ${new Set(found.map((f) => f.key)).size} entr(ies).`);
    return;
  }

  const known = new Set(baseline.entries ?? []);
  const novel = found.filter((f) => !known.has(f.key));
  if (novel.length > 0) {
    console.error(`✗ ${novel.length} unguarded outbound fetch(es) in the edge tree:\n`);
    for (const f of novel) console.error(`    ${f.file}:${f.line}  fetch(${f.arg}`);
    console.error(
      '\nUse safeFetch from _shared/safe-fetch.ts, or assertSafeUrl before a fetch that must\n' +
        'observe a redirect. A constant endpoint is fine; a URL a caller chose is not.',
    );
    process.exit(1);
  }
  console.log(
    `✓ No new unguarded outbound fetch in the edge tree (${files.length} files walked, ${known.size} baselined).`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
