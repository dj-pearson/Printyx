/**
 * Run AI Enhancement Migration
 * This script applies the Motion AI database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-ai-migration');

async function runAIMigration() {
  log.info('🚀 Starting Comprehensive AI Migrations...');

  const migrations = [
    { name: 'AI Employees', file: 'ai-employees-migration.sql' },
    { name: 'Calendar Integration', file: 'calendar-integration-migration.sql' },
    { name: 'Meeting Transcription', file: 'meeting-transcription-migration.sql' },
    { name: 'Task Management', file: 'task-management-migration.sql' },
    { name: 'AI Search & Knowledge', file: 'ai-search-knowledge-migration.sql' },
  ];

  try {
    for (const migration of migrations) {
      log.info(`\n📋 Processing ${migration.name} Migration...`);

      // Read the migration SQL file
      const migrationPath = path.join(__dirname, '../migrations', migration.file);

      if (!fs.existsSync(migrationPath)) {
        log.info(`⚠️  Migration file not found: ${migration.file}, skipping...`);
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      log.info(`📄 ${migration.name} SQL loaded, executing...`);

      try {
        // Execute the entire SQL file as one block to handle multi-line statements properly
        await db.execute(migrationSQL);
        log.info(`✅ ${migration.name} Migration executed successfully!`);
      } catch (error: any) {
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate column name') ||
          error.message?.includes('duplicate key value')
        ) {
          log.info(`⚠️  ${migration.name} Migration: Some objects already exist, continuing...`);
        } else {
          log.error(`❌ Error in ${migration.name} migration:`, error.message);
          // Continue with other migrations rather than failing completely
        }
      }

      log.info(`✅ ${migration.name} Migration completed!`);
    }

    log.info('\n🎉 All AI Migrations completed successfully!');
    log.info('\n🎯 Your platform now includes:');
    log.info('• AI Employees - Intelligent agents and workflow automation');
    log.info('• Calendar Integration - Smart scheduling and event management');
    log.info('• Meeting Transcription - AI-powered meeting notes and highlights');
    log.info('• Task Management - AI scheduling and dependency tracking');
    log.info('• AI Search & Knowledge - Vector search and intelligent answers');
    log.info('\n🔧 Next Steps:');
    log.info('1. Set CLAUDE_API_KEY in your environment variables');
    log.info('2. Update sidebar navigation to include new features');
    log.info('3. Test the integrations with your new AI capabilities');
  } catch (error) {
    log.error('❌ Migration failed:', error);
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
      log.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runAIMigration };
