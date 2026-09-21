#!/usr/bin/env node
/**
 * An unknown sub-resource must not be answered with the parent record.
 *
 * PA-020 is the worked example: `supabase/functions/customers/` computed a
 * `customerId`, dropped the sub-segment, and answered every tab - invoices,
 * equipment, service history, financials, supplies - with the CUSTOMER OBJECT
 * at 200. A component mapping over an object renders an empty list and reports
 * nothing, which is why that survived an audit. That story's own conclusion is
 * the rule this guard enforces: "An unknown sub-resource 404s deliberately:
 * falling through to the customer object is what made the defect invisible, so
 * the fallback had to go."
 *
 * The cost is not the one missing branch. It is that the NEXT missing branch is
 * invisible too - `GET /service-tickets/:id/analysis` answered the ticket, and
 * anyone adding a sub-path to one of these functions had no way to discover
 * that it was never routed except by reading the response body.
 *
 * WHAT COUNTS AS GUARDED - three shapes, all real in this tree:
 *   1. `if (id && sub) { return 404 }`            (equipment)
 *   2. `if (req.method === 'GET' && id && sub) {` (the five fixed in round 131)
 *   3. `if (id && sub) return handleSubResource(` (customers - a dispatch whose
 *      own tail 404s, which is why matching on the CONDITION rather than on the
 *      404 is what keeps this from reporting correct code)
 * All three are a catch-all on (id, sub) placed ABOVE the generic `/:id` branch,
 * so that is the property, not the response body.
 *
 * SCOPE: a function is only in scope when it BOTH names a `parts[1]`
 * sub-resource AND tests it against at least one literal. A function that never
 * routes a sub-resource has no fallthrough to report - `/:id/anything` there is
 * one undifferentiated shape and its author never claimed otherwise.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'supabase/functions';

/** Below this the walk is not measuring the tree it claims to measure. */
export const MIN_CORPUS = 40;

/**
 * The segment array is spelled `parts`, `pathParts` and `segments` across the
 * tree for the identical shape. A pattern naming one spelling guards one
 * spelling (the setMonth/setUTCMonth lesson), and `deals`, `companies`,
 * `business-records` and `leads` - the CRM core - all use `pathParts`.
 */
const SEGMENTS = '\\w*(?:[Pp]arts|[Ss]egments)';

/**
 * Line comments first, then block comments blanked to SPACES so reported line
 * numbers stay honest. The `(?<![:/])` lookbehind keeps `https://` intact; the
 * other order reads a line comment ending in `/*` as a block opener and blanks
 * the next forty lines (check:shared-helper-imports paid for this twice).
 */
