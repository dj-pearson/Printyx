#!/usr/bin/env node
/**
 * LEGAL-010 guard: no unapproved certification or compliance claims.
 *
 * Printyx does not hold a SOC 2 or ISO 27001 report. Before this guard existed,
 * the claim appeared in five places: the Privacy Policy (a legal document), a
 * marketing page, the public login screen, and two admin dashboards that
 * hardcoded "Compliant" badges alongside invented audit scores, audit dates and
 * non-conformity counts.
 *
 * The dashboards were the worse half. Staff answer customer security
 * questionnaires from what the product tells them, so a fabricated compliance
 * screen becomes a written misrepresentation with a straight face.
 *
 * When a certification is genuinely obtained: add it to APPROVED below with the
 * report period, in the same commit that publishes it. That keeps the claim and
 * its evidence together.
 *
 * Usage: node scripts/check-certification-claims.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'client/src');

/**
 * Certifications Printyx actually holds. Empty on purpose.
 * Each entry should read like: { pattern: /SOC ?2/i, evidence: 'Type II, period 2026-01-01..2026-12-31, auditor X' }
 */
const APPROVED = [];

/** Claim patterns that need evidence before they can ship. */
const CLAIMS = [
  { re: /\bSOC ?2\b/i, what: 'SOC 2' },
  { re: /\bISO ?27001\b/i, what: 'ISO 27001' },
  { re: /\bISO ?9001\b/i, what: 'ISO 9001' },
  { re: /\bPCI[ -]?DSS\b/i, what: 'PCI DSS' },
  { re: /\bFedRAMP\b/i, what: 'FedRAMP' },
  { re: /\bHIPAA[- ]compliant\b/i, what: 'HIPAA compliance' },
  { re: /\bGDPR[- ]compliant\b/i, what: 'GDPR compliance (as a certification claim)' },
  { re: /\bCCPA[- ]compliant\b/i, what: 'CCPA compliance (as a certification claim)' },
];

/**
 * Lines that name a standard in order to say we do NOT hold it, or to explain
 * what was removed. Matching these keeps the guard from flagging its own fix.
 */
const DISCLAIMER_MARKERS = [
  /LEGAL-010/,
  /does not (currently )?hold/i,
  /not tracked/i,
  /previously showed/i,
  /hardcoded rather than measured/i,
  /invented (audit )?scores/i,
  /nothing here tracks one/i,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SCAN_DIR)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    if (DISCLAIMER_MARKERS.some((m) => m.test(line))) return;
    for (const claim of CLAIMS) {
      if (!claim.re.test(line)) continue;
      if (APPROVED.some((a) => a.pattern.test(line))) continue;
      violations.push({ rel, line: i + 1, what: claim.what, text: line.trim().slice(0, 100) });
    }
  });
}

if (violations.length > 0) {
  console.error(`\ncheck:certifications FAILED - ${violations.length} unapproved claim(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ${v.what}`);
    console.error(`      ${v.text}`);
  }
  console.error(
    '\nPrintyx does not hold these certifications. Remove the claim, or - if one has genuinely\n' +
      'been obtained - add it to APPROVED in this script with its report period and auditor,\n' +
      'in the same commit that publishes the claim.\n',
  );
  process.exit(1);
}

console.log('check:certifications passed - no unapproved certification claims.');
