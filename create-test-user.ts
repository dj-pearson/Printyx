/**
 * Create Test User Script
 * This script helps you create a test user account for login testing
 */

import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function createTestUser() {
  log('\n=== CREATE TEST USER ===\n', colors.cyan);

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    log('❌ ERROR: DATABASE_URL is not set!', colors.red);
    log('Please run: .\\setup-database-url.ps1', colors.yellow);
    process.exit(1);
  }

  // Get user details from command line or use defaults
  const email = process.argv[2] || 'admin@test.com';
  const password = process.argv[3] || 'Admin123!@#';
  const firstName = process.argv[4] || 'Admin';
  const lastName = process.argv[5] || 'User';

  log(`Creating user with email: ${email}`, colors.cyan);
  log(`Password: ${password}`, colors.yellow);
  log(`Name: ${firstName} ${lastName}`, colors.yellow);
  log('', colors.reset);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Check if user already exists
    log('Checking if user already exists...', colors.cyan);
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );

    if (existingUser.rows.length > 0) {
      log(`⚠ User already exists: ${email}`, colors.yellow);
      log(`User ID: ${existingUser.rows[0].id}`, colors.yellow);

      const updatePassword = process.argv.includes('--update-password');
      if (updatePassword) {
        log('\nUpdating password...', colors.cyan);
        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
          passwordHash,
          existingUser.rows[0].id,
        ]);

        log('✓ Password updated successfully!', colors.green);
        log(`\nYou can now log in with:`, colors.cyan);
        log(`  Email: ${email}`, colors.yellow);
        log(`  Password: ${password}`, colors.yellow);
      } else {
        log('\nTo update the password, run:', colors.yellow);
        log(`  npx tsx create-test-user.ts ${email} ${password} --update-password`, colors.yellow);
      }

      await pool.end();
      return;
    }

    // Check if we have any tenants
    log('Checking for tenants...', colors.cyan);
    const tenants = await pool.query('SELECT id, name FROM tenants LIMIT 1');

    let tenantId: string;
    if (tenants.rows.length === 0) {
      log('No tenants found. Creating default tenant...', colors.yellow);

      const newTenant = await pool.query(
        `INSERT INTO tenants (id, name, domain, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, name`,
        [randomUUID(), 'Test Company', 'test-company'],
      );

      tenantId = newTenant.rows[0].id;
      log(`✓ Created tenant: ${newTenant.rows[0].name} (${tenantId})`, colors.green);
    } else {
      tenantId = tenants.rows[0].id;
      log(`✓ Using existing tenant: ${tenants.rows[0].name} (${tenantId})`, colors.green);
    }

    // Hash password
    log('\nHashing password...', colors.cyan);
    const passwordHash = await bcrypt.hash(password, 10);
    log('✓ Password hashed', colors.green);

    // Create user
    log('\nCreating user...', colors.cyan);
    const userId = randomUUID();

    await pool.query(
      `INSERT INTO users (
        id, tenant_id, email, first_name, last_name, 
        password_hash, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
      [userId, tenantId, email, firstName, lastName, passwordHash],
    );

    log('✓ User created successfully!', colors.green);

    // Verify user was created
    const verifyUser = await pool.query(
      'SELECT id, email, first_name, last_name, tenant_id, is_active FROM users WHERE id = $1',
      [userId],
    );

    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      log('\n=== USER DETAILS ===', colors.cyan);
      log(`ID: ${user.id}`, colors.yellow);
      log(`Email: ${user.email}`, colors.yellow);
      log(`Name: ${user.first_name} ${user.last_name}`, colors.yellow);
      log(`Tenant ID: ${user.tenant_id}`, colors.yellow);
      log(`Active: ${user.is_active}`, colors.yellow);

      log('\n=== LOGIN CREDENTIALS ===', colors.cyan);
      log(`Email: ${email}`, colors.green);
      log(`Password: ${password}`, colors.green);

      log('\n✅ You can now log in with these credentials!', colors.green);
      log('\nNext steps:', colors.cyan);
      log('1. Start the server: npm run dev', colors.yellow);
      log('2. Navigate to: http://localhost:5000/login', colors.yellow);
      log('3. Enter the credentials above', colors.yellow);
    }
  } catch (error: any) {
    log('\n❌ ERROR creating user:', colors.red);
    console.error(error);

    if (error.code === 'ECONNREFUSED') {
      log('\nDatabase connection refused. Check:', colors.yellow);
      log('- DATABASE_URL is correct', colors.yellow);
      log('- Database server is running', colors.yellow);
      log('- Firewall allows connection', colors.yellow);
    } else if (error.code === '23505') {
      log('\nUser with this email already exists.', colors.yellow);
      log('Try a different email or use --update-password flag.', colors.yellow);
    } else if (error.code === '42P01') {
      log('\nUsers table does not exist!', colors.yellow);
      log('You need to import your database schema first.', colors.yellow);
    }
  } finally {
    await pool.end();
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('\n=== CREATE TEST USER - USAGE ===\n', colors.cyan);
  log('Create a new test user:', colors.yellow);
  log('  npx tsx create-test-user.ts [email] [password] [firstName] [lastName]', colors.yellow);
  log('', colors.reset);
  log('Examples:', colors.cyan);
  log('  npx tsx create-test-user.ts', colors.yellow);
  log('  npx tsx create-test-user.ts admin@example.com MyPassword123!', colors.yellow);
  log('  npx tsx create-test-user.ts admin@example.com MyPassword123! John Doe', colors.yellow);
  log('', colors.reset);
  log('Update password for existing user:', colors.cyan);
  log(
    '  npx tsx create-test-user.ts admin@example.com NewPassword123! --update-password',
    colors.yellow,
  );
  log('', colors.reset);
  log('Defaults:', colors.cyan);
  log('  Email: admin@test.com', colors.yellow);
  log('  Password: Admin123!@#', colors.yellow);
  log('  First Name: Admin', colors.yellow);
  log('  Last Name: User', colors.yellow);
  log('', colors.reset);
  process.exit(0);
}

// Run
createTestUser().catch((error) => {
  log('\n❌ FATAL ERROR:', colors.red);
  console.error(error);
  process.exit(1);
});
