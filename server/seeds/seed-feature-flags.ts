/**
 * Seed Feature Flags
 * US-035: Seeds 5 default feature flags.
 */

import { db } from '../db';
import { featureFlags } from '../../shared/feature-flags-schema';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('seed-feature-flags');

const DEFAULT_FLAGS = [
  {
    name: 'new_dashboard',
    description: 'Enable the redesigned dashboard experience',
    enabled: false,
    rolloutPercentage: 100,
    tenantOverrides: {},
  },
  {
    name: 'ai_features',
    description: 'Enable AI-powered features (GPT analysis, predictions)',
    enabled: true,
    rolloutPercentage: 100,
    tenantOverrides: {},
  },
  {
    name: 'advanced_reporting',
    description: 'Enable advanced reporting and analytics features',
    enabled: true,
    rolloutPercentage: 100,
    tenantOverrides: {},
  },
  {
    name: 'mobile_pwa',
    description: 'Enable progressive web app features for mobile',
    enabled: false,
    rolloutPercentage: 50,
    tenantOverrides: {},
  },
  {
    name: 'beta_integrations',
    description: 'Enable beta third-party integrations',
    enabled: false,
    rolloutPercentage: 10,
    tenantOverrides: {},
  },
];

async function seedFeatureFlags() {
  log.info('Seeding feature flags...');

  for (const flag of DEFAULT_FLAGS) {
    try {
      await db.insert(featureFlags).values(flag).onConflictDoNothing({ target: featureFlags.name });
      log.info(`  + ${flag.name} (enabled=${flag.enabled}, rollout=${flag.rolloutPercentage}%)`);
    } catch (error: any) {
      if (error.code === '23505') {
        log.info(`  ~ ${flag.name} already exists, skipping`);
      } else {
        log.error(`  ! Failed to seed ${flag.name}:`, error);
      }
    }
  }

  log.info('Feature flags seeding complete');
  process.exit(0);
}

seedFeatureFlags().catch((error) => {
  log.error('Feature flags seeding failed:', error);
  process.exit(1);
});
