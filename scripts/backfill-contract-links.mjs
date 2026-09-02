#!/usr/bin/env node
// backfill-contract-links.mjs  (WF-C-09)
//
// Fills contracts.deal_id / contracts.proposal_id and the deals.contract_id
// back-link on rows created before those columns existed.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/backfill-contract-links.mjs --dry-run
//   DATABASE_URL=postgres://... node scripts/backfill-contract-links.mjs --apply
//   ... --tenant <id>     restrict to one tenant
//
// Exit 0 on success, 1 on a failed write, 2 when it could not connect - so "it
// did not run" is never mistaken for "there was nothing to do".
//
// ── HOW A LINK IS INFERRED, AND WHY IT IS DELIBERATELY NARROW ─────────────────
//
// There is no stored trace back to the proposal, so the match is reconstructed
// from what createContractFromProposal used at the time: it set customer_id from
// proposal.business_record_id and nothing else. Matching on the customer alone
// would link every contract a customer has ever had to the same proposal, so a
// candidate must also be:
//
//   - an ACCEPTED proposal for that customer, and
//   - the ONLY such proposal (ambiguous customers are skipped and listed), and
//   - accepted BEFORE the contract was created, and within 24 hours of it,
//     because the contract was written in the same request as the acceptance.
//
// A customer with two accepted proposals is reported, not guessed. Attaching a
// contract to the wrong deal is worse than leaving it unattached: it moves
// revenue onto the wrong rep's number and puts the wrong account in WF-P-04's
// Needs Ordering queue.
//
// The deal is then whichever deal the proposal produced - upsertDealForProposal
// keys on the title `"<proposal title> (<proposal number>)"`, which is the same
// reconstruction, and equally exact.
//
// WHAT IT WILL NOT DO: it never overwrites a link that is already set, and it
// never touches start_date or end_date. Rows created before WF-C-09 carry a
// fabricated 36-month term; correcting those is an acceptance question
// (WF-L-08), not a back-fill.

import pg from 'pg';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run') || !apply;
const tenantArg = args.indexOf('--tenant');
const tenantId = tenantArg === -1 ? null : args[tenantArg + 1];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. This script needs a database; it cannot be inferred.');
  process.exit(2);
}

const ssl =
  process.env.DB_SSL === 'false'
    ? undefined
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };

const client = new pg.Client({ connectionString: url, ssl });

const scope = tenantId ? 'and c.tenant_id = $1' : '';
const params = tenantId ? [tenantId] : [];

/** Contracts with no proposal link, and the accepted proposals that could be theirs. */
const CANDIDATES = `
  select
    c.id            as contract_id,
    c.tenant_id,
    c.contract_number,
    c.created_at    as contract_created_at,
    count(p.id)     as candidate_count,
    min(p.id)       as proposal_id,
    min(p.title)    as proposal_title,
    min(p.proposal_number) as proposal_number
  from contracts c
  join proposals p
    on p.tenant_id = c.tenant_id
   and p.business_record_id = c.customer_id
   and p.status = 'accepted'
   and p.accepted_at is not null
   and p.accepted_at <= c.created_at
   and p.accepted_at > c.created_at - interval '24 hours'
  where c.proposal_id is null
    and c.deal_id is null
    ${scope}
  group by c.id, c.tenant_id, c.contract_number, c.created_at
`;

async function main() {
  await client.connect();

  const { rows } = await client.query(CANDIDATES, params);
  const unique = rows.filter((r) => Number(r.candidate_count) === 1);
  const ambiguous = rows.filter((r) => Number(r.candidate_count) > 1);

  console.log(
    `${rows.length} unlinked contract(s) with a plausible proposal; ` +
      `${unique.length} unambiguous, ${ambiguous.length} skipped as ambiguous.`,
  );

  if (ambiguous.length > 0) {
    console.log('\nSkipped - more than one accepted proposal in the window:');
    for (const r of ambiguous) {
      console.log(`  ${r.contract_number} (${r.contract_id}) — ${r.candidate_count} candidates`);
    }
  }

  let linked = 0;
  let dealsLinked = 0;

  for (const row of unique) {
    // The deal upsertDealForProposal would have created, by the exact title it
    // builds. No match is fine: the proposal link still stands on its own.
    const title = `${row.proposal_title} (${row.proposal_number})`;
    const { rows: deals } = await client.query(
      `select id from deals where tenant_id = $1 and title = $2 limit 2`,
      [row.tenant_id, title],
    );
    const dealId = deals.length === 1 ? deals[0].id : null;

    console.log(
      `  ${row.contract_number} -> proposal ${row.proposal_id}` +
        (dealId ? `, deal ${dealId}` : ', no single matching deal'),
    );

    if (dryRun) continue;

    try {
      await client.query('begin');
      await client.query(
        `update contracts set proposal_id = $1, deal_id = $2, updated_at = now()
         where id = $3 and proposal_id is null and deal_id is null`,
        [row.proposal_id, dealId, row.contract_id],
      );
      linked++;
      if (dealId) {
        // Never overwrite a back-link that is already set.
        const res = await client.query(
          `update deals set contract_id = $1, updated_at = now()
           where id = $2 and contract_id is null`,
          [row.contract_id, dealId],
        );
        dealsLinked += res.rowCount ?? 0;
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      console.error(`✗ failed on contract ${row.contract_id}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log(
      `\nDRY RUN — nothing written. Re-run with --apply to link ${unique.length} row(s).`,
    );
  } else {
    console.log(`\n✓ Linked ${linked} contract(s) and ${dealsLinked} deal back-link(s).`);
  }

  await client.end();
}

main().catch(async (err) => {
  console.error(`✗ ${err.message}`);
  try {
    await client.end();
  } catch {
    // already closed
  }
  process.exit(2);
});
