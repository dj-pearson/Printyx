/**
 * AI Documentation Migration Runner
 * Executes ai-documentation-migration.sql to add intelligent document creation and knowledge management features
 */

import { db } from './db';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runAIDocumentationMigration() {
  console.log('📚 Starting AI Documentation Migration...');
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationPath = path.join(__dirname, '../migrations/ai-documentation-migration.sql');
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 AI documentation migration SQL loaded, executing...');
    
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
    
    console.log('✅ AI Documentation Migration completed successfully!');
    console.log('\n🎯 AI Documentation Features Added:');
    console.log('📝 Document Types - Configurable templates with AI writing prompts and formatting');
    console.log('🧠 AI Documents - Intelligent content generation with confidence scoring and version control');
    console.log('✨ Writing Sessions - AI assistance tracking with user interaction metrics');
    console.log('📄 Document Sections - Structured content with AI-powered generation and formatting');
    console.log('💡 Content Suggestions - AI-powered improvements for grammar, style, and clarity');
    console.log('📚 Knowledge Articles - Enhanced knowledge base with AI categorization and search optimization');
    console.log('🎨 Document Templates - Reusable templates with AI customization and success tracking');
    console.log('📊 Writing Analytics - Performance insights and AI effectiveness metrics');
    console.log('👥 Document Reviews - Collaboration workflow with AI-assisted review process');
    console.log('\n🚀 Ready for intelligent document creation and AI-powered writing assistance!');
    
  } catch (error) {
    console.error('❌ AI documentation migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAIDocumentationMigration().then(() => {
    console.log('AI documentation migration script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('AI documentation migration script failed:', error);
    process.exit(1);
  });
}

export { runAIDocumentationMigration };
