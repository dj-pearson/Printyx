#!/usr/bin/env node
/**
 * Every ambiguous-ownership domain carries a verdict and a reason.
 *
 * `check:routes` already finds the class: a domain Express registers handlers
 * for AND an edge function serves, with no `crmProxies` entry between them. In
 * production `getApiUrl` rewrites `/api/<seg>` straight to the functions host,
 * so **dev and production run different code for the same path** - and the
 * baseline records 44 of them as a flat list of names.
 *
 * A flat list reads the same whether the divergence was checked and found
 * harmless or nobody ever looked, and two priority-1 stories sat inside this
 * one undetected until they were found by hand:
 *
 *   LAUNCH-013  `leads` and `import`: enforceUsageLimits and
 *               requireFeature('ai_csv_import') are mounted on Express and
 *               decide nothing in production, where no edge function carries a
 *               plan check at all.
 *   LEGAL-004   `gdpr`: the Express service erased a data subject's uploaded
 *               objects across six buckets. The edge function anonymised two
 *               tables of rows, touched no storage, and told the subject their
 *               data had been erased.
 *
 * Neither was findable from the name. So this is the treatment
 * `docs/edge-rbac-triage.json` and `docs/nplus1-triage.json` already apply:
 * every entry gets a verdict and a reason, `unexamined` IS a permitted verdict
 * because "nobody has looked" said out loud beats it hiding inside a flat list,
 * and an entry with no reason is refused.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OWNERSHIP = resolve(ROOT, 'docs/route-ownership-baseline.json');
const TRIAGE = resolve(ROOT, 'docs/route-divergence-triage.json');

/**
 * `unexamined` is first on purpose: it is the honest default, and the whole
 * design rests on it being sayable rather than something to avoid.
 */
export const VERDICTS = new Set([
  'unexamined',
  'parity',
  'divergent',
  'resolved',
  'express-only-capability',
]);

/** Below this the ownership baseline is not the file we think it is. */
export const MIN_DOMAINS = 10;

export function divergentDomains() {
  const baseline = JSON.parse(readFileSync(OWNERSHIP, 'utf8'));
  return [...(baseline.bothDivergent ?? [])].sort();
}

export function readTriage() {
  if (!existsSync(TRIAGE)) return { note: '', entries: {} };
  const parsed = JSON.parse(readFileSync(TRIAGE, 'utf8'));
  return { note: parsed.note ?? '', entries: parsed.entries ?? {} };
}

/**
 * Pure so it can be exercised with fixtures. A source-level check of the CLI
 * cannot tell a working rule from a deleted one - the constant it matches is
 * still in the file either way.
 */
export function triageProblems(domains, entries) {
  const problems = [];
  const known = new Set(domains);

  for (const domain of domains) {
    const entry = entries[domain];
    if (!entry) {
      problems.push({ kind: 'untriaged', domain });
      continue;
    }
    if (!VERDICTS.has(entry.verdict)) {
      problems.push({ kind: 'bad-verdict', domain, detail: String(entry.verdict) });
      continue;
    }
    if (!entry.reason || entry.reason.length < 40) {
      problems.push({ kind: 'unreasoned', domain });
    }
  }

  // An entry for a domain that is no longer divergent is debt that was resolved
  // rather than accepted; leaving it pre-forgives whatever returns under that
  // name, which is the defect check:error-shape's baseline had.
  for (const domain of Object.keys(entries)) {
    if (!known.has(domain)) problems.push({ kind: 'stale', domain });
  }

  return problems;
}

const DEFAULT_NOTE = [
  'A verdict and a reason for every ambiguous-ownership domain in',
  "docs/route-ownership-baseline.json's bothDivergent list: Express registers",
  'handlers for it, an edge function serves it, and nothing proxies between',
  'them, so dev and production run different code for the same path.',
  '"unexamined" is a permitted verdict and is the point - it is what stops a',
  'guess from being written down as a finding.',
].join(' ');

function existingNote(fallback) {
  return readTriage().note || fallback;
}

function main() {
  const domains = divergentDomains();
  if (domains.length < MIN_DOMAINS) {
    console.error(
      `check:route-divergence-triage read only ${domains.length} divergent domain(s) from ` +
        `${OWNERSHIP} - that is not the file this guard is about, so a clean run would mean nothing.`,
    );
    process.exit(2);
  }

  const { entries } = readTriage();

  if (process.argv.includes('--update-baseline')) {
    const next = {};
    for (const domain of domains) {
      next[domain] = entries[domain] ?? { verdict: 'unexamined', reason: '' };
    }
    writeFileSync(
      TRIAGE,
      `${JSON.stringify({ note: existingNote(DEFAULT_NOTE), entries: next }, null, 2)}\n`,
      'utf8',
    );
    console.log(`Wrote ${TRIAGE} with ${Object.keys(next).length} entries.`);
    const blank = Object.entries(next).filter(([, e]) => !e.reason);
    if (blank.length) {
      console.error(
        `\n${blank.length} entr(ies) have no reason. Write one for each - "unexamined" still needs ` +
          `to say what has not been looked at:\n${blank.map(([d]) => `  ${d}`).join('\n')}`,
      );
      process.exit(1);
    }
    return;
  }

  const problems = triageProblems(domains, entries);
  if (!problems.length) {
    const counts = {};
    for (const domain of domains) {
      const v = entries[domain].verdict;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const summary = Object.entries(counts)
      .sort()
      .map(([v, n]) => `${n} ${v}`)
      .join(', ');
    console.log(`✓ Route divergence: ${domains.length} domain(s) triaged (${summary}).`);
    return;
  }

  console.error(`check:route-divergence-triage found ${problems.length} problem(s):\n`);
  for (const p of problems) {
    const lines = {
      untriaged: `no entry - say what differs between the hosts, or say it is unexamined`,
      'bad-verdict': `verdict "${p.detail}" is not one of: ${[...VERDICTS].join(', ')}`,
      unreasoned: 'has a verdict but no reason long enough to be one',
      stale: 'is no longer ambiguous - remove it rather than leaving it pre-forgiven',
    };
    console.error(`  ${p.kind.toUpperCase().padEnd(12)} ${p.domain}\n     ${lines[p.kind]}\n`);
  }
  process.exit(1);
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
