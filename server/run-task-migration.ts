/**
 * Run Task Management Migration
 * This script applies the task management database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';

async function runTaskMigration() {
  console.log('🚀 Starting Task Management Migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/task-management-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded, executing...');

    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(statement);
        } catch (error: any) {
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate column name') ||
            error.message?.includes('duplicate key value')
          ) {
            console.log(`⚠️  Skipped statement ${i + 1} (already exists)`);
            continue;
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('✅ Task Management Migration completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Visit /tasks to see the new task management interface');
    console.log('2. Test AI-powered task scheduling and prioritization');
    console.log('3. Create tasks and see AI suggestions in action');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTaskMigration()
    .then(() => {
      console.log('Task management migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Task management migration script failed:', error);
      process.exit(1);
    });
}

export { runTaskMigration };
