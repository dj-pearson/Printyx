/**
 * Authentication System Diagnostic Script
 * This script tests the authentication setup after database switch
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { users } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

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

async function runDiagnostics() {
  log('\n=== AUTHENTICATION SYSTEM DIAGNOSTICS ===\n', colors.cyan);

  // 1. Check DATABASE_URL
  log('1. Checking DATABASE_URL configuration...', colors.cyan);
  if (!process.env.DATABASE_URL) {
    log('   ❌ ERROR: DATABASE_URL is not set!', colors.red);
    log('   Please set DATABASE_URL in your .env file or environment variables.', colors.yellow);
    process.exit(1);
  }
  log(`   ✓ DATABASE_URL is set: ${process.env.DATABASE_URL.substring(0, 30)}...`, colors.green);

  // 2. Test database connection
  log('\n2. Testing database connection...', colors.cyan);
  let pool: Pool;
  let db: any;

  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool });

    // Test basic query
    const result = await pool.query('SELECT NOW() as now');
    log(`   ✓ Database connected successfully at ${result.rows[0].now}`, colors.green);
  } catch (error: any) {
    log('   ❌ ERROR: Cannot connect to database!', colors.red);
    log(`   ${error.message}`, colors.red);
    process.exit(1);
  }

  // 3. Check if sessions table exists
  log('\n3. Checking sessions table...', colors.cyan);
  try {
    const sessionsCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sessions')",
    );
    if (sessionsCheck.rows[0].exists) {
      log('   ✓ Sessions table exists', colors.green);

      // Check sessions count
      const sessionCount = await pool.query('SELECT COUNT(*) FROM sessions');
      log(`   ℹ Found ${sessionCount.rows[0].count} active sessions`, colors.yellow);
    } else {
      log('   ❌ Sessions table does not exist!', colors.red);
      log('   Creating sessions table...', colors.yellow);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)');
      log('   ✓ Sessions table created', colors.green);
    }
  } catch (error: any) {
    log('   ❌ ERROR checking sessions table:', colors.red);
    log(`   ${error.message}`, colors.red);
  }

  // 4. Check users table
  log('\n4. Checking users table...', colors.cyan);
  try {
    const usersCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')",
    );
    if (usersCheck.rows[0].exists) {
      log('   ✓ Users table exists', colors.green);

      // Get user count
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      log(`   ℹ Found ${userCount.rows[0].count} users in database`, colors.yellow);

      // Check for users with passwords
      const usersWithPasswords = await pool.query(
        'SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL',
      );
      log(`   ℹ ${usersWithPasswords.rows[0].count} users have passwords set`, colors.yellow);

      // List first few users (without sensitive data)
      const sampleUsers = await pool.query(
        'SELECT id, email, first_name, last_name, tenant_id, is_active, last_login_at FROM users LIMIT 5',
      );
      log('\n   Sample users:', colors.yellow);
      sampleUsers.rows.forEach((user: any) => {
        log(
          `     - ${user.email} (${user.first_name} ${user.last_name}) - Active: ${user.is_active}`,
          colors.yellow,
        );
        log(`       ID: ${user.id}, Tenant: ${user.tenant_id || 'none'}`, colors.yellow);
        log(`       Last login: ${user.last_login_at || 'never'}`, colors.yellow);
      });
    } else {
      log('   ❌ Users table does not exist!', colors.red);
      log('   This is a critical error - the users table must exist.', colors.red);
    }
  } catch (error: any) {
    log('   ❌ ERROR checking users table:', colors.red);
    log(`   ${error.message}`, colors.red);
  }

  // 5. Check user schema columns
  log('\n5. Verifying users table schema...', colors.cyan);
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    const requiredColumns = [
      'id',
      'email',
      'password_hash',
      'first_name',
      'last_name',
      'tenant_id',
    ];
    const foundColumns = columns.rows.map((row: any) => row.column_name);

    log('   Required columns check:', colors.yellow);
    requiredColumns.forEach((col) => {
      if (foundColumns.includes(col)) {
        log(`     ✓ ${col} exists`, colors.green);
      } else {
        log(`     ❌ ${col} is missing!`, colors.red);
      }
    });
  } catch (error: any) {
    log('   ❌ ERROR checking schema:', colors.red);
    log(`   ${error.message}`, colors.red);
  }

  // 6. Test password hashing
  log('\n6. Testing password hashing...', colors.cyan);
  try {
    const testPassword = 'TestPassword123!';
    const hash = await bcrypt.hash(testPassword, 10);
    const isValid = await bcrypt.compare(testPassword, hash);

    if (isValid) {
      log('   ✓ Password hashing and comparison works correctly', colors.green);
    } else {
      log('   ❌ Password comparison failed!', colors.red);
    }
  } catch (error: any) {
    log('   ❌ ERROR with password hashing:', colors.red);
    log(`   ${error.message}`, colors.red);
  }

  // 7. Test authentication for a specific user (if provided)
  if (process.argv[2]) {
    const testEmail = process.argv[2];
    log(`\n7. Testing authentication for: ${testEmail}`, colors.cyan);

    try {
      const userResult = await pool.query(
        'SELECT id, email, password_hash, first_name, last_name, is_active, tenant_id FROM users WHERE LOWER(email) = LOWER($1)',
        [testEmail],
      );

      if (userResult.rows.length === 0) {
        log(`   ❌ User not found: ${testEmail}`, colors.red);
      } else {
        const user = userResult.rows[0];
        log(`   ✓ User found: ${user.email}`, colors.green);
        log(`     - ID: ${user.id}`, colors.yellow);
        log(`     - Name: ${user.first_name} ${user.last_name}`, colors.yellow);
        log(`     - Tenant: ${user.tenant_id || 'none'}`, colors.yellow);
        log(`     - Active: ${user.is_active}`, colors.yellow);

        if (!user.password_hash) {
          log(`     ❌ No password hash set for this user!`, colors.red);
          log(`        This user cannot log in until a password is set.`, colors.yellow);
        } else {
          log(`     ✓ Password hash exists`, colors.green);

          if (process.argv[3]) {
            const testPassword = process.argv[3];
            log(`     Testing password...`, colors.yellow);
            const passwordValid = await bcrypt.compare(testPassword, user.password_hash);

            if (passwordValid) {
              log(`     ✓ Password is CORRECT!`, colors.green);
            } else {
              log(`     ❌ Password is INCORRECT!`, colors.red);
            }
          }
        }
      }
    } catch (error: any) {
      log('   ❌ ERROR testing authentication:', colors.red);
      log(`   ${error.message}`, colors.red);
    }
  }

  // 8. Environment variable check
  log('\n8. Checking other required environment variables...', colors.cyan);
  const requiredVars = ['SESSION_SECRET', 'NODE_ENV'];
  const optionalVars = ['TEST_MODE', 'DEMO_TENANT_ID'];

  log('   Required:', colors.yellow);
  requiredVars.forEach((varName) => {
    if (process.env[varName]) {
      log(`     ✓ ${varName} is set`, colors.green);
    } else {
      log(`     ⚠ ${varName} is not set (will use defaults)`, colors.yellow);
    }
  });

  log('   Optional:', colors.yellow);
  optionalVars.forEach((varName) => {
    if (process.env[varName]) {
      log(`     ✓ ${varName}: ${process.env[varName]}`, colors.green);
    } else {
      log(`     - ${varName} is not set`, colors.yellow);
    }
  });

  // Cleanup
  await pool.end();

  log('\n=== DIAGNOSTICS COMPLETE ===\n', colors.cyan);
  log('Usage: tsx test-auth-connection.ts [email] [password]', colors.yellow);
  log('  - Run without arguments to check database connectivity', colors.yellow);
  log('  - Provide email to check if user exists', colors.yellow);
  log('  - Provide both email and password to test authentication', colors.yellow);
}

// Run diagnostics
runDiagnostics().catch((error) => {
  log('\n❌ FATAL ERROR:', colors.red);
  console.error(error);
  process.exit(1);
});
