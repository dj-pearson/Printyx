#!/usr/bin/env node
/**
 * A button labelled with an action verb must do something (UI-DEAD-BUTTONS-001).
 *
 * "Save", "Export", "Send", "Schedule" - a control that names a thing it will do
 * and then does nothing is the most visible kind of broken, and this tree had
 * three confirmed ones before anybody scanned: SEODashboard's Save Settings, and
 * View Details plus Download on every row of Invoices.
 *
 * ANCESTRY IS RESOLVED, NOT GUESSED. scripts/scan-dead-buttons.mjs (the
 * unhardened predecessor, kept for spot checks) excluded a button within 15
 * LINES of a form or a Dialog trigger, which is a window and not a scope: a
 * submit button in a form declared thirty lines up reads as dead, and a button
 * that merely follows a `</form>` reads as alive. This walks a tag stack, so a
 * <Button> is excluded when it is genuinely INSIDE a <form> or one of the
 * trigger wrappers, at any depth, and not otherwise. That took the count from
 * 107 to what you see below - the difference is entirely false positives the
 * line window had let through in both directions.
 *
 * WHAT COUNTS AS DOING SOMETHING: onClick, type="submit", asChild (the child
 * carries the behaviour), href, onSubmit, a form= attribute, or being inside a
 * trigger wrapper whose parent opens the thing. A disabled button is still
 * reported: a control that is permanently disabled with no handler behind it is
 * a feature nobody built, which is exactly what this looks for.
 *
 * THE BASELINE IS A TRIAGE FILE, NOT A LIST. docs/dead-buttons-baseline.json
 * gives every entry a verdict and a reason, the way docs/edge-rbac-triage.json
 * does, because "115 dead buttons" read as one number tells you nothing about
 * which are a missing feature and which are a control that should be deleted.
 * `unexamined` is a permitted verdict - saying nobody has looked beats implying
 * somebody has.
 *
 * KNOWN BLIND SPOTS, so a clean run is never read as proof:
 *   - A handler passed through a spread (`{...props}`) or a variable holding JSX.
 *   - A button rendered by a map whose handler is bound in the parent.
 *   - A handler that EXISTS and does nothing, or calls an endpoint that 404s -
 *     that is check:uncalled-express' and check:edge-coverage's half.
 *   - Labels built at runtime, which have no verb to match here.
 *
 *   node scripts/check-dead-buttons.mjs
 *   node scripts/check-dead-buttons.mjs --list
 *   node scripts/check-dead-buttons.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'client/src');
const BASELINE = join(ROOT, 'docs', 'dead-buttons-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');
const LIST = process.argv.includes('--list');

export const ACTION_WORDS =
  /\b(save|submit|create|add|update|delete|remove|send|apply|generate|export|import|run|start|assign|approve|reject|confirm|schedule|invite|publish|sync|refresh|upload|download|print|resolve|archive|convert|record|log|book|pay|renew|cancel)\b/i;

/**
 * Wrappers whose child button is driven by the wrapper, not by an onClick of
 * its own. `asChild` on these is the whole idiom - the trigger clones the
 * button and attaches its own handler - so a Button inside one is never dead.
 */
export const TRIGGER_TAGS = new Set([
  'form',
  'DialogTrigger',
  'AlertDialogTrigger',
  'AlertDialogCancel',
  'AlertDialogAction',
  'PopoverTrigger',
  'SheetTrigger',
  'DrawerTrigger',
  'DropdownMenuTrigger',
  'ContextMenuTrigger',
  'HoverCardTrigger',
  'CollapsibleTrigger',
  'AccordionTrigger',
  'TooltipTrigger',
  'MenubarTrigger',
  'SelectTrigger',
  'Link',
  'a',
  'label',
]);

/**
 * `asChild` is a BARE boolean attribute in this codebase's idiom
 * (`<Button asChild variant="outline">`), so requiring `=` or `{` after it
 * misses every one - BlogCalendar's "Export .ics" wraps an <a> exactly that way
 * and read as dead. Matched without a value here; the rest take one.
 */
