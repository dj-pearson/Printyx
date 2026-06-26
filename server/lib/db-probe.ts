/**
 * One-off connectivity probe: tries each TLS mode against DATABASE_URL and
 * reports which one actually connects + runs `SELECT 1`. Disposable — delete
 * after we know the right SSL setting for the pooler.
 *   npx tsx server/lib/db-probe.ts
 */
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const cs = (
  process.env.DATABASE_URL_MIGRATE ||
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();
if (!cs) {
  console.error('No DATABASE_URL set.');
  process.exit(1);
}
try {
  const u = new URL(cs.replace(/^postgres(ql)?:\/\//, 'http://'));
  console.log(`Target: ${u.hostname}:${u.port || '5432'}\n`);
} catch {}

const modes: Array<{ label: string; ssl: any }> = [
  { label: 'ssl: false (plaintext)', ssl: false },
  { label: 'ssl: { rejectUnauthorized: false }', ssl: { rejectUnauthorized: false } },
  { label: 'ssl: true (verify cert)', ssl: true },
];

for (const m of modes) {
  const pool = new Pool({
    connectionString: cs,
    ssl: m.ssl,
    max: 1,
    connectionTimeoutMillis: 8000,
  });
  process.stdout.write(`Trying ${m.label} ... `);
  try {
    const r = await pool.query('SELECT 1 AS ok');
    console.log(`✓ CONNECTED (SELECT 1 -> ${r.rows[0].ok})`);
  } catch (err) {
    console.log(`✗ ${(err as Error & { code?: string }).code || ''} ${(err as Error).message}`);
  } finally {
    await pool.end().catch(() => {});
  }
}
console.log('\nUse the first mode that says CONNECTED.');
