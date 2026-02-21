/**
 * Production Environment Configuration
 * Optimized for performance, security, and reliability.
 */

import type { DeepPartial } from './index';
import type { AppConfig } from './default';

export const productionConfig: DeepPartial<AppConfig> = {
  server: {
    trustProxy: true,
  },

  database: {
    poolMin: 5,
    poolMax: 20,
    slowQueryThresholdMs: 500,
    logQueries: false,
    logParams: false,
  },

  cache: {
    defaultTtl: 300,
    longTtl: 3600,
  },

  logging: {
    level: 'info',
  },

  apm: {
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  },

  session: {
    secureCookies: true,
  },

  features: {
    disableSubscriptionJobs: false,
  },
};
