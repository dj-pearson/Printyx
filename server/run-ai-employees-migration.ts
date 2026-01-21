// server/run-ai-employees-migration.ts
import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

async function runAIEmployeesMigration() {
  console.log('🤖 Starting AI Employees Migration...');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../migrations/ai-employees-migration.sql'),
      'utf8',
    );

    // Execute the migration
    await db.execute(sql.raw(migrationSql));

    console.log('✅ AI Employees Migration completed successfully.');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log('   • Added ai_employees table for AI agent definitions');
    console.log('   • Added ai_employee_tasks table for task management');
    console.log('   • Added ai_employee_workflows table for process automation');
    console.log('   • Added ai_workflow_executions table for execution tracking');
    console.log('   • Added ai_employee_skills table for capability management');
    console.log('   • Added ai_employee_interactions table for communication tracking');
    console.log('   • Added ai_employee_training table for learning management');
    console.log('   • Added ai_employee_analytics table for performance tracking');
    console.log('   • Inserted default AI employee templates (Sales, Support, Analyst, PM)');
    console.log('   • Inserted default workflows (Lead Processing, Customer Support)');
    console.log('   • Created optimized indexes for performance');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Test the AI employee API endpoints');
    console.log('   2. Configure AI employee capabilities and workflows');
    console.log('   3. Set up task assignment and execution monitoring');
    console.log('   4. Customize AI employees for your specific use cases');
    console.log('');
    console.log('🚀 Available AI Employees:');
    console.log('   • Sales Assistant AI - Lead qualification and outreach');
    console.log('   • Support Agent AI - Customer support and issue resolution');
    console.log('   • Data Analyst AI - Business intelligence and reporting');
    console.log('   • Project Manager AI - Task coordination and project management');
  } catch (error) {
    console.error('❌ Error running AI Employees Migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runAIEmployeesMigration();
