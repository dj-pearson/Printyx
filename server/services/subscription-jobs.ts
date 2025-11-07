import { SubscriptionService } from './subscription-service';
import { UsageTrackingService } from './usage-tracking-service';

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
    console.log('🚀 Starting subscription scheduled jobs...');

    // Check trial expirations every hour
    this.intervals.push(
      setInterval(() => {
        this.checkTrialExpirations().catch((error) => {
          console.error('Trial expiration check failed:', error);
        });
      }, 60 * 60 * 1000) // 1 hour
    );

    // Check usage limits every 6 hours
    this.intervals.push(
      setInterval(() => {
        this.checkUsageLimits().catch((error) => {
          console.error('Usage limit check failed:', error);
        });
      }, 6 * 60 * 60 * 1000) // 6 hours
    );

    // Create daily snapshots at midnight (run once per day)
    this.intervals.push(
      setInterval(() => {
        const now = new Date();
        // Run at approximately midnight (23:00 - 01:00)
        if (now.getHours() === 0) {
          this.createDailySnapshots().catch((error) => {
            console.error('Daily snapshot creation failed:', error);
          });
        }
      }, 60 * 60 * 1000) // Check every hour
    );

    // Recalculate usage every 4 hours
    this.intervals.push(
      setInterval(() => {
        this.recalculateUsage().catch((error) => {
          console.error('Usage recalculation failed:', error);
        });
      }, 4 * 60 * 60 * 1000) // 4 hours
    );

    // Run initial checks immediately
    this.runInitialChecks();

    console.log('✅ Subscription scheduled jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  static stopAll() {
    console.log('🛑 Stopping subscription scheduled jobs...');

    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    this.intervals = [];
    console.log('✅ Subscription scheduled jobs stopped');
  }

  /**
   * Run initial checks on startup
   */
  private static async runInitialChecks() {
    try {
      console.log('🔍 Running initial subscription checks...');

      await Promise.all([
        this.checkTrialExpirations(),
        this.checkUsageLimits(),
      ]);

      console.log('✅ Initial subscription checks completed');
    } catch (error) {
      console.error('Initial checks failed:', error);
    }
  }

  /**
   * Check for trial expirations and send warnings
   */
  static async checkTrialExpirations(): Promise<void> {
    try {
      console.log('⏰ Checking trial expirations...');

      await SubscriptionService.checkTrialExpirations();

      console.log('✅ Trial expiration check completed');
    } catch (error) {
      console.error('Trial expiration check failed:', error);
      throw error;
    }
  }

  /**
   * Check usage limits for all active subscriptions
   */
  static async checkUsageLimits(): Promise<void> {
    try {
      console.log('📊 Checking usage limits...');

      await SubscriptionService.checkUsageLimits();

      console.log('✅ Usage limit check completed');
    } catch (error) {
      console.error('Usage limit check failed:', error);
      throw error;
    }
  }

  /**
   * Create daily usage snapshots for all tenants
   */
  static async createDailySnapshots(): Promise<void> {
    try {
      console.log('📸 Creating daily usage snapshots...');

      await UsageTrackingService.createAllDailySnapshots();

      console.log('✅ Daily snapshots created');
    } catch (error) {
      console.error('Daily snapshot creation failed:', error);
      throw error;
    }
  }

  /**
   * Recalculate usage for all active tenants
   */
  static async recalculateUsage(): Promise<void> {
    try {
      console.log('♻️ Recalculating usage for all tenants...');

      await UsageTrackingService.recalculateAllUsage();

      console.log('✅ Usage recalculation completed');
    } catch (error) {
      console.error('Usage recalculation failed:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for all maintenance tasks
   */
  static async runMaintenance(): Promise<void> {
    console.log('🔧 Running subscription maintenance tasks...');

    try {
      await Promise.all([
        this.checkTrialExpirations(),
        this.checkUsageLimits(),
        this.createDailySnapshots(),
        this.recalculateUsage(),
      ]);

      console.log('✅ Subscription maintenance completed successfully');
    } catch (error) {
      console.error('Subscription maintenance failed:', error);
      throw error;
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping subscription jobs...');
  SubscriptionJobs.stopAll();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping subscription jobs...');
  SubscriptionJobs.stopAll();
});
