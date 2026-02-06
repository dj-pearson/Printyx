import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_TABLE = '__migration_lock';
const LOCK_ID = 1;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
  const databaseUrl = buildDatabaseUrl();
  const sslConfig =
    process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
      ? process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
        ? { rejectUnauthorized: false }
        : true
      : undefined;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: sslConfig as any,
    max: 1,
  });

  try {
    // Acquire migration lock
    console.log('[Migrate] Acquiring migration lock...');
    const acquired = await acquireLock(pool);
    if (!acquired) {
      const status = await getLockStatus(pool);
      console.error(
        `[Migrate] Failed to acquire lock. Currently locked by: ${status.lockedBy} since ${status.lockedAt}`,
      );
      process.exit(1);
    }
    console.log('[Migrate] Lock acquired.');

    // Run migrations
    const migrationsFolder = path.resolve(__dirname, '../../drizzle/migrations');
    console.log(`[Migrate] Running migrations from: ${migrationsFolder}`);

    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder });

    console.log('[Migrate] Migrations completed successfully.');
  } catch (error) {
    console.error('[Migrate] Migration failed:', error);
    process.exit(1);
  } finally {
    // Always release lock
    try {
      await releaseLock(pool);
      console.log('[Migrate] Lock released.');
    } catch (lockError) {
      console.error('[Migrate] Warning: Failed to release lock:', lockError);
    }
    await pool.end();
  }
}

async function showStatus(): Promise<void> {
  const databaseUrl = buildDatabaseUrl();
  const sslConfig =
    process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
      ? process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
        ? { rejectUnauthorized: false }
        : true
      : undefined;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: sslConfig as any,
    max: 1,
  });

  try {
    // Check lock status
    const lockStatus = await getLockStatus(pool);
    console.log('[Migrate] Lock status:', lockStatus.locked ? 'LOCKED' : 'FREE');
    if (lockStatus.locked) {
      console.log(`  Locked by: ${lockStatus.lockedBy}`);
      console.log(`  Locked at: ${lockStatus.lockedAt}`);
    }

    // Check applied migrations from drizzle's __drizzle_migrations table
    try {
      const result = await pool.query(
        `SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 20`,
      );
      console.log(`\n[Migrate] Applied migrations (${result.rows.length} shown):`);
      for (const row of result.rows) {
        const date = new Date(Number(row.created_at));
        console.log(`  - ${row.hash} (applied: ${date.toISOString()})`);
      }
    } catch {
      console.log(
        '[Migrate] No migrations have been applied yet (__drizzle_migrations table not found).',
      );
    }
  } catch (error) {
    console.error('[Migrate] Error checking status:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// CLI handler
const command = process.argv[2];
if (command === 'status') {
  showStatus();
} else {
  runMigrations();
}
