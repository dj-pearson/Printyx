#!/usr/bin/env tsx
/**
 * Tenant purge plan (LEGAL-005).
 *
 * Prints exactly which tables a post-termination purge would clear and which it
 * would hold, with the stated reason for each hold. Read this before setting
 * TENANT_PURGE_ENABLED=true.
 *
 * It exists because the table list is DERIVED from the Drizzle schema rather
 * than written down. That keeps it from going stale, but it also means a table
 * added last week is in scope automatically, and nobody has looked at it. This
 * is the looking.
 *
 * Reviewing the first version of that classification caught five financial
 * tables the patterns had missed - customer_payments, lease_payments,
 * vendor_bills, auto_invoice_generation and irs_mileage_logs, the last being a
 * tax record - plus two tables held that should not have been. Patterns are a
 * safety net for what comes later, not a substitute for reading the list.
 *
 * Needs no database credentials: classification is pure schema.
 *
 * Usage:
 *   npx tsx scripts/report-tenant-purge-plan.ts
 *   npx tsx scripts/report-tenant-purge-plan.ts --purge-list
 */

import {
  PURGE_GRACE_DAYS,
  classifyTables,
  listTenantScopedTables,
} from '../server/services/tenant-purge-service';

const SHOW_PURGE_LIST = process.argv.includes('--purge-list');

const tables = listTenantScopedTables();
const { purge, retained } = classifyTables(tables);

console.log(`Post-termination purge plan (grace period: ${PURGE_GRACE_DAYS} days)\n`);
console.log(`  tenant-scoped tables: ${tables.length}`);
console.log(`  would be purged:      ${purge.length}`);
console.log(`  held under a stated exemption: ${retained.length}\n`);

console.log('HELD (and why):');
const byReason = new Map<string, string[]>();
for (const r of retained) {
  if (!byReason.has(r.reason)) byReason.set(r.reason, []);
  byReason.get(r.reason)!.push(r.table);
}
for (const [reason, list] of byReason) {
  console.log(`\n  ${reason}`);
  for (const t of list.sort()) console.log(`    - ${t}`);
}

// The tables most worth a second look: anything whose name suggests a record
// somebody might be required to keep.
const suspicious = purge.filter((t) =>
  /invoic|payment|bill|financ|tax|ledger|irs|audit|consent|gdpr|legal|contract/.test(t),
);

console.log(
  `\n\nWOULD BE PURGED, and the name suggests a record worth checking (${suspicious.length}):`,
);
if (suspicious.length === 0) {
  console.log('  none');
} else {
  for (const t of suspicious.sort()) console.log(`  - ${t}`);
  console.log(
    '\n  Each of these is scheduled for deletion. If any is a record the company is\n' +
      '  required to keep, add it to RETAINED_TABLES in tenant-purge-service.ts first.',
  );
}

if (SHOW_PURGE_LIST) {
  console.log(`\n\nFULL PURGE LIST (${purge.length}):`);
  for (const t of purge) console.log(`  - ${t}`);
}

console.log(
  '\n\nThis is a plan, not an action. Nothing is deleted until TENANT_PURGE_ENABLED=true,\n' +
    'and the scheduled job reports rather than deletes until then.',
);
