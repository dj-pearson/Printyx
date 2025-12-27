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
import { subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
  console.log('============================================');
  console.log('  Updating Subscription Plans with Stripe IDs');
  console.log('============================================\n');

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const config of stripeConfigs) {
    console.log(`\nProcessing ${config.slug} plan...`);

    const productId = process.env[config.productEnvVar];
    const monthlyPriceId = process.env[config.monthlyPriceEnvVar];
    const annualPriceId = process.env[config.annualPriceEnvVar];

    // Check if any IDs are missing
    const missingVars: string[] = [];
    if (!productId) missingVars.push(config.productEnvVar);
    if (!monthlyPriceId) missingVars.push(config.monthlyPriceEnvVar);
    if (!annualPriceId) missingVars.push(config.annualPriceEnvVar);

    if (missingVars.length > 0) {
      console.log(`  ⚠️  Missing environment variables: ${missingVars.join(', ')}`);
      skippedCount++;
      continue;
    }

    try {
      // Check if plan exists
      const existingPlan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.slug, config.slug),
      });

      if (!existingPlan) {
        console.log(`  ⚠️  Plan with slug '${config.slug}' not found in database`);
        console.log(`  Run: npx tsx server/seed-subscription-plans.ts first`);
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

      console.log(`  ✅ Updated ${config.slug} plan:`);
      console.log(`     Product ID: ${productId}`);
      console.log(`     Monthly Price ID: ${monthlyPriceId}`);
      console.log(`     Annual Price ID: ${annualPriceId}`);
      updatedCount++;
    } catch (error) {
      console.error(`  ❌ Error updating ${config.slug} plan:`, error);
      errorCount++;
    }
  }

  console.log('\n============================================');
  console.log('  Summary');
  console.log('============================================');
  console.log(`  ✅ Updated: ${updatedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('');

  if (skippedCount > 0) {
    console.log('To complete setup:');
    console.log('1. Run the Stripe setup script to create products');
    console.log('2. Copy the generated IDs to your .env file');
    console.log('3. Run this script again');
    console.log('');
  }

  // Verify current state
  console.log('\n--- Current Plan Configuration ---\n');

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

    console.log(`${status} ${plan.name} (${plan.slug})`);
    console.log(`   Monthly: $${plan.monthlyPrice}/month`);
    console.log(`   Annual: $${plan.annualPrice}/year`);

    if (hasStripe) {
      console.log(`   Stripe Product: ${plan.stripeProductId}`);
      console.log(`   Stripe Monthly: ${plan.stripePriceIdMonthly}`);
      console.log(`   Stripe Annual: ${plan.stripePriceIdAnnual}`);
    } else {
      console.log(`   Stripe: Not configured`);
    }
    console.log('');
  }
}

// Run the update
updateStripeIds()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
