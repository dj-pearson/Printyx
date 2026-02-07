import { db } from './db';
import { subscriptionAddons, type NewSubscriptionAddon } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-subscription-addons');

/**
 * SUBSCRIPTION ADD-ONS SEED DATA
 *
 * Based on Printyx PRD requirements:
 * - One-time add-ons: Implementation, Data Migration, Training
 * - Recurring add-ons: Additional API Calls, Additional Storage, Premium Support
 */

const addons: NewSubscriptionAddon[] = [
  // ============================================================================
  // ONE-TIME ADD-ONS
  // ============================================================================
  {
    name: 'Professional Implementation',
    slug: 'professional_implementation',
    description:
      'White-glove implementation service with dedicated project manager, custom configuration, and data migration assistance',
    category: 'one_time',
    price: '3000.00',
    billingCycle: 'one_time',
    unit: 'service',
    quantity: 1,
    appliesToPlans: ['starter', 'professional', 'enterprise'],
    displayOrder: 1,
    isVisible: true,
    isActive: true,
    metadata: {
      features: [
        'Dedicated project manager',
        'Custom configuration',
        'Data migration assistance',
        'User training sessions',
        'Go-live support',
      ],
      estimatedDuration: '4-6 weeks',
    },
  },
  {
    name: 'Data Migration Service',
    slug: 'data_migration',
    description:
      'Expert data migration from your existing systems to Printyx, including data cleansing and validation',
    category: 'one_time',
    price: '2000.00',
    billingCycle: 'one_time',
    unit: 'service',
    quantity: 1,
    appliesToPlans: ['starter', 'professional', 'enterprise'],
    displayOrder: 2,
    isVisible: true,
    isActive: true,
    metadata: {
      features: [
        'Data extraction from legacy systems',
        'Data cleansing and validation',
        'Custom field mapping',
        'Data integrity testing',
        'Rollback support',
      ],
      estimatedDuration: '2-4 weeks',
    },
  },
  {
    name: 'Advanced Training Package',
    slug: 'advanced_training',
    description:
      'Comprehensive training for your team, including admin training, end-user training, and custom workflow training',
    category: 'one_time',
    price: '1500.00',
    billingCycle: 'one_time',
    unit: 'service',
    quantity: 1,
    appliesToPlans: ['starter', 'professional', 'enterprise'],
    displayOrder: 3,
    isVisible: true,
    isActive: true,
    metadata: {
      features: [
        'Admin training (4 hours)',
        'End-user training (8 hours)',
        'Custom workflow training',
        'Recorded sessions',
        'Training materials',
      ],
      estimatedDuration: '1-2 weeks',
      maxParticipants: 25,
    },
  },

  // ============================================================================
  // RECURRING ADD-ONS
  // ============================================================================
  {
    name: 'Additional API Calls',
    slug: 'additional_api_calls',
    description: 'Additional API calls beyond your plan limits at $0.001 per call',
    category: 'usage_based',
    price: '0.001',
    billingCycle: 'monthly',
    unit: 'API_calls',
    quantity: 1,
    appliesToPlans: ['starter', 'professional'],
    displayOrder: 10,
    isVisible: true,
    isActive: true,
    metadata: {
      minimumQuantity: 1000,
      billedInIncrements: 1000,
      description: 'Billed monthly based on actual usage',
    },
  },
  {
    name: 'Additional Storage (100GB)',
    slug: 'additional_storage_100gb',
    description: 'Add 100GB of additional storage to your plan',
    category: 'recurring',
    price: '50.00',
    billingCycle: 'monthly',
    unit: 'GB',
    quantity: 100,
    appliesToPlans: ['starter', 'professional'],
    displayOrder: 11,
    isVisible: true,
    isActive: true,
    metadata: {
      incrementSize: 100,
      description: 'Includes secure cloud storage with automatic backups',
    },
  },
  {
    name: 'Premium Support Package',
    slug: 'premium_support',
    description: '24/7 phone and email support with guaranteed 1-hour response time',
    category: 'recurring',
    price: '500.00',
    billingCycle: 'monthly',
    unit: 'service',
    quantity: 1,
    appliesToPlans: ['starter', 'professional'],
    displayOrder: 12,
    isVisible: true,
    isActive: true,
    metadata: {
      features: [
        '24/7 phone and email support',
        '1-hour guaranteed response time',
        'Dedicated support channel',
        'Priority bug fixes',
        'Monthly check-in calls',
      ],
      description: 'Get enterprise-level support on any plan',
    },
  },

  // ============================================================================
  // LOCATION ADD-ONS
  // ============================================================================
  {
    name: 'Additional Locations (5-pack)',
    slug: 'additional_locations_5',
    description: 'Add 5 additional locations to your plan',
    category: 'recurring',
    price: '100.00',
    billingCycle: 'monthly',
    unit: 'locations',
    quantity: 5,
    appliesToPlans: ['starter', 'professional'],
    displayOrder: 20,
    isVisible: true,
    isActive: true,
    metadata: {
      incrementSize: 5,
      description: 'Each location gets full multi-location capabilities',
    },
  },
  {
    name: 'Additional Users (10-pack)',
    slug: 'additional_users_10',
    description: 'Add 10 additional users to your plan',
    category: 'recurring',
    price: '200.00',
    billingCycle: 'monthly',
    unit: 'users',
    quantity: 10,
    appliesToPlans: ['starter', 'professional'],
    displayOrder: 21,
    isVisible: true,
    isActive: true,
    metadata: {
      incrementSize: 10,
      description: 'Add more team members without upgrading your plan',
      perUserCost: 20,
    },
  },

  // ============================================================================
  // INTEGRATION ADD-ONS
  // ============================================================================
  {
    name: 'Custom Integration Development',
    slug: 'custom_integration',
    description:
      'Build a custom integration with your proprietary systems or third-party applications',
    category: 'one_time',
    price: '5000.00',
    billingCycle: 'one_time',
    unit: 'service',
    quantity: 1,
    appliesToPlans: ['professional', 'enterprise'],
    displayOrder: 30,
    isVisible: true,
    isActive: true,
    metadata: {
      features: [
        'Custom API integration development',
        'Testing and validation',
        'Documentation',
        '90-day support and maintenance',
      ],
      estimatedDuration: '6-8 weeks',
      requiresConsultation: true,
    },
  },
];

/**
 * Seed subscription add-ons
 */
export async function seedSubscriptionAddons() {
  log.info('🌱 Seeding subscription add-ons...');

  try {
    const insertedAddons = await db
      .insert(subscriptionAddons)
      .values(addons)
      .onConflictDoUpdate({
        target: subscriptionAddons.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          category: sql`excluded.category`,
          price: sql`excluded.price`,
          billingCycle: sql`excluded.billing_cycle`,
          unit: sql`excluded.unit`,
          quantity: sql`excluded.quantity`,
          appliesToPlans: sql`excluded.applies_to_plans`,
          displayOrder: sql`excluded.display_order`,
          isVisible: sql`excluded.is_visible`,
          isActive: sql`excluded.isActive`,
          metadata: sql`excluded.metadata`,
        },
      })
      .returning();

    log.info(`✅ Seeded ${insertedAddons.length} add-ons`);
    log.info('✅ Subscription add-ons seeding completed successfully!');
    return insertedAddons;
  } catch (error) {
    log.error('❌ Error seeding subscription add-ons:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedSubscriptionAddons()
    .then(() => {
      log.info('🎉 Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      log.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}
