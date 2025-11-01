# Multi-Factor Authentication (MFA) Enforcement System Documentation

## Overview

The Multi-Factor Authentication (MFA) Enforcement System provides comprehensive two-factor authentication capabilities for the Printyx platform. It supports TOTP (Time-based One-Time Passwords) authentication, backup recovery codes, audit logging, and compliance tracking to enhance account security across the platform.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Storage Methods](#storage-methods)
6. [Security Considerations](#security-considerations)
7. [Usage Examples](#usage-examples)
8. [Admin Operations](#admin-operations)
9. [Compliance & Reporting](#compliance--reporting)

## Features

### Core Capabilities

- **TOTP Authentication**: Industry-standard time-based one-time password support
- **QR Code Enrollment**: Easy setup via authenticator apps (Google Authenticator, Authy, Microsoft Authenticator)
- **Backup Recovery Codes**: 10 one-time use codes for account recovery
- **Audit Logging**: Comprehensive tracking of all MFA events
- **Admin Management**: Admin reset capabilities and compliance reporting
- **Multi-Tenant Support**: Tenant-aware MFA enforcement and reporting

### Security Features

- **Bcrypt-Hashed Backup Codes**: Secure storage of recovery codes
- **Rate Limiting**: Protection against brute force attacks (via Express middleware)
- **Time Window Tolerance**: ±30 second window for clock drift
- **IP & Device Tracking**: Complete audit trail with device information
- **Session Management**: Integration with existing authentication system

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    MFA Enforcement System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Enrollment │  │ Verification │  │    Backup    │     │
│  │              │  │              │  │     Codes    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Audit Logging│  │    Admin     │  │  Compliance  │     │
│  │              │  │  Management  │  │   Reporting  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **TOTP Implementation**: Custom implementation using Node.js `crypto` module
- **Base32 Encoding**: Custom implementation for secret encoding
- **Password Hashing**: Bcrypt for backup code security
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas for request validation

## Database Schema

### Users Table (Extended)

```sql
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR; -- Encrypted TOTP secret
```

### MFA Backup Codes Table

```sql
CREATE TABLE mfa_backup_codes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  tenant_id VARCHAR,
  code_hash VARCHAR NOT NULL,          -- Bcrypt hashed backup code
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  used_ip_address VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_mfa_backup_codes_user ON mfa_backup_codes(user_id);
CREATE INDEX idx_mfa_backup_codes_user_unused ON mfa_backup_codes(user_id, is_used);
```

### MFA Audit Logs Table

```sql
CREATE TABLE mfa_audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  tenant_id VARCHAR,
  event_type VARCHAR NOT NULL,        -- enrollment, verification_success, verification_failure, backup_code_used, admin_reset, disabled
  event_details JSONB,                -- Additional context
  ip_address VARCHAR,
  user_agent VARCHAR,
  device_info JSONB,                  -- Browser, OS, device type
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason VARCHAR,             -- invalid_code, code_expired, rate_limit, etc.
  performed_by VARCHAR,               -- User ID who performed the action (for admin actions)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mfa_audit_logs_user ON mfa_audit_logs(user_id);
CREATE INDEX idx_mfa_audit_logs_event_type ON mfa_audit_logs(event_type, created_at);
CREATE INDEX idx_mfa_audit_logs_user_event ON mfa_audit_logs(user_id, event_type, created_at);
```

## API Endpoints

### Enrollment Endpoints

#### POST /api/mfa/enroll/init

Initialize MFA enrollment by generating a TOTP secret and QR code URL.

**Request:**
```http
POST /api/mfa/enroll/init
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "secret": "OVJOFDZPCVML7LHU6HB4KF4YVQSDY6SD",
  "otpauthUrl": "otpauth://totp/Printyx:user@example.com?secret=...&issuer=Printyx",
  "qrCodeData": "otpauth://totp/...",
  "backupCodes": []
}
```

#### POST /api/mfa/enroll/verify

Complete MFA enrollment by verifying the TOTP code.

**Request:**
```http
POST /api/mfa/enroll/verify
Content-Type: application/json

{
  "secret": "OVJOFDZPCVML7LHU6HB4KF4YVQSDY6SD",
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "backupCodes": [
    "BB2PVWJ0",
    "B24LUW4N",
    "UJECDM06",
    ...
  ],
  "message": "MFA enabled successfully. Save your backup codes in a secure location."
}
```

### Verification Endpoints

#### POST /api/mfa/verify

Verify TOTP code or backup code during login.

**Request:**
```http
POST /api/mfa/verify
Content-Type: application/json

{
  "userId": "user-id-here",
  "code": "123456",
  "useBackupCode": false
}
```

**Response:**
```json
{
  "success": true,
  "usedBackupCode": false
}
```

### Status & Management Endpoints

#### GET /api/mfa/status

Get current user's MFA status.

**Response:**
```json
{
  "enabled": true,
  "hasBackupCodes": true
}
```

#### POST /api/mfa/disable

Disable MFA for current user (requires TOTP verification).

**Request:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA disabled successfully"
}
```

### Backup Code Endpoints

#### POST /api/mfa/backup-codes/regenerate

Regenerate backup codes (requires TOTP verification).

**Request:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "backupCodes": ["CODE1", "CODE2", ...],
  "message": "Backup codes regenerated successfully. Save them in a secure location."
}
```

#### GET /api/mfa/backup-codes/count

Get count of unused backup codes.

**Response:**
```json
{
  "count": 9
}
```

### Admin Endpoints

#### POST /api/mfa/admin/reset/:userId

Admin reset MFA for a user.

**Response:**
```json
{
  "success": true,
  "message": "MFA reset successfully for user"
}
```

#### GET /api/mfa/admin/compliance-report

Get MFA compliance report for tenant.

**Response:**
```json
{
  "totalUsers": 100,
  "mfaEnabledUsers": 75,
  "mfaDisabledUsers": 25,
  "compliancePercentage": 75,
  "recentEnrollments": 10,
  "recentFailures": 3
}
```

#### GET /api/mfa/admin/users-without-mfa

Get list of users without MFA enabled.

**Response:**
```json
[
  {
    "id": "user-1",
    "email": "user1@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  ...
]
```

### Audit Log Endpoints

#### GET /api/mfa/audit-logs

Get MFA audit logs for current user.

**Query Parameters:**
- `eventType` (optional): Filter by event type
- `success` (optional): Filter by success status (true/false)

**Response:**
```json
[
  {
    "id": "log-1",
    "userId": "user-1",
    "eventType": "verification_success",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "success": true,
    "createdAt": "2025-11-01T10:30:00Z"
  },
  ...
]
```

#### GET /api/mfa/admin/audit-logs

Get MFA audit logs for entire tenant (admin only).

**Query Parameters:**
- `eventType` (optional): Filter by event type
- `success` (optional): Filter by success status (true/false)

## Storage Methods

### MFA Enrollment & Configuration

```typescript
// Enable MFA for a user
enableMfaForUser(userId: string, secret: string): Promise<User | null>

// Disable MFA for a user
disableMfaForUser(userId: string): Promise<User | null>

// Get user's MFA status
getUserMfaStatus(userId: string): Promise<{
  enabled: boolean;
  hasBackupCodes: boolean;
} | null>
```

### Backup Codes

```typescript
// Generate new backup codes
generateBackupCodes(
  userId: string,
  tenantId: string | null,
  count: number = 10
): Promise<{ codes: string[]; hashes: MfaBackupCode[] }>

// Validate a backup code
validateBackupCode(userId: string, code: string): Promise<boolean>

// Get unused backup codes
getUnusedBackupCodes(userId: string): Promise<MfaBackupCode[]>

// Delete all backup codes
deleteAllBackupCodes(userId: string): Promise<void>
```

### Audit Logs

```typescript
// Create audit log entry
createMfaAuditLog(log: InsertMfaAuditLog): Promise<MfaAuditLog>

// Get audit logs for user
getMfaAuditLogs(
  userId: string,
  filters?: { eventType?: string; success?: boolean }
): Promise<MfaAuditLog[]>

// Get audit logs for tenant
getMfaAuditLogsByTenant(
  tenantId: string,
  filters?: { eventType?: string; success?: boolean }
): Promise<MfaAuditLog[]>
```

### Compliance & Reporting

```typescript
// Get compliance report
getMfaComplianceReport(tenantId: string): Promise<{
  totalUsers: number;
  mfaEnabledUsers: number;
  mfaDisabledUsers: number;
  compliancePercentage: number;
  recentEnrollments: number;
  recentFailures: number;
}>

// Get users without MFA
getUsersWithoutMfa(tenantId: string): Promise<User[]>
```

## Security Considerations

### TOTP Implementation

1. **Secret Generation**: 20-byte random secrets (160 bits of entropy)
2. **Time Step**: 30-second intervals (RFC 6238 standard)
3. **Code Length**: 6 digits
4. **Time Window**: ±30 seconds tolerance for clock drift
5. **Algorithm**: HMAC-SHA1 (standard TOTP algorithm)

### Backup Code Security

1. **Hashing**: All backup codes are bcrypt-hashed before storage
2. **One-Time Use**: Codes are marked as used after successful validation
3. **Quantity**: 10 codes generated per user
4. **Regeneration**: Requires TOTP verification to prevent unauthorized access

### Best Practices

1. **Rate Limiting**: Implement rate limiting on verification endpoints
2. **IP Tracking**: Monitor for unusual login patterns
3. **Audit Logging**: All MFA events are logged for security review
4. **Session Management**: MFA verification should be part of login flow
5. **Admin Access**: Restrict admin reset capabilities to platform administrators

## Usage Examples

### Frontend Integration

#### Step 1: Initialize MFA Enrollment

```typescript
async function initiateMfaEnrollment() {
  const response = await fetch('/api/mfa/enroll/init', {
    method: 'POST',
    credentials: 'include',
  });
  
  const data = await response.json();
  
  // Display QR code using data.qrCodeData
  // Show secret for manual entry: data.secret
  
  return data;
}
```

#### Step 2: Verify and Complete Enrollment

```typescript
async function completeMfaEnrollment(secret: string, token: string) {
  const response = await fetch('/api/mfa/enroll/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, token }),
    credentials: 'include',
  });
  
  const data = await response.json();
  
  // Display backup codes to user
  // IMPORTANT: User must save these codes
  console.log('Backup Codes:', data.backupCodes);
  
  return data;
}
```

#### Step 3: Verify During Login

```typescript
async function verifyMfaCode(userId: string, code: string, isBackupCode = false) {
  const response = await fetch('/api/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      code,
      useBackupCode: isBackupCode,
    }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Proceed with login
    if (data.usedBackupCode) {
      // Warn user that backup code was used
      alert('Backup code used. You have fewer backup codes remaining.');
    }
  }
  
  return data;
}
```

### Login Flow Integration

```typescript
async function handleLogin(email: string, password: string) {
  // Step 1: Authenticate with email/password
  const authResponse = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const authData = await authResponse.json();
  
  // Step 2: Check if MFA is enabled
  if (authData.mfaRequired) {
    const userId = authData.userId;
    
    // Prompt user for TOTP code
    const code = prompt('Enter your 6-digit verification code:');
    
    // Step 3: Verify MFA code
    const mfaResponse = await fetch('/api/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code, useBackupCode: false }),
    });
    
    const mfaData = await mfaResponse.json();
    
    if (mfaData.success) {
      // Complete login
      return { success: true, user: authData.user };
    } else {
      return { success: false, error: 'Invalid MFA code' };
    }
  }
  
  // No MFA required
  return { success: true, user: authData.user };
}
```

## Admin Operations

### Resetting MFA for a User

When a user loses access to their authenticator app and backup codes:

```typescript
async function adminResetUserMfa(userId: string) {
  const response = await fetch(`/api/mfa/admin/reset/${userId}`, {
    method: 'POST',
    credentials: 'include',
  });
  
  const data = await response.json();
  
  // Notify user that MFA has been reset
  // User will need to re-enroll
  
  return data;
}
```

### Viewing Compliance Report

```typescript
async function getComplianceReport() {
  const response = await fetch('/api/mfa/admin/compliance-report', {
    credentials: 'include',
  });
  
  const report = await response.json();
  
  console.log(`MFA Compliance: ${report.compliancePercentage}%`);
  console.log(`Users with MFA: ${report.mfaEnabledUsers}/${report.totalUsers}`);
  console.log(`Recent enrollments: ${report.recentEnrollments}`);
  console.log(`Recent failures: ${report.recentFailures}`);
  
  return report;
}
```

## Compliance & Reporting

### Event Types

- `enrollment`: User enrolled in MFA
- `verification_success`: Successful MFA verification
- `verification_failure`: Failed MFA verification attempt
- `backup_code_used`: User used a backup recovery code
- `admin_reset`: Admin reset user's MFA
- `disabled`: User disabled MFA

### Audit Log Fields

All audit log entries include:
- **userId**: User who performed the action
- **tenantId**: Tenant context
- **eventType**: Type of MFA event
- **ipAddress**: IP address of the request
- **userAgent**: Browser/client information
- **deviceInfo**: Parsed device details
- **success**: Whether the action succeeded
- **failureReason**: Reason for failure (if applicable)
- **performedBy**: User who performed admin actions
- **createdAt**: Timestamp of the event

### Compliance Metrics

The system tracks:
1. **Total Users**: Number of users in the tenant
2. **MFA Enabled**: Users with MFA active
3. **MFA Disabled**: Users without MFA
4. **Compliance Percentage**: Percentage of users with MFA
5. **Recent Enrollments**: New MFA enrollments in last 30 days
6. **Recent Failures**: Failed verification attempts in last 30 days

## Testing

### Seed Data

The system includes a seed script (`server/seed-mfa-data.ts`) that creates test data:

```bash
npx tsx server/seed-mfa-data.ts
```

This will:
- Enable MFA for a test user
- Generate 10 backup codes
- Create sample audit log entries
- Display TOTP secret and QR code URL

### Testing with Authenticator Apps

1. Run the seed script to get a TOTP secret
2. Scan the QR code URL with Google Authenticator, Authy, or Microsoft Authenticator
3. Use the 6-digit code from the app to test verification

### Testing Backup Codes

The seed script outputs plaintext backup codes. Use these to test:
- Backup code verification
- One-time use enforcement
- Used code tracking

## Future Enhancements

Potential improvements for the MFA system:

1. **SMS/Email Verification**: Alternative MFA methods
2. **Push Notifications**: Mobile app push-based authentication
3. **Hardware Key Support**: WebAuthn/FIDO2 integration
4. **Trusted Devices**: Remember devices for 30 days
5. **Forced Enrollment**: Require MFA for specific roles
6. **Recovery Options**: Email-based account recovery
7. **MFA Policies**: Tenant-level MFA enforcement rules

## Support

For questions or issues with the MFA system:
- Review audit logs for authentication failures
- Check compliance reports for tenant-wide issues
- Use admin reset for users locked out of their accounts
- Ensure authenticator apps are synced with correct time

---

**Version**: 1.0.0  
**Last Updated**: November 1, 2025  
**Author**: Printyx Platform Team
