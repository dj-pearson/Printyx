#!/usr/bin/env node
/**
 * An invalidation key that matches no query key refreshes nothing, silently
 * (INVALIDATE-001, INVALIDATE-002).
 *
 * The mutation succeeds, the toast says saved, and the list on screen keeps the
 * old rows until a reload. There is no error anywhere, which is why these
 * accumulate: EnhancedReportsHub keys its saved-report list
 * ['reporting/reports', ...] while CustomReportBuilder invalidated
 * ['/api/reports'], so a report the user had just saved did not appear.
 *
 * TANSTACK MATCHES BY PREFIX, ELEMENT BY ELEMENT, and both halves of that
 * matter. An invalidation key is a match when it is an element-wise prefix of a
 * query key, so ['/api/leads'] reaches ['/api/leads', id] - but ['/api/leads',
 * id, 'contacts'] reaches NOTHING when the only query is ['/api/leads', id],
 * because a longer key is not a prefix of a shorter one. And because a key
 * element here is a whole URL, ['/api/rbac'] does not reach ['/api/rbac/roles']
 * either: those are two different strings, not a path and its child. That
 * second case is what invalidateApiPath in lib/queryClient.ts exists for, and
 * this guard treats a call to it as satisfied by any query under that path.
 *
 * THREE THINGS IT RESOLVES rather than reporting, each of which was a false
 * positive in the first cut:
 *   - a key held in a local `const queryKey = [...]` (useCrmNotes,
 *     useCustomFields, MeterReadReview all do this);
 *   - `${...}` interpolation, normalised to a placeholder, since
 *     `/api/x/${bookId}` and `/api/x/${id}` are the same key at runtime;
 *   - optional chaining, so `project.id` and `project?.id` compare equal.
 *
 * AND IT STRIPS COMMENTS FIRST, on both sides. Every note above explaining a
 * repointed key quotes the dead key it replaced, and queryClient.ts's own doc
 * comment contains an example invalidation. A guard that reads its own
 * explanation reports it.
 *
 * Anything it cannot resolve - a key assembled from a variable at runtime -
 * goes in docs/invalidation-key-exemptions.json with a reason, not into a
 * silent skip. Hard gate at zero unresolved findings.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const EXEMPTIONS_FILE = 'docs/invalidation-key-exemptions.json';
const ORPHANS_FILE = 'docs/orphan-files-baseline.json';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry.name)) files.push(p.replace(/\\/g, '/'));
  }
})(ROOT);

// Blanked IN PLACE, never deleted: a block comment removed outright shifts
// every line below it and the reported line number stops matching the file.
const stripComments = (s) =>
  s
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, (m, p1) => p1 + ' '.repeat(m.length - p1.length)))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Read the bracketed array whose '[' sits at `i`. Returns its top-level elements. */
function readArray(src, i) {
  if (src[i] !== '[') return null;
  let depth = 0;
  let end = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') {
      if (--depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end < 0) return null;
  const inner = src.slice(i + 1, end);
  let d = 0;
  let cur = '';
  const parts = [];
  for (const c of inner) {
    if ('([{'.includes(c)) d++;
    if (')]}'.includes(c)) d--;
    if (c === ',' && d === 0) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const normEl = (e) =>
  e
    .replace(/\s+/g, '')
    .replace(/\$\{[^}]*\}/g, '${}')
    .replace(/\?\./g, '.')
    .replace(/^[`'"]|[`'"]$/g, '');
const normKey = (els) => els.map(normEl);

const MUTATORS = /(invalidateQueries|refetchQueries|removeQueries|cancelQueries)\s*\(/g;
const PATH_HELPER = /invalidateApiPath\s*\(\s*([`'"][^`'"]*[`'"])\s*\)/g;

const queryKeys = [];
const invalidations = [];
const pathInvalidations = [];
const unresolved = [];

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));

  // Local `const someKey = [...]` declarations, so a key held in a variable
  // still counts as a query key.
  const locals = new Map();
  for (const m of src.matchAll(/\bconst\s+(\w*[kK]ey\w*)\s*=\s*\[/g)) {
    const els = readArray(src, src.indexOf('[', m.index));
    if (els) locals.set(m[1], normKey(els));
  }

  // A key whose single element is a string const - `const queueKey = \`/api/x?\
  // status=${f}\`` then `queryKey: [queueKey]` - is the same shape one level
  // down, and MeterReadReview does exactly that.
  const strConsts = new Map();
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([`'"][^`'"\n]*[`'"])\s*;/g)) {
    strConsts.set(m[1], m[2]);
  }
  const resolveEl = (e) => normEl(strConsts.get(e.trim()) ?? e);
  const resolveKey = (els) => els.map(resolveEl);

  const invRanges = [];
  let m;
  MUTATORS.lastIndex = 0;
  while ((m = MUTATORS.exec(src))) {
    const window = src.slice(m.index, m.index + 400);
    const line = src.slice(0, m.index).split('\n').length;

    // `queryKey: someKey` and the `{ queryKey }` shorthand both resolve through
    // the local const declarations collected above. Without this every hook in
    // the tree that names its key once and reuses it reads as unresolvable,
    // which is 24 of them and would have buried the five real findings.
    const viaIdent = window.match(/queryKey\s*:\s*([A-Za-z_$][\w$]*)/);
    const viaShorthand = /\{\s*queryKey\s*[,}]/.test(window);
    if (viaIdent && locals.has(viaIdent[1])) {
      invalidations.push({
        file,
        line,
        fn: m[1],
        els: locals.get(viaIdent[1]),
        resolved: viaIdent[1],
      });
      continue;
    }
    if (viaShorthand && locals.has('queryKey')) {
      invalidations.push({
        file,
        line,
        fn: m[1],
        els: locals.get('queryKey'),
        resolved: 'queryKey',
      });
      continue;
    }

    const rel = window.search(/queryKey\s*:\s*\[/);
    let idx = -1;
    if (rel >= 0) idx = m.index + window.indexOf('[', rel);
    else {
      const bare = window.search(/\(\s*\[/);
      if (bare >= 0) idx = m.index + window.indexOf('[', bare);
    }
    if (idx < 0) {
      // predicate:, a variable key, or a bare invalidateQueries() - the last of
      // which invalidates everything and is never a dead key.
      if (!/predicate\s*:/.test(window) && !/invalidateQueries\s*\(\s*\)/.test(window)) {
        const ident = window.match(/queryKey\s*:\s*([A-Za-z_$][\w$]*)/);
        unresolved.push({
          file,
          line,
          fn: m[1],
          ident: ident?.[1],
          text: window.slice(0, 80).replace(/\s+/g, ' '),
        });
      }
      continue;
    }
    const els = readArray(src, idx);
    if (!els) continue;
    invRanges.push([m.index, idx + 1]);
    invalidations.push({ file, line, fn: m[1], els, normalised: resolveKey(els) });
  }

  PATH_HELPER.lastIndex = 0;
  while ((m = PATH_HELPER.exec(src))) {
    pathInvalidations.push({
      file,
      line: src.slice(0, m.index).split('\n').length,
      prefix: normEl(m[1]),
    });
  }

  for (const km of src.matchAll(/queryKey\s*:\s*(\[|\w+)/g)) {
    if (invRanges.some(([a, b]) => km.index >= a && km.index < b)) continue;
    if (km[1] === '[') {
      const els = readArray(src, src.indexOf('[', km.index));
      if (els) queryKeys.push({ file, els: resolveKey(els) });
    } else if (locals.has(km[1])) {
      queryKeys.push({ file, els: locals.get(km[1]) });
    }
  }
  for (const els of locals.values()) queryKeys.push({ file, els });
}

const isPrefix = (inv, q) => inv.length <= q.length && inv.every((e, i) => e === q[i]);
const underPath = (prefix, q) => {
  const first = q[0];
  return (
    typeof first === 'string' &&
    (first === prefix || first.startsWith(`${prefix}/`) || first.startsWith(`${prefix}?`))
  );
};

const exemptions = JSON.parse(fs.readFileSync(EXEMPTIONS_FILE, 'utf8')).exempt;
const exemptKey = (e) => `${e.file}::${e.key}`;
const exemptSet = new Map(exemptions.map((e) => [exemptKey(e), e]));
const orphans = new Set(JSON.parse(fs.readFileSync(ORPHANS_FILE, 'utf8')).allowed ?? []);

const seenExempt = new Set();
const dead = [];
for (const inv of invalidations) {
  const key = inv.resolved ? inv.els : (inv.normalised ?? normKey(inv.els));
  if (queryKeys.some((q) => isPrefix(key, q.els))) continue;
  const sig = inv.resolved
    ? `${inv.file}::${inv.resolved}`
    : `${inv.file}::[${inv.els.join(', ').replace(/\s+/g, ' ')}]`;
  if (exemptSet.has(sig)) {
    seenExempt.add(sig);
    continue;
  }
  dead.push({ ...inv, sig, orphan: orphans.has(inv.file) });
}

for (const p of pathInvalidations) {
  if (queryKeys.some((q) => underPath(p.prefix, q.els))) continue;
  const sig = `${p.file}::invalidateApiPath('${p.prefix}')`;
  if (exemptSet.has(sig)) {
    seenExempt.add(sig);
    continue;
  }
  dead.push({
    file: p.file,
    line: p.line,
    fn: 'invalidateApiPath',
    els: [p.prefix],
    sig,
    orphan: orphans.has(p.file),
  });
}

const live = dead.filter((d) => !d.orphan);
const onOrphans = dead.filter((d) => d.orphan);

let failed = false;

if (live.length) {
  failed = true;
  console.error('Invalidation keys that match no query key:\n');
  for (const d of live) {
    console.error(`  ${d.file}:${d.line}  ${d.fn}  [${d.els.join(', ')}]`);
  }
  console.error(
    '\nTanStack matches element-wise prefixes, so a LONGER key reaches nothing and a\n' +
      'URL is not a path. Repoint it at the query it meant to refresh, use\n' +
      `invalidateApiPath() for a URL family, or record it in ${EXEMPTIONS_FILE}.\n`,
  );
}

const unexplained = unresolved.filter((u) => {
  const sig = `${u.file}::${u.ident ?? ''}`;
  if (u.ident && exemptSet.has(sig)) {
    seenExempt.add(sig);
    return false;
  }
  return true;
});

if (unexplained.length) {
  failed = true;
  console.error('Invalidations whose key could not be read statically:\n');
  for (const u of unexplained) console.error(`  ${u.file}:${u.line}  ${u.text}`);
  console.error(`\nRecord each in ${EXEMPTIONS_FILE} with the reason.\n`);
}

const staleExemptions = exemptions.filter((e) => !seenExempt.has(exemptKey(e)));
if (staleExemptions.length) {
  failed = true;
  console.error(`Stale entries in ${EXEMPTIONS_FILE} - these invalidations no longer exist:\n`);
  for (const e of staleExemptions) console.error(`  ${e.file}  ${e.key}`);
  console.error('\nRemove them. An exemption that outlives its code stops being evidence.\n');
}

if (failed) process.exit(1);

console.log(
  `check:invalidation-keys - ${invalidations.length + pathInvalidations.length} invalidations ` +
    `across ${files.length} files, every one reaches a query ` +
    `(${exemptions.length} exempt, ${onOrphans.length} on unreachable files).`,
);
