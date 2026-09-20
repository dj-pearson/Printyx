#!/usr/bin/env node
// crm-table-reconcile.mjs  (COP-B00)
//
// Reports - and optionally performs - the `companies` -> `business_records`
// reconciliation the canonical-table decision has been waiting on.
//
// WHY THIS EXISTS. docs/crm-canonical-model.md settled that `business_records`
// is the company of record and nothing carried it out, so the two tables have
// been filling up in parallel. The split is not even: 53 edge functions read
// `business_records` and 7 read `companies`, of which THREE write it. An account
// created through the production CRM account list therefore lands somewhere the
// opportunity radar, churn risk, QBR, contracts, invoices, service, search and
// the forecast never look.
//
// COP-B00's own note says the order matters and it is right: repointing the
// readers before the rows move HIDES every account that currently lives only in
// `companies`. This script is what makes the move safe, and it will not decide
// anything a human should:
//
//   - an `id` match is proof (already migrated)   -> skipped
//   - a `customer_number` match is proof (UNIQUE)  -> reported, never merged
//   - a normalised NAME match is a CANDIDATE       -> reported, never merged
//   - a row with no created_by (NOT NULL there)    -> refused, never invented
//
// Everything left is unambiguous and is what --apply copies, keeping the id so
// deals, proposals and quotes that already point at the account still resolve.
//
// Usage - THROUGH tsx, NOT BARE node. This file imports
// shared/company-to-business-record.ts, and node cannot load a .ts: the
// documented `node scripts/...` invocation died with ERR_UNKNOWN_FILE_EXTENSION
// before it read a single row. That matters more than a usual doc slip, because
// this is a script somebody runs ONCE, against production, with credentials,
// following this header.
//
//   DATABASE_URL=postgres://... npm run crm:reconcile
//   ... -- --tenant <id>    restrict to one tenant
//   ... -- --json           machine-readable report
//   ... -- --apply          perform the unambiguous copies (prints first)
//   ... -- --limit <n>      cap rows copied in one run
//
// (or `npx tsx scripts/crm-table-reconcile.mjs <flags>` directly.)
//
// Exit 0 when the report is clean or --apply succeeded, 1 when anything needs a
// human, and 2 when it could not connect - so "did not run" is never read as
// "passed", the same contract check:stage-resolution carries.

import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildRecordIndex, classify, mapCompanyRow } = await import(
  pathToFileURL(join(repo, 'shared/company-to-business-record.ts')).href
);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};

const tenantId = value('--tenant');
const asJson = flag('--json');
const apply = flag('--apply');
const limit = value('--limit') ? Number(value('--limit')) : Infinity;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. This needs a database; it cannot be inferred.');
  process.exit(2);
}

const ssl =
  process.env.DB_SSL === 'false'
    ? undefined
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };

const client = new pg.Client({ connectionString: url, ssl });

const COMPANY_COLUMNS = [
  'id',
  'tenant_id',
  'business_name',
  'business_record_type',
  'customer_number',
  'activity',
  'industry',
  'website',
  'description',
  'phone',
  'fax',
  'billing_address',
  'billing_city',
  'billing_state',
  'billing_zip',
  'employees',
  'annual_revenue',
  'customer_since',
  'next_call_back',
  'created_by',
  'business_owner',
  'created_at',
  'updated_at',
];

function fail(message, code = 2) {
  console.error(`✗ ${message}`);
  process.exit(code);
}

try {
  await client.connect();
} catch (err) {
  fail(`Could not connect: ${err.message}`);
}

const scope = tenantId ? 'where tenant_id = $1' : '';
const params = tenantId ? [tenantId] : [];

let companies;
let records;
try {
  companies = (
    await client.query(
      `select ${COMPANY_COLUMNS.join(', ')} from companies ${scope} order by created_at asc nulls last, id asc`,
      params,
    )
  ).rows;
  records = (
    await client.query(
      `select id, tenant_id, company_name, customer_number from business_records ${scope}`,
      params,
    )
  ).rows;
} catch (err) {
  await client.end();
  fail(`Query failed: ${err.message}`);
}

const index = buildRecordIndex(records);

const buckets = {
  'already-migrated': [],
  'duplicate-customer-number': [],
  'candidate-name-match': [],
  'no-created-by': [],
  migratable: [],
};
let statusCoercions = 0;

for (const company of companies) {
  const verdict = classify(company, index);
  buckets[verdict.verdict].push({ company, ...verdict });
  if (verdict.verdict === 'migratable' && mapCompanyRow(company).statusCoerced) statusCoercions++;
}

