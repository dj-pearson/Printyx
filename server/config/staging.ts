/**
 * Staging Environment Configuration
 * Production-like settings with more verbose logging.
 */

import type { DeepPartial } from './index';
import type { AppConfig } from './default';

export const stagingConfig: DeepPartial<AppConfig> = {
  server: {
    trustProxy: true,
  },

  database: {
    poolMin: 2,
    poolMax: 15,
    slowQueryThresholdMs: 500,
  },

  logging: {
    level: 'debug',
  },

  apm: {
    tracesSampleRate: 0.5, // More traces in staging for debugging
    profilesSampleRate: 0.3,
  },

  session: {
    secureCookies: true,
  },
};
