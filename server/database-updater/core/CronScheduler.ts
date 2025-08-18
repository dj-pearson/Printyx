/**
 * CRON Scheduler
 * Manages CRON-based scheduling for database updaters
 */

import * as cron from 'node-cron';
import { Logger } from './Logger';

export interface ScheduledJob {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  task: cron.ScheduledTask;
  lastExecution?: Date;
  nextExecution?: Date;
  executionCount: number;
  errorCount: number;
}

export interface SchedulerOptions {
  timezone?: string;
  enableExceptionHandling?: boolean;
  maxConcurrentJobs?: number;
}

export class CronScheduler {
  private jobs = new Map<string, ScheduledJob>();
  private logger: Logger;
  private isRunning = false;
  private options: SchedulerOptions;
  private runningJobs = new Set<string>();

  constructor(logger: Logger, options: SchedulerOptions = {}) {
    this.logger = logger;
    this.options = {
      timezone: 'America/New_York',
      enableExceptionHandling: true,
      maxConcurrentJobs: 5,
      ...options,
    };
  }

  /**
   * Schedule a new job
   */
  schedule(name: string, cronExpression: string, handler: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      this.logger.warn(`Job ${name} already exists. Removing existing job.`);
      this.unschedule(name);
    }

    try {
      // Validate CRON expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid CRON expression: ${cronExpression}`);
      }

      // Create wrapped handler with exception handling
      const wrappedHandler = this.createWrappedHandler(name, handler);

      // Create scheduled task
      const task = cron.schedule(cronExpression, wrappedHandler, {
        scheduled: false,
        timezone: this.options.timezone,
      });

      const job: ScheduledJob = {
        name,
        cronExpression,
        handler,
        task,
        executionCount: 0,
        errorCount: 0,
      };

      this.jobs.set(name, job);

      // Start the task if scheduler is running
      if (this.isRunning) {
        task.start();
      }

      this.logger.info(`Scheduled job: ${name}`, {
        cronExpression,
        timezone: this.options.timezone,
      });
    } catch (error) {
      this.logger.error(`Failed to schedule job: ${name}`, error);
      throw error;
    }
  }

  /**
   * Unschedule a job
   */
  unschedule(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      this.logger.warn(`Job ${name} not found`);
      return false;
    }

    job.task.destroy();
    this.jobs.delete(name);
    this.runningJobs.delete(name);

    this.logger.info(`Unscheduled job: ${name}`);
    return true;
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.logger.info('Starting CRON scheduler...');

    for (const job of this.jobs.values()) {
      job.task.start();
    }

    this.isRunning = true;
    this.logger.info(`CRON scheduler started with ${this.jobs.size} jobs`);
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Scheduler is not running');
      return;
    }

    this.logger.info('Stopping CRON scheduler...');

    // Wait for running jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeout) {
      this.logger.debug(`Waiting for ${this.runningJobs.size} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningJobs.size > 0) {
      this.logger.warn(`Timeout waiting for jobs to complete: ${Array.from(this.runningJobs).join(', ')}`);
    }

    // Stop all jobs
    for (const job of this.jobs.values()) {
      job.task.stop();
    }

    this.isRunning = false;
    this.logger.info('CRON scheduler stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const jobs = Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      cronExpression: job.cronExpression,
      isRunning: this.runningJobs.has(job.name),
      lastExecution: job.lastExecution,
      nextExecution: this.getNextExecutionTime(job),
      executionCount: job.executionCount,
      errorCount: job.errorCount,
    }));

    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      runningJobs: this.runningJobs.size,
      jobs,
    };
  }

  /**
   * Get next execution times for all jobs
   */
  getNextExecutions(): Record<string, Date | null> {
    const nextExecutions: Record<string, Date | null> = {};
    
    for (const job of this.jobs.values()) {
      nextExecutions[job.name] = this.getNextExecutionTime(job);
    }
    
    return nextExecutions;
  }

  /**
   * Execute a job manually
   */
  async executeJob(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Job ${name} not found`);
    }

    if (this.runningJobs.has(name)) {
      throw new Error(`Job ${name} is already running`);
    }

    this.logger.info(`Manually executing job: ${name}`);
    
    try {
      await this.executeJobHandler(job);
    } catch (error) {
      this.logger.error(`Manual execution failed for job: ${name}`, error);
      throw error;
    }
  }

  /**
   * Update job schedule
   */
  updateSchedule(name: string, newCronExpression: string): void {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Job ${name} not found`);
    }

    // Unschedule existing job
    this.unschedule(name);
    
    // Reschedule with new expression
    this.schedule(name, newCronExpression, job.handler);
  }

  /**
   * Create wrapped handler with exception handling and concurrency control
   */
  private createWrappedHandler(name: string, handler: () => Promise<void>) {
    return async () => {
      const job = this.jobs.get(name);
      if (!job) return;

      // Check concurrency limit
      if (this.runningJobs.size >= (this.options.maxConcurrentJobs || 5)) {
        this.logger.warn(`Skipping execution of job ${name}: concurrency limit reached`);
        return;
      }

      await this.executeJobHandler(job);
    };
  }

  /**
   * Execute job handler with error handling and metrics
   */
  private async executeJobHandler(job: ScheduledJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.runningJobs.add(job.name);
      
      this.logger.debug(`Executing scheduled job: ${job.name}`);
      
      await job.handler();
      
      job.executionCount++;
      job.lastExecution = new Date();
      
      const executionTime = Date.now() - startTime;
      this.logger.info(`Completed scheduled job: ${job.name}`, {
        executionTime: `${executionTime}ms`,
        executionCount: job.executionCount,
      });
    } catch (error) {
      job.errorCount++;
      
      const executionTime = Date.now() - startTime;
      this.logger.error(`Scheduled job failed: ${job.name}`, {
        error,
        executionTime: `${executionTime}ms`,
        errorCount: job.errorCount,
      });

      if (this.options.enableExceptionHandling) {
        // Optionally implement retry logic here
        this.logger.info(`Exception handling enabled for job: ${job.name}`);
      }
    } finally {
      this.runningJobs.delete(job.name);
    }
  }

  /**
   * Calculate next execution time for a job
   */
  private getNextExecutionTime(job: ScheduledJob): Date | null {
    try {
      // This is a simplified calculation - in a real implementation,
      // you'd use the cron library's ability to get next execution time
      // For now, we'll return null or implement a basic calculation
      
      // Note: node-cron doesn't have a built-in method to get next execution time
      // You might want to use a library like 'cron-parser' for this functionality
      
      return null; // Placeholder
    } catch (error) {
      this.logger.error(`Failed to calculate next execution time for job: ${job.name}`, error);
      return null;
    }
  }

  /**
   * Get job by name
   */
  getJob(name: string): ScheduledJob | undefined {
    return this.jobs.get(name);
  }

  /**
   * Get all job names
   */
  getJobNames(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get scheduler statistics
   */
  getStatistics() {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      totalExecutions: jobs.reduce((sum, job) => sum + job.executionCount, 0),
      totalErrors: jobs.reduce((sum, job) => sum + job.errorCount, 0),
      runningJobs: this.runningJobs.size,
      averageExecutionsPerJob: jobs.length > 0 ? 
        jobs.reduce((sum, job) => sum + job.executionCount, 0) / jobs.length : 0,
    };
  }
}

export default CronScheduler;
