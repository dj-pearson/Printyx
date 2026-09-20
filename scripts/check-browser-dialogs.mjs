#!/usr/bin/env node
/**
 * No raw `alert()`, `confirm()` or `prompt()` in the app (WF-S-08,
 * UI-BROWSER-DIALOGS-001). Hard gate at zero.
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
 * WIDENED TO confirm() AND prompt() (UI-BROWSER-DIALOGS-001). This guard was
 * scoped to alert() on purpose and said so: twenty `confirm()` calls guarded
 * deletes and deactivations and five `prompt()` calls collected a URL or a
 * reason, and replacing those looked like an AlertDialog plus a state machine
 * per call site. It was not, in the end - `ConfirmDialogProvider` in
 * client/src/components/ui/confirm-dialog.tsx answers with a PROMISE, so
 * `if (!(await confirm({...}))) return;` keeps the shape the browser call had
 * and the twenty-five conversions stayed mechanical.
 *
 * Use `useConfirm()` for a yes/no and `useTextPrompt()` for a value. Both
 * resolve to the SAFE answer (false / null) when dismissed, when a second
 * question arrives, and outside a provider.
 *
 * The count is a hard zero rather than a baseline for the reason the original
 * gave: a list of 25 known-bad entries is where the 26th hides.
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
 * A dialog global in an EXPRESSION position: at the start of a line, or after
 * one of the characters a call can follow. A space is not enough - that is what
 * let `critical alert(s) need review` through - so a preceding word character or
 * a word-then-space both disqualify it. A leading `.` means somebody's method;
 * `window.` still counts.
 *
 * `await ` is in the prefix set for confirm/prompt and NOT for alert: the
 * replacements are awaited (`await confirm({...})`), so without it every
 * converted call site would report itself. That is narrow on purpose - it
 * admits exactly the shape the fix produces, not any preceding keyword.
 */
const DIALOG = /(?:^|[=;{}()[\],&|?:!+]|=>|\bawait)\s*(?:window\.)?(alert|confirm|prompt)\s*\(/;

/**
 * The app's own replacements, which ARE awaited calls named confirm/prompt.
 * Matched on the call's ARGUMENT SHAPE - the hook takes an options OBJECT where
 * the browser takes a string - because matching on the identifier alone would
 * excuse a bare `await confirm('really?')`, which is still the browser dialog.
 */
const OWN_DIALOG = /(?:await\s+)?(?:confirm|textPrompt)\s*\(\s*\{/;

const findings = [];
for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  src.split('\n').forEach((line, i) => {
    const m = line.match(DIALOG);
    if (m && !OWN_DIALOG.test(line)) {
      findings.push({ file, line: i + 1, fn: m[1], text: line.trim().slice(0, 100) });
    }
  });
}

if (findings.length) {
  console.error(`\n${findings.length} raw browser dialog(s):\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.fn}()\n      ${f.text}`);
  console.error(`
  alert()   -> toast from @/hooks/use-toast. It blocks the thread, cannot carry a
               variant, and is where debug copy escapes to production.
  confirm() -> useConfirm() from @/components/ui/confirm-dialog, awaited.
  prompt()  -> useTextPrompt() from the same module, awaited.
`);
  process.exit(1);
}

console.log(
  `check:browser-dialogs - ${files.length} files, no raw alert(), confirm() or prompt().`,
);
