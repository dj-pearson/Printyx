/**
 * Printyx Stripe Products Setup Script (Node.js)
 * ============================================================================
 * This script creates all subscription products, prices, and payment links
 * in your Stripe account using the Stripe Node.js SDK.
 *
 * Prerequisites:
 *   1. Set STRIPE_SECRET_KEY in your .env file
 *   2. Run: npx tsx scripts/setup-stripe-products.ts
 *
 * Options:
 *   --live    Use live mode (default is test mode)
 *   --dry-run Show what would be created without making API calls
 * ============================================================================
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live');
const isDryRun = args.includes('--dry-run');

// Load environment variables
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Get Stripe key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && !isDryRun) {
  console.error('Error: STRIPE_SECRET_KEY not found in environment');
  console.error('Set it in your .env file or as an environment variable');
  process.exit(1);
}

// Check if using test or live key
if (stripeSecretKey && !isDryRun) {
  const isTestKey = stripeSecretKey.startsWith('sk_test_');
  const isLiveKey = stripeSecretKey.startsWith('sk_live_');

  if (isLiveMode && !isLiveKey) {
    console.error('Error: --live flag specified but STRIPE_SECRET_KEY is a test key');
    process.exit(1);
  }

  if (!isLiveMode && isLiveKey) {
    console.warn('Warning: Using a live key without --live flag');
    console.warn('Products will be created in LIVE mode!');
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question('Type "CONFIRM" to proceed: ', (answer: string) => {
        rl.close();
        if (answer !== 'CONFIRM') {
          console.log('Aborted.');
          process.exit(1);
        }
        resolve();
      });
    });
  }
}

// Initialize Stripe
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })
  : null;

// Types
interface PlanConfig {
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number; // in cents
  annualPrice: number; // in cents
  metadata: Record<string, string>;
}

interface CreatedPlan {
  productId: string;
  monthlyPriceId: string;
  annualPriceId: string;
  monthlyPaymentLink: string;
  annualPaymentLink: string;
}

// Plan configurations
const plans: PlanConfig[] = [
  {
    name: 'Printyx Starter',
    slug: 'starter',
    description:
      'Perfect for small copier dealers (5-20 employees) with core contract management and meter billing',
    monthlyPrice: 7900, // $79.00
    annualPrice: 75800, // $758.00
    metadata: {
      tier: 'starter',
      maxUsers: '20',
      maxLocations: '3',
      maxStorage: '100',
      trialDays: '30',
    },
  },
  {
    name: 'Printyx Professional',
    slug: 'professional',
    description:
      'For growing copier dealers (20-100 employees) with service dispatch, mobile app, and advanced inventory',
    monthlyPrice: 9900, // $99.00
    annualPrice: 95000, // $950.00
    metadata: {
      tier: 'professional',
      maxUsers: '100',
      maxLocations: '10',
      popular: 'true',
      trialDays: '30',
    },
  },
  {
    name: 'Printyx Enterprise',
    slug: 'enterprise',
    description:
      'For large copier dealers (100+ employees) with dedicated account manager, API access, and SLA guarantees',
    monthlyPrice: 14900, // $149.00
    annualPrice: 143000, // $1,430.00
    metadata: {
      tier: 'enterprise',
      maxUsers: 'unlimited',
      maxLocations: 'unlimited',
      sla: 'true',
      dedicatedSupport: 'true',
      trialDays: '30',
    },
  },
];

// Helper function to format currency
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Create a product
async function createProduct(plan: PlanConfig): Promise<string> {
  if (isDryRun) {
    console.log(`  [DRY RUN] Would create product: ${plan.name}`);
    return `prod_dry_run_${plan.slug}`;
  }

  if (!stripe) throw new Error('Stripe not initialized');

  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: plan.metadata,
  });

  return product.id;
}

// Create a price
async function createPrice(
  productId: string,
  amount: number,
  interval: 'month' | 'year',
  plan: PlanConfig,
): Promise<string> {
  if (isDryRun) {
    console.log(
      `  [DRY RUN] Would create ${interval}ly price: ${formatCurrency(amount)}/${interval}`,
    );
    return `price_dry_run_${plan.slug}_${interval}`;
  }

  if (!stripe) throw new Error('Stripe not initialized');

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: 'usd',
    recurring: {
      interval: interval,
    },
    nickname: `${plan.name} ${interval === 'month' ? 'Monthly' : 'Annual'}`,
    metadata: {
      plan: plan.slug,
      billing: interval === 'month' ? 'monthly' : 'annual',
      discount: interval === 'year' ? '20%' : '0%',
    },
  });

  return price.id;
}

// Create a payment link
async function createPaymentLink(
  priceId: string,
  plan: PlanConfig,
  billing: string,
): Promise<string> {
  if (isDryRun) {
    console.log(`  [DRY RUN] Would create payment link for ${plan.slug} ${billing}`);
    return `https://pay.stripe.com/dry_run_${plan.slug}_${billing}`;
  }

  if (!stripe) throw new Error('Stripe not initialized');

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    metadata: {
      plan: plan.slug,
      billing: billing,
    },
  });

  return paymentLink.url;
}

// Main setup function
async function setupStripeProducts(): Promise<void> {
  const modeLabel = isDryRun ? 'DRY RUN' : isLiveMode ? 'LIVE' : 'TEST';

  console.log('============================================');
  console.log('  Printyx Stripe Products Setup');
  console.log(`  Mode: ${modeLabel}`);
  console.log('============================================\n');

  const results: Record<string, CreatedPlan> = {};
  let stepNum = 1;
  const totalSteps = plans.length * 3; // product + 2 prices for each plan, then payment links

  for (const plan of plans) {
    console.log(`\n[${stepNum}/${totalSteps}] Creating ${plan.name} product...`);

    // Create product
    const productId = await createProduct(plan);
    console.log(`  Product ID: ${productId}`);
    stepNum++;

    console.log(`\n[${stepNum}/${totalSteps}] Creating ${plan.name} prices...`);

    // Create monthly price
    const monthlyPriceId = await createPrice(productId, plan.monthlyPrice, 'month', plan);
    console.log(`  Monthly Price: ${monthlyPriceId} (${formatCurrency(plan.monthlyPrice)}/month)`);

    // Create annual price
    const annualPriceId = await createPrice(productId, plan.annualPrice, 'year', plan);
    console.log(`  Annual Price: ${annualPriceId} (${formatCurrency(plan.annualPrice)}/year)`);
    stepNum++;

    console.log(`\n[${stepNum}/${totalSteps}] Creating ${plan.name} payment links...`);

    // Create payment links
    const monthlyPaymentLink = await createPaymentLink(monthlyPriceId, plan, 'monthly');
    console.log(`  Monthly Link: ${monthlyPaymentLink}`);

    const annualPaymentLink = await createPaymentLink(annualPriceId, plan, 'annual');
    console.log(`  Annual Link: ${annualPaymentLink}`);
    stepNum++;

    results[plan.slug] = {
      productId,
      monthlyPriceId,
      annualPriceId,
      monthlyPaymentLink,
      annualPaymentLink,
    };
  }

  // Output summary
  console.log('\n============================================');
  console.log('  Setup Complete!');
  console.log('============================================');

  console.log('\n--- Environment Variables (.env) ---\n');

  const envVars = `
# Stripe Product & Price IDs (Auto-generated)
# Generated: ${new Date().toISOString()}
# Mode: ${modeLabel}

# Starter Plan (${formatCurrency(plans[0].monthlyPrice)}/month, ${formatCurrency(plans[0].annualPrice)}/year)
STRIPE_STARTER_PRODUCT_ID=${results.starter.productId}
STRIPE_STARTER_PRICE_MONTHLY=${results.starter.monthlyPriceId}
STRIPE_STARTER_PRICE_ANNUAL=${results.starter.annualPriceId}

# Professional Plan (${formatCurrency(plans[1].monthlyPrice)}/month, ${formatCurrency(plans[1].annualPrice)}/year)
STRIPE_PROFESSIONAL_PRODUCT_ID=${results.professional.productId}
STRIPE_PROFESSIONAL_PRICE_MONTHLY=${results.professional.monthlyPriceId}
STRIPE_PROFESSIONAL_PRICE_ANNUAL=${results.professional.annualPriceId}

# Enterprise Plan (${formatCurrency(plans[2].monthlyPrice)}/month, ${formatCurrency(plans[2].annualPrice)}/year)
STRIPE_ENTERPRISE_PRODUCT_ID=${results.enterprise.productId}
STRIPE_ENTERPRISE_PRICE_MONTHLY=${results.enterprise.monthlyPriceId}
STRIPE_ENTERPRISE_PRICE_ANNUAL=${results.enterprise.annualPriceId}
`;

  console.log(envVars);

  console.log('--- Payment Links ---\n');

  const paymentLinksConfig = `
# Starter Plan Payment Links
STRIPE_STARTER_LINK_MONTHLY=${results.starter.monthlyPaymentLink}
STRIPE_STARTER_LINK_ANNUAL=${results.starter.annualPaymentLink}

# Professional Plan Payment Links
STRIPE_PROFESSIONAL_LINK_MONTHLY=${results.professional.monthlyPaymentLink}
STRIPE_PROFESSIONAL_LINK_ANNUAL=${results.professional.annualPaymentLink}

# Enterprise Plan Payment Links
STRIPE_ENTERPRISE_LINK_MONTHLY=${results.enterprise.monthlyPaymentLink}
STRIPE_ENTERPRISE_LINK_ANNUAL=${results.enterprise.annualPaymentLink}
`;

  console.log(paymentLinksConfig);

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `stripe-products-config-${timestamp}.txt`;
  const outputContent = `# Printyx Stripe Configuration
# Generated: ${new Date().toISOString()}
# Mode: ${modeLabel}
${envVars}
${paymentLinksConfig}
`;

  fs.writeFileSync(outputFile, outputContent);
  console.log(`\nConfiguration saved to: ${outputFile}`);

  console.log('\n--- Next Steps ---');
  console.log('1. Copy the environment variables above to your .env file');
  console.log('2. Run: npm run db:push (to update database schema if needed)');
  console.log('3. Run: npx tsx server/update-stripe-ids.ts (to update plan records in database)');
  console.log('4. Configure Stripe webhook endpoint at: https://dashboard.stripe.com/webhooks');
  console.log('   Webhook URL: https://your-domain.com/api/webhooks/stripe');
  console.log('');
}

// Run the setup
setupStripeProducts()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during setup:', error);
    process.exit(1);
  });
