/**
 * Meeting Transcription Migration Runner
 * Executes meeting-transcription-migration.sql to add AI transcription and note generation features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-meeting-transcription-migration');

async function runMeetingTranscriptionMigration() {
  log.info('🎙️ Starting Meeting Transcription Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/meeting-transcription-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log.info('📄 Meeting transcription migration SQL loaded, executing...');

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

    log.info('✅ Meeting Transcription Migration completed successfully!');
    log.info('\n🎯 Meeting Transcription Features Added:');
    log.info('🎥 Meeting Recordings - File upload with processing status and AI analysis');
    log.info('📝 Meeting Transcriptions - AI-powered speech-to-text with speaker identification');
    log.info('📋 Meeting Notes - Intelligent note generation with structured content extraction');
    log.info('✨ Meeting Highlights - Key moments and insights with importance scoring');
    log.info('🎤 Meeting Speakers - Voice recognition and speaker profile management');
    log.info('🔍 Content Search - Full-text search across transcriptions and notes');
    log.info('📊 Content Analytics - Performance metrics and topic analysis');
    log.info('🔗 Recording Integrations - Webhook support for Zoom, Teams, Google Meet');
    log.info('\n🚀 Ready for AI-powered meeting transcription and intelligent note generation!');
  } catch (error) {
    log.error('❌ Meeting transcription migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMeetingTranscriptionMigration()
    .then(() => {
      log.info('Meeting transcription migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Meeting transcription migration script failed:', error);
      process.exit(1);
    });
}

export { runMeetingTranscriptionMigration };
