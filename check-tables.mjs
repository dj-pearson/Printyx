import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log('Total tables in database:', result.rows.length);
  console.log('Tables:');
  result.rows.forEach(r => console.log(`  - ${r.table_name}`));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
  process.exit(0);
}
