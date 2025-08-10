#!/usr/bin/env node

// This script generates export commands using pg_dump
import fs from 'fs/promises';

const TABLES_WITH_DATA = [
  'tenants', 'users', 'roles', 'enhanced_roles', 'role_permissions',
  'companies', 'locations', 'regions', 'business_records', 
  'master_product_models', 'master_product_accessories', 
  'enabled_products', 'product_models', 'deals', 'quotes'
];

async function generateExportCommands() {
  let commands = `#!/bin/bash
# Database Export Commands for Printyx
# Generated on: ${new Date().toISOString()}

echo "🔄 Starting database export..."

# Create exports directory
mkdir -p database-exports

# Export individual tables with data
`;

  for (const table of TABLES_WITH_DATA) {
    commands += `
echo "📊 Exporting ${table}..."
pg_dump "$DATABASE_URL" --table=${table} --data-only --inserts > "database-exports/${table}.sql"
`;
  }

  commands += `
# Export complete schema
echo "📋 Exporting complete schema..."
pg_dump "$DATABASE_URL" --schema-only > "database-exports/schema.sql"

# Export all data in one file
echo "📦 Exporting all data..."
pg_dump "$DATABASE_URL" --data-only --inserts > "database-exports/all-data.sql"

# Create CSV exports for key tables
echo "📊 Creating CSV exports..."
`;

  for (const table of TABLES_WITH_DATA.slice(0, 8)) { // First 8 tables for CSV
    commands += `psql "$DATABASE_URL" -c "\\COPY ${table} TO 'database-exports/${table}.csv' WITH CSV HEADER"\n`;
  }

  commands += `
echo "✅ Export completed!"
echo "📁 Files created in database-exports/ folder"
`;

  await fs.writeFile('export-commands.sh', commands);
  await fs.chmod('export-commands.sh', '755');
  
  console.log('✅ Created export-commands.sh');
  console.log('📝 Run: ./export-commands.sh');
}

generateExportCommands().catch(console.error);