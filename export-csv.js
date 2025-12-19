#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs/promises';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Key tables for CSV export (most important data)
const KEY_TABLES = [
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
  'product_models',
  'quotes',
  'proposals',
];

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportToCSV() {
  console.log('📊 Starting CSV export for key tables...');

  await fs.mkdir('csv-exports', { recursive: true });

  for (const table of KEY_TABLES) {
    try {
      console.log(`📋 Exporting ${table} to CSV...`);

      const result = await pool.query(`SELECT * FROM "${table}"`);
      const rows = result.rows;

      if (rows.length === 0) {
        console.log(`   ⚠️  Table ${table} is empty, skipping...`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      let csvContent = columns.join(',') + '\n';

      for (const row of rows) {
        const values = columns.map((col) => escapeCSV(row[col]));
        csvContent += values.join(',') + '\n';
      }

      await fs.writeFile(`csv-exports/${table}.csv`, csvContent);
      console.log(`   ✅ Exported ${rows.length} rows to ${table}.csv`);
    } catch (error) {
      console.error(`   ❌ Error exporting ${table}:`, error.message);
    }
  }

  // Close the pool
  await pool.end();

  console.log('✅ CSV export completed!');
  console.log('📁 CSV files created in csv-exports/ folder');
}

exportToCSV().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
