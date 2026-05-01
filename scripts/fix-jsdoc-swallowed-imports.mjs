#!/usr/bin/env node
// One-shot fixer for the JSDoc-swallowed-imports bug.
//
// Many files in this repo have the shape:
//
//   /**
//
//   import { X } from '...';
//   const y = ...;
//
//    * Some doc text
//    * ...
//    */
//
// The opening `/**` and closing `*/` form a single JSDoc block, so the
// `import` and `const` lines between them are *inside* the comment and
// never execute. At runtime that produces `ReferenceError: <thing> is
// not defined` the first time the const is referenced.
//
// This script normalises every affected file to:
//
//   /**
//    * Some doc text
//    * ...
//    */
//   import { X } from '...';
//   const y = ...;
//
// We only touch files whose first non-shebang line is `/**` AND whose
// JSDoc block contains a code line (anything not starting with `*` or
// blank) before the closing `*/`. Anything else is left alone.
//
// Run from the repo root:
//   node scripts/fix-jsdoc-swallowed-imports.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

function listCandidates() {
  // ripgrep is faster but we can't rely on it being installed; use Node's
  // built-in `glob` via execSync against `git ls-files`. Already-tracked
  // .ts files only — keeps node_modules out of the picture for free.
  const stdout = execSync('git ls-files "*.ts" "*.tsx"', { cwd: ROOT })
    .toString()
    .trim();
  return stdout.split(/\r?\n/).map((p) => path.join(ROOT, p));
}

/** Returns the rewritten file content if a fix is needed, otherwise null. */
function tryFix(content) {
  const lines = content.split('\n');
  let cursor = 0;

  // Skip a leading shebang if present (none of these files have one,
  // but be safe).
  if (lines[cursor]?.startsWith('#!')) cursor++;

  // Block must open with `/**` (allowing trailing whitespace).
  if (!/^\/\*\*\s*$/.test(lines[cursor] ?? '')) return null;
  const openIdx = cursor;

  // Find the closing `*/` line. Walk until we hit one.
  let closeIdx = -1;
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (/\*\/\s*$/.test(lines[i] ?? '')) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return null;

  // Inspect the lines BETWEEN the opener and closer. Two buckets:
  //   - "doc" lines: blank, or starting with `*` (with optional leading ws)
  //   - "code" lines: anything else (imports, consts, etc.)
  // We only rewrite when at least one code line is present.
  const inside = lines.slice(openIdx + 1, closeIdx);
  const docLines = [];
  const codeLines = [];
  for (const line of inside) {
    if (line.trim() === '' || /^\s*\*/.test(line)) {
      docLines.push(line);
    } else {
      codeLines.push(line);
    }
  }
  if (codeLines.length === 0) return null;

  // Trim leading and trailing blank doc lines (cosmetic — the original
  // had them only because the imports were wedged in the middle).
  while (docLines.length && docLines[0].trim() === '') docLines.shift();
  while (docLines.length && docLines[docLines.length - 1].trim() === '') docLines.pop();

  // Drop blank code lines at the boundaries — also cosmetic.
  while (codeLines.length && codeLines[0].trim() === '') codeLines.shift();
  while (codeLines.length && codeLines[codeLines.length - 1].trim() === '') codeLines.pop();

  const newLines = [
    ...lines.slice(0, openIdx),
    '/**',
    ...docLines,
    ' */',
    ...codeLines,
    ...lines.slice(closeIdx + 1),
  ];

  return newLines.join('\n');
}

async function main() {
  const candidates = listCandidates();
  let fixed = 0;
  let scanned = 0;
  for (const file of candidates) {
    let content;
    try {
      content = await readFile(file, 'utf-8');
    } catch {
      continue;
    }
    scanned++;
    const next = tryFix(content);
    if (next != null && next !== content) {
      await writeFile(file, next, 'utf-8');
      fixed++;
    }
  }
  console.log(`Scanned ${scanned} files, fixed ${fixed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
