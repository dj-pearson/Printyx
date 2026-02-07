/**
 * Meeting Scheduling Migration Runner
 * Executes meeting-scheduling-migration.sql to add intelligent meeting coordination features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-meeting-scheduling-migration');

async function runMeetingSchedulingMigration() {
  log.info('📅 Starting Meeting Scheduling Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/meeting-scheduling-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log.info('📄 Meeting scheduling migration SQL loaded, executing...');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    log.info(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          log.info(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(statement);
        } catch (error: any) {
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate column name') ||
            error.message?.includes('duplicate key value')
          ) {
            log.info(`⚠️  Skipped statement ${i + 1} (already exists)`);
            continue;
          } else {
            log.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    log.info('✅ Meeting Scheduling Migration completed successfully!');
    log.info('\n🎯 Meeting Scheduling Features Added:');
    log.info('📋 Meeting Types - Configurable meeting templates with AI optimization');
    log.info('📅 Meetings - Intelligent meeting coordination with AI scoring');
    log.info('👥 Meeting Participants - Availability preferences and AI insights');
    log.info('🏢 Meeting Rooms - Resource management with AI usage patterns');
    log.info('📊 Room Bookings - Automated booking with suitability scoring');
    log.info('📈 Availability Analysis - AI-powered availability optimization');
    log.info('🤖 Scheduling Requests - AI-driven meeting scheduling suggestions');
    log.info('📊 Meeting Analytics - Performance insights and efficiency metrics');
    log.info('💬 Meeting Feedback - Learning system for continuous improvement');
    log.info('\n🚀 Ready for intelligent meeting scheduling and coordination!');
  } catch (error) {
    log.error('❌ Meeting scheduling migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMeetingSchedulingMigration()
    .then(() => {
      log.info('Meeting scheduling migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Meeting scheduling migration script failed:', error);
      process.exit(1);
    });
}

export { runMeetingSchedulingMigration };
