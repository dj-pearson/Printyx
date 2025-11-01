import { db } from "./db";
import { users, mfaBackupCodes, mfaAuditLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";

function generateTOTPSecret(): string {
  // Generate a random base32-encoded secret (20 bytes = 32 base32 chars)
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

async function generateBackupCode(): Promise<{ code: string; hash: string }> {
  // Generate a random 8-character alphanumeric code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const hash = await bcrypt.hash(code, 10);
  return { code, hash };
}

async function seedMfaData() {
  console.log("🔐 Seeding MFA data...");

  try {
    // Clean up existing MFA test data first
    console.log("Cleaning up existing MFA test data...");
    
    // Get test users - try to find any user to enable MFA on
    const testUsers = await db
      .select()
      .from(users)
      .limit(1);

    if (testUsers.length === 0) {
      console.log("⚠️  No users found in database. Skipping MFA seed.");
      return;
    }

    const testUser = testUsers[0];

    // Delete existing backup codes for test users
    await db
      .delete(mfaBackupCodes)
      .where(eq(mfaBackupCodes.userId, testUser.id));

    // Delete existing audit logs for test users
    await db
      .delete(mfaAuditLogs)
      .where(eq(mfaAuditLogs.userId, testUser.id));

    console.log("✓ Cleaned up existing MFA data");

    // 1. Enable MFA for admin user
    const mfaSecret = generateTOTPSecret();
    
    await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: mfaSecret,
        updatedAt: new Date(),
      })
      .where(eq(users.id, testUser.id));

    console.log(`✓ Enabled MFA for user: ${testUser.email}`);
    console.log(`  TOTP Secret: ${mfaSecret}`);
    console.log(`  otpauth://totp/Printyx:${testUser.email}?secret=${mfaSecret}&issuer=Printyx`);

    // 2. Generate backup codes
    const backupCodes: { code: string; hash: string }[] = [];
    
    for (let i = 0; i < 10; i++) {
      const { code, hash } = await generateBackupCode();
      backupCodes.push({ code, hash });
    }

    await db.insert(mfaBackupCodes).values(
      backupCodes.map(({ hash }) => ({
        userId: testUser.id,
        tenantId: testUser.tenantId,
        codeHash: hash,
        isUsed: false,
      }))
    );

    console.log(`✓ Generated 10 backup codes for ${testUser.email}:`);
    backupCodes.forEach((bc, idx) => {
      console.log(`  ${idx + 1}. ${bc.code}`);
    });

    // 3. Use one backup code to test the used state
    const usedBackupCodes = await db
      .select()
      .from(mfaBackupCodes)
      .where(and(
        eq(mfaBackupCodes.userId, testUser.id),
        eq(mfaBackupCodes.isUsed, false)
      ))
      .limit(1);

    if (usedBackupCodes.length > 0) {
      await db
        .update(mfaBackupCodes)
        .set({
          isUsed: true,
          usedAt: new Date(),
          usedIpAddress: "192.168.1.100",
        })
        .where(eq(mfaBackupCodes.id, usedBackupCodes[0].id));

      console.log(`✓ Marked one backup code as used`);
    }

    // 4. Create audit log entries
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    await db.insert(mfaAuditLogs).values([
      // Enrollment event
      {
        userId: testUser.id,
        tenantId: testUser.tenantId,
        eventType: 'enrollment',
        eventDetails: {
          method: 'totp',
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows 10',
        },
        success: true,
        createdAt: threeDaysAgo,
      },
      // Successful verification
      {
        userId: testUser.id,
        tenantId: testUser.tenantId,
        eventType: 'verification_success',
        eventDetails: {
          method: 'totp',
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows 10',
        },
        success: true,
        createdAt: twoDaysAgo,
      },
      // Another successful verification
      {
        userId: testUser.id,
        tenantId: testUser.tenantId,
        eventType: 'verification_success',
        eventDetails: {
          method: 'totp',
        },
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        deviceInfo: {
          browser: 'Safari',
          os: 'iOS',
        },
        success: true,
        createdAt: yesterday,
      },
      // Failed verification attempt
      {
        userId: testUser.id,
        tenantId: testUser.tenantId,
        eventType: 'verification_failure',
        eventDetails: {
          method: 'totp',
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows 10',
        },
        success: false,
        failureReason: 'invalid_token',
        createdAt: yesterday,
      },
      // Backup code used
      {
        userId: testUser.id,
        tenantId: testUser.tenantId,
        eventType: 'backup_code_used',
        eventDetails: {
          codesRemaining: 9,
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows 10',
        },
        success: true,
        createdAt: now,
      },
    ]);

    console.log(`✓ Created 5 MFA audit log entries`);

    console.log("\n✅ MFA data seeded successfully!");
    console.log("\n📝 Test User MFA Details:");
    console.log(`   Email: ${testUser.email}`);
    console.log(`   MFA Enabled: true`);
    console.log(`   TOTP Secret: ${mfaSecret}`);
    console.log(`   Backup Codes: ${backupCodes.length} (1 used, 9 unused)`);
    console.log(`   Audit Logs: 5 entries`);
    console.log(`\n🔗 otpauth://totp/Printyx:${testUser.email}?secret=${mfaSecret}&issuer=Printyx`);
    console.log(`\n💡 Use this URL in an authenticator app (Google Authenticator, Authy, etc.)`);

  } catch (error) {
    console.error("❌ Error seeding MFA data:", error);
    throw error;
  }
}

export { seedMfaData };

// Run the seed if this file is executed directly
seedMfaData()
  .then(() => {
    console.log("✓ Seeding complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Seeding failed:", error);
    process.exit(1);
  });
