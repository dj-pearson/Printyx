#!/usr/bin/env node
/**
 * Schema-of-record manifest (PA-031).
 *
 * `check:phantom-tables` proves a table name is absent from the two sources the
 * REPOSITORY controls — `pgTable()` in shared/ and `CREATE TABLE` in drizzle/.
 * Its own header is careful to say that this does not prove the relation is
 * missing from a database, so every name on its list is a question rather than a
 * defect. PA-031 is the story that answers the question.
 *
 * It can be answered properly now: since PA-032, `npm run db:migrate` builds a
 * complete database from the migrations alone, so "does this relation exist in a
 * database built from the repo" has a definite answer instead of an inference.
 * Point DATABASE_URL at such a database and this writes the manifest.
 *
 * Each name lands in one of three buckets:
 *
 *   RENAME    a relation with that name is absent, but an obvious real table
 *             serves the same feature (`notifications` -> `user_notifications`).
 *             The handler is querying the wrong name.
 *   MISSING   absent, with no candidate. Either the feature needs a schema and a
 *             migration, or the endpoint is dead and should go.
 *   PRESENT   the relation exists after all. The checker's own list was built
 *             from a stale read, or a migration has since added it.
 *
 * Usage:
 *   DATABASE_URL=postgres://…  node scripts/build-schema-of-record-manifest.mjs
 *   … --out docs/schema-of-record-manifest.md
 *
 * Exits 2 when it cannot reach a database, so "did not run" is never mistaken
 * for "nothing to report".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const repoRoot = resolve(import.meta.dirname, '..');
const baselinePath = resolve(repoRoot, 'docs/phantom-tables-baseline.json');

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outPath = resolve(
  repoRoot,
  outIdx === -1 ? 'docs/schema-of-record-manifest.md' : args[outIdx + 1],
);

/**
 * Candidate real tables for the names the code gets wrong, from the story's own
 * list plus what the repo shows. Only recorded where the mapping is defensible;
 * a guess here would be worse than a blank, because it is the thing a later
 * change gets made against.
 */
const RENAME_CANDIDATES = {
  // notifications -> user_notifications is the case that motivated
  // check:phantom-tables; PROD-008b already re-pointed it, so it no longer
  // appears in the baseline. Kept as the worked example of the pattern.
  notifications: 'user_notifications',
  customers: 'business_records',
  inventory: 'inventory_items',
  work_orders: 'service_tickets',
  parts: 'parts_orders',
  pricing_settings: 'company_pricing_settings',
  team_members: 'sales_team_members',
  leads: 'business_records',
  devices: 'equipment',
  appointments: 'customer_maintenance_appointments',
  payments: 'customer_payments',
  activities: 'business_record_activities',
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. This manifest is only meaningful against a database');
  console.error('  built from the migrations — see docs/disaster-recovery-runbook.md.');
  process.exit(2);
}

const ssl =
  process.env.DB_SSL === 'false'
    ? undefined
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };

/** "activities (supabase/functions/gdpr/index.ts)" -> { table, file } */
function parseEntry(entry) {
  const match = entry.match(/^(\S+)\s+\((.+)\)$/);
  return match ? { table: match[1], file: match[2] } : null;
}

const client = new pg.Client({ connectionString: url, ssl });

try {
  await client.connect();

  const { rows: relations } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public'
     union
     select matviewname from pg_matviews where schemaname = 'public'`,
  );
  const present = new Set(relations.map((r) => r.table_name));

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).allowed ?? [];
  const byTable = new Map();
  for (const entry of baseline) {
    const parsed = parseEntry(entry);
    if (!parsed) continue;
    const files = byTable.get(parsed.table) ?? [];
    files.push(parsed.file);
    byTable.set(parsed.table, files);
  }

  const buckets = { PRESENT: [], RENAME: [], MISSING: [] };
  for (const [table, files] of [...byTable].sort()) {
    const candidate = RENAME_CANDIDATES[table];
    const bucket = present.has(table)
      ? 'PRESENT'
      : candidate && present.has(candidate)
        ? 'RENAME'
        : 'MISSING';
    buckets[bucket].push({ table, files: files.sort(), candidate });
  }

  const total = byTable.size;
  const lines = [];
  lines.push('# Schema-of-record manifest');
  lines.push('');
  lines.push(
    '**PA-031.** Every table name the code queries that is declared in no `shared/*.ts` ' +
      '`pgTable()` and created by no migration, classified against a database built from the ' +
      'migrations alone.',
  );
  lines.push('');
  lines.push(
    '`check:phantom-tables` finds these names but is explicit that absence from the repo does ' +
      'not prove absence from a database. This resolves that: since PA-032, `npm run db:migrate` ' +
      'builds a complete database from the repo, so the question has a definite answer.',
  );
  lines.push('');
  lines.push('Regenerate with:');
  lines.push('');
  lines.push('```bash');
  lines.push('DATABASE_URL=… npm run manifest:schema-of-record');
  lines.push('```');
  lines.push('');
  lines.push(
    `Counted **${total}** distinct table name(s) across ${baseline.length} reference(s): ` +
      `${buckets.MISSING.length} missing, ${buckets.RENAME.length} with a rename candidate, ` +
      `${buckets.PRESENT.length} present after all.`,
  );
  lines.push('');

  const sections = [
    [
      'MISSING',
      'Absent, with no candidate',
      'Each of these needs a decision: give the feature a schema and a migration, or delete the ' +
        'endpoint. A handler that swallows the 42P01 and returns an empty list is the worst of ' +
        'the three outcomes, because nobody ever sees it fail.',
    ],
    [
      'RENAME',
      'Absent, but a real table serves the feature',
      'The handler is querying the wrong name. Re-point it — no schema change needed. Confirm the ' +
        'candidate against the columns the handler actually reads before repointing; the mapping ' +
        'here is by feature, not by column.',
    ],
    [
      'PRESENT',
      'Exists after all',
      'The relation is in the migration-built database, so these are stale entries in the ' +
        'phantom-table baseline rather than defects. Tighten the baseline.',
    ],
  ];

  for (const [key, title, blurb] of sections) {
    lines.push(`## ${title} (${buckets[key].length})`);
    lines.push('');
    lines.push(blurb);
    lines.push('');
    if (buckets[key].length === 0) {
      lines.push('_None._');
      lines.push('');
      continue;
    }
    lines.push('| Table | ' + (key === 'RENAME' ? 'Real table | ' : '') + 'Referenced by |');
    lines.push('| --- | ' + (key === 'RENAME' ? '--- | ' : '') + '--- |');
    for (const row of buckets[key]) {
      const files = row.files.map((f) => `\`${f}\``).join('<br>');
      lines.push(
        `| \`${row.table}\` | ` +
          (key === 'RENAME' ? `\`${row.candidate}\` | ` : '') +
          `${files} |`,
      );
    }
    lines.push('');
  }

  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(
    `✓ Wrote ${outPath}: ${total} table(s) — ${buckets.MISSING.length} missing, ` +
      `${buckets.RENAME.length} rename, ${buckets.PRESENT.length} present.`,
  );
} catch (error) {
  console.error(`✗ Could not build the manifest: ${error.message}`);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
