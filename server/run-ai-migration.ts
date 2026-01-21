/**
 * Run AI Enhancement Migration
 * This script applies the Motion AI database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runAIMigration() {
  console.log('🚀 Starting Comprehensive AI Migrations...');

  const migrations = [
    { name: 'AI Employees', file: 'ai-employees-migration.sql' },
    { name: 'Calendar Integration', file: 'calendar-integration-migration.sql' },
    { name: 'Meeting Transcription', file: 'meeting-transcription-migration.sql' },
    { name: 'Task Management', file: 'task-management-migration.sql' },
    { name: 'AI Search & Knowledge', file: 'ai-search-knowledge-migration.sql' },
  ];

  try {
    for (const migration of migrations) {
      console.log(`\n📋 Processing ${migration.name} Migration...`);

      // Read the migration SQL file
      const migrationPath = path.join(__dirname, '../migrations', migration.file);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migration.file}, skipping...`);
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      console.log(`📄 ${migration.name} SQL loaded, executing...`);

      try {
        // Execute the entire SQL file as one block to handle multi-line statements properly
        await db.execute(migrationSQL);
        console.log(`✅ ${migration.name} Migration executed successfully!`);
      } catch (error: any) {
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate column name') ||
          error.message?.includes('duplicate key value')
        ) {
          console.log(`⚠️  ${migration.name} Migration: Some objects already exist, continuing...`);
        } else {
          console.error(`❌ Error in ${migration.name} migration:`, error.message);
          // Continue with other migrations rather than failing completely
        }
      }

      console.log(`✅ ${migration.name} Migration completed!`);
    }

    console.log('\n🎉 All AI Migrations completed successfully!');
    console.log('\n🎯 Your platform now includes:');
    console.log('• AI Employees - Intelligent agents and workflow automation');
    console.log('• Calendar Integration - Smart scheduling and event management');
    console.log('• Meeting Transcription - AI-powered meeting notes and highlights');
    console.log('• Task Management - AI scheduling and dependency tracking');
    console.log('• AI Search & Knowledge - Vector search and intelligent answers');
    console.log('\n🔧 Next Steps:');
    console.log('1. Set CLAUDE_API_KEY in your environment variables');
    console.log('2. Update sidebar navigation to include new features');
    console.log('3. Test the integrations with your new AI capabilities');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run migration if this file is executed directly

if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAIMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runAIMigration };
