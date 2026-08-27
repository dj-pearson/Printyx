#!/usr/bin/env node
/**
 * QUALITY-002: a tenant_id column that cannot hold a tenant id.
 *
 * tenants.id is `varchar` defaulting to gen_random_uuid() (shared/schema.ts),
 * and 570 tables declare tenant_id to match. Twenty-one declare it as
 * `integer`. Nothing can ever be filtered by a real tenant in those: the value
 * that arrives from the JWT, the x-tenant-id header or req.tenantId is a uuid
 * string, and Postgres will not compare it to an integer column.
 *
 * It is a schema defect rather than a code one, so this ratchets rather than
 * hard-gating — changing a column type needs a migration, and for the tables
 * that hold rows it needs a data migration. What it prevents is a new one.
 *
 * How it showed up: document-generation-service types every id and tenantId as
 * `number` because document_templates.tenant_id is an integer, then hands those
 * numbers to businessRecords / quotes / deals / serviceCalls / invoices, whose
 * ids are varchar. Ten of the TS2769s in that file are that mismatch. The route
 * above it passes req.tenantId, which is a string, so at runtime the core
 * lookups work by accident and the document_templates lookup is the one that
 * cannot.
 *
 *   npm run check:tenant-id-type
 *   npm run check:tenant-id-type -- --update-baseline
 */
import fs from 'node:fs';
import path from 'node:path';

const SHARED = 'shared';
const BASELINE = 'docs/tenant-id-type-baseline.json';
const ALLOWED = /^(varchar|uuid|text)$/;

const findings = [];
for (const file of fs.readdirSync(SHARED).filter((f) => f.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join(SHARED, file), 'utf8');
  const re = /export const (\w+) = pgTable\(/g;
  let m;
  while ((m = re.exec(source))) {
    // Table bodies close with either `\n);` or `\n});` depending on whether the
    // declaration takes an index callback.
    const paren = source.indexOf('\n);', m.index);
    const brace = source.indexOf('\n});', m.index);
    const end = Math.min(paren < 0 ? Infinity : paren, brace < 0 ? Infinity : brace);
    const body = source.slice(m.index, end === Infinity ? source.length : end);

    const column = body.match(/tenantId:\s*(\w+)\('tenant_id'/);
    if (!column || ALLOWED.test(column[1])) continue;
    findings.push({ entry: `${file}:${m[1]}`, type: column[1] });
  }
}

const baseline = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  : { note: '', allowed: [] };
const allowed = new Set(baseline.allowed || []);

if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'QUALITY-002. Tables whose tenant_id is not the type tenants.id is (varchar uuid), so no ' +
          'real tenant id can match. This list only shrinks: fixing one means a migration, and a ' +
          'data migration where the table holds rows. A NEW entry is a defect, not debt.',
        allowed: findings.map((f) => f.entry).sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${findings.length} table(s) recorded.`);
  process.exit(0);
}

const added = findings.filter((f) => !allowed.has(f.entry));
const resolved = [...allowed].filter((a) => !findings.some((f) => f.entry === a));

if (added.length > 0) {
  console.error(`✗ ${added.length} table(s) declare tenant_id as something a tenant id is not:\n`);
  for (const f of added) console.error(`    shared/${f.entry}  (${f.type})`);
  console.error(
    '\n  tenants.id is a varchar uuid. An integer tenant_id cannot be compared to the\n' +
      '  value that arrives from the JWT or the x-tenant-id header, so every query on\n' +
      '  this table fails or returns nothing. Declare it varchar.\n',
  );
  process.exit(1);
}

console.log(`✓ No new mistyped tenant_id — ${findings.length} known.`);
if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baselined table(s) now type it correctly. Tighten the ratchet:\n` +
      '      node scripts/check-tenant-id-type.mjs --update-baseline\n',
  );
  for (const r of resolved) console.log(`    ${r}`);
}
