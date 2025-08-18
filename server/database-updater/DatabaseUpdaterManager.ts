/**
 * Database Updater Manager
 * Main orchestrator for the database updater system
 * Manages CRON schedules, updater registry, and execution flow
 */

import { CronScheduler } from './core/CronScheduler';
import { UpdaterRegistry } from './core/UpdaterRegistry';
import { Logger } from './core/Logger';
import { UpdaterConfig } from './config/UpdaterConfig';
import { BusinessRecordActivityUpdater } from './updaters/BusinessRecordActivityUpdater';
import { ServiceTicketUpdater } from './updaters/ServiceTicketUpdater';
import { BusinessRecordUpdater } from './updaters/BusinessRecordUpdater';

export interface UpdaterManagerOptions {
  dryRun?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableScheduling?: boolean;
  configOverrides?: Partial<UpdaterConfig>;
}

export class DatabaseUpdaterManager {
  private scheduler: CronScheduler;
  private registry: UpdaterRegistry;
  private logger: Logger;
  private config: UpdaterConfig;
  private isRunning = false;

  constructor(options: UpdaterManagerOptions = {}) {
    this.logger = new Logger({
      level: options.logLevel || 'info',
      enableConsole: true,
      enableFile: true,
    });

    this.config = new UpdaterConfig(options.configOverrides);
    this.registry = new UpdaterRegistry(this.logger);
    this.scheduler = new CronScheduler(this.logger);

    this.initializeUpdaters(options.dryRun || false);
  }

  /**
   * Initialize all table updaters
   */
  private initializeUpdaters(dryRun: boolean) {
    const targetTenantId = this.config.targetTenantId;
    const targetCustomerId = this.config.targetCustomerId;

    // Register business record activity updater
    this.registry.register(
      'business_record_activities',
      new BusinessRecordActivityUpdater({
        tenantId: targetTenantId,
        dryRun,
        logger: this.logger,
      })
    );

    // Register service ticket updater
    this.registry.register(
      'service_tickets',
      new ServiceTicketUpdater({
        tenantId: targetTenantId,
        customerId: targetCustomerId,
        dryRun,
        logger: this.logger,
      })
    );

    // Register business record (leads) updater
    this.registry.register(
      'business_records',
      new BusinessRecordUpdater({
        tenantId: targetTenantId,
        dryRun,
        logger: this.logger,
      })
    );

    this.logger.info(`Initialized ${this.registry.getUpdaterCount()} updaters`, {
      dryRun,
      targetTenantId,
      targetCustomerId,
    });
  }

  /**
   * Start the database updater system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Database updater is already running');
      return;
    }

    try {
      this.logger.info('Starting Database Updater Manager...');

      // Validate configuration
      await this.validateConfiguration();

      // Schedule all updaters
      await this.scheduleUpdaters();

      // Start the scheduler
      await this.scheduler.start();

      this.isRunning = true;
      this.logger.info('Database Updater Manager started successfully');

      // Log next execution times
      this.logNextExecutions();
    } catch (error) {
      this.logger.error('Failed to start Database Updater Manager', error);
      throw error;
    }
  }

  /**
   * Stop the database updater system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Database updater is not running');
      return;
    }

    try {
      this.logger.info('Stopping Database Updater Manager...');

      await this.scheduler.stop();
      this.isRunning = false;

      this.logger.info('Database Updater Manager stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Database Updater Manager', error);
      throw error;
    }
  }

  /**
   * Execute a specific updater manually
   */
  async executeUpdater(updaterName: string): Promise<void> {
    try {
      this.logger.info(`Manually executing updater: ${updaterName}`);

      const updater = this.registry.get(updaterName);
      if (!updater) {
        throw new Error(`Updater not found: ${updaterName}`);
      }

      const result = await updater.execute();
      
      this.logger.info(`Manual execution completed for ${updaterName}`, {
        success: result.success,
        recordsUpdated: result.recordsUpdated,
        executionTime: result.executionTime,
      });
    } catch (error) {
      this.logger.error(`Manual execution failed for ${updaterName}`, error);
      throw error;
    }
  }

  /**
   * Get status of all updaters
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updaters: this.registry.getAll().map(updater => ({
        name: updater.name,
        lastExecution: updater.getLastExecution(),
        isEnabled: updater.isEnabled(),
        config: updater.getConfig(),
      })),
      nextExecutions: this.scheduler.getNextExecutions(),
      config: this.config.getAll(),
    };
  }

  /**
   * Update configuration and restart if needed
   */
  async updateConfiguration(newConfig: Partial<UpdaterConfig>): Promise<void> {
    this.logger.info('Updating configuration', newConfig);

    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    this.config.update(newConfig);

    if (wasRunning) {
      await this.start();
    }

    this.logger.info('Configuration updated successfully');
  }

  /**
   * Validate system configuration
   */
  private async validateConfiguration(): Promise<void> {
    const errors: string[] = [];

    // Validate tenant ID format
    if (!this.config.targetTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      errors.push('Invalid tenant ID format');
    }

    // Validate customer ID
    if (!this.config.targetCustomerId || this.config.targetCustomerId.trim() === '') {
      errors.push('Customer ID cannot be empty');
    }

    // Validate CRON expressions
    const scheduleConfig = this.config.scheduleConfig;
    if (!this.isValidCronExpression(scheduleConfig.businessActivities)) {
      errors.push('Invalid CRON expression for business activities');
    }
    if (!this.isValidCronExpression(scheduleConfig.serviceTickets)) {
      errors.push('Invalid CRON expression for service tickets');
    }
    if (!this.isValidCronExpression(scheduleConfig.newLeads)) {
      errors.push('Invalid CRON expression for new leads');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    this.logger.info('Configuration validation passed');
  }

  /**
   * Schedule all updaters based on configuration
   */
  private async scheduleUpdaters(): Promise<void> {
    const scheduleConfig = this.config.scheduleConfig;

    // Schedule business record activities updater
    this.scheduler.schedule(
      'business_record_activities',
      scheduleConfig.businessActivities,
      async () => {
        const updater = this.registry.get('business_record_activities');
        if (updater) {
          await updater.execute();
        }
      }
    );

    // Schedule service tickets updater
    this.scheduler.schedule(
      'service_tickets',
      scheduleConfig.serviceTickets,
      async () => {
        const updater = this.registry.get('service_tickets');
        if (updater) {
          await updater.execute();
        }
      }
    );

    // Schedule new leads updater
    this.scheduler.schedule(
      'business_records',
      scheduleConfig.newLeads,
      async () => {
        const updater = this.registry.get('business_records');
        if (updater) {
          await updater.execute();
        }
      }
    );

    this.logger.info('All updaters scheduled successfully');
  }

  /**
   * Log next execution times for all scheduled jobs
   */
  private logNextExecutions(): void {
    const nextExecutions = this.scheduler.getNextExecutions();
    
    this.logger.info('Next scheduled executions:', nextExecutions);
  }

  /**
   * Basic CRON expression validation
   */
  private isValidCronExpression(expression: string): boolean {
    // Basic validation - should have 5 or 6 parts (seconds optional)
    const parts = expression.trim().split(/\s+/);
    return parts.length >= 5 && parts.length <= 6;
  }
}

export default DatabaseUpdaterManager;
