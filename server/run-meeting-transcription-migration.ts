/**
 * Meeting Transcription Migration Runner
 * Executes meeting-transcription-migration.sql to add AI transcription and note generation features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runMeetingTranscriptionMigration() {
  console.log('🎙️ Starting Meeting Transcription Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/meeting-transcription-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Meeting transcription migration SQL loaded, executing...');

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

    console.log('✅ Meeting Transcription Migration completed successfully!');
    console.log('\n🎯 Meeting Transcription Features Added:');
    console.log('🎥 Meeting Recordings - File upload with processing status and AI analysis');
    console.log(
      '📝 Meeting Transcriptions - AI-powered speech-to-text with speaker identification',
    );
    console.log(
      '📋 Meeting Notes - Intelligent note generation with structured content extraction',
    );
    console.log('✨ Meeting Highlights - Key moments and insights with importance scoring');
    console.log('🎤 Meeting Speakers - Voice recognition and speaker profile management');
    console.log('🔍 Content Search - Full-text search across transcriptions and notes');
    console.log('📊 Content Analytics - Performance metrics and topic analysis');
    console.log('🔗 Recording Integrations - Webhook support for Zoom, Teams, Google Meet');
    console.log('\n🚀 Ready for AI-powered meeting transcription and intelligent note generation!');
  } catch (error) {
    console.error('❌ Meeting transcription migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMeetingTranscriptionMigration()
    .then(() => {
      console.log('Meeting transcription migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Meeting transcription migration script failed:', error);
      process.exit(1);
    });
}

export { runMeetingTranscriptionMigration };
