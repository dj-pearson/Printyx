#!/usr/bin/env node
/**
 * A download that never checks response.ok writes the ERROR BODY to disk under
 * the filename the user expected. They get business-records-csv-1712.csv
 * containing {"error":"Unauthorized"}, and no indication anything went wrong -
 * PlatformBusinessRecords even followed it with a toast reading
 * "Success - Exported 47 records as CSV", over an endpoint that exists on no
 * backend at all.
 *
 * The same call is usually a raw fetch(), which is wrong twice more: it carries
 * no Authorization header, and a relative path is never rewritten to the
 * functions host, so it 401s or 404s the moment it leaves dev.
 *
 * client/src/lib/authed-download.ts does all three - auth headers, getApiUrl,
 * and a non-2xx throw carrying the server's own message. Use downloadAuthedFile
 * or fetchAuthedBlob.
 *
 * The rule: a `.blob()` on a fetch Response must have a `.ok` or status check
 * within the preceding 20 lines. Hard gate at zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
// The helpers ARE the checked implementations.
const EXEMPT = /lib\/(authed-download|invoice-pdf|quote-pdf|document-export|truck-stock-csv)\.ts$/;

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p) && !EXEMPT.test(p)) files.push(p);
  }
})(ROOT);

const findings = [];
for (const file of files) {
  const src = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n').map((l) => l.replace(/\/\/.*$/, ''));
  lines.forEach((line, i) => {
    // res.blob() on something that looks like a fetch Response, not new Blob().
    if (!/\b[a-zA-Z_$][\w$]*\s*\.\s*blob\s*\(\s*\)/.test(line)) return;
    const before = lines.slice(Math.max(0, i - 20), i + 1).join('\n');
    if (/\.ok\b|\.status\s*(===|!==|>=|<=|>|<)|fetchAuthedBlob|downloadAuthedFile/.test(before))
      return;
    findings.push(`${file}:${i + 1}  ${line.trim()}`);
  });
}

if (findings.length) {
  console.error('Blob download with no response.ok check (saves the error body as the file):\n');
  for (const f of findings) console.error('  ' + f);
  console.error(`\n${findings.length} finding(s). Use downloadAuthedFile from @/lib/authed-download.`);
  process.exit(1);
}
console.log(`check:blob-downloads - ${files.length} files, every download checks its response.`);
