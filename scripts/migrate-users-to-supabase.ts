/**
 * User Migration Script: Legacy Auth to Supabase Auth
 *
 * This script migrates existing users from the legacy Express/Neon auth
 * to Supabase Auth (GoTrue). Since bcrypt hashes cannot be migrated directly,
 * users will need to reset their passwords.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase.ts [--dry-run] [--batch-size=50]
 *
 * Options:
 *   --dry-run       Preview changes without making them
 *   --batch-size=N  Number of users to process per batch (default: 50)
 *   --skip-emails   Don't send password reset emails (for testing)
 *
 * Required Environment Variables:
 *   DATABASE_URL           - Legacy Neon PostgreSQL connection string
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_KEY   - Supabase service role key
 *   SITE_URL               - Frontend URL for password reset links
 */

import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipEmails = args.includes('--skip-emails');
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;

// Validate environment variables
const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize clients
const legacyDb = postgres(process.env.DATABASE_URL!);
const db = drizzle(legacyDb);

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Migration statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: 0,
  emailsSent: 0,
};

// Error log
const errors: Array<{ email: string; error: string }> = [];

interface LegacyUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  tenant_id: string;
  role_id: string | null;
  access_scope: string | null;
  status: string | null;
  is_tenant_admin: boolean | null;
  created_at: Date | null;
}

async function fetchLegacyUsers(): Promise<LegacyUser[]> {
  console.log('Fetching users from legacy database...');

  const result = await legacyDb`
    SELECT
      id,
      email,
      first_name,
      last_name,
      phone,
      tenant_id,
      role_id,
      access_scope,
      status,
      is_tenant_admin,
      created_at
    FROM users
    WHERE email IS NOT NULL
    ORDER BY created_at ASC
  `;

  return result as LegacyUser[];
}

async function checkUserExistsInSupabase(email: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (error) {
    console.error(`Error checking user existence: ${error.message}`);
    return false;
  }

  // Search for specific user
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  return users?.users.some((u) => u.email === email) ?? false;
}

async function migrateUser(user: LegacyUser): Promise<boolean> {
  try {
    // Check if user already exists in Supabase
    const exists = await checkUserExistsInSupabase(user.email);
    if (exists) {
      console.log(`  Skipping ${user.email} - already exists in Supabase`);
      stats.skipped++;
      return true;
    }

    if (isDryRun) {
      console.log(`  [DRY RUN] Would migrate: ${user.email}`);
      stats.migrated++;
      return true;
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      email_confirm: true, // Mark as confirmed since they had a verified account
      user_metadata: {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        phone: user.phone || null,
        migrated_from_legacy: true,
        legacy_user_id: user.id,
      },
      app_metadata: {
        tenantId: user.tenant_id,
        roleId: user.role_id || null,
        accessScope: user.access_scope || 'own',
        isPlatformUser: false,
        isTenantAdmin: user.is_tenant_admin || false,
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    console.log(`  Migrated: ${user.email} (Supabase ID: ${authData.user.id})`);

    // Update the legacy user record with the new Supabase ID
    // This allows us to link records during the transition period
    await legacyDb`
      UPDATE users
      SET
        supabase_user_id = ${authData.user.id},
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Send password reset email (unless skipped)
    if (!skipEmails) {
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${process.env.SITE_URL || 'https://printyx.net'}/reset-password`,
        },
      });

      if (resetError) {
        console.warn(
          `  Warning: Failed to send password reset email to ${user.email}: ${resetError.message}`,
        );
      } else {
        stats.emailsSent++;
        console.log(`  Password reset email sent to: ${user.email}`);
      }
    }

    stats.migrated++;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  Error migrating ${user.email}: ${errorMessage}`);
    errors.push({ email: user.email, error: errorMessage });
    stats.errors++;
    return false;
  }
}

async function addSupabaseUserIdColumn(): Promise<void> {
  // Check if column exists
  const result = await legacyDb`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'supabase_user_id'
  `;

  if (result.length === 0) {
    console.log('Adding supabase_user_id column to users table...');

    if (!isDryRun) {
      await legacyDb`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS supabase_user_id UUID
      `;
      console.log('Column added successfully.');
    } else {
      console.log('[DRY RUN] Would add supabase_user_id column');
    }
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Printyx User Migration: Legacy Auth -> Supabase Auth');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Send Reset Emails: ${skipEmails ? 'No' : 'Yes'}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Add tracking column to legacy database
    await addSupabaseUserIdColumn();

    // Fetch all legacy users
    const users = await fetchLegacyUsers();
    stats.total = users.length;

    console.log(`Found ${stats.total} users to migrate`);
    console.log('');

    // Process users in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(users.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);

      for (const user of batch) {
        await migrateUser(user);
      }

      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total Users:     ${stats.total}`);
    console.log(`Migrated:        ${stats.migrated}`);
    console.log(`Skipped:         ${stats.skipped}`);
    console.log(`Errors:          ${stats.errors}`);
    console.log(`Emails Sent:     ${stats.emailsSent}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const err of errors) {
        console.log(`  - ${err.email}: ${err.error}`);
      }
    }

    if (isDryRun) {
      console.log('');
      console.log('This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to perform the actual migration.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await legacyDb.end();
  }
}

main();
