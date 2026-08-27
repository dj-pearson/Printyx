import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
import {
  webForms,
  webFormSubmissions,
  businessRecords,
  type WebForm,
  type WebFormField,
} from '@shared/schema';
import { findDuplicates } from './csv-import-service';
import { leadIntelligenceService } from './lead-intelligence-service';
import { autoLeadRoutingService } from './auto-lead-routing-service';
import { dispatchWorkflowEvent, enrollExecution } from './workflow-runtime';

const log = createModuleLogger('web-form-processor');

/**
 * Web-form submission processor (CRMX-011).
 *
 * The public edge function only CAPTURES submissions (status='new'). This Node
 * worker turns each capture into a CRM lead — where the CRM services live —
 * doing the heavy lifting:
 *   dedup → create/link business_records lead → score → route → workflow trigger.
 *
 * Idempotent: each submission is claimed with an atomic new→processing update,
 * so overlapping ticks never double-process. Every step that reaches an external
 * service (scoring/routing/workflow) is best-effort and never fails the lead.
 */

interface MappedLead {
  lead: Record<string, unknown>;
  custom: Record<string, unknown>;
}

// Map a raw submission payload onto business_records columns using the form's
// per-field `mapTo`. `cf_<key>` maps into the customFields jsonb (CRMX-004).
function mapPayloadToLead(fields: WebFormField[], payload: Record<string, unknown>): MappedLead {
  const lead: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};
  for (const f of fields ?? []) {
    const value = payload[f.key];
    if (value === undefined || value === null || value === '') continue;
    if (!f.mapTo) continue;
    if (f.mapTo.startsWith('cf_')) custom[f.mapTo.slice(3)] = value;
    else lead[f.mapTo] = value;
  }
  return { lead, custom };
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Process one captured submission end-to-end. Returns the resulting lead id (or
 * null if it was spam/failed). Safe to call concurrently.
 */
