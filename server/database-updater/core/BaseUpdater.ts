/**
 * Base Updater Class
 * Abstract base class for all database table updaters
 */

import { Logger } from './Logger';

export interface UpdaterOptions {
  tenantId: string;
  dryRun?: boolean;
  logger: Logger;
  customerId?: string;
}

export interface ExecutionResult {
  success: boolean;
  recordsUpdated: number;
  executionTime: number;
  errors?: string[];
  data?: any;
}

export interface UpdaterMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  lastError?: string;
}

export abstract class BaseUpdater {
  protected tenantId: string;
  protected dryRun: boolean;
  protected logger: Logger;
  protected customerId?: string;
  protected enabled = true;
  
  private metrics: UpdaterMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
  };

  public readonly name: string;

  constructor(name: string, options: UpdaterOptions) {
    this.name = name;
    this.tenantId = options.tenantId;
    this.dryRun = options.dryRun || false;
    this.logger = options.logger;
    this.customerId = options.customerId;
  }

  /**
   * Execute the updater
   */
  async execute(): Promise<ExecutionResult> {
    if (!this.enabled) {
      this.logger.warn(`Updater ${this.name} is disabled`);
      return {
        success: false,
        recordsUpdated: 0,
        executionTime: 0,
        errors: ['Updater is disabled'],
      };
    }

    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting execution for updater: ${this.name}`, {
        tenantId: this.tenantId,
        customerId: this.customerId,
        dryRun: this.dryRun,
      });

      // Pre-execution validation
      await this.validateExecution();

      // Generate data
      const dataToInsert = await this.generateData();
      
      if (!dataToInsert || dataToInsert.length === 0) {
        this.logger.info(`No data generated for updater: ${this.name}`);
        return {
          success: true,
          recordsUpdated: 0,
          executionTime: Date.now() - startTime,
        };
      }

      this.logger.debug(`Generated ${dataToInsert.length} records for ${this.name}`, {
        sampleRecord: dataToInsert[0],
      });

      // Insert data (or simulate if dry run)
      const recordsUpdated = await this.insertData(dataToInsert);

      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(true, executionTime);

      const result: ExecutionResult = {
        success: true,
        recordsUpdated,
        executionTime,
        data: this.dryRun ? dataToInsert : undefined,
      };

      this.logger.info(`Completed execution for updater: ${this.name}`, result);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update metrics
      this.updateMetrics(false, executionTime, errorMessage);

      this.logger.error(`Execution failed for updater: ${this.name}`, error);

      return {
        success: false,
        recordsUpdated: 0,
        executionTime,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Abstract method to generate data for insertion
   */
  protected abstract generateData(): Promise<any[]>;

  /**
   * Abstract method to insert data into the database
   */
  protected abstract insertData(data: any[]): Promise<number>;

  /**
   * Abstract method to validate execution conditions
   */
  protected abstract validateExecution(): Promise<void>;

  /**
   * Get updater configuration
   */
  getConfig() {
    return {
      name: this.name,
      tenantId: this.tenantId,
      customerId: this.customerId,
      dryRun: this.dryRun,
      enabled: this.enabled,
    };
  }

  /**
   * Get updater metrics
   */
  getMetrics(): UpdaterMetrics {
    return { ...this.metrics };
  }

  /**
   * Get last execution time
   */
  getLastExecution(): Date | undefined {
    return this.metrics.lastExecution;
  }

  /**
   * Check if updater is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the updater
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`Updater ${this.name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
    };
    this.logger.info(`Metrics reset for updater: ${this.name}`);
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(success: boolean, executionTime: number, errorMessage?: string): void {
    this.metrics.totalExecutions++;
    this.metrics.lastExecution = new Date();

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
      if (errorMessage) {
        this.metrics.lastError = errorMessage;
      }
    }

    // Update average execution time
    const totalTime = (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1)) + executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
  }

  /**
   * Helper method to generate random value from distribution
   */
  protected selectFromDistribution(distribution: Record<string, number>): string {
    const random = Math.random();
    let cumulative = 0;
    
    for (const [value, probability] of Object.entries(distribution)) {
      cumulative += probability;
      if (random <= cumulative) {
        return value;
      }
    }
    
    // Fallback to first key if distribution doesn't sum to 1
    return Object.keys(distribution)[0];
  }

  /**
   * Helper method to generate random number within range
   */
  protected randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Helper method to generate random decimal within range
   */
  protected randomDecimalInRange(min: number, max: number, decimals = 2): number {
    const random = Math.random() * (max - min) + min;
    return Math.round(random * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Helper method to get random element from array
   */
  protected randomFromArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Helper method to generate random date within range
   */
  protected randomDateInRange(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + Math.random() * (endTime - startTime);
    return new Date(randomTime);
  }

  /**
   * Helper method to generate business hours date
   */
  protected generateBusinessHoursDate(daysFromNow = 0): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    
    // Set to random business hour (9 AM to 5 PM)
    const businessHour = this.randomInRange(9, 17);
    const minute = this.randomInRange(0, 59);
    
    date.setHours(businessHour, minute, 0, 0);
    
    // If it's weekend, move to next Monday
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) { // Sunday
      date.setDate(date.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      date.setDate(date.getDate() + 2);
    }
    
    return date;
  }

  /**
   * Generate UUID v4
   */
  protected generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export default BaseUpdater;
