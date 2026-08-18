#!/usr/bin/env node
/**
 * LEGAL-012 guard: conversational AI stays authenticated and guarded.
 *
 * Two failure modes, both of which are one small diff away.
 *
 * 1. A chatbot route loses requireAuth. Today every conversational surface is
 *    authenticated internal B2B, which is the entire reason crisis handling was
 *    a low priority. Exposing one publicly should be a deliberate decision that
 *    someone reviews, not a line nobody noticed in a diff about something else.
 *
 * 2. A conversational system prompt ships without the safety directive. Prompts
 *    get rewritten, and a rewrite that drops the directive looks like an
 *    improvement in the diff.
 *
 * Adding a new conversational surface means adding it to CONVERSATIONAL below,
 * which is the point: the list is the record of what counts as talking to a
 * person.
 *
 * Usage: node scripts/check-ai-safety.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Routes that accept free text from a person and answer them. */
const AUTH_REQUIRED_ROUTES = [
  { file: 'server/routes-chatbot.ts', route: '/api/chatbot/query' },
];

/**
 * Files holding a conversational system prompt. Data-processing prompts (CSV
 * mapping, email parsing, deduplication) are excluded on purpose: nobody is
 * talking to them, so a crisis directive there is noise that trains people to
 * ignore the directive where it matters.
 */
const CONVERSATIONAL = [
  'server/services/gpt5-service.ts',
  'server/services/ai-employee-service.ts',
  'server/routes-deal-desk-copilot.ts',
];

/** The module every conversational surface must route through. */
const SAFETY_MODULE = 'server/lib/crisis-response.ts';

const violations = [];

// Rule 0: the safety module itself must exist and carry real resources.
const safetyPath = path.join(ROOT, SAFETY_MODULE);
if (!fs.existsSync(safetyPath)) {
  violations.push({ file: SAFETY_MODULE, msg: 'Safety module is missing.' });
} else {
  const safety = fs.readFileSync(safetyPath, 'utf8');
  if (!safety.includes('988')) {
    violations.push({
      file: SAFETY_MODULE,
      msg: 'Safety module no longer names a crisis line. "Seek help" is not a response.',
    });
  }
}

// Rule 1: conversational routes keep their auth middleware.
for (const { file, route } of AUTH_REQUIRED_ROUTES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    violations.push({ file, msg: `Expected file is missing; update ${path.basename(import.meta.url)}.` });
    continue;
  }
  const source = fs.readFileSync(full, 'utf8');
  const line = source.split('\n').find((l) => l.includes(route) && /app\.(post|get)\(/.test(l));
  if (!line) {
    violations.push({ file, msg: `Route ${route} not found; update this guard if it moved.` });
    continue;
  }
  if (!line.includes('requireAuth')) {
    violations.push({
      file,
      msg:
        `Route ${route} no longer has requireAuth. Exposing a conversational AI surface ` +
        'publicly is a decision that needs review, not a side effect. If it is deliberate, ' +
        'read docs/ai-surface-exposure-policy.md and satisfy its prerequisites first.',
    });
  }
}

// Rule 2: conversational prompts carry the guardrail.
for (const file of CONVERSATIONAL) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    violations.push({ file, msg: 'Expected conversational file is missing; update this guard.' });
    continue;
  }
  const source = fs.readFileSync(full, 'utf8');
  // Check for the CALL, not the identifier. Searching for the bare name passes
  // on a file that only still imports it - which is exactly what happened when
  // this rule was first tested by replacing the call and leaving the import.
  // Same trap as the subprocessor guard in LEGAL-007: a substring that survives
  // the regression proves nothing.
  if (!/withCrisisGuardrail\s*\(/.test(source)) {
    violations.push({
      file,
      msg: 'Conversational system prompt does not go through withCrisisGuardrail().',
    });
  }
}

if (violations.length > 0) {
  console.error(`\ncheck:ai-safety FAILED with ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v.file}\n      ${v.msg}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check:ai-safety passed - ${AUTH_REQUIRED_ROUTES.length} route(s) authenticated, ` +
    `${CONVERSATIONAL.length} conversational prompt(s) guarded.`,
);
