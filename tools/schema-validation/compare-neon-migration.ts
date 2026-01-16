/**
 * NEON to Supabase Migration Checker
 * Compares old NEON database exports with current Supabase schema
 */

import * as fs from 'fs';
import * as path from 'path';

interface MigrationStatus {
  neonTables: string[];
  supabaseTables: string[];
  missingTables: string[];
  extraTables: string[];
  commonTables: string[];
}

async function analyzeMigration(): Promise<void> {
  console.log('🔍 Analyzing NEON → Supabase Migration Status\n');

  // Read NEON export
  const neonExportPath = path.join(process.cwd(), 'database-exports', 'complete-with-schema.sql');

  if (!fs.existsSync(neonExportPath)) {
    console.log('⚠️  No NEON export found at database-exports/complete-with-schema.sql');
    console.log('Cannot perform comparison without old database export.\n');
    return;
  }

  const neonExport = fs.readFileSync(neonExportPath, 'utf-8');

  // Extract table names from NEON export
  const neonTableMatches = neonExport.matchAll(/CREATE TABLE\s+(?:public\.)?([a-z_]+)/gi);
  const neonTables = new Set<string>();

  for (const match of neonTableMatches) {
    neonTables.add(match[1]);
  }

  // Get Supabase schema (from our generated schema-definition.json)
  const schemaPath = path.join(
    process.cwd(),
    'tools',
    'schema-validation',
    'schema-definition.json',
  );

  if (!fs.existsSync(schemaPath)) {
    console.log('⚠️  No schema definition found. Run extract-schema.ts first.');
    return;
  }

  const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const supabaseTables = new Set(Object.keys(schemaData.tables));

  // Compare
  const neonTableList = Array.from(neonTables).sort();
  const supabaseTableList = Array.from(supabaseTables).sort();

  const missingTables = neonTableList.filter((t) => !supabaseTables.has(t));
  const extraTables = supabaseTableList.filter((t) => !neonTables.has(t));
  const commonTables = neonTableList.filter((t) => supabaseTables.has(t));

  // Report
  console.log('📊 Migration Status Report\n');
  console.log('═'.repeat(60));

  console.log(`\n📋 NEON Database (Old):`);
  console.log(`   ${neonTableList.length} tables found\n`);

  console.log(`📋 Supabase Database (Current):`);
  console.log(`   ${supabaseTableList.length} tables found\n`);

  console.log('═'.repeat(60));

  console.log(`\n✅ Successfully Migrated: ${commonTables.length} tables`);
  console.log(`⚠️  Missing from Supabase: ${missingTables.length} tables`);
  console.log(`➕ New Tables (not in NEON): ${extraTables.length} tables\n`);

  console.log('═'.repeat(60));

  // Missing tables details
  if (missingTables.length > 0) {
    console.log(`\n⚠️  Tables in NEON but NOT in Supabase:\n`);
    missingTables.forEach((table) => {
      console.log(`   ❌ ${table}`);
    });
    console.log('\n💡 These tables may need to be migrated or were intentionally excluded.');
  } else {
    console.log(`\n✅ All NEON tables have been migrated to Supabase!`);
  }

  // Extra tables details
  if (extraTables.length > 0) {
    console.log(`\n➕ New tables added in Supabase (not in old NEON):\n`);
    extraTables.forEach((table) => {
      console.log(`   ✨ ${table}`);
    });
    console.log('\n💡 These are new features added after migration.');
  }

  // Core tables check
  console.log('\n' + '═'.repeat(60));
  console.log('\n🎯 Core Tables Verification:\n');

  const coreTables = [
    'users',
    'tenants',
    'companies',
    'company_contacts',
    'customers',
    'leads',
    'deals',
    'quotes',
    'invoices',
    'contracts',
    'service_tickets',
    'equipment',
    'meter_readings',
    'roles',
    'teams',
    'locations',
  ];

  for (const table of coreTables) {
    const inNeon = neonTables.has(table);
    const inSupabase = supabaseTables.has(table);

    if (inNeon && inSupabase) {
      console.log(`   ✅ ${table.padEnd(25)} - Migrated`);
    } else if (!inNeon && inSupabase) {
      console.log(`   ➕ ${table.padEnd(25)} - New (not in NEON)`);
    } else if (inNeon && !inSupabase) {
      console.log(`   ❌ ${table.padEnd(25)} - MISSING from Supabase!`);
    } else {
      console.log(`   ⚪ ${table.padEnd(25)} - Not in either DB`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📈 Migration Completeness:\n');

  const migrationPercent = Math.round((commonTables.length / neonTableList.length) * 100);
  console.log(
    `   ${migrationPercent}% of NEON tables migrated (${commonTables.length}/${neonTableList.length})`,
  );

  if (migrationPercent === 100) {
    console.log('\n   🎉 Complete! All tables migrated successfully!');
  } else if (migrationPercent >= 90) {
    console.log('\n   ✅ Nearly complete! Review missing tables to confirm intentional.');
  } else if (migrationPercent >= 75) {
    console.log('\n   ⚠️  Most tables migrated. Some work remaining.');
  } else {
    console.log('\n   ⚠️  Migration incomplete. Many tables still need migration.');
  }

  console.log('\n' + '═'.repeat(60));

  // Check for data files
  console.log('\n📦 Data Export Files Available:\n');

  const dataExports = fs
    .readdirSync(path.join(process.cwd(), 'database-exports'))
    .filter((f) => f.endsWith('.sql') || f.endsWith('.csv'));

  console.log(`   Found ${dataExports.length} export files:`);
  dataExports.slice(0, 10).forEach((file) => {
    console.log(`   📄 ${file}`);
  });

  if (dataExports.length > 10) {
    console.log(`   ... and ${dataExports.length - 10} more files`);
  }

  console.log('\n═'.repeat(60));
  console.log('\n✅ Analysis complete!\n');
}

analyzeMigration().catch(console.error);
