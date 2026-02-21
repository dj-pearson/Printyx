/**
 * Development Environment Configuration
 * Overrides for local development.
 */

import type { DeepPartial } from './index';
import type { AppConfig } from './default';

export const developmentConfig: DeepPartial<AppConfig> = {
  server: {
    trustProxy: false,
  },

  database: {
    poolMin: 2,
    poolMax: 10,
    logQueries: false,
    logParams: false,
    slowQueryThresholdMs: 2000,
  },

  cache: {
    defaultTtl: 60, // 1 minute in dev for faster iteration
  },

  rateLimits: {
    auth: { limit: 20, windowMs: 60 * 1000 }, // More lenient in dev
    mutation: { limit: 500, windowMs: 60 * 1000 },
    read: { limit: 1000, windowMs: 60 * 1000 },
  },

  logging: {
    level: 'debug',
  },

  apm: {
    provider: 'none',
  },

  session: {
    secureCookies: false,
  },

  features: {
    disableSubscriptionJobs: true, // Reduces DB noise in dev
  },
};
