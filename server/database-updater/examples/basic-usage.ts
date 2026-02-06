/**
 * Database Updater - Basic Usage Examples
 * Demonstrates how to use the database updater system
 */

import { DatabaseUpdaterManager, startDatabaseUpdater } from '../index';
import { createModuleLogger } from '../../lib/logger';
const log = createModuleLogger('basic-usage');

/**
 * Example 1: Basic startup
 */
async function basicStartup() {
  log.info('🚀 Starting Database Updater with basic configuration...');

  try {
    const manager = await startDatabaseUpdater({
      logLevel: 'info',
      enableScheduling: true,
    });

    log.info('✅ Database Updater started successfully!');

    // Get status
    const status = manager.getStatus();
    log.info('Status:', status);

    // Stop after 30 seconds (for example)
    setTimeout(async () => {
      await manager.stop();
      log.info('✅ Database Updater stopped');
      process.exit(0);
    }, 30000);
  } catch (error) {
    log.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

/**
 * Example 2: Dry-run mode
 */
async function dryRunExample() {
  log.info('🧪 Running in dry-run mode...');

  try {
    const manager = new DatabaseUpdaterManager({
      dryRun: true,
      logLevel: 'debug',
      enableScheduling: false,
    });

    // Execute specific updater
    await manager.executeUpdater('business_record_activities');
    await manager.executeUpdater('service_tickets');
    await manager.executeUpdater('business_records');

    log.info('✅ Dry-run completed successfully!');
  } catch (error) {
    log.error('❌ Dry-run failed:', error);
    process.exit(1);
  }
}

/**
 * Example 3: Custom configuration
 */
async function customConfigExample() {
  log.info('⚙️ Starting with custom configuration...');

  try {
    const manager = new DatabaseUpdaterManager({
      logLevel: 'info',
      enableScheduling: true,
      configOverrides: {
        scheduleConfig: {
          businessActivities: '0 */1 9-17 * * 1-5', // Every hour during business hours
          serviceTickets: '0 0 */4 * * *', // Every 4 hours
          newLeads: '0 0 8 * * 1-5', // Daily at 8 AM
        },
        executionConfig: {
          enabledUpdaters: {
            businessActivities: true,
            serviceTickets: true,
            newLeads: false, // Disable new leads
          },
          maxConcurrentExecutions: 2,
          executionTimeoutMinutes: 10,
        },
      },
    });

    await manager.start();
    log.info('✅ Started with custom configuration!');

    // Show configuration
    const status = manager.getStatus();
    log.info('Custom Schedule Config:', status.config.scheduleConfig);
    log.info('Custom Execution Config:', status.config.executionConfig);
  } catch (error) {
    log.error('❌ Failed to start with custom config:', error);
    process.exit(1);
  }
}

/**
 * Example 4: Manual execution
 */
async function manualExecutionExample() {
  log.info('🔧 Manual execution example...');

  try {
    const manager = new DatabaseUpdaterManager({
      enableScheduling: false, // Disable automatic scheduling
      logLevel: 'info',
    });

    // Execute updaters manually
    log.info('Executing business activities updater...');
    await manager.executeUpdater('business_record_activities');

    log.info('Executing service tickets updater...');
    await manager.executeUpdater('service_tickets');

    log.info('Executing business records updater...');
    await manager.executeUpdater('business_records');

    log.info('✅ Manual execution completed!');

    // Get execution metrics
    const status = manager.getStatus();
    status.updaters.forEach((updater) => {
      log.info(`${updater.name}: Last execution - ${updater.lastExecution}`);
    });
  } catch (error) {
    log.error('❌ Manual execution failed:', error);
    process.exit(1);
  }
}

/**
 * Example 5: Configuration updates
 */
async function configUpdateExample() {
  log.info('🔄 Configuration update example...');

  try {
    const manager = new DatabaseUpdaterManager({
      enableScheduling: true,
      logLevel: 'info',
    });

    await manager.start();
    log.info('✅ Initial startup complete');

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Update configuration
    log.info('Updating configuration...');
    await manager.updateConfiguration({
      scheduleConfig: {
        businessActivities: '0 */3 9-17 * * 1-5', // Change to every 3 hours
        serviceTickets: '0 0 */8 * * *', // Change to every 8 hours
        newLeads: '0 0 14 * * 1-5', // Change to 2 PM daily
      },
    });

    log.info('✅ Configuration updated successfully!');

    // Show updated configuration
    const status = manager.getStatus();
    log.info('Updated Schedule:', status.config.scheduleConfig);
  } catch (error) {
    log.error('❌ Configuration update failed:', error);
    process.exit(1);
  }
}

// Run examples based on command line argument
const example = process.argv[2];

switch (example) {
  case 'basic':
    basicStartup();
    break;
  case 'dry-run':
    dryRunExample();
    break;
  case 'custom':
    customConfigExample();
    break;
  case 'manual':
    manualExecutionExample();
    break;
  case 'config-update':
    configUpdateExample();
    break;
  default:
    log.info('Available examples:');
    log.info('  npm run example basic        - Basic startup');
    log.info('  npm run example dry-run      - Dry-run mode');
    log.info('  npm run example custom       - Custom configuration');
    log.info('  npm run example manual       - Manual execution');
    log.info('  npm run example config-update - Configuration updates');
}
