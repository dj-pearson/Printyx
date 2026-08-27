#!/usr/bin/env node
/**
 * CR-035: two accessible-name defects that eslint-plugin-jsx-a11y does not
 * cover, hard-gated at zero.
 *
 *  1. An icon-only <Button>. jsx-a11y has no rule for it: the button has a
 *     child, so nothing fires, and a screen reader announces "button" with no
 *     name. 158 of these existed.
 *  2. A search <Input> whose only name is its placeholder. A placeholder is a
 *     weak name (browsers fall back to it, but it vanishes the moment the user
 *     types), so search fields carry an explicit aria-label. 95 of these
 *     existed.
 *
 * Deliberately narrow. It reads JSX as text, so it sees `<Button ...>` and the
 * elements directly inside it and nothing else: a name assembled at runtime,
 * a wrapper component of the repo's own, or an icon rendered through a
 * variable will not be understood. It also only judges INPUTS whose placeholder
 * mentions search — the other 173 unlabelled placeholder inputs are a separate
 * question (most want a visible label, which is a design change, not a patch).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/src';
const NAMED = /aria-label|aria-labelledby|title=|sr-only/;

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(ROOT);

const iconButtons = [];
const searchInputs = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const lineAt = (index) => source.slice(0, index).split('\n').length;

  for (const m of source.matchAll(/<Button\b([\s\S]*?)>([\s\S]*?)<\/Button>/g)) {
    const [, attrs, inner] = m;
    if (/<Button\b/.test(inner)) continue; // nested; the outer match is unreliable
    if (NAMED.test(attrs)) continue;
    // Children are icons only when removing every self-closing capitalised
    // element and JSX comments leaves nothing behind.
    const rest = inner
      .replace(/<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .trim();
    if (rest !== '' || !/<[A-Z]/.test(inner)) continue;
    iconButtons.push(`${file}:${lineAt(m.index)}`);
  }

  for (const m of source.matchAll(/<Input\b([\s\S]*?)\/>/g)) {
    const attrs = m[1];
    if (!/placeholder=/.test(attrs) || NAMED.test(attrs) || /\bid=/.test(attrs)) continue;
    const line = lineAt(m.index);
    // A wrapping <label>, or shadcn's FormControl/FormLabel, names it already.
    const above = lines.slice(Math.max(0, line - 7), line - 1).join('\n');
    if (/<label\b|<FormControl|<FormLabel/.test(above)) continue;
    const placeholder = (attrs.match(/placeholder="([^"]*)"/) || [])[1];
    const isSearch = placeholder ? /search/i.test(placeholder) : /search/i.test(attrs);
    if (!isSearch) continue;
    searchInputs.push(`${file}:${line}`);
  }
}

const report = (label, hits, fix) => {
  if (!hits.length) return false;
  console.error(`✗ ${hits.length} ${label}:\n`);
  for (const h of hits.slice(0, 25)) console.error(`    ${h}`);
  if (hits.length > 25) console.error(`    ... and ${hits.length - 25} more`);
  console.error(`\n  ${fix}\n`);
  return true;
};

const bad =
  report(
    'icon-only <Button> element(s) with no accessible name',
    iconButtons,
    'A screen reader announces these as "button" and nothing else. Add aria-label\n' +
      '  naming the action, not the icon: aria-label="Delete invoice", not "trash".',
  ) |
  report(
    'search <Input> element(s) named only by a placeholder',
    searchInputs,
    'A placeholder is gone as soon as the field has text. Add aria-label, usually\n' +
      '  the placeholder wording minus its trailing ellipsis.',
  );

if (bad) process.exit(1);
console.log('✓ Icon-only buttons and search inputs all carry an accessible name.');
