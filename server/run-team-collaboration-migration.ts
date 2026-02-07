/**
 * Team Collaboration Migration Runner
 * Executes team-collaboration-migration.sql to add team management and project coordination features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-team-collaboration-migration');

async function runTeamCollaborationMigration() {
  log.info('👥 Starting Team Collaboration Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/team-collaboration-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log.info('📄 Team collaboration migration SQL loaded, executing...');

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

    log.info('✅ Team Collaboration Migration completed successfully!');
    log.info('\n🎯 Team Collaboration Features Added:');
    log.info('📋 Teams - Team organization and management');
    log.info('👤 Team Members - Roles, skills, and capacity management');
    log.info('📊 Projects - Hierarchical project structure with AI optimization');
    log.info('🎯 Milestones - Project milestones with dependency tracking');
    log.info('📝 Task Assignments - Enhanced assignments with AI skill matching');
    log.info('📈 Capacity Analytics - Team workload and capacity planning');
    log.info('💬 Collaboration Activities - Communication and activity tracking');
    log.info('📋 Project Templates - Reusable project templates');
    log.info('📊 Performance Metrics - Team performance tracking');
    log.info('🤝 Cross-Team Dependencies - Inter-team coordination');
    log.info('\n🚀 Ready for team collaboration and project management!');
  } catch (error) {
    log.error('❌ Team collaboration migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTeamCollaborationMigration()
    .then(() => {
      log.info('Team collaboration migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Team collaboration migration script failed:', error);
      process.exit(1);
    });
}

export { runTeamCollaborationMigration };
