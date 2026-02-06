import 'dotenv/config';
import pg from 'pg';
import { createModuleLogger } from './logger';
const log = createModuleLogger('migrate');

const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_TABLE = '__migration_lock';
const LOCK_ID = 1;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle/migrations');

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.startsWith('postgres')) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'postgres';
  if (!host || !user || !password) {
    throw new Error(
      'Database configuration incomplete. Provide either DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD',
    );
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function createPool(): pg.Pool {
  const databaseUrl = buildDatabaseUrl();
  const sslConfig =
    process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
      ? process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
        ? { rejectUnauthorized: false }
        : true
      : undefined;

  return new Pool({
    connectionString: databaseUrl,
    ssl: sslConfig as any,
    max: 1,
  });
}

async function ensureLockTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${LOCK_TABLE} (
      id INTEGER PRIMARY KEY DEFAULT 1,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      locked_by TEXT,
      locked_at TIMESTAMPTZ,
      CONSTRAINT single_lock CHECK (id = 1)
    )
  `);
  await pool.query(`
    INSERT INTO ${LOCK_TABLE} (id, locked) VALUES (1, FALSE)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function acquireLock(pool: pg.Pool): Promise<boolean> {
  await ensureLockTable(pool);
  const hostname = process.env.HOSTNAME || 'unknown';
  const result = await pool.query(
    `
    UPDATE ${LOCK_TABLE}
    SET locked = TRUE, locked_by = $1, locked_at = NOW()
    WHERE id = $2
      AND (locked = FALSE OR locked_at < NOW() - INTERVAL '${LOCK_TIMEOUT_MS} milliseconds')
    RETURNING *
  `,
    [hostname, LOCK_ID],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

async function releaseLock(pool: pg.Pool): Promise<void> {
  await pool.query(
    `UPDATE ${LOCK_TABLE} SET locked = FALSE, locked_by = NULL, locked_at = NULL WHERE id = $1`,
    [LOCK_ID],
  );
}

async function getLockStatus(pool: pg.Pool): Promise<{
  locked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
}> {
  await ensureLockTable(pool);
  const result = await pool.query(`SELECT * FROM ${LOCK_TABLE} WHERE id = $1`, [LOCK_ID]);
  if (result.rows.length === 0) {
    return { locked: false, lockedBy: null, lockedAt: null };
  }
  const row = result.rows[0];
  return {
    locked: row.locked,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at ? new Date(row.locked_at) : null,
  };
}

async function runMigrations(): Promise<void> {
  const pool = createPool();

  try {
    log.info('[Migrate] Acquiring migration lock...');
    const acquired = await acquireLock(pool);
    if (!acquired) {
      const status = await getLockStatus(pool);
      log.error(
        `[Migrate] Failed to acquire lock. Currently locked by: ${status.lockedBy} since ${status.lockedAt}`,
      );
      process.exit(1);
    }
    log.info('[Migrate] Lock acquired.');

    log.info(`[Migrate] Running migrations from: ${MIGRATIONS_FOLDER}`);

    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    log.info('[Migrate] Migrations completed successfully.');
  } catch (error) {
    log.error('[Migrate] Migration failed:', error);
    process.exit(1);
  } finally {
    try {
      await releaseLock(pool);
      log.info('[Migrate] Lock released.');
    } catch (lockError) {
      log.error('[Migrate] Warning: Failed to release lock:', lockError);
    }
    await pool.end();
  }
}

/**
 * Mark all existing migrations as applied WITHOUT executing them.
 * Use this when initializing drizzle migrations against an existing database
 * that was previously managed with db:push.
 *
 * Usage: npm run db:migrate:baseline
 */
async function markBaseline(): Promise<void> {
  const pool = createPool();

  try {
    // Read the meta journal to find all migrations
    const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) {
      log.error('[Migrate] No migrations found. Run `npm run db:generate` first.');
      process.exit(1);
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    const entries: Array<{ tag: string }> = journal.entries || [];

    if (entries.length === 0) {
      log.error('[Migrate] No migration entries in journal.');
      process.exit(1);
    }

    // Create the drizzle migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    // Check what's already applied
    const applied = await pool.query(`SELECT hash FROM __drizzle_migrations`);
    const appliedHashes = new Set(applied.rows.map((r: { hash: string }) => r.hash));

    let marked = 0;
    for (const entry of entries) {
      const sqlFile = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFile)) {
        log.warn(`[Migrate] Warning: SQL file not found for ${entry.tag}, skipping`);
        continue;
      }

      const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
      const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

      if (appliedHashes.has(hash)) {
        log.info(`[Migrate] Already applied: ${entry.tag}`);
        continue;
      }

      await pool.query(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [
        hash,
        Date.now(),
      ]);
      marked++;
      log.info(`[Migrate] Marked as applied: ${entry.tag}`);
    }

    if (marked === 0) {
      log.info('[Migrate] All migrations already marked as applied.');
    } else {
      log.info(`[Migrate] Baseline complete. Marked ${marked} migration(s) as applied.`);
    }
    log.info('[Migrate] Future schema changes will generate incremental migrations.');
  } catch (error) {
    log.error('[Migrate] Baseline failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function showStatus(): Promise<void> {
  const pool = createPool();

  try {
    const lockStatus = await getLockStatus(pool);
    log.info('[Migrate] Lock status:', lockStatus.locked ? 'LOCKED' : 'FREE');
    if (lockStatus.locked) {
      log.info(`  Locked by: ${lockStatus.lockedBy}`);
      log.info(`  Locked at: ${lockStatus.lockedAt}`);
    }

    try {
      const result = await pool.query(
        `SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 20`,
      );
      log.info(`\n[Migrate] Applied migrations (${result.rows.length} shown):`);
      for (const row of result.rows) {
        const date = new Date(Number(row.created_at));
        log.info(`  - ${row.hash} (applied: ${date.toISOString()})`);
      }
    } catch {
      log.info(
        '[Migrate] No migrations have been applied yet (__drizzle_migrations table not found).',
      );
    }
  } catch (error) {
    log.error('[Migrate] Error checking status:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// CLI handler
const command = process.argv[2];
if (command === 'status') {
  showStatus();
} else if (command === 'baseline') {
  markBaseline();
} else {
  runMigrations();
}
