#!/usr/bin/env node
/**
 * The default queryFn in client/src/lib/queryClient.ts builds its URL with
 * `queryKey.join('/')`. An object element therefore stringifies to
 * "[object Object]" and the request goes to a path that exists nowhere - and
 * because the page usually renders `data ?? []`, the screen is empty rather
 * than broken. Ten of these shipped at once: three inert time-range selectors
 * on PlatformCRMDashboard, four dead filters on MarginAnalysisReport and
 * ManufacturerIntegrationAudit, and the Deals/Activities/Health tabs of the
 * platform record detail pages.
 *
 * Hard gate at zero: a filter value belongs in the URL's query string, not in
 * a path segment. A useQuery that supplies its own queryFn is out of scope -
 * it decides its own URL and the key is only a cache identity there.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
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

    for (const raw of parts) {
      const el = raw.trim();
      if (!el.startsWith('{')) continue;
      const line = src.slice(0, start).split('\n').length;
      findings.push(`${file}:${line}  object in queryKey -> ${el.replace(/\s+/g, ' ')}`);
    }
  }
}

if (findings.length) {
  console.error(
    'Objects in a default-queryFn queryKey (each becomes "[object Object]" in the URL):\n',
  );
  for (const f of findings) console.error('  ' + f);
  console.error(`\n${findings.length} finding(s). Put filter values in the query string.`);
  process.exit(1);
}
console.log(`check:query-keys - ${files.length} files, no object query keys.`);
