#!/usr/bin/env node
/**
 * apiRequest() called with the METHOD in the URL position.
 *
 * The signature is apiRequest(url, method = 'GET', body?, headers?), but it is
 * easy to write the axios/fetch-ish order instead:
 *
 *     apiRequest('POST', '/api/knowledge-base/articles/1/feedback', body)
 *
 * That sends a request to the URL "POST" with the HTTP method set to the path
 * string. The mutation fails silently from the user's point of view - it is a
 * network error, not a 4xx with a message.
 *
 * tsc cannot see it: the signature is (url: string, methodOrOptions: string |
 * ApiRequestOptions, ...), so both arguments are strings and both positions
 * accept anything. Six live sites existed when this check was written - a saved
 * dashboard layout, four integration actions (create, test, sync, disconnect)
 * and article feedback - across three pages.
 *
 * HARD GATE AT ZERO. There is no baseline: unlike the ratchets, every instance
 * of this is a broken request with no reason to keep one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['client/src'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// apiRequest( 'POST' , ...  — the method literal sitting where the url belongs.
const RE = /\bapiRequest\s*(?:<[^>]*>)?\s*\(\s*(['"`])(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\1/g;

const findings = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8');
    let m;
    while ((m = RE.exec(src))) {
      findings.push({
        file: relative(ROOT, file).replace(/\\/g, '/'),
        line: src.slice(0, m.index).split('\n').length,
        method: m[2],
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} apiRequest() call(s) with the method in the URL position:\n`);
  for (const f of findings) console.error(`    ${f.file}:${f.line}  apiRequest('${f.method}', ...`);
  console.error(
    '\nThe signature is apiRequest(url, method, body). Written this way the request\n' +
      'goes to the URL "' +
      findings[0].method +
      '" with the path as its HTTP method, and the\n' +
      'mutation fails as a network error rather than a readable 4xx.',
  );
  process.exit(1);
}

console.log('✓ No apiRequest() calls with the method in the URL position.');
