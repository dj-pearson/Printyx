/**
 * Meeting Scheduling Migration Runner
 * Executes meeting-scheduling-migration.sql to add intelligent meeting coordination features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runMeetingSchedulingMigration() {
  console.log('📅 Starting Meeting Scheduling Migration...');
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/meeting-scheduling-migration.sql');
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Meeting scheduling migration SQL loaded, executing...');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(statement);
        } catch (error: any) {
          if (error.message?.includes('already exists') ||
              error.message?.includes('duplicate column name') ||
              error.message?.includes('duplicate key value')) {
            console.log(`⚠️  Skipped statement ${i + 1} (already exists)`);
            continue;
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Meeting Scheduling Migration completed successfully!');
    console.log('\n🎯 Meeting Scheduling Features Added:');
    console.log('📋 Meeting Types - Configurable meeting templates with AI optimization');
    console.log('📅 Meetings - Intelligent meeting coordination with AI scoring');
    console.log('👥 Meeting Participants - Availability preferences and AI insights');
    console.log('🏢 Meeting Rooms - Resource management with AI usage patterns');
    console.log('📊 Room Bookings - Automated booking with suitability scoring');
    console.log('📈 Availability Analysis - AI-powered availability optimization');
    console.log('🤖 Scheduling Requests - AI-driven meeting scheduling suggestions');
    console.log('📊 Meeting Analytics - Performance insights and efficiency metrics');
    console.log('💬 Meeting Feedback - Learning system for continuous improvement');
    console.log('\n🚀 Ready for intelligent meeting scheduling and coordination!');
    
  } catch (error) {
    console.error('❌ Meeting scheduling migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMeetingSchedulingMigration().then(() => {
    console.log('Meeting scheduling migration script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Meeting scheduling migration script failed:', error);
    process.exit(1);
  });
}

export { runMeetingSchedulingMigration };
