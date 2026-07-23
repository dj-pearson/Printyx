/**
 * CRON SERVICE
 *
 * Handles scheduled tasks like trial email automation
 * Note: Cron functionality is temporarily disabled until node-cron package is installed
 */

import { TrialManagementService } from './trial-management-service';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('cron-service');

export class CronService {
  private static jobs: any[] = [];
  private static intervals: NodeJS.Timeout[] = [];

  /**
   * Initialize all cron jobs
   * Using native setInterval until node-cron is available
   */
  static initialize() {
    log.info('[CRON] Initializing scheduled tasks with native timers...');

    // Run trial email processing daily at 9 AM (using interval for now)
    // In production, this should use a proper cron library
    const HOUR_IN_MS = 60 * 60 * 1000;
    const DAY_IN_MS = 24 * HOUR_IN_MS;

    // For development: Run trial processing every 6 hours
    if (process.env.NODE_ENV === 'development') {
      const sixHourInterval = setInterval(async () => {
        log.info('[CRON DEV] Running trial check...');
        try {
          const results = await TrialManagementService.processTrialEmails();
          log.info(`[CRON DEV] Trial emails: ${results.sent} sent`);
        } catch (error) {
          log.error('[CRON DEV] Error:', error);
        }
      }, 6 * HOUR_IN_MS);

      this.intervals.push(sixHourInterval);
    } else {
      // Production: Run once per day
      const dailyInterval = setInterval(async () => {
        log.info('[CRON] Running trial email processing...');
        try {
          const results = await TrialManagementService.processTrialEmails();
          log.info(`[CRON] Trial emails processed: ${results.sent} sent, ${results.errors} errors`);
        } catch (error) {
          log.error('[CRON] Trial email processing failed:', error);
        }
      }, DAY_IN_MS);

      this.intervals.push(dailyInterval);
    }

    // US-SUPER-015: hourly tick that delivers morning briefings to each user at
    // 6am in their own timezone. Safe to run hourly — same-day dedupe lives in
    // runDueDailyBriefings. Lazy import to avoid load-order coupling.
    const briefingInterval = setInterval(
      async () => {
        try {
          const { runDueDailyBriefings } = await import('../routes-daily-briefing');
          const r = await runDueDailyBriefings();
          if (r.due > 0) log.info(`[CRON] Morning briefings: ${r.generated}/${r.due} delivered`);
        } catch (error) {
          log.error('[CRON] Morning briefing tick failed:', error);
        }
      },
      60 * 60 * 1000,
    );
    this.intervals.push(briefingInterval);

    // Data-retention enforcement (GDPR storage-limitation). Runs daily across
    // all active retention policies. REPORT-ONLY by default: it identifies and
    // records candidate rows without deleting. Destructive purge only runs when
    // DATA_RETENTION_PURGE_ENABLED === 'true' (opt-in once the archive-before-
    // purge path is completed). Legal-hold and per-policy status are enforced
    // inside the service.
    const retentionInterval = setInterval(async () => {
      try {
        const { runScheduledRetention } = await import('./data-retention-service');
        const dryRun = process.env.DATA_RETENTION_PURGE_ENABLED !== 'true';
        const r = await runScheduledRetention(dryRun);
        if (r.policiesChecked > 0) {
          log.info(
            `[CRON] Data retention (${dryRun ? 'report-only' : 'purge'}): ` +
              `${r.jobsCreated}/${r.policiesChecked} policies processed` +
              (r.errors.length ? `, ${r.errors.length} errors` : ''),
          );
        }
      } catch (error) {
        log.error('[CRON] Data retention tick failed:', error);
      }
    }, DAY_IN_MS);
    this.intervals.push(retentionInterval);

    log.info(`[CRON] Initialized ${this.intervals.length} scheduled tasks`);
  }

  /**
   * Stop all cron jobs
   */
  static shutdown() {
    log.info('[CRON] Stopping all scheduled tasks...');
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    this.jobs = [];
    log.info('[CRON] All tasks stopped');
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
