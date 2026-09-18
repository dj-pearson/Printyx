#!/usr/bin/env node
/**
 * The default queryFn in client/src/lib/queryClient.ts builds its URL with
 * `queryKey.join('/')`. EVERY element of the key is therefore a URL path
 * segment, and this guard covers both ways that goes wrong.
 *
 * AN OBJECT ELEMENT (QUERYKEY-001) stringifies to "[object Object]" and the
 * request goes to a path that exists nowhere - and because the page usually
 * renders `data ?? []`, the screen is empty rather than broken. Ten of those
 * shipped at once: three inert time-range selectors on PlatformCRMDashboard,
 * four dead filters on MarginAnalysisReport and ManufacturerIntegrationAudit,
 * and the Deals/Activities/Health tabs of the platform record detail pages.
 *
 * A STRING ELEMENT (QUERYKEY-002) is harder, because some of them are correct:
 * ['/api/quotes', id, 'line-items'] really is a path. Thirteen were not -
 * a period, a status, a scope, a tenant - and each produced either a 404 or a
 * silently unfiltered read while the selector the user moved did nothing.
 *
 * So the rule is a NAMED ALLOWLIST rather than a pattern. Any multi-element key
 * must appear in docs/query-key-path-segments.json, where each entry records
 * the URL it builds and the handler that serves it. Both directions fail: an
 * unlisted key, and a listed key that no longer exists. A name-based heuristic
 * was the alternative and it is exactly wrong here - two of the thirteen
 * (CustomerContracts, CustomerQuotes) read as textbook sub-resources,
 * ['/api/contracts', 'customer', customerId], and the contracts function reads
 * parts[0] as a contract id, so that asked for a contract called "customer".
 * Only opening the handler tells you which kind you have, which is what the
 * allowlist is a record of.
 *
 * A useQuery that supplies its own queryFn is out of scope - it decides its own
 * URL and the key is only a cache identity there.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const ALLOWLIST_FILE = 'docs/query-key-path-segments.json';

const normalise = (s) => s.replace(/\s+/g, ' ').trim();
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')).allowed;
const allowed = new Map(allowlist.map((e) => [`${e.file}::${normalise(e.key)}`, e]));
const seen = new Set();
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry.name)) files.push(p);
  }
})(ROOT);

const findings = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /useQuery(?:<[^>]*>)?\(\{/g;
  let m;
  while ((m = re.exec(src))) {
    const start = re.lastIndex - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) continue;
    const body = src.slice(start, end + 1);
    if (/\bqueryFn\s*:/.test(body)) continue;

    const km = body.match(/queryKey\s*:\s*\[([\s\S]*?)\]\s*,/);
    if (!km) continue;

    // Top-level elements of the key array.
    let d = 0;
    let cur = '';
    const parts = [];
    for (const c of km[1]) {
      if ('([{'.includes(c)) d++;
      if (')]}'.includes(c)) d--;
      if (c === ',' && d === 0) {
        parts.push(cur);
        cur = '';
      } else cur += c;
    }
    parts.push(cur);

    const els = parts.map((p) => p.trim()).filter(Boolean);
    const line = src.slice(0, start).split('\n').length;
    const rel = file.replace(/\\/g, '/');

    for (const el of els) {
      if (!el.startsWith('{')) continue;
      findings.push(`${rel}:${line}  object in queryKey -> ${normalise(el)}`);
    }

    if (els.length < 2) continue;
    const signature = `${rel}::${normalise(`[${els.join(', ')}]`)}`;
    if (allowed.has(signature)) {
      seen.add(signature);
      continue;
    }
    findings.push(
      `${rel}:${line}  multi-element queryKey -> ${normalise(`[${els.join(', ')}]`)}\n` +
        `      requests ${normalise(els.join('/'))} - put a filter value in the query string,\n` +
        `      or add it to ${ALLOWLIST_FILE} with the handler that serves that path.`,
    );
  }
}

const stale = allowlist.filter((e) => !seen.has(`${e.file}::${normalise(e.key)}`));

if (findings.length || stale.length) {
  if (findings.length) {
    console.error('Query keys that build a URL path out of something that is not one:\n');
    for (const f of findings) console.error('  ' + f);
  }
  if (stale.length) {
    console.error(`\nStale entries in ${ALLOWLIST_FILE} - these keys no longer exist:\n`);
    for (const e of stale) console.error(`  ${e.file}  ${normalise(e.key)}`);
    console.error('\nRemove them. An allowlist that outlives its code stops being evidence.');
  }
  process.exit(1);
}
console.log(
  `check:query-keys - ${files.length} files, no object keys and ` +
    `${allowlist.length} multi-element keys, each recorded as a real path in ${ALLOWLIST_FILE}.`,
);
