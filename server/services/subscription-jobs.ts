import { SubscriptionService } from './subscription-service';
import { UsageTrackingService } from './usage-tracking-service';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('subscription-jobs');

/**
 * SUBSCRIPTION SCHEDULED JOBS
 *
 * Automated jobs for subscription management:
 * - Trial expiration checks and warnings
 * - Usage limit monitoring
 * - Daily usage snapshots
 * - Billing period transitions
 */

export class SubscriptionJobs {
  private static intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scheduled jobs
   */
  static startAll() {
    // Allow disabling in development (similar to WebSocket and Database Updater)
    if (process.env.DISABLE_SUBSCRIPTION_JOBS === 'true') {
      log.info('ℹ️ Subscription jobs disabled (set DISABLE_SUBSCRIPTION_JOBS=false to enable)');
      return;
    }

    log.info('🚀 Starting subscription scheduled jobs...');

    // Check trial expirations every hour
    this.intervals.push(
      setInterval(
        () => {
          this.checkTrialExpirations().catch((error) => {
            // Only log in development to reduce noise
            if (process.env.NODE_ENV === 'development') {
              log.error('Trial expiration check failed:', error?.message || error);
            }
          });
        },
        60 * 60 * 1000,
      ), // 1 hour
    );

    // Check usage limits every 6 hours
    this.intervals.push(
      setInterval(
        () => {
          this.checkUsageLimits().catch((error) => {
            // Only log in development to reduce noise
            if (process.env.NODE_ENV === 'development') {
              log.error('Usage limit check failed:', error?.message || error);
            }
          });
        },
        6 * 60 * 60 * 1000,
      ), // 6 hours
    );

    // Create daily snapshots at midnight (run once per day)
    this.intervals.push(
      setInterval(
        () => {
          const now = new Date();
          // Run at approximately midnight (23:00 - 01:00)
          if (now.getHours() === 0) {
            this.createDailySnapshots().catch((error) => {
              log.error('Daily snapshot creation failed:', error);
            });
          }
        },
        60 * 60 * 1000,
      ), // Check every hour
    );

    // Recalculate usage every 4 hours
    this.intervals.push(
      setInterval(
        () => {
          this.recalculateUsage().catch((error) => {
            log.error('Usage recalculation failed:', error);
          });
        },
        4 * 60 * 60 * 1000,
      ), // 4 hours
    );

    // Run initial checks immediately
    this.runInitialChecks();

    log.info('✅ Subscription scheduled jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  static stopAll() {
    log.info('🛑 Stopping subscription scheduled jobs...');

    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    this.intervals = [];
    log.info('✅ Subscription scheduled jobs stopped');
  }

  /**
   * Run initial checks on startup
   */
  private static async runInitialChecks() {
    try {
      log.info('🔍 Running initial subscription checks...');

      // Run checks individually with error handling to prevent one failure from blocking others
      const results = await Promise.allSettled([
        this.checkTrialExpirations(),
        this.checkUsageLimits(),
      ]);

      // Log any failures but don't crash
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const checkName = index === 0 ? 'Trial expiration' : 'Usage limit';
          if (import.meta.env?.DEV) {
            log.warn(
              `${checkName} check failed on startup (will retry on schedule):`,
              result.reason?.message,
            );
          }
        }
      });

      log.info('✅ Initial subscription checks completed');
    } catch (error) {
      // Catch any unexpected errors
      if (import.meta.env?.DEV) {
        log.error('Initial checks failed:', error);
      }
    }
  }

  /**
   * Check for trial expirations and send warnings
   */
  static async checkTrialExpirations(): Promise<void> {
    try {
      log.info('⏰ Checking trial expirations...');

      await SubscriptionService.checkTrialExpirations();

      log.info('✅ Trial expiration check completed');
    } catch (error) {
      // Only log in development to reduce noise
      if (import.meta.env?.DEV) {
        log.error('Trial expiration check failed:', error);
      }
      throw error;
    }
  }

  /**
   * Check usage limits for all active subscriptions
   */
  static async checkUsageLimits(): Promise<void> {
    try {
      log.info('📊 Checking usage limits...');

      await SubscriptionService.checkUsageLimits();

      log.info('✅ Usage limit check completed');
    } catch (error) {
      // Only log in development to reduce noise
      if (import.meta.env?.DEV) {
        log.error('Usage limit check failed:', error);
      }
      throw error;
    }
  }

  /**
   * Create daily usage snapshots for all tenants
   */
  static async createDailySnapshots(): Promise<void> {
    try {
      log.info('📸 Creating daily usage snapshots...');

      await UsageTrackingService.createAllDailySnapshots();

      log.info('✅ Daily snapshots created');
    } catch (error) {
      log.error('Daily snapshot creation failed:', error);
      throw error;
    }
  }

  /**
   * Recalculate usage for all active tenants
   */
  static async recalculateUsage(): Promise<void> {
    try {
      log.info('♻️ Recalculating usage for all tenants...');

      await UsageTrackingService.recalculateAllUsage();

      log.info('✅ Usage recalculation completed');
    } catch (error) {
      log.error('Usage recalculation failed:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for all maintenance tasks
   */
  static async runMaintenance(): Promise<void> {
    log.info('🔧 Running subscription maintenance tasks...');

    try {
      await Promise.all([
        this.checkTrialExpirations(),
        this.checkUsageLimits(),
        this.createDailySnapshots(),
        this.recalculateUsage(),
      ]);

      log.info('✅ Subscription maintenance completed successfully');
    } catch (error) {
      log.error('Subscription maintenance failed:', error);
      throw error;
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, stopping subscription jobs...');
  SubscriptionJobs.stopAll();
});

process.on('SIGINT', () => {
  log.info('SIGINT received, stopping subscription jobs...');
  SubscriptionJobs.stopAll();
});
