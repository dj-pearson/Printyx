/**
 * Run Task Management Migration
 * This script applies the task management database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-task-migration');

async function runTaskMigration() {
  log.info('🚀 Starting Task Management Migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/task-management-migration.sql');
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

    log.info('✅ Task Management Migration completed successfully!');
    log.info('\n🎯 Next Steps:');
    log.info('1. Visit /tasks to see the new task management interface');
    log.info('2. Test AI-powered task scheduling and prioritization');
    log.info('3. Create tasks and see AI suggestions in action');
  } catch (error) {
    log.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTaskMigration()
    .then(() => {
      log.info('Task management migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Task management migration script failed:', error);
      process.exit(1);
    });
}

export { runTaskMigration };
