#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs/promises';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Key tables with actual data
const PRIORITY_TABLES = [
  'tenants',
  'users',
  'roles',
  'companies',
  'locations',
  'regions',
  'business_records',
  'customers',
  'leads',
  'deals',
  'contracts',
  'equipment',
  'inventory_items',
  'service_tickets',
  'invoices',
  'master_product_models',
  'master_product_accessories',
  'product_models',
  'quotes',
  'proposals',
  'enabled_products',
];

async function exportPriorityTables() {
  console.log('🔄 Starting export of tables with data...');

  await fs.mkdir('database-exports', { recursive: true });

  let combinedSQL = `-- Printyx Database Export\n`;
  combinedSQL += `-- Generated on: ${new Date().toISOString()}\n\n`;

  for (const tableName of PRIORITY_TABLES) {
    try {
      console.log(`📊 Checking table: ${tableName}`);

      // Get count
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count);

      if (rowCount === 0) {
        console.log(`   ⚠️  Table ${tableName} is empty, skipping...`);
        continue;
      }

      console.log(`   ✅ Found ${rowCount} rows in ${tableName}, exporting...`);

      // Get table structure
      const structureResult = await pool.query(
        `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName],
      );

      let tableSQL = `\n-- Table: ${tableName} (${rowCount} rows)\n`;
      tableSQL += `-- Structure:\n`;
      structureResult.rows.forEach((col) => {
        tableSQL += `--   ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ''}\n`;
      });
      tableSQL += `\n`;

      // Get all data
      const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);
      const rows = dataResult.rows;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);

        rows.forEach((row) => {
          const values = columns
            .map((col) => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              if (typeof value === 'boolean') return value ? 'true' : 'false';
              if (value instanceof Date) return `'${value.toISOString()}'`;
              if (typeof value === 'object')
                return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
              return value;
            })
            .join(', ');

          tableSQL += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values});\n`;
        });
      }

      combinedSQL += tableSQL;

      // Also create individual file
      await fs.writeFile(`database-exports/${tableName}.sql`, tableSQL);
    } catch (error) {
      console.error(`   ❌ Error with ${tableName}:`, error.message);
    }
  }

  // Write combined file
  await fs.writeFile('database-exports/priority-tables-export.sql', combinedSQL);

  // Close the pool
  await pool.end();

  console.log('\n✅ Export completed!');
  console.log('📁 Files created in database-exports/ folder');
}

exportPriorityTables().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
