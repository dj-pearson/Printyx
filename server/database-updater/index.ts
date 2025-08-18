/**
 * Database Updater System - Main Entry Point
 * Export all components for easy integration
 */

// Core components
export { DatabaseUpdaterManager } from './DatabaseUpdaterManager';
export { BaseUpdater } from './core/BaseUpdater';
export { CronScheduler } from './core/CronScheduler';
export { Logger } from './core/Logger';
export { UpdaterRegistry } from './core/UpdaterRegistry';

// Configuration
export { UpdaterConfig } from './config/UpdaterConfig';

// Updaters
export { BusinessRecordActivityUpdater } from './updaters/BusinessRecordActivityUpdater';
export { ServiceTicketUpdater } from './updaters/ServiceTicketUpdater';
export { BusinessRecordUpdater } from './updaters/BusinessRecordUpdater';

// API routes
export { default as updaterRoutes } from './api/updater-routes';

// Types
export type { UpdaterOptions, ExecutionResult, UpdaterMetrics } from './core/BaseUpdater';
export type { ScheduleConfig, DatabaseConfig, DataGenerationConfig } from './config/UpdaterConfig';
export type { LogLevel, LogEntry, LoggerOptions } from './core/Logger';

/**
 * Quick start function for easy integration
 */
export async function startDatabaseUpdater(options?: {
  dryRun?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableScheduling?: boolean;
}) {
  const manager = new DatabaseUpdaterManager(options);
  await manager.start();
  return manager;
}

/**
 * Health check function
 */
export function checkUpdaterHealth() {
  try {
    // Basic health check - you can expand this
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// Default export
export default DatabaseUpdaterManager;
