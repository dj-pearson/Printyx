/**
 * One audit-log writer for edge functions.
 *
 * Five functions already write `audit_logs` (admin, user, audit-logs,
 * root-admin, security) and each carries its own near-copy of this insert. This
 * module exists so the next caller is not a sixth; the five are deliberately NOT
 * converted here, because rewriting four unrelated functions to land one
 * story's audit trail is a refactor wearing a feature's clothes. They are one
 * import away whenever somebody is in them for another reason.
 *
 * EVERY NOT NULL COLUMN IS SUPPLIED, checked against drizzle's own getTableConfig
 * by the test rather than copied from a sibling: tenant_id, user_id, action,
 * resource, ip_address, severity and category are all NOT NULL, and `timestamp`
 * is NOT NULL with a database default (the column is `timestamp`, NOT
 * `created_at` - CLAUDE.md records that one as a confirmed true positive).
 *
 * IT NEVER THROWS. An audit write that fails must not fail the action it is
 * recording: a rep who cannot save a territory because the log is down is a
 * worse outcome than a gap in the log, and the gap is visible in the log while
 * the refusal is not. The failure is logged to the console and the caller is
 * told, so a handler that wants to surface it can.
 */

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditEntry {
  tenantId: string;
  userId: string;
  /** Imperative and past-tense-free, e.g. CREATE_TERRITORY. */
  action: string;
  /** The table or domain object, e.g. sales_territories. */
  resource: string;
  resourceId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  severity?: AuditSeverity;
  category?: string;
  /** Anything a reader of the trail would want that is not a column. */
  additionalContext?: Record<string, unknown> | null;
}

/** The subset of the Supabase client this module uses. */
export interface AuditClient {
  from(table: string): {
    insert(values: Record<string, unknown>): Promise<{ error: unknown }>;
  };
}

function callerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  // x-forwarded-for is a LIST; the client is the first entry, and storing the
  // whole chain puts proxy addresses in a column an auditor reads as "who".
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || '0.0.0.0';
}

/**
 * Record one auditable action. Resolves to whether the row was written, and
 * never rejects.
 */
export async function writeAuditLog(
  admin: AuditClient,
  entry: AuditEntry,
  req: Request,
): Promise<{ written: boolean; error?: string }> {
  try {
    const { error } = await admin.from('audit_logs').insert({
      tenant_id: entry.tenantId,
      user_id: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ?? null,
      old_values: entry.oldValues ?? null,
      new_values: entry.newValues ?? null,
      ip_address: callerIp(req),
      user_agent: req.headers.get('user-agent'),
      severity: entry.severity ?? 'medium',
      category: entry.category ?? 'data_modification',
      additional_context: entry.additionalContext ?? null,
    });
    if (error) {
      console.error('Audit log insert failed:', error);
      return { written: false, error: String((error as { message?: string })?.message ?? error) };
    }
    return { written: true };
  } catch (err) {
    console.error('Audit log insert threw:', err);
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
}
