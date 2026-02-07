#!/usr/bin/env node

/**
 * Database Updater CLI
 * Command-line interface for managing the database updater system
 */

import * as commander from 'commander';
import { DatabaseUpdaterManager } from '../DatabaseUpdaterManager';
import { Logger } from '../core/Logger';
import { createModuleLogger } from '../../lib/logger';
const log = createModuleLogger('updater-cli');

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
      log.info('🚀 Starting Database Updater System...\n');

      const manager = new DatabaseUpdaterManager({
        dryRun: options.dryRun,
        logLevel: options.logLevel,
        enableScheduling: true,
      });

      await manager.start();

      const status = manager.getStatus();

      log.info('✅ Database Updater System started successfully!\n');
      log.info('📊 System Status:');
      log.info(`   - Running: ${status.isRunning}`);
      log.info(`   - Total Updaters: ${status.updaters.length}`);
      log.info(`   - Enabled Updaters: ${status.updaters.filter((u) => u.isEnabled).length}`);
      log.info(`   - Dry Run Mode: ${options.dryRun || false}\n`);

      log.info('📋 Registered Updaters:');
      status.updaters.forEach((updater) => {
        const enabledIcon = updater.isEnabled ? '✅' : '❌';
        log.info(`   ${enabledIcon} ${updater.name}`);
      });

      log.info('\n⏰ Next Executions:');
      Object.entries(status.nextExecutions).forEach(([name, date]) => {
        const dateStr = date ? new Date(date).toLocaleString() : 'Not scheduled';
        log.info(`   - ${name}: ${dateStr}`);
      });

      log.info('\nPress Ctrl+C to stop the system');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        log.info('\n🛑 Stopping Database Updater System...');
        await manager.stop();
        log.info('✅ System stopped successfully');
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      log.error('❌ Failed to start system:', error);
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
      log.info('📊 Database Updater System Status\n');

      const manager = new DatabaseUpdaterManager({
        enableScheduling: false,
      });

      const status = manager.getStatus();

      log.info('🖥️  System Information:');
      log.info(`   - Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
      log.info(`   - Total Updaters: ${status.updaters.length}`);
      log.info(`   - Enabled Updaters: ${status.updaters.filter((u) => u.isEnabled).length}`);
      log.info(`   - Target Tenant: ${status.config.targetTenantId}`);
      log.info(`   - Target Customer: ${status.config.targetCustomerId}\n`);

      log.info('📋 Updater Details:');
      status.updaters.forEach((updater) => {
        const enabledIcon = updater.isEnabled ? '✅' : '❌';
        const lastExec = updater.lastExecution
          ? new Date(updater.lastExecution).toLocaleString()
          : 'Never';

        log.info(`   ${enabledIcon} ${updater.name}`);
        log.info(`      Last Execution: ${lastExec}`);
      });

      log.info('\n⏰ Schedules:');
      log.info(`   - Business Activities: ${status.config.scheduleConfig.businessActivities}`);
      log.info(`   - Service Tickets: ${status.config.scheduleConfig.serviceTickets}`);
      log.info(`   - New Leads: ${status.config.scheduleConfig.newLeads}`);
    } catch (error) {
      log.error('❌ Failed to get status:', error);
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
      log.info(`🔄 Executing ${updaterName}...\n`);

      const manager = new DatabaseUpdaterManager({
        dryRun: options.dryRun,
        enableScheduling: false,
        logLevel: 'info',
      });

      await manager.executeUpdater(updaterName);

      log.info(`✅ ${updaterName} executed successfully!`);

      if (options.dryRun) {
        log.info('📝 Note: This was a dry-run. No data was actually inserted.');
      }
    } catch (error) {
      log.error(`❌ Failed to execute ${updaterName}:`, error);
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
      log.info('🧪 Testing all updaters in dry-run mode...\n');

      const manager = new DatabaseUpdaterManager({
        dryRun: true,
        enableScheduling: false,
        logLevel: 'debug',
      });

      const status = manager.getStatus();
      const updaterNames = status.updaters.map((u) => u.name);

      for (const updaterName of updaterNames) {
        log.info(`🔄 Testing ${updaterName}...`);
        try {
          await manager.executeUpdater(updaterName);
          log.info(`   ✅ ${updaterName} - PASSED`);
        } catch (error) {
          log.info(`   ❌ ${updaterName} - FAILED: ${error}`);
        }
      }

      log.info('\n🏁 Test completed!');
    } catch (error) {
      log.error('❌ Test failed:', error);
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
      log.info('⚙️  Database Updater Configuration\n');

      const manager = new DatabaseUpdaterManager({
        enableScheduling: false,
      });

      const status = manager.getStatus();
      const config = status.config;

      log.info('🎯 Target Configuration:');
      log.info(`   - Tenant ID: ${config.targetTenantId}`);
      log.info(`   - Customer ID: ${config.targetCustomerId}\n`);

      log.info('⏰ Schedule Configuration:');
      log.info(`   - Business Activities: ${config.scheduleConfig.businessActivities}`);
      log.info(`   - Service Tickets: ${config.scheduleConfig.serviceTickets}`);
      log.info(`   - New Leads: ${config.scheduleConfig.newLeads}\n`);

      log.info('🔧 Execution Configuration:');
      log.info(
        `   - Business Activities Enabled: ${config.executionConfig.enabledUpdaters.businessActivities}`,
      );
      log.info(
        `   - Service Tickets Enabled: ${config.executionConfig.enabledUpdaters.serviceTickets}`,
      );
      log.info(`   - New Leads Enabled: ${config.executionConfig.enabledUpdaters.newLeads}`);
      log.info(`   - Max Concurrent Executions: ${config.executionConfig.maxConcurrentExecutions}`);
      log.info(
        `   - Execution Timeout: ${config.executionConfig.executionTimeoutMinutes} minutes\n`,
      );

      log.info('🕒 Timezone Configuration:');
      log.info(`   - Timezone: ${config.timezoneConfig.timezone}`);
      log.info(
        `   - Business Hours: ${config.timezoneConfig.businessHours.start}:00 - ${config.timezoneConfig.businessHours.end}:00`,
      );
      log.info(`   - Business Days: ${config.timezoneConfig.businessDays.join(', ')}`);
    } catch (error) {
      log.error('❌ Failed to show configuration:', error);
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
      log.info('📋 Recent Log Entries\n');

      const count = parseInt(options.count) || 50;
      const logs = logger.getRecentLogs(count);

      if (logs.length === 0) {
        log.info('No log entries found.');
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

        log.info(`${levelIcon} [${timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        if (log.data) {
          log.info(`    Data: ${JSON.stringify(log.data, null, 2)}`);
        }
      });
    } catch (error) {
      log.error('❌ Failed to show logs:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
