/**
 * Test Environment Configuration
 * Optimized for fast test execution with minimal side effects.
 */

import type { DeepPartial } from './index';
import type { AppConfig } from './default';

export const testConfig: DeepPartial<AppConfig> = {
  server: {
    port: 5001,
  },

  database: {
    poolMin: 1,
    poolMax: 5,
    maxRetries: 1,
    retryBaseDelayMs: 100,
    retryMaxDelayMs: 500,
  },

  cache: {
    defaultTtl: 1, // 1 second for tests
    shortTtl: 1,
    mediumTtl: 1,
    longTtl: 5,
  },

  rateLimits: {
    auth: { limit: 1000, windowMs: 60 * 1000 }, // No rate limiting in tests
    mutation: { limit: 1000, windowMs: 60 * 1000 },
    read: { limit: 1000, windowMs: 60 * 1000 },
    general: { limit: 1000, windowMs: 60 * 1000 },
  },

  logging: {
    level: 'warn', // Quiet logs during tests
  },

  apm: {
    provider: 'none',
  },

  features: {
    enableAi: false,
    enableStripe: false,
    enableWebSockets: false,
    enableEmailNotifications: false,
    enableScheduledReports: false,
    disableSubscriptionJobs: true,
  },
};
