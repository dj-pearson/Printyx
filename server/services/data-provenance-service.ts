/**
 * Article 14 provenance and suppression (LEGAL-008).
 *
 * Two obligations that the platform previously met neither of:
 *
 * 1. A person whose contact record was bought from Apollo or ZoomInfo never
 *    gave us their data and does not know we hold it. GDPR Art. 14 gives them a
 *    right to be told, within a month of acquisition. That is impossible unless
 *    something records which records came from a provider and when.
 *
 * 2. When that person objects or asks to be erased, deleting the row is not
 *    enough. The next enrichment run re-acquires them from the same provider
 *    and the erasure quietly undoes itself. Suppression has to outlive the
 *    record, which is why it is keyed by email rather than by contact id.
 *
 * The suppression check is the part that must never be skipped. `isSuppressed`
 * is called before a record is written, not after, and it FAILS CLOSED: if the
 * check itself errors, the record is treated as suppressed rather than
 * acquired. Re-acquiring someone who asked to be left alone is the failure that
 * gets noticed by the person it happens to.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  INDIRECT_SOURCES,
  contactDataProvenance,
  contactSuppressions,
  type ProvenanceSource,
} from '../../shared/data-provenance-schema';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('data-provenance');

/** Art. 14(3)(a): information must be provided within a reasonable period, at most one month. */
export const ART14_NOTICE_DEADLINE_DAYS = 30;

export type ProvenanceSubjectType = 'contact' | 'company';

export interface RecordProvenanceInput {
  tenantId: string;
  subjectType: ProvenanceSubjectType;
  subjectId: string;
  subjectEmail?: string | null;
  source: ProvenanceSource;
  sourceRecordId?: string | null;
  fieldsAcquired?: string[];
}

/** Normalize an email for matching. Providers are not consistent about case. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = String(email ?? '')
    .trim()
    .toLowerCase();
  return e.length > 0 ? e : null;
}

/** Whether this source creates an Article 14 obligation. */
export function requiresArt14Notice(source: ProvenanceSource): boolean {
  return INDIRECT_SOURCES.includes(source);
}

/**
 * Is this person on the do-not-acquire list?
 *
 * FAILS CLOSED. A thrown query returns true, because the cost of wrongly
 * skipping one enrichment is a missing record, and the cost of wrongly
 * acquiring one is contacting a person who formally asked not to be.
 */
export async function isSuppressed(
  tenantId: string,
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false; // nothing to match on

  try {
    const rows = await db
      .select({ id: contactSuppressions.id })
      .from(contactSuppressions)
      .where(
        and(eq(contactSuppressions.tenantId, tenantId), eq(contactSuppressions.email, normalized)),
      )
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    log.error(
      { tenantId, err: err instanceof Error ? err.message : String(err) },
      'suppression check failed; treating as suppressed',
    );
    return true;
  }
}

/** Filter a batch of candidate emails down to the ones not suppressed. */
export async function filterSuppressed(
  tenantId: string,
  emails: Array<string | null | undefined>,
): Promise<Set<string>> {
  const normalized = emails.map((e) => normalizeEmail(e)).filter((e): e is string => e !== null);
  if (normalized.length === 0) return new Set();

  try {
    const rows = await db
      .select({ email: contactSuppressions.email })
      .from(contactSuppressions)
      .where(
        and(
          eq(contactSuppressions.tenantId, tenantId),
          inArray(contactSuppressions.email, normalized),
        ),
      );
    return new Set(rows.map((r) => r.email));
  } catch (err) {
    log.error(
      { tenantId, err: err instanceof Error ? err.message : String(err) },
      'batch suppression check failed; treating all as suppressed',
    );
    return new Set(normalized);
  }
}

/**
 * Record where a record came from.
 *
 * Upserts on (tenant, subjectType, subjectId): re-enriching an existing contact
 * updates the provenance rather than accumulating rows, but never downgrades an
 * Art. 14 status that has already been satisfied or suppressed.
 */
