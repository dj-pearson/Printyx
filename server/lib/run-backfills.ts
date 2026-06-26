/**
 * Ordered runner for the hand-run drizzle/migrations/_backfill_*.sql repair
 * scripts. These carry an underscore prefix so drizzle-kit ignores them (they
 * are NOT in meta/_journal.json); they exist because 0008 bombed mid-script on
 * some installs and never reached the blog DDL. Every script is idempotent, so
 * re-running this whole runner is safe.
 *
 * Why a Node runner instead of `psql -f _backfill_run_all.sql`: that file uses
 * psql meta-commands (\set, \ir, \echo) which only the psql CLI understands — a
 * GUI client or driver ships the backslash to the server and gets
 * `42601 syntax error at or near "\"`. This runner needs no psql and reuses the
 * same env/SSL connection logic as server/lib/migrate.ts.
 *
 * Ordering rule: a script that REFERENCES a table must run AFTER the script that
 * CREATES it. The TIERS array encodes that. Each file is executed as its own
 * query (one implicit transaction per file, so a feature's tables are
 * all-or-nothing), and the runner stops on the first error.
 *
 * Usage:  npm run db:backfill
 */
import 'dotenv/config';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPgSslConfigFromEnv } from './postgres-ssl';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle/migrations');

// --- connection (mirrors migrate.ts) --------------------------------------
function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.startsWith('postgres')) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'postgres';
  if (!host || !user || !password) {
    throw new Error('Provide either DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD');
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
function connectionString(): string {
  const direct =
    process.env.DATABASE_URL_MIGRATE?.trim() || process.env.DIRECT_DATABASE_URL?.trim();
  return direct?.startsWith('postgres') ? direct : buildDatabaseUrl();
}

// --- pre-flight self-heal --------------------------------------------------
// A half-applied install can leave a machine-keyed table present but WITHOUT
// machine_id, so its CREATE INDEX (machine_id) throws 42703 and aborts the file.
// ADD COLUMN IF NOT EXISTS never drops data; absent tables are created correctly
// by the backfill itself.
const PREFLIGHT_SQL = `
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'machine_supply_levels','supply_orders','machine_supply_settings','equipment_failure_predictions'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS machine_id varchar', t);
    END IF;
  END LOOP;
END $$;`;

// --- ordered file list (dependency tiers) ---------------------------------
const TIERS: Array<{ tier: string; files: string[] }> = [
  {
    tier: 'Tier 0 — standalone feature tables',
    files: [
      'chatbot',
      'churn_risk',
      'contract_pnl',
      'daily_briefing',
      'deal_desk_copilot',
      'email_autopilot',
      'meter_read_vision',
      'portal_service_classification',
      'predictive_failure',
      'qbr',
      'renewal_autoquote',
      'service_knowledge',
      'toner_replenish',
      'truck_stock',
      'voice_agent',
      'voice_ticket_close',
    ],
  },
  {
    tier: 'Tier 1 — blog foundation (creates blog_posts, blog_assets, ...)',
    files: ['blog_tables'],
  },
  {
    tier: 'Tier 2 — blog (foundation-only deps)',
    files: [
      // authors / serp_snapshots / authoring_tools are needed by Tier 3 — run first
      'blog_authors',
      'blog_serp_snapshots',
      'blog_authoring_tools',
      'blog_ai_costs',
      'blog_jobs',
      'blog_pipeline',
      'blog_platform_api',
      'blog_competitor_gap',
      'blog_assets_bucket',
      'blog_experiments',
      'blog_outline_variants',
      'blog_post_variants',
      'blog_qa_reports',
      'blog_rank_forecasts',
      'blog_syndication',
      'blog_topic_intel',
      'blog_distribution_engine',
      'blog_analytics_intel',
      // ALTER-only (alter foundation tables):
      'blog_critique_loop',
      'blog_keywords_paa',
      'blog_schema_markup',
      'blog_posts_calendar',
    ],
  },
  {
    tier: 'Tier 3 — blog (cross-script deps)',
    files: [
      'blog_outreach', // needs blog_authors
      'blog_serp_monitor', // needs blog_serp_snapshots
      'blog_content_platform', // needs blog_data_assets (from authoring_tools)
    ],
  },
];

async function main(): Promise<void> {
  const cs = connectionString();
  const pool = new Pool({ connectionString: cs, ssl: getPgSslConfigFromEnv(cs) as any, max: 1 });
  let ran = 0;
  try {
    console.log('[backfill] pre-flight self-heal (machine_id columns)...');
    await pool.query(PREFLIGHT_SQL);

    for (const { tier, files } of TIERS) {
      console.log(`\n[backfill] ${tier}`);
      for (const stem of files) {
        const file = path.join(MIGRATIONS_FOLDER, `_backfill_${stem}.sql`);
        if (!fs.existsSync(file)) {
          console.warn(`  ⚠ missing, skipped: _backfill_${stem}.sql`);
          continue;
        }
        const sql = fs.readFileSync(file, 'utf-8');
        try {
          await pool.query(sql);
          console.log(`  ✓ _backfill_${stem}.sql`);
          ran++;
        } catch (err) {
          console.error(`  ✗ _backfill_${stem}.sql — ${(err as Error).message}`);
          throw err; // stop on first error, like ON_ERROR_STOP
        }
      }
    }
    console.log(`\n[backfill] done — ${ran} script(s) applied.`);
  } catch (err) {
    console.error('\n[backfill] FAILED:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
