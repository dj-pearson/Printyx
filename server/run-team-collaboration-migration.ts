/**
 * Team Collaboration Migration Runner
 * Executes team-collaboration-migration.sql to add team management and project coordination features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runTeamCollaborationMigration() {
  console.log('👥 Starting Team Collaboration Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/team-collaboration-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Team collaboration migration SQL loaded, executing...');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
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

    console.log('✅ Team Collaboration Migration completed successfully!');
    console.log('\n🎯 Team Collaboration Features Added:');
    console.log('📋 Teams - Team organization and management');
    console.log('👤 Team Members - Roles, skills, and capacity management');
    console.log('📊 Projects - Hierarchical project structure with AI optimization');
    console.log('🎯 Milestones - Project milestones with dependency tracking');
    console.log('📝 Task Assignments - Enhanced assignments with AI skill matching');
    console.log('📈 Capacity Analytics - Team workload and capacity planning');
    console.log('💬 Collaboration Activities - Communication and activity tracking');
    console.log('📋 Project Templates - Reusable project templates');
    console.log('📊 Performance Metrics - Team performance tracking');
    console.log('🤝 Cross-Team Dependencies - Inter-team coordination');
    console.log('\n🚀 Ready for team collaboration and project management!');
  } catch (error) {
    console.error('❌ Team collaboration migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTeamCollaborationMigration()
    .then(() => {
      console.log('Team collaboration migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Team collaboration migration script failed:', error);
      process.exit(1);
    });
}

export { runTeamCollaborationMigration };
