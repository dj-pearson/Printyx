/**
 * Database Updater - Basic Usage Examples
 * Demonstrates how to use the database updater system
 */

import { DatabaseUpdaterManager, startDatabaseUpdater } from '../index';

/**
 * Example 1: Basic startup
 */
async function basicStartup() {
  console.log('🚀 Starting Database Updater with basic configuration...');
  
  try {
    const manager = await startDatabaseUpdater({
      logLevel: 'info',
      enableScheduling: true,
    });

    console.log('✅ Database Updater started successfully!');
    
    // Get status
    const status = manager.getStatus();
    console.log('Status:', status);
    
    // Stop after 30 seconds (for example)
    setTimeout(async () => {
      await manager.stop();
      console.log('✅ Database Updater stopped');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

/**
 * Example 2: Dry-run mode
 */
async function dryRunExample() {
  console.log('🧪 Running in dry-run mode...');
  
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

    console.log('✅ Dry-run completed successfully!');
    
  } catch (error) {
    console.error('❌ Dry-run failed:', error);
    process.exit(1);
  }
}

/**
 * Example 3: Custom configuration
 */
async function customConfigExample() {
  console.log('⚙️ Starting with custom configuration...');
  
  try {
    const manager = new DatabaseUpdaterManager({
      logLevel: 'info',
      enableScheduling: true,
      configOverrides: {
        scheduleConfig: {
          businessActivities: '0 */1 9-17 * * 1-5', // Every hour during business hours
          serviceTickets: '0 0 */4 * * *',         // Every 4 hours
          newLeads: '0 0 8 * * 1-5',               // Daily at 8 AM
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
    console.log('✅ Started with custom configuration!');
    
    // Show configuration
    const status = manager.getStatus();
    console.log('Custom Schedule Config:', status.config.scheduleConfig);
    console.log('Custom Execution Config:', status.config.executionConfig);
    
  } catch (error) {
    console.error('❌ Failed to start with custom config:', error);
    process.exit(1);
  }
}

/**
 * Example 4: Manual execution
 */
async function manualExecutionExample() {
  console.log('🔧 Manual execution example...');
  
  try {
    const manager = new DatabaseUpdaterManager({
      enableScheduling: false, // Disable automatic scheduling
      logLevel: 'info',
    });

    // Execute updaters manually
    console.log('Executing business activities updater...');
    await manager.executeUpdater('business_record_activities');

    console.log('Executing service tickets updater...');
    await manager.executeUpdater('service_tickets');

    console.log('Executing business records updater...');
    await manager.executeUpdater('business_records');

    console.log('✅ Manual execution completed!');
    
    // Get execution metrics
    const status = manager.getStatus();
    status.updaters.forEach(updater => {
      console.log(`${updater.name}: Last execution - ${updater.lastExecution}`);
    });
    
  } catch (error) {
    console.error('❌ Manual execution failed:', error);
    process.exit(1);
  }
}

/**
 * Example 5: Configuration updates
 */
async function configUpdateExample() {
  console.log('🔄 Configuration update example...');
  
  try {
    const manager = new DatabaseUpdaterManager({
      enableScheduling: true,
      logLevel: 'info',
    });

    await manager.start();
    console.log('✅ Initial startup complete');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update configuration
    console.log('Updating configuration...');
    await manager.updateConfiguration({
      scheduleConfig: {
        businessActivities: '0 */3 9-17 * * 1-5', // Change to every 3 hours
        serviceTickets: '0 0 */8 * * *',           // Change to every 8 hours
        newLeads: '0 0 14 * * 1-5',               // Change to 2 PM daily
      },
    });

    console.log('✅ Configuration updated successfully!');
    
    // Show updated configuration
    const status = manager.getStatus();
    console.log('Updated Schedule:', status.config.scheduleConfig);
    
  } catch (error) {
    console.error('❌ Configuration update failed:', error);
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
    console.log('Available examples:');
    console.log('  npm run example basic        - Basic startup');
    console.log('  npm run example dry-run      - Dry-run mode');
    console.log('  npm run example custom       - Custom configuration');
    console.log('  npm run example manual       - Manual execution');
    console.log('  npm run example config-update - Configuration updates');
}