/** Per-tenant totals, because "which tenants are affected" is the first question. */
const perTenant = new Map();
const bump = (tenant, key) => {
  if (!perTenant.has(tenant)) {
    perTenant.set(tenant, { companies: 0, records: 0, migratable: 0, needsHuman: 0 });
  }
  perTenant.get(tenant)[key]++;
};
for (const c of companies) bump(c.tenant_id, 'companies');
for (const r of records) bump(r.tenant_id, 'records');
for (const e of buckets.migratable) bump(e.company.tenant_id, 'migratable');
for (const key of ['duplicate-customer-number', 'candidate-name-match', 'no-created-by']) {
  for (const e of buckets[key]) bump(e.company.tenant_id, 'needsHuman');
}

const needsHuman =
  buckets['duplicate-customer-number'].length +
  buckets['candidate-name-match'].length +
  buckets['no-created-by'].length;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        companies: companies.length,
        businessRecords: records.length,
        counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
        statusCoercions,
        perTenant: Object.fromEntries(perTenant),
        needsHuman: ['duplicate-customer-number', 'candidate-name-match', 'no-created-by'].flatMap(
          (key) =>
            buckets[key].map((e) => ({
              verdict: key,
              id: e.company.id,
              tenantId: e.company.tenant_id,
              name: e.company.business_name,
              matchedRecordId: e.matchedRecordId ?? null,
              detail: e.detail,
            })),
        ),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\ncompanies: ${companies.length}    business_records: ${records.length}`);
  console.log(`\n  already migrated (id present in both)   ${buckets['already-migrated'].length}`);
  console.log(`  unambiguous, ready to copy             ${buckets.migratable.length}`);
  console.log(
    `  duplicate customer_number (human)      ${buckets['duplicate-customer-number'].length}`,
  );
  console.log(`  same name, different row (human)       ${buckets['candidate-name-match'].length}`);
  console.log(`  no created_by, refused (human)         ${buckets['no-created-by'].length}`);
  if (statusCoercions > 0) {
    console.log(
      `\n  ${statusCoercions} row(s) carry a companies.activity outside the business_records\n` +
        '  status vocabulary and would be coerced to the record type default.',
    );
  }

  console.log('\n  per tenant:');
  for (const [tenant, t] of [...perTenant].sort((a, b) => b[1].companies - a[1].companies)) {
    console.log(
      `    ${tenant}  companies=${t.companies} business_records=${t.records} ` +
        `ready=${t.migratable} needs-human=${t.needsHuman}`,
    );
  }

  for (const key of ['duplicate-customer-number', 'candidate-name-match', 'no-created-by']) {
    if (buckets[key].length === 0) continue;
    console.log(`\n  ${key}:`);
    for (const e of buckets[key].slice(0, 50)) {
      console.log(
        `    ${e.company.id}  ${JSON.stringify(e.company.business_name)}` +
          (e.matchedRecordId ? `  ->  business_records ${e.matchedRecordId}` : ''),
      );
    }
    if (buckets[key].length > 50) console.log(`    ... and ${buckets[key].length - 50} more`);
  }
}

let copied = 0;
if (apply && buckets.migratable.length > 0) {
  const batch = buckets.migratable.slice(0, limit === Infinity ? undefined : limit);
  try {
    await client.query('begin');
    for (const { company } of batch) {
      const { row } = mapCompanyRow(company);
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      // ON CONFLICT (id): the id is preserved, so a re-run is a conflict rather
      // than a duplicate. Idempotent for nothing.
      await client.query(
        `insert into business_records (${columns.map((c) => `"${c}"`).join(', ')}) ` +
          `values (${placeholders.join(', ')}) on conflict (id) do nothing`,
        columns.map((c) => row[c]),
      );
      copied++;
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    await client.end();
    fail(`Copy failed and was rolled back: ${err.message}`, 1);
  }
  console.log(`\n✓ Copied ${copied} row(s) into business_records, ids preserved.`);
} else if (apply) {
  console.log('\n  Nothing unambiguous to copy.');
}

await client.end();

if (needsHuman > 0) {
  /**
   * SAY WHAT HAPPENED, NOT WHAT USUALLY HAPPENS.
   *
   * This printed "Nothing was merged" unconditionally - including directly
   * under "✓ Copied 4 row(s) into business_records", which had just run. The
   * refusal line is the LAST thing on screen after a long report, so on the
   * one-shot production run this script exists for, an operator would read
   * "nothing was merged" about a run that had merged rows, and re-run or
   * escalate. The ambiguous rows are what was not merged; the unambiguous ones
   * were, and the exit code stays 1 either way because a human is still owed a
   * decision.
   */
  const merged =
    copied > 0
      ? `${copied} unambiguous row(s) were copied; these ${needsHuman} were not.`
      : 'Nothing was merged.';
  console.error(
    `\n✗ ${needsHuman} row(s) need a decision no script should make. Resolve them, then ` +
      `re-run. ${merged}`,
  );
  process.exit(1);
}

console.log(
  apply
    ? '\n✓ Reconciliation applied; every remaining companies row is accounted for.'
    : '\n✓ Nothing ambiguous. Re-run with --apply to copy the ready rows.',
);
