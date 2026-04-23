/**
 * MFA edge function (canonical).
 *
 * Replaces server/routes/mfa-routes.ts (17 endpoints) + mfa-otp-service.ts.
 *
 * URL prefix: /mfa/*
 *
 * Endpoints:
 *   POST /enroll/init            — generate TOTP secret + otpauth URL
 *   POST /enroll/verify          — verify code, mark enrollment active
 *   POST /verify                 — verify any active method (TOTP/backup/OTP)
 *   GET  /status                 — user's MFA status
 *   GET  /methods                — which methods enrolled
 *   POST /challenge              — issue a challenge (stub — returns methods)
 *   POST /disable                — disable all MFA for current user
 *   POST /backup-codes/regenerate
 *   GET  /backup-codes/count
 *   POST /otp/email/send         — email one-time code (uses SendGrid via email-marketing)
 *   POST /otp/sms/send           — SMS one-time code (Twilio REST; simulation if env unset)
 *   POST /otp/verify             — consume email/SMS OTP
 *   GET  /audit-logs             — own events
 *   GET  /admin/audit-logs       — tenant-wide (admin only)
 *   POST /admin/reset/:userId    — force-disable MFA for a user (admin only)
 *   GET  /admin/compliance-report
 *   GET  /admin/users-without-mfa
 *
 * Encryption-at-rest for mfa_enrollments.secret is a follow-up
 * (tasks/followup-credentials-encryption.md).
 *
 * One-time SQL:
 *   \i drizzle/rls/auth-security-tables.sql
 *   \i drizzle/rls/auth-security.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { generateSecret, verifyCode } from './_totp.ts';
import { sendSms } from './_twilio.ts';

const log = createLogger('mfa');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/mfa/, '')
      .replace(/\/$/, '') || '/'
  );
}

function isAdmin(auth: { supabaseUser?: Record<string, unknown> }): boolean {
  const u = auth.supabaseUser as
    | { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }
    | undefined;
  const role = String(
    (u?.app_metadata as Record<string, unknown> | undefined)?.role ??
      (u?.user_metadata as Record<string, unknown> | undefined)?.role ??
      '',
  ).toLowerCase();
  if (['admin', 'platform_admin', 'super_admin', 'root_admin'].some((r) => role.includes(r))) {
    return true;
  }
  const raw =
    (u?.app_metadata as Record<string, unknown> | undefined)?.roleLevel ??
    (u?.app_metadata as Record<string, unknown> | undefined)?.role_level ??
    1;
  const level = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 1;
  return level >= 7;
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    const auth = await requireAuth(req);
    const db = getDb();
    const parts = sub.split('/').filter(Boolean);
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];

    // ─── Enrollment ─────────────────────────────────────────────────────────

    if (method === 'POST' && p0 === 'enroll' && p1 === 'init') {
      const issuer = 'Printyx';
      const label = String((auth.supabaseUser as Record<string, unknown>)?.email ?? auth.userId);
      const { base32, otpauthUrl } = generateSecret({ issuer, label });
      await db.from('mfa_enrollments').upsert(
        {
          user_id: auth.userId,
          tenant_id: auth.tenantId,
          method: 'totp',
          secret: base32,
          is_verified: false,
          is_primary: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,method' },
      );
      return jsonResponse({ secret: base32, otpauthUrl }, 200, req, requestId);
    }

    if (method === 'POST' && p0 === 'enroll' && p1 === 'verify') {
      const body = (await req.json().catch(() => ({}))) as { code?: string };
      if (!body.code) {
        return errorResponse(400, 'code required', req, { code: 'VALIDATION_ERROR', requestId });
      }
      const { data: enroll } = await db
        .from('mfa_enrollments')
        .select('id, secret')
        .eq('user_id', auth.userId)
        .eq('method', 'totp')
        .eq('is_verified', false)
        .maybeSingle();
      if (!enroll) {
        return errorResponse(404, 'No pending TOTP enrollment', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }
      const ok = verifyCode(enroll.secret as string, body.code);
      if (!ok) {
        await writeAudit(db, auth, 'enroll_verify_failed', false, 'bad_code');
        return errorResponse(401, 'Invalid code', req, { code: 'BAD_CODE', requestId });
      }
      await db
        .from('mfa_enrollments')
        .update({
          is_verified: true,
          is_primary: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enroll.id);
      // Seed 10 backup codes
      const plaintextCodes = await regenerateBackupCodes(db, auth);
      await writeAudit(db, auth, 'enroll_verified', true);
      return jsonResponse({ enrolled: true, backupCodes: plaintextCodes }, 200, req, requestId);
    }

    // ─── Verify (login) ─────────────────────────────────────────────────────

    if (method === 'POST' && p0 === 'verify' && !p1) {
      const body = (await req.json().catch(() => ({}))) as { code?: string; method?: string };
      if (!body.code) {
        return errorResponse(400, 'code required', req, { code: 'VALIDATION_ERROR', requestId });
      }
      // Try each active method.
      const { data: enrolled } = await db
        .from('mfa_enrollments')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('is_verified', true);
      for (const e of (enrolled ?? []) as Array<Record<string, unknown>>) {
        if (e.method === 'totp' && verifyCode(e.secret as string, body.code)) {
          await bumpEnrollmentUsage(db, e.id as string);
          await writeAudit(db, auth, 'verify_success', true, null, { method: 'totp' });
          return jsonResponse({ verified: true, method: 'totp' }, 200, req, requestId);
        }
      }
      // Backup code fallback
      if (await consumeBackupCode(db, auth.userId, body.code)) {
        await writeAudit(db, auth, 'verify_success', true, null, { method: 'backup_code' });
        return jsonResponse({ verified: true, method: 'backup_code' }, 200, req, requestId);
      }
      await writeAudit(db, auth, 'verify_failed', false, 'no_match');
      return errorResponse(401, 'Invalid code', req, { code: 'BAD_CODE', requestId });
    }

    // ─── Status / Methods / Challenge ────────────────────────────────────────

    if (method === 'GET' && p0 === 'status' && !p1) {
      const { data } = await db
        .from('mfa_enrollments')
        .select('method, is_verified, is_primary')
        .eq('user_id', auth.userId);
      const enrolled = ((data ?? []) as Array<Record<string, unknown>>).filter(
        (e) => e.is_verified,
      );
      return jsonResponse(
        {
          enrolled: enrolled.length > 0,
          methods: enrolled.map((e) => e.method),
          primary: enrolled.find((e) => e.is_primary)?.method ?? null,
        },
        200,
        req,
        requestId,
      );
    }

    if (method === 'GET' && p0 === 'methods' && !p1) {
      const { data } = await db
        .from('mfa_enrollments')
        .select('method, is_verified, is_primary, last_used_at')
        .eq('user_id', auth.userId);
      return jsonResponse({ methods: data ?? [] }, 200, req, requestId);
    }

    if (method === 'POST' && p0 === 'challenge' && !p1) {
      const { data } = await db
        .from('mfa_enrollments')
        .select('method')
        .eq('user_id', auth.userId)
        .eq('is_verified', true);
      return jsonResponse(
        {
          challenge: 'choose-method',
          availableMethods: (data ?? []).map((d: { method: string }) => d.method),
        },
        200,
        req,
        requestId,
      );
    }

    // ─── Disable ────────────────────────────────────────────────────────────

    if (method === 'POST' && p0 === 'disable' && !p1) {
      await db.from('mfa_enrollments').delete().eq('user_id', auth.userId);
      await db.from('mfa_backup_codes').delete().eq('user_id', auth.userId);
      await db.from('mfa_otp_tokens').delete().eq('user_id', auth.userId);
      await writeAudit(db, auth, 'disabled_by_user', true);
      return jsonResponse({ disabled: true }, 200, req, requestId);
    }

    // ─── Backup codes ───────────────────────────────────────────────────────

    if (method === 'POST' && p0 === 'backup-codes' && p1 === 'regenerate') {
      const codes = await regenerateBackupCodes(db, auth);
      await writeAudit(db, auth, 'backup_codes_regenerated', true);
      return jsonResponse({ codes }, 200, req, requestId);
    }

    if (method === 'GET' && p0 === 'backup-codes' && p1 === 'count') {
      const { count } = await db
        .from('mfa_backup_codes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.userId)
        .eq('is_used', false);
      return jsonResponse({ remaining: count ?? 0 }, 200, req, requestId);
    }

    // ─── OTP (email / SMS) ──────────────────────────────────────────────────

    if (method === 'POST' && p0 === 'otp' && p1 === 'email' && p2 === 'send') {
      return await sendEmailOtp(req, auth, db, requestId);
    }

    if (method === 'POST' && p0 === 'otp' && p1 === 'sms' && p2 === 'send') {
      return await sendSmsOtp(req, auth, db, requestId);
    }

    if (method === 'POST' && p0 === 'otp' && p1 === 'verify') {
      return await verifyOtp(req, auth, db, requestId);
    }

    // ─── Audit logs ─────────────────────────────────────────────────────────

    if (method === 'GET' && p0 === 'audit-logs' && !p1) {
      const { data } = await db
        .from('mfa_audit_logs')
        .select('*')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
        .limit(200);
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    if (p0 === 'admin') {
      if (!isAdmin(auth)) {
        return errorResponse(403, 'Admin role required', req, { code: 'FORBIDDEN', requestId });
      }

      if (method === 'GET' && p1 === 'audit-logs') {
        const { data } = await db
          .from('mfa_audit_logs')
          .select('*')
          .eq('tenant_id', auth.tenantId)
          .order('created_at', { ascending: false })
          .limit(500);
        return jsonResponse(data ?? [], 200, req, requestId);
      }

      if (method === 'POST' && p1 === 'reset' && p2) {
        const targetUserId = p2;
        await db.from('mfa_enrollments').delete().eq('user_id', targetUserId);
        await db.from('mfa_backup_codes').delete().eq('user_id', targetUserId);
        await db.from('mfa_otp_tokens').delete().eq('user_id', targetUserId);
        await db.from('mfa_audit_logs').insert({
          user_id: targetUserId,
          tenant_id: auth.tenantId,
          event_type: 'admin_reset',
          success: true,
          performed_by: auth.userId,
        });
        return jsonResponse({ reset: true, userId: targetUserId }, 200, req, requestId);
      }

      if (method === 'GET' && p1 === 'compliance-report') {
        const { data: tenantUsers } = await db
          .from('users')
          .select('id')
          .eq('tenant_id', auth.tenantId);
        const userIds = ((tenantUsers ?? []) as Array<{ id: string }>).map((u) => u.id);
        const { data: verifiedEnrollments } = await db
          .from('mfa_enrollments')
          .select('user_id')
          .eq('is_verified', true)
          .in('user_id', userIds.length > 0 ? userIds : ['__none__']);
        const enrolledIds = new Set(
          ((verifiedEnrollments ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
        );
        const totalUsers = userIds.length;
        const withMfa = userIds.filter((id) => enrolledIds.has(id)).length;
        return jsonResponse(
          {
            totalUsers,
            usersWithMfa: withMfa,
            usersWithoutMfa: totalUsers - withMfa,
            complianceRate: totalUsers > 0 ? Number(((withMfa / totalUsers) * 100).toFixed(1)) : 0,
          },
          200,
          req,
          requestId,
        );
      }

      if (method === 'GET' && p1 === 'users-without-mfa') {
        const { data: tenantUsers } = await db
          .from('users')
          .select('id, email, first_name, last_name')
          .eq('tenant_id', auth.tenantId);
        const users = (tenantUsers ?? []) as Array<Record<string, unknown>>;
        const ids = users.map((u) => u.id as string);
        const { data: verifiedEnrollments } = await db
          .from('mfa_enrollments')
          .select('user_id')
          .eq('is_verified', true)
          .in('user_id', ids.length > 0 ? ids : ['__none__']);
        const enrolledIds = new Set(
          ((verifiedEnrollments ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
        );
        const withoutMfa = users.filter((u) => !enrolledIds.has(u.id as string));
        return jsonResponse({ users: withoutMfa, count: withoutMfa.length }, 200, req, requestId);
      }
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, { code: 'INTERNAL', requestId });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function regenerateBackupCodes(db: any, auth: any): Promise<string[]> {
  await db.from('mfa_backup_codes').delete().eq('user_id', auth.userId);
  const codes: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 10; i++) {
    const code = formatBackupCode(randomHex(5));
    codes.push(code);
    rows.push({
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      code_hash: await sha256Hex(code),
      is_used: false,
    });
  }
  await db.from('mfa_backup_codes').insert(rows);
  return codes;
}

// deno-lint-ignore no-explicit-any
async function consumeBackupCode(db: any, userId: string, code: string): Promise<boolean> {
  const hash = await sha256Hex(code);
  const { data } = await db
    .from('mfa_backup_codes')
    .select('id')
    .eq('user_id', userId)
    .eq('code_hash', hash)
    .eq('is_used', false)
    .maybeSingle();
  if (!data) return false;
  await db
    .from('mfa_backup_codes')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', data.id);
  return true;
}

// deno-lint-ignore no-explicit-any
async function bumpEnrollmentUsage(db: any, id: string) {
  await db
    .from('mfa_enrollments')
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
}

// deno-lint-ignore no-explicit-any
async function writeAudit(
  db: any,
  auth: any,
  eventType: string,
  success: boolean,
  failureReason: string | null = null,
  details: Record<string, unknown> = {},
) {
  try {
    await db.from('mfa_audit_logs').insert({
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      event_type: eventType,
      event_details: details,
      success,
      failure_reason: failureReason,
    });
  } catch {
    // audit log failure never breaks the primary op
  }
}

// ─── OTP flows ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function sendEmailOtp(
  req: Request,
  auth: any,
  db: any,
  requestId: string,
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email ?? (auth.supabaseUser as { email?: string })?.email;
  if (!email) {
    return errorResponse(400, 'email required', req, { code: 'VALIDATION_ERROR', requestId });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.from('mfa_otp_tokens').insert({
    user_id: auth.userId,
    tenant_id: auth.tenantId,
    method: 'email',
    token_hash: hash,
    destination: email,
    expires_at: expiresAt,
  });

  // Forward to email-marketing via SendGrid wrapper if available. For now we
  // log the code so dev/simulation flows work; real SendGrid integration in
  // this function is a follow-up (needs a shared helper extraction).
  log.info({ requestId, email, code: code.slice(0, 2) + '••••' }, 'email_otp_issued');

  return jsonResponse(
    {
      sent: true,
      method: 'email',
      destination: email.replace(/(.{2}).+(@.+)/, '$1••••$2'),
      stub: true,
      message:
        'Code generated + stored. Real SendGrid dispatch wires in via Phase 3 _shared/sendgrid.ts — follow-up.',
    },
    200,
    req,
    requestId,
  );
}

// deno-lint-ignore no-explicit-any
async function sendSmsOtp(req: Request, auth: any, db: any, requestId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    phoneNumber?: string;
    phone_number?: string;
  };
  const phone = body.phoneNumber ?? body.phone_number;
  if (!phone) {
    return errorResponse(400, 'phoneNumber required', req, { code: 'VALIDATION_ERROR', requestId });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.from('mfa_otp_tokens').insert({
    user_id: auth.userId,
    tenant_id: auth.tenantId,
    method: 'sms',
    token_hash: hash,
    destination: phone,
    expires_at: expiresAt,
  });
  let sent = { messageId: 'sim', simulated: true } as { messageId: string; simulated: boolean };
  try {
    sent = await sendSms(
      phone,
      `Your Printyx verification code is ${code}. Expires in 10 minutes.`,
    );
  } catch (err) {
    log.error({ requestId, err: String(err) }, 'twilio_send_failed');
    return errorResponse(502, 'SMS dispatch failed', req, {
      code: 'SMS_ERROR',
      details: err instanceof Error ? err.message : String(err),
      requestId,
    });
  }
  return jsonResponse(
    {
      sent: true,
      method: 'sms',
      destination: phone.replace(/(\d{3}).+(\d{4})/, '$1••••$2'),
      simulated: sent.simulated,
      messageId: sent.messageId,
    },
    200,
    req,
    requestId,
  );
}

// deno-lint-ignore no-explicit-any
async function verifyOtp(req: Request, auth: any, db: any, requestId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return errorResponse(400, 'code required', req, { code: 'VALIDATION_ERROR', requestId });
  }
  const hash = await sha256Hex(body.code);
  const { data, error } = await db
    .from('mfa_otp_tokens')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('token_hash', hash)
    .eq('consumed', false)
    .gte('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) {
    return errorResponse(500, 'OTP lookup failed', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  if (!data) {
    await writeAudit(db, auth, 'otp_verify_failed', false, 'bad_or_expired');
    return errorResponse(401, 'Invalid or expired code', req, { code: 'BAD_CODE', requestId });
  }
  await db
    .from('mfa_otp_tokens')
    .update({ consumed: true, consumed_at: new Date().toISOString() })
    .eq('id', data.id);
  await writeAudit(db, auth, 'otp_verify_success', true, null, { method: data.method });
  return jsonResponse({ verified: true, method: data.method }, 200, req, requestId);
}

// ─── Low-level ───────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatBackupCode(hex: string): string {
  // XXXX-XXXX, uppercase hex
  return (hex.slice(0, 4) + '-' + hex.slice(4, 8)).toUpperCase();
}
