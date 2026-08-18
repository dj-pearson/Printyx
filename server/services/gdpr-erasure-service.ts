/**
 * GDPR Data Erasure Service (Right to Erasure — GDPR Article 17)
 *
 * Executes a data-subject erasure request by ANONYMIZING personal data in place
 * across the canonical tables that hold it, rather than hard-deleting rows.
 *
 * Why anonymize instead of DELETE:
 *  - Hard-deleting a `users` or `business_records` row breaks referential
 *    integrity (audit logs, created_by/owner_id back-references, invoices) and
 *    can destroy records the controller is legally REQUIRED to retain.
 *  - GDPR Art. 17(3)(b)/(e) explicitly exempts data whose retention is required
 *    for a legal obligation or the establishment/exercise/defence of legal
 *    claims (e.g. financial records, security audit logs). The compliant pattern
 *    for those is to sever the link to the natural person (anonymize the
 *    identifiers) while preserving the underlying business/financial record.
 *
 * Scope of this service:
 *  - LIVE systems only. Database backups (pg_dump archives, per CLAUDE.md) are
 *    intentionally NOT edited surgically; they age out under the documented
 *    backup retention schedule and are never selectively restored for an erased
 *    subject. This exclusion is a standard, defensible Art. 17 posture and is
 *    surfaced in the returned `notes` and the audit trail.
 *  - Every statement is tenant-scoped. Nothing crosses a tenant boundary.
 *  - Idempotent: redaction tokens are derived deterministically from the
 *    subjectId, so re-running an erasure produces the same result.
 */

import { createHash } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userSettings,
  businessRecords,
  companyContacts,
  enhancedContacts,
} from '../../shared/schema';
import {
  createStorageErasureClient,
  eraseSubjectStorageObjects,
  type StorageErasureResult,
} from './gdpr-storage-erasure';

export type ErasureSubjectType = 'user' | 'contact' | 'customer' | 'lead';

export interface ErasureInput {
  /**
   * The kind of subject. Pass 'auto' (or omit) when unknown — the service will
   * resolve it by looking the subjectId up in `users` then `business_records`.
   */
  subjectType?: ErasureSubjectType | 'auto' | string;
  subjectId: string;
  subjectEmail?: string | null;
  /** Advisory only — this service anonymizes all mapped identifiers regardless. */
  dataCategories?: string[];
}

export interface ErasureResult {
  /** Rows anonymized per table. */
  anonymized: Record<string, number>;
  /** Total rows affected across all tables. */
  totalRows: number;
  /**
   * Per-bucket outcome for uploaded objects (LEGAL-004). Reported alongside the
   * row counts because an erasure record that covers only the database
   * overstates what was actually erased.
   */
  storage: StorageErasureResult;
  /** Human-readable notes about scope, exemptions, and retained records. */
  notes: string[];
}

const REDACTED = '[erased]';

/** Deterministic, non-reversible token derived from the subject id. */
function redactionHash(subjectId: string): string {
  return createHash('sha256').update(subjectId).digest('hex').slice(0, 12);
}

/**
 * Unique, syntactically-valid but undeliverable placeholder email.
 * `.invalid` is reserved by RFC 2606 and can never resolve, so anonymized rows
 * keep a value in NOT NULL / unique email columns without impersonating anyone.
 */
function redactedEmail(subjectId: string): string {
  return `erased-${redactionHash(subjectId)}@erased.invalid`;
}

async function countedUpdate(updatePromise: Promise<Array<{ id: string }>>): Promise<number> {
  const rows = await updatePromise;
  return rows.length;
}

