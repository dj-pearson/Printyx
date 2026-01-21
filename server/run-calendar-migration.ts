/**
 * Run Calendar Integration Migration
 * This script applies the calendar integration database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';

async function runCalendarMigration() {
  console.log('🚀 Starting Calendar Integration Migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/calendar-integration-migration.sql');
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
            error.message?.includes('duplicate column name')
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

    console.log('✅ Calendar Integration Migration completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Visit /calendar-demo to see the new calendar interface');
    console.log('2. Configure external calendar connections (Google/Outlook)');
    console.log('3. Test AI-powered scheduling features');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runCalendarMigration()
    .then(() => {
      console.log('Calendar migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Calendar migration script failed:', error);
      process.exit(1);
    });
}

export { runCalendarMigration };
