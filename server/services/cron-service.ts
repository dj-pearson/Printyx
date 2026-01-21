/**
 * CRON SERVICE
 *
 * Handles scheduled tasks like trial email automation
 * Note: Cron functionality is temporarily disabled until node-cron package is installed
 */

import { TrialManagementService } from './trial-management-service';

export class CronService {
  private static jobs: any[] = [];
  private static intervals: NodeJS.Timeout[] = [];

  /**
   * Initialize all cron jobs
   * Using native setInterval until node-cron is available
   */
  static initialize() {
    console.log('[CRON] Initializing scheduled tasks with native timers...');

    // Run trial email processing daily at 9 AM (using interval for now)
    // In production, this should use a proper cron library
    const HOUR_IN_MS = 60 * 60 * 1000;
    const DAY_IN_MS = 24 * HOUR_IN_MS;

    // For development: Run trial processing every 6 hours
    if (process.env.NODE_ENV === 'development') {
      const sixHourInterval = setInterval(async () => {
        console.log('[CRON DEV] Running trial check...');
        try {
          const results = await TrialManagementService.processTrialEmails();
          console.log(`[CRON DEV] Trial emails: ${results.sent} sent`);
        } catch (error) {
          console.error('[CRON DEV] Error:', error);
        }
      }, 6 * HOUR_IN_MS);

      this.intervals.push(sixHourInterval);
    } else {
      // Production: Run once per day
      const dailyInterval = setInterval(async () => {
        console.log('[CRON] Running trial email processing...');
        try {
          const results = await TrialManagementService.processTrialEmails();
          console.log(
            `[CRON] Trial emails processed: ${results.sent} sent, ${results.errors} errors`,
          );
        } catch (error) {
          console.error('[CRON] Trial email processing failed:', error);
        }
      }, DAY_IN_MS);

      this.intervals.push(dailyInterval);
    }

    console.log(`[CRON] Initialized ${this.intervals.length} scheduled tasks`);
  }

  /**
   * Stop all cron jobs
   */
  static shutdown() {
    console.log('[CRON] Stopping all scheduled tasks...');
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    this.jobs = [];
    console.log('[CRON] All tasks stopped');
  }

  /**
   * Get status of all cron jobs
   */
  static getStatus(): { total: number; running: number } {
    return {
      total: this.intervals.length,
      running: this.intervals.length,
    };
  }
}

export const cronService = CronService;
