#!/usr/bin/env node
/**
 * An edge function that CALLS a `_shared` helper it never imported.
 *
 * Deno files are outside the tsc project, so nothing in this repo typechecks
 * them: an undefined identifier is not a compile error, it is a ReferenceError
 * the first time the code path runs, and the endpoint 500s. PERF-ROWCAP-002
 * converted 33 call sites to `fetchAllRows` and left EIGHT of them without the
 * import - daily-briefing, qbr, commission, contract-renewal, churn-risk,
 * payment-processing, predictive-failure, renewal-autoquote. Two unit tests
 * caught two of them; the other six would have reached production.
 *
 * The check is narrow on purpose. It only knows names EXPORTED from
 * `_shared/`, only counts a name that appears as a CALL, and ignores any file
 * that declares the name itself (platform-analytics has its own local
 * `fetchAllRows`, which is a duplicate worth removing but not a crash). Short
 * and generic names are skipped, because a six-character helper called `toRow`
 * would collide with everything.
 *
 * It cannot see a helper reached through a namespace import, a name assembled
 * at runtime, or a missing import of something outside `_shared/`. Hard gate at
 * zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const SHARED = 'supabase/functions/_shared';
const ROOT = 'supabase/functions';
const MIN_NAME_LENGTH = 8;

/** Exported function and const names in _shared, mapped to their module. */
const sharedExports = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.ts')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(
        /^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/gm,
      )) {
        if (m[1].length >= MIN_NAME_LENGTH) sharedExports.set(m[1], p.split(path.sep).join('/'));
      }
    }
  }
})(SHARED);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_shared') continue;
      walk(p);
    } else if (p.endsWith('.ts')) files.push(p.split(path.sep).join('/'));
  }
})(ROOT);

const findings = [];
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  // Comments carry helper names constantly - the header of half these files
  // names the function it replaced. Strip them before looking for calls.
  //
  // LINE COMMENTS FIRST, and this order is load-bearing. reports/handlers/
  // sales.ts opens with `// Sales-persona reports - /reports/sales/*`, and a
  // block-comment pass run first reads that trailing `/*` as the start of one
  // and blanks the next forty lines, imports included - so the file looked like
  // it called jsonResponse without importing it. That was 77 findings, nearly
  // all of them this. The lookbehind keeps `https://` intact, which is the
  // mirror-image bug check:seo-assets already carries in its header.
  const src = raw
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // String literals too. workflows/index.ts answers 501 with the message
  // "use: dispatchWorkflowEvent(tenantId, ...)", which is documentation, not a
  // call. Imports survive this because a module specifier is not a helper name.
  const code = src.replace(/(['"])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => m[0] + m[0]);

  for (const [name, module] of sharedExports) {
    // Called, with or without a generic argument. NOT after a dot: the meetings
    // handlers do `google.withAutoRefresh(...)` off a namespace import, which is
    // a different name that happens to end in the same word.
    if (!new RegExp(`(?<![.\\w$])${name}\\s*(?:<[^;()]{0,80}>)?\\s*\\(`).test(code)) continue;
    // Imported, under its own name or as an alias target.
    if (new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, 's').test(src)) continue;
    if (new RegExp(`\\bas\\s+${name}\\b`).test(src)) continue;
    // Destructured off a dynamic import - blog-platform-api pulls
    // decryptCredential in with `const { decryptCredential } = await import(...)`
    // at the two places it needs it, so the static import list never names it.
    if (new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*await\\s+import`, 's').test(src))
      continue;
    // Declared here - a local copy is a duplicate, not a crash.
    if (new RegExp(`(?:function|const|let|var|class)\\s+${name}\\b`).test(src)) continue;

    findings.push(`${file}  calls ${name}() - exported by ${module}, imported by nothing here`);
  }
}

if (findings.length) {
  console.error('Edge function calls a _shared helper it never imported:\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    `\n${findings.length} finding(s). Deno files are outside the tsc project, so this is a` +
      ` ReferenceError at runtime, not a compile error - the endpoint 500s the first time the` +
      ` code path runs.`,
  );
  process.exit(1);
}
console.log(
  `check:shared-helper-imports - ${files.length} edge files, every call to one of the` +
    ` ${sharedExports.size} shared helpers is imported.`,
);
