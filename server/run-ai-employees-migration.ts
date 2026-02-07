// server/run-ai-employees-migration.ts
import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('run-ai-employees-migration');

async function runAIEmployeesMigration() {
  log.info('🤖 Starting AI Employees Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../migrations/ai-employees-migration.sql'),
      'utf8',
    );

    // Execute the migration
    await db.execute(sql.raw(migrationSql));

    log.info('✅ AI Employees Migration completed successfully.');
    log.info('');
    log.info('📋 Migration Summary:');
    log.info('   • Added ai_employees table for AI agent definitions');
    log.info('   • Added ai_employee_tasks table for task management');
    log.info('   • Added ai_employee_workflows table for process automation');
    log.info('   • Added ai_workflow_executions table for execution tracking');
    log.info('   • Added ai_employee_skills table for capability management');
    log.info('   • Added ai_employee_interactions table for communication tracking');
    log.info('   • Added ai_employee_training table for learning management');
    log.info('   • Added ai_employee_analytics table for performance tracking');
    log.info('   • Inserted default AI employee templates (Sales, Support, Analyst, PM)');
    log.info('   • Inserted default workflows (Lead Processing, Customer Support)');
    log.info('   • Created optimized indexes for performance');
    log.info('');
    log.info('🎯 Next Steps:');
    log.info('   1. Test the AI employee API endpoints');
    log.info('   2. Configure AI employee capabilities and workflows');
    log.info('   3. Set up task assignment and execution monitoring');
    log.info('   4. Customize AI employees for your specific use cases');
    log.info('');
    log.info('🚀 Available AI Employees:');
    log.info('   • Sales Assistant AI - Lead qualification and outreach');
    log.info('   • Support Agent AI - Customer support and issue resolution');
    log.info('   • Data Analyst AI - Business intelligence and reporting');
    log.info('   • Project Manager AI - Task coordination and project management');
  } catch (error) {
    log.error('❌ Error running AI Employees Migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runAIEmployeesMigration();
