/**
 * Run Calendar Integration Migration
 * This script applies the calendar integration database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-calendar-migration');

async function runCalendarMigration() {
  log.info('🚀 Starting Calendar Integration Migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/calendar-integration-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    log.info('📄 Migration SQL loaded, executing...');

    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    log.info(`📊 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim()) {
        try {
          log.info(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(statement);
        } catch (error: any) {
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate column name')
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

    log.info('✅ Calendar Integration Migration completed successfully!');
    log.info('\n🎯 Next Steps:');
    log.info('1. Visit /calendar-demo to see the new calendar interface');
    log.info('2. Configure external calendar connections (Google/Outlook)');
    log.info('3. Test AI-powered scheduling features');
  } catch (error) {
    log.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runCalendarMigration()
    .then(() => {
      log.info('Calendar migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Calendar migration script failed:', error);
      process.exit(1);
    });
}

export { runCalendarMigration };