export async function recordProvenance(input: RecordProvenanceInput): Promise<void> {
  const email = normalizeEmail(input.subjectEmail);
  const noticeStatus = requiresArt14Notice(input.source) ? 'pending' : 'not_required';

  try {
    await db
      .insert(contactDataProvenance)
      .values({
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectEmail: email,
        source: input.source,
        sourceRecordId: input.sourceRecordId ?? null,
        fieldsAcquired: input.fieldsAcquired ?? [],
        art14NoticeStatus: noticeStatus,
      })
      .onConflictDoUpdate({
        target: [
          contactDataProvenance.tenantId,
          contactDataProvenance.subjectType,
          contactDataProvenance.subjectId,
        ],
        set: {
          source: input.source,
          sourceRecordId: input.sourceRecordId ?? null,
          subjectEmail: email,
          fieldsAcquired: input.fieldsAcquired ?? [],
          // Never walk a satisfied or suppressed status back to 'pending'.
          // Re-enrichment does not un-send a notice or un-object a person.
          art14NoticeStatus: sql`CASE
            WHEN ${contactDataProvenance.art14NoticeStatus} IN ('sent', 'suppressed', 'exempt')
              THEN ${contactDataProvenance.art14NoticeStatus}
            ELSE ${noticeStatus}
          END`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    // Provenance is evidence, not a feature. Losing it silently would put us
    // back where this story started, so it is logged loudly, but it does not
    // fail the enrichment that triggered it.
    log.error(
      {
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        err: err instanceof Error ? err.message : String(err),
      },
      'failed to record data provenance',
    );
  }
}

export interface SuppressInput {
  tenantId: string;
  email: string;
  reason: 'objection' | 'erasure' | 'manual';
  reasonDetail?: string;
  source?: string;
}

/**
 * Add someone to the do-not-acquire list, and mark any provenance rows for them
 * as suppressed so a notice is not sent to someone who just objected.
 */
export async function suppressContact(
  input: SuppressInput,
): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: 'email is required' };

  try {
    await db
      .insert(contactSuppressions)
      .values({
        tenantId: input.tenantId,
        email,
        reason: input.reason,
        reasonDetail: input.reasonDetail ?? null,
        source: input.source ?? 'privacy_request',
      })
      .onConflictDoNothing({
        target: [contactSuppressions.tenantId, contactSuppressions.email],
      });

    await db
      .update(contactDataProvenance)
      .set({ art14NoticeStatus: 'suppressed', updatedAt: new Date() })
      .where(
        and(
          eq(contactDataProvenance.tenantId, input.tenantId),
          eq(contactDataProvenance.subjectEmail, email),
        ),
      );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface Art14Due {
  id: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  subjectEmail: string | null;
  source: string;
  acquiredAt: Date;
  daysSinceAcquisition: number;
  overdue: boolean;
}

/** Records owed an Article 14 notice, oldest first, with the deadline applied. */
export async function findArt14NoticesDue(tenantId?: string): Promise<Art14Due[]> {
  const conditions = [eq(contactDataProvenance.art14NoticeStatus, 'pending')];
  if (tenantId) conditions.push(eq(contactDataProvenance.tenantId, tenantId));

  const rows = await db
    .select()
    .from(contactDataProvenance)
    .where(and(...conditions))
    .orderBy(contactDataProvenance.acquiredAt);

  const now = Date.now();
  return rows.map((r) => {
    const days = Math.floor((now - new Date(r.acquiredAt).getTime()) / 86_400_000);
    return {
      id: r.id,
      tenantId: r.tenantId,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      subjectEmail: r.subjectEmail,
      source: r.source,
      acquiredAt: new Date(r.acquiredAt),
      daysSinceAcquisition: days,
      overdue: days > ART14_NOTICE_DEADLINE_DAYS,
    };
  });
}

/** Mark a notice as sent. */
export async function markArt14NoticeSent(provenanceId: string): Promise<void> {
  await db
    .update(contactDataProvenance)
    .set({ art14NoticeStatus: 'sent', art14NoticeSentAt: new Date(), updatedAt: new Date() })
    .where(eq(contactDataProvenance.id, provenanceId));
}
