/**
 * Run AI Enhancement Migration
 * This script applies the Motion AI database enhancements
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';

async function runAIMigration() {
  console.log('🚀 Starting Motion AI Migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/ai-enhancement-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded, executing...');

    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(statement);
        } catch (error: any) {
          if (error.message?.includes('already exists') ||
              error.message?.includes('duplicate column name')) {
            console.log(`⚠️  Skipped statement ${i + 1} (already exists)`);
            continue;
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('✅ Motion AI Migration completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Set CLAUDE_API_KEY in your environment variables');
    console.log('2. Test the integration with /api/ai/health');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runAIMigration().then(() => {
    console.log('Migration script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

export { runAIMigration };
