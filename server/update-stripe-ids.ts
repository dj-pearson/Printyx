/**
 * Update Subscription Plans with Stripe IDs
 * ============================================================================
 * This script updates the subscription_plans table with Stripe product and
 * price IDs from environment variables.
 *
 * Run after setting up Stripe products:
 *   npx tsx server/update-stripe-ids.ts
 * ============================================================================
 */

import { db } from './db';
import { subscriptionPlans } from '@shared/schema-subscriptions';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('update-stripe-ids');

interface StripeConfig {
  slug: string;
  productEnvVar: string;
  monthlyPriceEnvVar: string;
  annualPriceEnvVar: string;
}

const stripeConfigs: StripeConfig[] = [
  {
    slug: 'starter',
    productEnvVar: 'STRIPE_STARTER_PRODUCT_ID',
    monthlyPriceEnvVar: 'STRIPE_STARTER_PRICE_MONTHLY',
    annualPriceEnvVar: 'STRIPE_STARTER_PRICE_ANNUAL',
  },
  {
    slug: 'professional',
    productEnvVar: 'STRIPE_PROFESSIONAL_PRODUCT_ID',
    monthlyPriceEnvVar: 'STRIPE_PROFESSIONAL_PRICE_MONTHLY',
    annualPriceEnvVar: 'STRIPE_PROFESSIONAL_PRICE_ANNUAL',
  },
  {
    slug: 'enterprise',
    productEnvVar: 'STRIPE_ENTERPRISE_PRODUCT_ID',
    monthlyPriceEnvVar: 'STRIPE_ENTERPRISE_PRICE_MONTHLY',
    annualPriceEnvVar: 'STRIPE_ENTERPRISE_PRICE_ANNUAL',
  },
];

async function updateStripeIds(): Promise<void> {
  log.info('============================================');
  log.info('  Updating Subscription Plans with Stripe IDs');
  log.info('============================================\n');

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const config of stripeConfigs) {
    log.info(`\nProcessing ${config.slug} plan...`);

    const productId = process.env[config.productEnvVar];
    const monthlyPriceId = process.env[config.monthlyPriceEnvVar];
    const annualPriceId = process.env[config.annualPriceEnvVar];

    // Check if any IDs are missing
    const missingVars: string[] = [];
    if (!productId) missingVars.push(config.productEnvVar);
    if (!monthlyPriceId) missingVars.push(config.monthlyPriceEnvVar);
    if (!annualPriceId) missingVars.push(config.annualPriceEnvVar);

    if (missingVars.length > 0) {
      log.info(`  ⚠️  Missing environment variables: ${missingVars.join(', ')}`);
      skippedCount++;
      continue;
    }

    try {
      // Check if plan exists
      const existingPlan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.slug, config.slug),
      });

      if (!existingPlan) {
        log.info(`  ⚠️  Plan with slug '${config.slug}' not found in database`);
        log.info(`  Run: npx tsx server/seed-subscription-plans.ts first`);
        skippedCount++;
        continue;
      }

      // Update the plan with Stripe IDs
      await db
        .update(subscriptionPlans)
        .set({
          stripeProductId: productId,
          stripePriceIdMonthly: monthlyPriceId,
          stripePriceIdAnnual: annualPriceId,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.slug, config.slug));

      log.info(`  ✅ Updated ${config.slug} plan:`);
      log.info(`     Product ID: ${productId}`);
      log.info(`     Monthly Price ID: ${monthlyPriceId}`);
      log.info(`     Annual Price ID: ${annualPriceId}`);
      updatedCount++;
    } catch (error) {
      log.error(`  ❌ Error updating ${config.slug} plan:`, error);
      errorCount++;
    }
  }

  log.info('\n============================================');
  log.info('  Summary');
  log.info('============================================');
  log.info(`  ✅ Updated: ${updatedCount}`);
  log.info(`  ⚠️  Skipped: ${skippedCount}`);
  log.info(`  ❌ Errors: ${errorCount}`);
  log.info('');

  if (skippedCount > 0) {
    log.info('To complete setup:');
    log.info('1. Run the Stripe setup script to create products');
    log.info('2. Copy the generated IDs to your .env file');
    log.info('3. Run this script again');
    log.info('');
  }

  // Verify current state
  log.info('\n--- Current Plan Configuration ---\n');

  const allPlans = await db.query.subscriptionPlans.findMany({
    columns: {
      name: true,
      slug: true,
      monthlyPrice: true,
      annualPrice: true,
      stripeProductId: true,
      stripePriceIdMonthly: true,
      stripePriceIdAnnual: true,
    },
    orderBy: (plans, { asc }) => [asc(plans.displayOrder)],
  });

  for (const plan of allPlans) {
    const hasStripe = plan.stripeProductId && plan.stripePriceIdMonthly && plan.stripePriceIdAnnual;
    const status = hasStripe ? '✅' : '⚠️';

    log.info(`${status} ${plan.name} (${plan.slug})`);
    log.info(`   Monthly: $${plan.monthlyPrice}/month`);
    log.info(`   Annual: $${plan.annualPrice}/year`);

    if (hasStripe) {
      log.info(`   Stripe Product: ${plan.stripeProductId}`);
      log.info(`   Stripe Monthly: ${plan.stripePriceIdMonthly}`);
      log.info(`   Stripe Annual: ${plan.stripePriceIdAnnual}`);
    } else {
      log.info(`   Stripe: Not configured`);
    }
    log.info('');
  }
}

// Run the update
updateStripeIds()
  .then(() => {
    log.info('Done!');
    process.exit(0);
  })
  .catch((error) => {
    log.error('Error:', error);
    process.exit(1);
  });
