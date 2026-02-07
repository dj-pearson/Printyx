/**
 * AI Documentation Migration Runner
 * Executes ai-documentation-migration.sql to add intelligent document creation and knowledge management features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-ai-documentation-migration');

async function runAIDocumentationMigration() {
  log.info('📚 Starting AI Documentation Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/ai-documentation-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log.info('📄 AI documentation migration SQL loaded, executing...');

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

    log.info('✅ AI Documentation Migration completed successfully!');
    log.info('\n🎯 AI Documentation Features Added:');
    log.info('📝 Document Types - Configurable templates with AI writing prompts and formatting');
    log.info(
      '🧠 AI Documents - Intelligent content generation with confidence scoring and version control',
    );
    log.info('✨ Writing Sessions - AI assistance tracking with user interaction metrics');
    log.info('📄 Document Sections - Structured content with AI-powered generation and formatting');
    log.info('💡 Content Suggestions - AI-powered improvements for grammar, style, and clarity');
    log.info(
      '📚 Knowledge Articles - Enhanced knowledge base with AI categorization and search optimization',
    );
    log.info(
      '🎨 Document Templates - Reusable templates with AI customization and success tracking',
    );
    log.info('📊 Writing Analytics - Performance insights and AI effectiveness metrics');
    log.info('👥 Document Reviews - Collaboration workflow with AI-assisted review process');
    log.info('\n🚀 Ready for intelligent document creation and AI-powered writing assistance!');
  } catch (error) {
    log.error('❌ AI documentation migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAIDocumentationMigration()
    .then(() => {
      log.info('AI documentation migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('AI documentation migration script failed:', error);
      process.exit(1);
    });
}

export { runAIDocumentationMigration };
