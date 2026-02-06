/**
 * AI Search & Knowledge Migration Runner
 * Executes ai-search-knowledge-migration.sql to add vector search and knowledge management features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-ai-search-knowledge-migration');

async function runAISearchKnowledgeMigration() {
  log.info('🔍 Starting AI Search & Knowledge Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/ai-search-knowledge-migration.sql');

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log.info('📄 AI search & knowledge migration SQL loaded, executing...');

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

    log.info('✅ AI Search & Knowledge Migration completed successfully!');
    log.info('\n🎯 AI Search & Knowledge Features Added:');
    log.info(
      '🔍 Vector Embeddings - High-dimensional vector storage for semantic search with quality metrics',
    );
    log.info(
      '🧠 AI Search Queries - Intelligent query processing with intent analysis and user feedback tracking',
    );
    log.info(
      '📝 AI Generated Answers - Comprehensive answer synthesis with source attribution and quality scoring',
    );
    log.info(
      '🌐 Knowledge Entities - Entity relationship mapping with importance scoring and trend analysis',
    );
    log.info(
      '💬 Search Sessions - Conversational search context with learning adaptation and outcome tracking',
    );
    log.info(
      '🔗 Content Similarities - Vector and semantic similarity relationships with recommendation engine',
    );
    log.info(
      '📊 Search Analytics - Performance insights with query patterns and optimization recommendations',
    );
    log.info('\n🚀 Ready for advanced semantic search and intelligent knowledge discovery!');
  } catch (error) {
    log.error('❌ AI search & knowledge migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAISearchKnowledgeMigration()
    .then(() => {
      log.info('AI search & knowledge migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('AI search & knowledge migration script failed:', error);
      process.exit(1);
    });
}

export { runAISearchKnowledgeMigration };
