// Blog Module — Audit Log Helper (US-BLOG-003 / US-BLOG-004)
//
// Centralizes writes to `blog_audit_log` so every blog edge function captures
// who changed what and when in a consistent shape.
//
// Usage:
//
//   import { writeAuditLog } from '../_shared/blog/audit-log.ts';
//
//   await writeAuditLog(admin, {
//     tenantId,
//     actorUserId: user.id,
//     actorType: 'user',
//     action: 'blog_brand_voice.create',
//     targetType: 'blog_brand_voice',
//     targetId: created.id,
//     beforeState: null,
//     afterState: created,
//     summary: `Created brand voice "${created.name}"`,
//   });
//
// Errors are logged but do not throw — audit log failures should not bring
// down the actual operation. If the row write fails, the action still
// succeeds; we just lose the audit trail for that specific call. Surface
// audit-write errors via console.error so they appear in edge function logs.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ActorType = 'user' | 'agent' | 'system';

export interface AuditLogEntry {
  tenantId: string;
  actorUserId: string | null;
  actorType: ActorType;
  /** Free-form e.g. 'auto_refresh_agent', 'multi_agent_draft_pipeline'. Null when actorType=user. */
  agentKind?: string | null;
  /** Dotted action key, e.g. 'blog_brand_voice.create', 'blog_post.publish'. */
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  summary?: string | null;
  requestIp?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(admin: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await admin.from('blog_audit_log').insert({
      tenant_id: entry.tenantId,
      actor_user_id: entry.actorUserId,
      actor_type: entry.actorType,
      agent_kind: entry.agentKind ?? null,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      before_state: entry.beforeState ?? null,
      after_state: entry.afterState ?? null,
      summary: entry.summary ?? null,
      request_ip: entry.requestIp ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) {
      console.error('writeAuditLog failed:', error.message, { action: entry.action });
    }
  } catch (err) {
    console.error('writeAuditLog threw:', err, { action: entry.action });
  }
}

/**
 * Convenience: pull request IP and user agent from a Request and merge into
 * an entry. Use at the call site so request context is preserved without
 * threading it through helper functions.
 */
export function withRequestContext(req: Request, entry: AuditLogEntry): AuditLogEntry {
  return {
    ...entry,
    requestIp:
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || entry.requestIp || null,
    userAgent: req.headers.get('user-agent') || entry.userAgent || null,
  };
}