export async function processFormSubmission(submissionId: string): Promise<string | null> {
  // Atomic claim: only the worker that flips new→processing proceeds.
  const [claimed] = await db
    .update(webFormSubmissions)
    .set({ status: 'processing' })
    .where(and(eq(webFormSubmissions.id, submissionId), eq(webFormSubmissions.status, 'new')))
    .returning();
  if (!claimed) return null;

  const tenantId = claimed.tenantId;
  try {
    const [resolvedForm] = (await db
      .select()
      .from(webForms)
      .where(and(eq(webForms.id, claimed.formId), eq(webForms.tenantId, tenantId)))
      .limit(1)) as WebForm[];

    if (!resolvedForm) {
      throw new Error(`Form ${claimed.formId} not found for tenant`);
    }

    const payload = (claimed.payload as Record<string, unknown>) ?? {};
    const { lead, custom } = mapPayloadToLead(resolvedForm.fields ?? [], payload);

    const email = asString(lead.primaryContactEmail) ?? asString(payload.email);
    const contactName = asString(lead.primaryContactName) ?? asString(payload.name);
    const companyName =
      asString(lead.companyName) ?? contactName ?? email ?? `Web form: ${resolvedForm.name}`;

    // Dedup against existing accounts (companyName/email/phone).
    const duplicates = await findDuplicates(
      {
        companyName,
        email,
        phone: asString(lead.primaryContactPhone) ?? asString(payload.phone),
      },
      'business_records',
      tenantId,
    );

    let businessRecordId: string;
    let deduped = false;

    if (duplicates.length > 0) {
      businessRecordId = duplicates[0].existingId;
      deduped = true;
      log.info(`[WebForm] submission ${submissionId} deduped to ${businessRecordId}`);
    } else {
      const [created] = await db
        .insert(businessRecords)
        .values({
          tenantId,
          recordType: 'lead',
          status: 'new',
          companyName,
          primaryContactName: contactName ?? null,
          primaryContactEmail: email ?? null,
          primaryContactPhone:
            asString(lead.primaryContactPhone) ?? asString(payload.phone) ?? null,
          leadSource: resolvedForm.settings?.leadSource ?? 'web_form',
          // business_records.created_by is NOT NULL with no default
          // (migration 0000) and nobody is logged in when a web form is
          // submitted. Without this the insert throws and the submission is
          // never converted — the `as $inferInsert` cast below is why tsc did
          // not say so. 'system' is the sentinel the seeders use.
          createdBy: 'system',
          ownerId: resolvedForm.settings?.defaultOwnerId ?? null,
          customFields: custom,
          externalData: {
            webFormId: resolvedForm.id,
            webFormSubmissionId: submissionId,
            utm: claimed.utm ?? {},
            referrer: claimed.referrer ?? null,
          },
          // Any remaining directly-mapped columns win last.
          ...lead,
        } as typeof businessRecords.$inferInsert)
        .returning();
      businessRecordId = created.id;
      log.info(`[WebForm] submission ${submissionId} created lead ${businessRecordId}`);
    }

    // Finalize the submission record.
    await db
      .update(webFormSubmissions)
      .set({
        status: deduped ? 'duplicate' : 'processed',
        businessRecordId,
        dedupedToExisting: deduped,
        processedAt: new Date(),
      })
      .where(eq(webFormSubmissions.id, submissionId));

    await db
      .update(webForms)
      .set({ submissionCount: (resolvedForm.submissionCount ?? 0) + 1, updatedAt: new Date() })
      .where(eq(webForms.id, resolvedForm.id));

    // Best-effort downstream automation (never fails the lead capture).
    if (!deduped) {
      try {
        await leadIntelligenceService.processNewLead(businessRecordId, tenantId);
      } catch (e) {
        log.warn(`[WebForm] scoring failed for ${businessRecordId}:`, e as Error);
      }
      try {
        await autoLeadRoutingService.routeLeadAutomatically(businessRecordId, tenantId);
      } catch (e) {
        log.warn(`[WebForm] routing failed for ${businessRecordId}:`, e as Error);
      }
    }

    // Workflow triggers: the generic form.submitted event + an optional explicit
    // autoresponder/nurture workflow configured on the form.
    try {
      await dispatchWorkflowEvent(
        tenantId,
        'form.submitted',
        {
          formId: resolvedForm.id,
          formName: resolvedForm.name,
          submissionId,
          recordId: businessRecordId,
          businessRecordId,
          deduped,
          ...payload,
        },
        { dedupeKey: `form-submission:${submissionId}`, initiatedBy: 'system' },
      );
      if (resolvedForm.settings?.autoresponderWorkflowId) {
        await enrollExecution({
          tenantId,
          workflowId: resolvedForm.settings.autoresponderWorkflowId,
          context: { formId: resolvedForm.id, submissionId, businessRecordId, ...payload },
          initiatedBy: 'system',
          dedupeKey: `form-autoresponder:${submissionId}`,
        });
      }
    } catch (e) {
      log.warn(`[WebForm] workflow dispatch failed for submission ${submissionId}:`, e as Error);
    }

    return businessRecordId;
  } catch (error) {
    log.error(`[WebForm] failed to process submission ${submissionId}:`, error);
    await db
      .update(webFormSubmissions)
      .set({
        status: 'error',
        processingError: error instanceof Error ? error.message : String(error),
        processedAt: new Date(),
      })
      .where(eq(webFormSubmissions.id, submissionId));
    return null;
  }
}

/** One sweep: process up to `limit` newly-captured submissions. */
export async function processNewFormSubmissions(limit = 25): Promise<number> {
  const pending = await db
    .select({ id: webFormSubmissions.id })
    .from(webFormSubmissions)
    .where(eq(webFormSubmissions.status, 'new'))
    .orderBy(webFormSubmissions.createdAt)
    .limit(limit);

  let processed = 0;
  for (const row of pending) {
    const result = await processFormSubmission(row.id);
    if (result) processed++;
  }
  return processed;
}

let processorTimer: NodeJS.Timeout | null = null;

/** Start the periodic submission processor. Idempotent. */
export function startWebFormProcessor(intervalMs = 30_000): () => void {
  if (processorTimer) return stopWebFormProcessor;
  log.info(`[WebForm] starting submission processor (every ${intervalMs}ms)`);
  processorTimer = setInterval(() => {
    processNewFormSubmissions().catch((e) => log.error('[WebForm] processor tick error:', e));
  }, intervalMs);
  if (typeof processorTimer.unref === 'function') processorTimer.unref();
  return stopWebFormProcessor;
}

export function stopWebFormProcessor(): void {
  if (processorTimer) {
    clearInterval(processorTimer);
    processorTimer = null;
  }
}
