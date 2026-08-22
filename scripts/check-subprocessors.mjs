#!/usr/bin/env node
/**
 * LEGAL-007 guard: every vendor that receives data must be on the subprocessor page.
 *
 * The failure this exists to prevent already happened. Subprocessors.tsx listed
 * four providers - Supabase, GCP, Stripe, SendGrid - while the platform was
 * sending data to roughly a dozen, including customer voice recordings to OpenAI
 * and imported file contents to Anthropic. Nothing connected the code to the
 * page, so the page went stale the moment anyone added an integration.
 *
 * Two signals are checked against the page:
 *   1. Third-party API hosts called from server/ and supabase/functions/.
 *   2. Vendor credentials in the environment (*_API_KEY, *_SECRET, *_TOKEN).
 *
 * A vendor visible in either and absent from the page fails the build.
 *
 * Adding a row here is not the whole job: a new subprocessor also needs customer
 * notice under the DPA before it starts processing. This guard only catches the
 * case where nobody remembered the page at all.
 *
 * Usage: node scripts/check-subprocessors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'client/src/pages/legal/Subprocessors.tsx';
const SCAN_DIRS = ['server', 'supabase/functions'];

/**
 * host or credential fragment -> the name that must appear on the page.
 * `name` is matched case-insensitively against the page source.
 */
const VENDORS = [
  { match: /api\.openai\.com|OPENAI_API_KEY/, name: 'OpenAI' },
  { match: /api\.anthropic\.com|ANTHROPIC_API_KEY|CLAUDE_API_KEY/, name: 'Anthropic' },
  { match: /api\.stripe\.com|STRIPE_SECRET_KEY/, name: 'Stripe' },
  { match: /api\.sendgrid\.com|SENDGRID_API_KEY/, name: 'SendGrid' },
  { match: /api\.twilio\.com|TWILIO_AUTH_TOKEN/, name: 'Twilio' },
  { match: /api\.apollo\.io/, name: 'Apollo' },
  { match: /api\.zoominfo\.com/, name: 'ZoomInfo' },
  { match: /api\.dataforseo\.com/, name: 'DataForSEO' },
  { match: /graph\.microsoft\.com|login\.microsoftonline\.com|MICROSOFT_CLIENT_SECRET/, name: 'Microsoft' },
  { match: /googleapis\.com|accounts\.google\.com|GOOGLE_CLIENT_SECRET|GOOGLE_PLACES_API_KEY/, name: 'Google' },
  { match: /appleid\.apple\.com|APPLE_CLIENT_SECRET/, name: 'Apple' },
  { match: /quickbooks\.api\.intuit\.com|oauth\.platform\.intuit\.com/, name: 'QuickBooks' },
  { match: /login\.salesforce\.com/, name: 'Salesforce' },
  { match: /api\.mailchimp\.com/, name: 'Mailchimp' },
  { match: /api\.e-automate\.com/, name: 'e-automate' },
  { match: /api\.printfleet\.com/, name: 'PrintFleet' },
  { match: /supabase|SUPABASE_SERVICE_ROLE_KEY/, name: 'Supabase' },
];

/**
 * Files that mention a vendor host without sending it anything: seed fixtures,
 * documentation URLs in an integration catalog, test data. Each needs a reason,
 * so that "it's just a doc link" stays a claim someone made rather than a
 * silent exclusion.
 */
const NOT_DATA_FLOWS = [
  { file: 'server/seed-signature-data.ts', why: 'Seed fixture. The signature send path is a stub; no envelope is created.' },
  { file: 'server/seed-manufacturer-orders.ts', why: 'Seed fixture for Canon/HP/Xerox endpoints that are not called.' },
  { file: 'server/quickbooks-mapping.ts', why: 'Field-mapping reference including a commented sandbox URL.' },
];

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(rel, out);
    } else if (/\.ts$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const excluded = new Set(NOT_DATA_FLOWS.map((e) => e.file.split(path.sep).join('/')));
const found = new Map(); // vendor name -> example file

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = file.split(path.sep).join('/');
    if (excluded.has(rel)) continue;
    let source;
    try {
      source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      continue; // unreadable/binary
    }
    for (const vendor of VENDORS) {
      if (!found.has(vendor.name) && vendor.match.test(source)) {
        found.set(vendor.name, rel);
      }
    }
  }
}

const pagePath = path.join(ROOT, PAGE);
if (!fs.existsSync(pagePath)) {
  console.error(`check:subprocessors FAILED: ${PAGE} is missing.`);
  process.exit(1);
}
const pageSource = fs.readFileSync(pagePath, 'utf8');

// Match the LISTED ENTRIES, not the whole file. A substring search over the page
// passes for the wrong reason: the prose and this file's own header mention
// vendors by name, so deleting a table row leaves the name behind and the check
// stays green. Only `name: '...'` inside the subprocessor arrays counts.
const listed = new Set(
  [...pageSource.matchAll(/\bname:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase()),
);

if (listed.size === 0) {
  console.error(`check:subprocessors FAILED: no subprocessor entries parsed from ${PAGE}.`);
  console.error('The page format changed; update the parser in this script.');
  process.exit(1);
}

/** A vendor counts as listed when some entry name contains it (e.g. "Twilio SendGrid"). */
function isListed(vendorName) {
  const needle = vendorName.toLowerCase();
  for (const entry of listed) {
    if (entry.includes(needle)) return true;
  }
  return false;
}

const missing = [];
for (const [name, exampleFile] of found) {
  if (!isListed(name)) missing.push({ name, exampleFile });
}

if (missing.length > 0) {
  console.error(`\ncheck:subprocessors FAILED - ${missing.length} vendor(s) receive data but are not listed:\n`);
  for (const m of missing) {
    console.error(`  ${m.name}  (e.g. ${m.exampleFile})`);
  }
  console.error(
    `\nAdd each to ${PAGE} with its purpose, the data involved, and its processing location.\n` +
      'If a vendor does NOT actually receive data, add its file to NOT_DATA_FLOWS in this script\n' +
      'with a reason rather than deleting the rule.\n' +
      'Remember the DPA obligation: customers are notified BEFORE a new subprocessor starts processing.\n',
  );
  process.exit(1);
}

console.log(
  `check:subprocessors passed - ${found.size} vendor(s) detected in code, all listed on the subprocessor page.`,
);
