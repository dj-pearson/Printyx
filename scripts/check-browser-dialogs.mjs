#!/usr/bin/env node
/**
 * No raw `alert()` in the app (WF-S-08). Hard gate at zero.
 *
 * A browser alert blocks the main thread, cannot be styled, is unreadable on a
 * phone, and on this codebase it was where debug copy escaped to users.
 * LeadDetail shipped
 * a red "🔴 API TEST" button whose first line was
 * alert('Button clicked! Check console for API test results...') - and which
 * also POSTed a contact named Test Contact <test@test.com> into the tenant's
 * database through the live endpoint.
 *
 * The rest were not debug, and that is the more useful half of the finding:
 * five alerts carried real validation messages on pages that had no toast at
 * all. DoDEnforcementButton's was the only place the actual failures were ever
 * shown - the badge under the button prints a COUNT and a setTimeout clears it
 * after two seconds - so replacing it with a toast that carries the detail is
 * what makes those errors readable rather than merely prettier.
 *
 * Use `toast` from @/hooks/use-toast instead.
 *
 * SCOPED TO alert() ON PURPOSE. There are 22 `confirm()` calls and 4
 * `prompt()` calls in this tree, nearly all of them a delete confirmation, and
 * replacing those means an AlertDialog and a state machine per call site - a
 * UI story, not a find-and-replace. Filed as UI-BROWSER-DIALOGS-001 rather than
 * swept into a baseline here, because a baseline of 26 known-bad entries is
 * where the 27th hides.
 *
 * EXCLUDED BY RULE, not baselined: client/src/components/ui (vendored shadcn
 * primitives, out of scope the same way they are for check:orphan-files); a
 * member expression like `foo.alert(...)`, which is somebody's own method; and
 * PROSE, which is what the first version of this guard got wrong - it reported
 * AdminHub's `{n} critical alert(s) need review` as a call, because `alert(`
 * appears in the JSX text. The token has to sit in an expression position.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const SKIP_DIR = 'client/src/components/ui';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (p === SKIP_DIR) continue;
      walk(p);
    } else if (/\.tsx?$/.test(entry.name)) files.push(p);
  }
})(ROOT);

// Blanked in place so a comment explaining a removal is never read as code, and
// so the reported line still matches the file.
const stripComments = (s) =>
  s
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, (m, p1) => p1 + ' '.repeat(m.length - p1.length)))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));

/**
 * `alert(` in an EXPRESSION position: at the start of a line, or after one of
 * the characters a call can follow. A space is not enough - that is what let
 * `critical alert(s) need review` through - so a preceding word character or a
 * word-then-space both disqualify it. A leading `.` means somebody's method;
 * `window.` still counts.
 */
const DIALOG = /(?:^|[=;{}()[\],&|?:!+]|=>)\s*(?:window\.)?(alert)\s*\(/;

const findings = [];
for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  src.split('\n').forEach((line, i) => {
    const m = line.match(DIALOG);
    if (m) findings.push({ file, line: i + 1, fn: m[1], text: line.trim().slice(0, 100) });
  });
}

if (findings.length) {
  console.error(`\n${findings.length} raw browser alert(s):\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.fn}()\n      ${f.text}`);
  console.error(`
  Use toast from @/hooks/use-toast for a message the user should read. A browser
  alert blocks the thread, cannot carry a variant, and is where debug copy
  escapes to production.
`);
  process.exit(1);
}

console.log(`check:browser-dialogs - ${files.length} files, no raw alert().`);
