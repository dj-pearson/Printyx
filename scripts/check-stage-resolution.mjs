#!/usr/bin/env node
// check-stage-resolution.mjs  (COP-M07)
//
// Verifies the CRMX-005 stage bridge against a real database: every deal's
// stage_id (a LEGACY deal_stages.id) must resolve to exactly ONE canonical
// pipeline_stages row through legacy_stage_id.
//
// This is the "existing deals do not orphan" check COP-M07 requires before and
// after any repointing of a stage writer. Repointing a writer into the
// pipeline_stages id space without it silently orphans deals: the row keeps a
// stage_id that no longer resolves, and the board simply stops showing the deal.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/check-stage-resolution.mjs
//   ... --tenant <id>     restrict to one tenant
//
// Exit 0 when every deal resolves; exit 1 on any orphan, any ambiguity, or any
// legacy stage with no mirror. Exit 2 when it could not connect, so "the check
// did not run" is never mistaken for "the check passed".

import pg from 'pg';

const args = process.argv.slice(2);
const tenantArg = args.indexOf('--tenant');
const tenantId = tenantArg === -1 ? null : args[tenantArg + 1];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. This check needs a database; it cannot be inferred.');
  process.exit(2);
}

const ssl =
  process.env.DB_SSL === 'false'
    ? undefined
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };

const client = new pg.Client({ connectionString: url, ssl });

const scope = tenantId ? 'and d.tenant_id = $1' : '';
const stageScope = tenantId ? 'and ds.tenant_id = $1' : '';
const params = tenantId ? [tenantId] : [];

const QUERIES = {
  orphans: `
    select d.tenant_id, d.id, d.title, d.stage_id
    from deals d
    where not exists (
      select 1 from pipeline_stages ps
      where ps.legacy_stage_id = d.stage_id and ps.tenant_id = d.tenant_id
    ) ${scope}
    order by d.tenant_id, d.title
    limit 50`,
  ambiguous: `
    select d.tenant_id, d.id, d.title, count(*) as matches
    from deals d
    join pipeline_stages ps
      on ps.legacy_stage_id = d.stage_id and ps.tenant_id = d.tenant_id
    where true ${scope}
    group by d.tenant_id, d.id, d.title
    having count(*) > 1
    limit 50`,
  unmirrored: `
    select ds.tenant_id, ds.id, ds.name
    from deal_stages ds
    where ds.is_active is not false
      and not exists (
        select 1 from pipeline_stages ps
        where ps.legacy_stage_id = ds.id and ps.tenant_id = ds.tenant_id
      ) ${stageScope}
    order by ds.tenant_id, ds.name
    limit 50`,
};

function report(title, rows, hint) {
  if (rows.length === 0) return false;
  console.error(`\n✗ ${title} (${rows.length}${rows.length === 50 ? '+, truncated' : ''}):`);
  for (const row of rows) console.error('   ', JSON.stringify(row));
  console.error(`    ${hint}`);
  return true;
}

try {
  await client.connect();

  const [totals] = (
    await client.query(
      `select
         (select count(*) from deals ${tenantId ? 'where tenant_id = $1' : ''}) as deals,
         (select count(*) from deal_stages ${tenantId ? 'where tenant_id = $1' : ''}) as legacy_stages,
         (select count(*) from pipeline_stages ${tenantId ? 'where tenant_id = $1' : ''}) as canonical_stages`,
      params,
    )
  ).rows;

  const orphans = (await client.query(QUERIES.orphans, params)).rows;
  const ambiguous = (await client.query(QUERIES.ambiguous, params)).rows;
  const unmirrored = (await client.query(QUERIES.unmirrored, params)).rows;

  console.log(
    `Checked ${totals.deals} deal(s) against ${totals.legacy_stages} legacy stage(s) ` +
      `and ${totals.canonical_stages} canonical stage(s)` +
      (tenantId ? ` in tenant ${tenantId}.` : ' across all tenants.'),
  );

  let failed = false;
  failed =
    report(
      'Deals whose stage resolves to NO canonical pipeline stage',
      orphans,
      'These deals are invisible to every surface bound to pipeline_stages. Mirror the legacy stage, do not repoint the deal.',
    ) || failed;
  failed =
    report(
      'Deals whose stage matches MORE THAN ONE canonical stage',
      ambiguous,
      'legacy_stage_id must be unique per tenant. Two mirrors of one legacy stage make the deal ambiguous.',
    ) || failed;
  failed =
    report(
      'Active legacy stages with no canonical mirror',
      unmirrored,
      'A deal moved into one of these would orphan immediately.',
    ) || failed;

  if (failed) {
    console.error('\nSee COP-M07 and docs/crm-canonical-model.md.');
    process.exit(1);
  }

  console.log('✓ Every deal resolves to exactly one canonical pipeline stage.');
} catch (error) {
  console.error(`✗ Stage-resolution check could NOT RUN: ${error.message}`);
  console.error('  Treat this as unknown, not as a pass.');
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
