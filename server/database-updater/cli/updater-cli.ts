#!/usr/bin/env node

/**
 * Database Updater CLI
 * Command-line interface for managing the database updater system
 */

import * as commander from 'commander';
import { DatabaseUpdaterManager } from '../DatabaseUpdaterManager';
import { Logger } from '../core/Logger';

const program = new commander.Command();

// Configure CLI
program
  .name('database-updater')
  .description('Database Updater CLI for Root Admin control')
  .version('1.0.0');

// Global logger
const logger = new Logger({
  level: 'info',
  enableConsole: true,
  enableFile: false,
});

/**
 * Start command
 */
program
  .command('start')
  .description('Start the database updater system')
  .option('-d, --dry-run', 'Run in dry-run mode')
  .option('-l, --log-level <level>', 'Set log level (debug, info, warn, error)', 'info')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Database Updater System...\n');

      const manager = new DatabaseUpdaterManager({
        dryRun: options.dryRun,
        logLevel: options.logLevel,
        enableScheduling: true,
      });

      await manager.start();

      const status = manager.getStatus();

      console.log('✅ Database Updater System started successfully!\n');
      console.log('📊 System Status:');
      console.log(`   - Running: ${status.isRunning}`);
      console.log(`   - Total Updaters: ${status.updaters.length}`);
      console.log(`   - Enabled Updaters: ${status.updaters.filter((u) => u.isEnabled).length}`);
      console.log(`   - Dry Run Mode: ${options.dryRun || false}\n`);

      console.log('📋 Registered Updaters:');
      status.updaters.forEach((updater) => {
        const enabledIcon = updater.isEnabled ? '✅' : '❌';
        console.log(`   ${enabledIcon} ${updater.name}`);
      });

      console.log('\n⏰ Next Executions:');
      Object.entries(status.nextExecutions).forEach(([name, date]) => {
        const dateStr = date ? new Date(date).toLocaleString() : 'Not scheduled';
        console.log(`   - ${name}: ${dateStr}`);
      });

      console.log('\nPress Ctrl+C to stop the system');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping Database Updater System...');
        await manager.stop();
        console.log('✅ System stopped successfully');
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error('❌ Failed to start system:', error);
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Get system status')
  .action(async () => {
    try {
      console.log('📊 Database Updater System Status\n');

      const manager = new DatabaseUpdaterManager({
        enableScheduling: false,
      });

      const status = manager.getStatus();

      console.log('🖥️  System Information:');
      console.log(`   - Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
      console.log(`   - Total Updaters: ${status.updaters.length}`);
      console.log(`   - Enabled Updaters: ${status.updaters.filter((u) => u.isEnabled).length}`);
      console.log(`   - Target Tenant: ${status.config.targetTenantId}`);
      console.log(`   - Target Customer: ${status.config.targetCustomerId}\n`);

      console.log('📋 Updater Details:');
      status.updaters.forEach((updater) => {
        const enabledIcon = updater.isEnabled ? '✅' : '❌';
        const lastExec = updater.lastExecution
          ? new Date(updater.lastExecution).toLocaleString()
          : 'Never';

        console.log(`   ${enabledIcon} ${updater.name}`);
        console.log(`      Last Execution: ${lastExec}`);
      });

      console.log('\n⏰ Schedules:');
      console.log(`   - Business Activities: ${status.config.scheduleConfig.businessActivities}`);
      console.log(`   - Service Tickets: ${status.config.scheduleConfig.serviceTickets}`);
      console.log(`   - New Leads: ${status.config.scheduleConfig.newLeads}`);
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

/**
 * Execute command
 */
program
  .command('execute <updater>')
  .description('Execute a specific updater')
  .option('-d, --dry-run', 'Run in dry-run mode')
  .action(async (updaterName, options) => {
    try {
      console.log(`🔄 Executing ${updaterName}...\n`);

      const manager = new DatabaseUpdaterManager({
        dryRun: options.dryRun,
        enableScheduling: false,
        logLevel: 'info',
      });

      await manager.executeUpdater(updaterName);

      console.log(`✅ ${updaterName} executed successfully!`);

      if (options.dryRun) {
        console.log('📝 Note: This was a dry-run. No data was actually inserted.');
      }
    } catch (error) {
      console.error(`❌ Failed to execute ${updaterName}:`, error);
      process.exit(1);
    }
  });

/**
 * Test command
 */
program
  .command('test')
  .description('Test all updaters in dry-run mode')
  .action(async () => {
    try {
      console.log('🧪 Testing all updaters in dry-run mode...\n');

      const manager = new DatabaseUpdaterManager({
        dryRun: true,
        enableScheduling: false,
        logLevel: 'debug',
      });

      const status = manager.getStatus();
      const updaterNames = status.updaters.map((u) => u.name);

      for (const updaterName of updaterNames) {
        console.log(`🔄 Testing ${updaterName}...`);
        try {
          await manager.executeUpdater(updaterName);
          console.log(`   ✅ ${updaterName} - PASSED`);
        } catch (error) {
          console.log(`   ❌ ${updaterName} - FAILED: ${error}`);
        }
      }

      console.log('\n🏁 Test completed!');
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  });

/**
 * Config command
 */
program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    try {
      console.log('⚙️  Database Updater Configuration\n');

      const manager = new DatabaseUpdaterManager({
        enableScheduling: false,
      });

      const status = manager.getStatus();
      const config = status.config;

      console.log('🎯 Target Configuration:');
      console.log(`   - Tenant ID: ${config.targetTenantId}`);
      console.log(`   - Customer ID: ${config.targetCustomerId}\n`);

      console.log('⏰ Schedule Configuration:');
      console.log(`   - Business Activities: ${config.scheduleConfig.businessActivities}`);
      console.log(`   - Service Tickets: ${config.scheduleConfig.serviceTickets}`);
      console.log(`   - New Leads: ${config.scheduleConfig.newLeads}\n`);

      console.log('🔧 Execution Configuration:');
      console.log(
        `   - Business Activities Enabled: ${config.executionConfig.enabledUpdaters.businessActivities}`,
      );
      console.log(
        `   - Service Tickets Enabled: ${config.executionConfig.enabledUpdaters.serviceTickets}`,
      );
      console.log(`   - New Leads Enabled: ${config.executionConfig.enabledUpdaters.newLeads}`);
      console.log(
        `   - Max Concurrent Executions: ${config.executionConfig.maxConcurrentExecutions}`,
      );
      console.log(
        `   - Execution Timeout: ${config.executionConfig.executionTimeoutMinutes} minutes\n`,
      );

      console.log('🕒 Timezone Configuration:');
      console.log(`   - Timezone: ${config.timezoneConfig.timezone}`);
      console.log(
        `   - Business Hours: ${config.timezoneConfig.businessHours.start}:00 - ${config.timezoneConfig.businessHours.end}:00`,
      );
      console.log(`   - Business Days: ${config.timezoneConfig.businessDays.join(', ')}`);
    } catch (error) {
      console.error('❌ Failed to show configuration:', error);
      process.exit(1);
    }
  });

/**
 * Logs command
 */
program
  .command('logs')
  .description('Show recent log entries')
  .option('-n, --count <number>', 'Number of log entries to show', '50')
  .action(async (options) => {
    try {
      console.log('📋 Recent Log Entries\n');

      const count = parseInt(options.count) || 50;
      const logs = logger.getRecentLogs(count);

      if (logs.length === 0) {
        console.log('No log entries found.');
        return;
      }

      logs.forEach((log) => {
        const timestamp = log.timestamp.toLocaleString();
        const levelIcon =
          {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
          }[log.level] || 'ℹ️';

        console.log(`${levelIcon} [${timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        if (log.data) {
          console.log(`    Data: ${JSON.stringify(log.data, null, 2)}`);
        }
      });
    } catch (error) {
      console.error('❌ Failed to show logs:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