export function stripComments(src) {
  const noLine = src.replace(/(?<![:/])\/\/[^\n]*/g, '');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * A bare `if (<id>) { return <404> }` catch-all, which is how PROD-008b wrote
 * the one in `business-records`. The refusal is required: `if (recordId)` on its
 * own is an ordinary condition, so counting it without reading what it RETURNS
 * would vouch for any function that happens to branch on the id.
 *
 * Bound to the next `return` after the brace - a construct, never a character
 * window, because a window is not a scope.
 */
export function hasBareIdRefusal(src, id, before) {
  const open = new RegExp(`if \\(${id}\\) \\{`, 'g');
  for (const m of src.matchAll(open)) {
    if (before !== undefined && m.index >= before) continue;
    const from = m.index + m[0].length;
    const ret = src.indexOf('return', from);
    if (ret === -1) continue;
    const end = src.indexOf(';', ret);
    if (end === -1) continue;
    if (/\b404\b/.test(src.slice(ret, end))) return true;
  }
  return false;
}

/** Analyse one edge function's source. Pure, so a fixture can exercise it. */
export function analyzeFunction(name, rawSource) {
  const src = stripComments(rawSource);

  // The segment array is spelled `parts`, `pathParts` and `segments` across the
  // tree for the identical shape. A pattern naming one spelling guards one
  // spelling (the setMonth/setUTCMonth lesson), and `deals`, `companies`,
  // `business-records` and `leads` - the CRM core - all use `pathParts`.
  // The `;` is load-bearing: `deals` opens with
  // `const pathParts = rawParts[0] === 'deals' ? ... : rawParts;`, a
  // NORMALISATION line whose right-hand side also starts with `<array>[0]`, and
  // without the terminator that line matches first and the id resolves to
  // "pathParts". Require the subscript to END the initializer.
  const idMatch = new RegExp(`const\\s+(\\w+)\\s*=\\s*${SEGMENTS}\\[0\\]\\s*;`).exec(src);
  const subMatch = new RegExp(`const\\s+(\\w+)\\s*=\\s*${SEGMENTS}\\[1\\]\\s*;`).exec(src);
  if (!idMatch || !subMatch) return null;

  const id = idMatch[1];
  const sub = subMatch[1];

  // Routes at least one sub-resource by name?
  const routed = [
    ...new Set([...src.matchAll(new RegExp(`${sub}\\s*===\\s*'([^']+)'`, 'g'))].map((m) => m[1])),
  ];
  if (routed.length === 0) return null;

  // The generic /:id GET branch, in either spelling. Writing it
  // `GET && id && !sub` is guarded BY CONSTRUCTION - the branch simply does not
  // match when a sub-segment is present - and `companies` and `leads` are both
  // written that way, so reading only the bare spelling would put the two
  // largest CRM functions in the "cannot prove" pile while they are correct.
  const guardedByShape = new RegExp(`if \\(req\\.method === 'GET' && ${id} && !${sub}\\)`).exec(
    src,
  );
  const generic = new RegExp(`if \\(req\\.method === 'GET' && ${id}\\)`).exec(src);
  if (!generic) {
    if (guardedByShape)
      return { fn: name, id, sub, routed, guarded: true, shape: 'negated-generic' };
    if (hasBareIdRefusal(src, id)) {
      return { fn: name, id, sub, routed, guarded: true, shape: 'bare-id-refusal' };
    }
    return null;
  }

  // A catch-all on (id, sub) above it - refusal or dispatch, either counts.
  const catchAll = new RegExp(`if \\((?:req\\.method === 'GET' && )?${id} && ${sub}\\)`, 'g');
  let guarded = false;
  for (const m of src.matchAll(catchAll)) {
    if (m.index < generic.index) {
      guarded = true;
      break;
    }
  }

  return { fn: name, id, sub, routed, guarded, shape: guarded ? 'catch-all' : 'fallthrough' };
}

export function edgeFunctions() {
  return readdirSync(ROOT)
    .filter((d) => existsSync(join(ROOT, d, 'index.ts')))
    .sort();
}

export function scan() {
  const names = edgeFunctions();
  const inScope = [];
  const unprovable = [];
  for (const name of names) {
    const raw = readFileSync(join(ROOT, name, 'index.ts'), 'utf8');
    const res = analyzeFunction(name, raw);
    if (res) {
      inScope.push(res);
      continue;
    }
    // Binds (id, sub) and routes at least one sub-resource, but no generic
    // branch could be LOCATED - so this guard can neither clear it nor accuse
    // it. Counted and printed rather than hidden, because a green run that
    // silently excludes a third of the candidates reads as full coverage.
    const src = stripComments(raw);
    const idm = new RegExp(`const\\s+(\\w+)\\s*=\\s*${SEGMENTS}\\[0\\]\\s*;`).exec(src);
    const sm = new RegExp(`const\\s+(\\w+)\\s*=\\s*${SEGMENTS}\\[1\\]\\s*;`).exec(src);
    if (!idm || !sm) continue;
    if (!new RegExp(`${sm[1]}\\s*===\\s*'`).test(src)) continue;
    unprovable.push(name);
  }
  return {
    corpus: names.length,
    inScope,
    unprovable,
    findings: inScope.filter((r) => !r.guarded),
  };
}

function main() {
  const { corpus, inScope, unprovable, findings } = scan();

  if (corpus < MIN_CORPUS) {
    console.error(
      `check:subresource-fallthrough - only ${corpus} edge function(s) found (expected >= ${MIN_CORPUS}).`,
    );
    console.error(
      'The walk is not reading the tree it claims to read; failing rather than passing.',
    );
    process.exit(2);
  }

  if (findings.length > 0) {
    console.error(
      `check:subresource-fallthrough - ${findings.length} function(s) answer an unknown sub-resource with the parent record:\n`,
    );
    for (const f of findings) {
      console.error(
        `  ${f.fn}: routes ${f.routed.map((r) => `'${r}'`).join(', ')} on \`${f.sub}\`,`,
      );
      console.error(
        `    but \`GET ${f.fn}/:${f.id}/<anything-else>\` falls through to the /:id branch and answers the row at 200.`,
      );
    }
    console.error(
      `\nAdd a catch-all above the /:id branch:\n` +
        `  if (req.method === 'GET' && <id> && <sub>) { return 404 }\n` +
        `A dispatch (\`if (id && sub) return handleSubResource(...)\`) counts too.`,
    );
    process.exit(1);
  }

  console.log(
    `✓ check:subresource-fallthrough - ${inScope.length} function(s) route sub-resources, all refuse an unknown one (${corpus} edge functions scanned).`,
  );
  console.log(
    `  ${unprovable.length} more bind (id, sub) and route sub-resources in a shape this guard cannot locate a generic branch in - neither cleared nor accused. Most read parts[0] as a RESOURCE NAME rather than a record id, so there is no parent row to fall through to.`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