export class GdprErasureService {
  /**
   * Anonymize all personal data belonging to a subject within a tenant.
   * Returns a per-table summary suitable for the erasure audit record.
   */
  /**
   * Resolve the effective subject type, detecting it from the data when the
   * caller passes 'auto' or an unrecognized value. Detection is tenant-scoped.
   */
  private async resolveSubjectType(
    tenantId: string,
    subjectType: string | undefined,
    subjectId: string,
  ): Promise<ErasureSubjectType | 'unknown'> {
    if (
      subjectType === 'user' ||
      subjectType === 'contact' ||
      subjectType === 'customer' ||
      subjectType === 'lead'
    ) {
      return subjectType;
    }

    const userRow = await db.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.id, subjectId)),
      columns: { id: true },
    });
    if (userRow) return 'user';

    const recordRow = await db.query.businessRecords.findFirst({
      where: and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, subjectId)),
      columns: { id: true },
    });
    if (recordRow) return 'customer';

    return 'unknown';
  }

  async executeErasure(tenantId: string, input: ErasureInput): Promise<ErasureResult> {
    const { subjectId } = input;
    const anonymized: Record<string, number> = {};
    const notes: string[] = [];

    const token = REDACTED;
    const emailToken = redactedEmail(subjectId);

    const subjectType = await this.resolveSubjectType(tenantId, input.subjectType, subjectId);

    if (subjectType === 'unknown') {
      notes.push(
        'Subject id not found in live user or CRM tables for this tenant; no live records to anonymize (may already be erased or exist only in aged-out backups).',
      );
      return {
        anonymized,
        totalRows: 0,
        storage: {
          buckets: [],
          totalRemoved: 0,
          notes: ['Subject not resolved; no storage erasure attempted.'],
        },
        notes,
      };
    }

    // --- Platform/user subject -------------------------------------------------
    if (subjectType === 'user') {
      anonymized.users = await countedUpdate(
        db
          .update(users)
          .set({
            email: emailToken,
            firstName: token,
            lastName: token,
            profileImageUrl: null,
            passwordHash: null,
            employeeId: null,
            metadata: null,
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(eq(users.tenantId, tenantId), eq(users.id, subjectId)))
          .returning({ id: users.id }),
      );

      anonymized.user_settings = await countedUpdate(
        db
          .update(userSettings)
          .set({
            phone: null,
            jobTitle: null,
            department: null,
            bio: null,
            avatar: null,
            twoFactorSecret: null,
            updatedAt: new Date(),
          })
          .where(and(eq(userSettings.tenantId, tenantId), eq(userSettings.userId, subjectId)))
          .returning({ id: userSettings.id }),
      );

      notes.push(
        'User account anonymized and deactivated. Login credentials and 2FA secret cleared.',
      );
    }

    // --- CRM company / lead / customer subject ---------------------------------
    if (subjectType === 'contact' || subjectType === 'customer' || subjectType === 'lead') {
      // business_records: redact the natural-person contact identifiers while
      // preserving the business record and its financial/relationship fields.
      anonymized.business_records = await countedUpdate(
        db
          .update(businessRecords)
          .set({
            primaryContactName: token,
            primaryContactEmail: null,
            primaryContactPhone: null,
            primaryContactTitle: null,
            billingContactName: token,
            billingContactEmail: null,
            billingContactPhone: null,
            phone: null,
            fax: null,
            notes: null,
            accountNotes: null,
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, subjectId)))
          .returning({ id: businessRecords.id }),
      );

      // company_contacts (canonical) linked to this company record.
      anonymized.company_contacts = await countedUpdate(
        db
          .update(companyContacts)
          .set({
            salutation: null,
            firstName: token,
            lastName: token,
            title: null,
            department: null,
            phone: null,
            mobile: null,
            email: null,
            assistant: null,
            assistantPhone: null,
            otherPhone: null,
            homePhone: null,
            fax: null,
            birthdate: null,
            mailingAddress: null,
            mailingCity: null,
            mailingState: null,
            mailingZip: null,
            otherAddress: null,
            otherCity: null,
            otherState: null,
            otherZip: null,
            customFields: null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(companyContacts.tenantId, tenantId), eq(companyContacts.companyId, subjectId)),
          )
          .returning({ id: companyContacts.id }),
      );

      // enhanced_contacts (deprecated Salesforce-sync staging) linked to this company.
      anonymized.enhanced_contacts = await countedUpdate(
        db
          .update(enhancedContacts)
          .set({
            firstName: token,
            lastName: token,
            fullName: token,
            salutation: null,
            suffix: null,
            email: null,
            workPhone: null,
            mobilePhone: null,
            homePhone: null,
            otherPhone: null,
            fax: null,
            mailingAddressLine1: null,
            mailingCity: null,
            mailingState: null,
            mailingPostalCode: null,
            mailingCountry: null,
            birthdate: null,
            assistantName: null,
            assistantPhone: null,
            description: null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(enhancedContacts.tenantId, tenantId), eq(enhancedContacts.companyId, subjectId)),
          )
          .returning({ id: enhancedContacts.id }),
      );

      notes.push(
        'CRM contact identifiers anonymized. Business/financial fields (company name, invoices, contract history) retained under GDPR Art. 17(3)(b) — legal-obligation and legal-claims exemptions.',
      );
    }

    // --- Uploaded objects (LEGAL-004) -----------------------------------------
    // Anonymizing rows leaves the files. Documents, recordings and reports live
    // in Supabase Storage and are reached through the service client, not
    // Drizzle, because most of the tables referencing them are drift tables that
    // exist in no schema or migration.
    const storageClient = await createStorageErasureClient();
    const storage = await eraseSubjectStorageObjects(
      storageClient,
      tenantId,
      subjectType,
      subjectId,
    );
    notes.push(...storage.notes);

    // LEGAL-004: this note used to cover database backups only, and was carried
    // over unchanged when storage erasure was added. It does not transfer:
    // pg_dump archives do not contain storage objects, so "ages out under the
    // backup retention schedule" is not true of a bucket. Say what is actually
    // the case for each.
    notes.push(
      'Database backups excluded from surgical erasure. Backup archives age out under the documented retention schedule and are never selectively restored for the erased subject.',
    );
    notes.push(
      'Storage objects are NOT covered by database backups (pg_dump does not include bucket contents), so removal above is the only deletion step for them and there is no backup copy ageing out behind it. Any object reported as failed or unlinked above therefore still exists.',
    );
    notes.push(
      'Security audit logs retained for legal-obligation / integrity purposes (Art. 17(3)(b)); they record system actions, not marketing profile data.',
    );

    const totalRows = Object.values(anonymized).reduce((sum, n) => sum + n, 0);

    return { anonymized, totalRows, storage, notes };
  }
}

export const gdprErasureService = new GdprErasureService();
export default gdprErasureService;