const VALUED_HANDLER = /\b(onClick|onSubmit|onPointerDown|onMouseDown|onKeyDown|href|form)\s*[={]/;
const BARE_HANDLER = /\basChild\b/;
const SUBMIT_TYPE = /\btype\s*=\s*["']submit["']/;

/**
 * Walk the JSX tags in a file, tracking open elements, and yield every <Button>
 * with the stack it sits in.
 *
 * A hand-rolled walk rather than a parser because the repo has no JSX AST tool
 * in its script toolchain, and the property needed here is shallow: which named
 * elements enclose this one. Self-closing tags never push; a closing tag pops to
 * its matching name, so an unbalanced fragment cannot desynchronise the whole
 * file.
 */
export function findButtons(source) {
  const src = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

  const found = [];
  const stack = [];
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9.]*)((?:[^<>'"]|'[^']*'|"[^"]*"|\{[^{}]*\})*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(src)) !== null) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing) {
      const at = stack.map((s) => s.name).lastIndexOf(name);
      if (at !== -1) stack.length = at;
      continue;
    }
    if (name === 'Button' || name === 'button') {
      // The label is the text up to the matching close, minus nested markup and
      // expressions - a label assembled at runtime has no verb to match.
      const rest = src.slice(m.index + m[0].length);
      const close = rest.indexOf(`</${name}>`);
      const label = (close === -1 ? '' : rest.slice(0, close))
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{[^{}]*\}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      found.push({
        line: src.slice(0, m.index).split('\n').length,
        label,
        attrs,
        ancestors: stack.map((s) => s.name),
      });
    }
    if (!selfClose) stack.push({ name });
  }
  return found;
}

export function isDead(button) {
  if (!ACTION_WORDS.test(button.label)) return false;
  const attrs = button.attrs;
  if (VALUED_HANDLER.test(attrs) || BARE_HANDLER.test(attrs) || SUBMIT_TYPE.test(attrs)) {
    return false;
  }
  return !button.ancestors.some((name) => TRIGGER_TAGS.has(name));
}

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = walkFiles(SRC);
const findings = [];
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const button of findButtons(readFileSync(file, 'utf8'))) {
    if (isDead(button))
      findings.push({ key: `${rel}:${button.label}`, file: rel, label: button.label });
  }
}
findings.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

// A walk that stops matching must fail rather than pass over nothing.
if (files.length < 300) {
  console.error(`✗ Only ${files.length} .tsx file(s) walked - the scan is not seeing the tree.`);
  process.exit(2);
}

if (LIST) {
  for (const f of findings) console.log(`  ${f.file}  "${f.label}"`);
  console.log(
    `\n${findings.length} finding(s) across ${new Set(findings.map((f) => f.file)).size} file(s).`,
  );
  process.exit(0);
}

const DEFAULT_NOTE =
  'UI-DEAD-BUTTONS-001. A <Button> whose label carries an action verb and which has no ' +
  'onClick, type="submit", asChild, href or form, and is not inside a <form> or a trigger ' +
  'wrapper. Ancestry is resolved by a tag walk, not a line window. Every entry carries a ' +
  'VERDICT and a REASON: wired, deleted, by-design, or unexamined - saying nobody has looked ' +
  'beats implying somebody has. Shrink this list; see scripts/check-dead-buttons.mjs.';

function existing() {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Keep a hand-written note rather than regenerating the default over it (round
 * 82's finding: a ratchet's note is the difference between a worklist and an
 * undifferentiated list, and a writer that rebuilds its header discards
 * whatever anybody explained there). Named to match the idiom the other 33
 * writers use, which is also what baseline-notes-preserved.test.ts looks for.
 */
function existingNote() {
  const note = existing()?.note;
  return typeof note === 'string' && note.length > 0 ? note : null;
}

if (UPDATE) {
  const prev = existing();
  const triage = {};
  for (const f of findings) {
    const carried = prev?.triage?.[f.key];
    triage[f.key] = {
      file: f.file,
      label: f.label,
      verdict: carried?.verdict ?? 'unexamined',
      reason: carried?.reason ?? '',
    };
  }
  writeFileSync(
    BASELINE,
    JSON.stringify({ note: prev?.note ?? DEFAULT_NOTE, count: findings.length, triage }, null, 2) +
      '\n',
  );
  console.log(`Baseline updated: ${findings.length} button(s) with no handler.`);
  process.exit(0);
}

const baseline = existing();
if (!baseline) {
  console.error('✗ No baseline. Create one: node scripts/check-dead-buttons.mjs --update-baseline');
  process.exit(1);
}

const known = new Set(Object.keys(baseline.triage ?? {}));
const added = findings.filter((f) => !known.has(f.key));
if (added.length > 0) {
  console.error(`✗ ${added.length} NEW button(s) with an action label and no handler:\n`);
  for (const f of added) console.error(`    ${f.file}  "${f.label}"`);
  console.error(
    '\nWire it, delete it, or record why it is driven some other way:\n' +
      '    node scripts/check-dead-buttons.mjs --update-baseline',
  );
  process.exit(1);
}

// An entry with no reason is the thing this file exists to prevent.
const silent = Object.entries(baseline.triage ?? {}).filter(
  ([, v]) => v.verdict !== 'unexamined' && !(v.reason ?? '').trim(),
);
if (silent.length > 0) {
  console.error(`✗ ${silent.length} baselined button(s) carry a verdict with no reason:\n`);
  for (const [key] of silent) console.error(`    ${key}`);
  process.exit(1);
}

const resolved = [...known].filter((k) => !findings.some((f) => f.key === k));
const counts = {};
for (const v of Object.values(baseline.triage ?? {}))
  counts[v.verdict] = (counts[v.verdict] ?? 0) + 1;
const summary = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `${n} ${k}`)
  .join(', ');

console.log(
  `✓ No new dead buttons (${findings.length} baselined: ${summary}).` +
    (resolved.length > 0
      ? `\n  ${resolved.length} baselined entr(ies) resolved. Tighten with --update-baseline`
      : ''),
);
