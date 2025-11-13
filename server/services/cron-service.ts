/**
 * CRON SERVICE
 *
 * Handles scheduled tasks like trial email automation
 */

import cron from 'node-cron';
import { TrialManagementService } from './trial-management-service';

export class CronService {
  private static jobs: cron.ScheduledTask[] = [];

  /**
   * Initialize all cron jobs
   */
  static initialize() {
    console.log('[CRON] Initializing scheduled tasks...');

    // Run trial email processing daily at 9 AM
    const trialEmailJob = cron.schedule('0 9 * * *', async () => {
      console.log('[CRON] Running trial email processing...');
      try {
        const results = await TrialManagementService.processTrialEmails();
        console.log(`[CRON] Trial emails processed: ${results.sent} sent, ${results.errors} errors`);
      } catch (error) {
        console.error('[CRON] Trial email processing failed:', error);
      }
    });

    this.jobs.push(trialEmailJob);

    // For development/testing: Run trial processing every hour
    if (process.env.NODE_ENV === 'development') {
      const hourlyTrialJob = cron.schedule('0 * * * *', async () => {
        console.log('[CRON DEV] Running hourly trial check...');
        try {
          const results = await TrialManagementService.processTrialEmails();
          console.log(`[CRON DEV] Trial emails: ${results.sent} sent`);
        } catch (error) {
          console.error('[CRON DEV] Error:', error);
        }
      });

      this.jobs.push(hourlyTrialJob);
    }

    console.log(`[CRON] Initialized ${this.jobs.length} scheduled tasks`);
  }

  /**
   * Stop all cron jobs
   */
  static shutdown() {
    console.log('[CRON] Stopping all scheduled tasks...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('[CRON] All tasks stopped');
  }

  /**
   * Get status of all cron jobs
   */
  static getStatus(): { total: number; running: number } {
    const running = this.jobs.filter(job => job.getStatus() === 'scheduled').length;
    return {
      total: this.jobs.length,
      running,
    };
  }
}

export const cronService = CronService;
