/**
 * MASTER DEMO DATA SEEDER
 *
 * Run with: npm run seed:demo   (add -- --force to re-seed a tenant)
 *
 * Looks up DEMO_USER from .env to find the existing demo user and their tenant,
 * then runs the shared demo data set in server/seeds/demo-data.ts. That module is
 * the single copy: the admin seed endpoint (POST /api/admin/seed/demo) runs the
 * same code against the caller's tenant.
 */
import 'dotenv/config';
import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { users } from '../../shared/schema';
import { demoDataExists, seedDemoData } from './demo-data';

const log = createModuleLogger('seed-all-demo-data');

const DEMO_USER_EMAIL = process.env.DEMO_USER;

async function main() {
  log.info('🚀 Starting Demo Data Seeder...\n');
  log.info('='.repeat(60));

  if (!DEMO_USER_EMAIL) {
    log.error('❌ DEMO_USER is not set. Add it to .env and try again.');
    process.exit(1);
  }

  const [demoUser] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, DEMO_USER_EMAIL.toLowerCase()));

  if (!demoUser?.tenantId) {
    log.error(`❌ Demo user not found, or has no tenant: ${DEMO_USER_EMAIL}`);
    log.error('   Check that the user exists and that .env has DEMO_USER set correctly.');
    process.exit(1);
  }

  const displayName =
    [demoUser.firstName, demoUser.lastName].filter(Boolean).join(' ') || demoUser.email;
  log.info(`✅ Found demo user: ${displayName}`);
  log.info(`   User ID: ${demoUser.id}`);
  log.info(`   Tenant ID: ${demoUser.tenantId}`);

  const force = process.argv.includes('--force');
  if ((await demoDataExists(demoUser.tenantId)) && !force) {
    log.info('\n⚠️  Demo data already exists for this tenant. Skipping to prevent duplicates.');
    log.info('   To re-seed, run with --force: npm run seed:demo -- --force\n');
    process.exit(0);
  }
  if (force) log.info('\n⚡ Force flag detected - proceeding with seeding...');

  const results = await seedDemoData({ tenantId: demoUser.tenantId, userId: demoUser.id });

  log.info('\n' + '='.repeat(60));
  log.info('✅ Demo data seeding completed successfully!\n');
  log.info('📊 Summary:');
  for (const [entity, count] of Object.entries(results)) {
    log.info(`   • ${count} ${entity}`);
  }
  log.info('\n🔐 Demo User:');
  log.info(`   Email: ${DEMO_USER_EMAIL}`);
  log.info(`   Tenant ID: ${demoUser.tenantId}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('\n❌ Error seeding demo data:', error);
    process.exit(1);
  });
