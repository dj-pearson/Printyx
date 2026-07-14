import { and, eq, lte, gte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
import {
  emailSequenceEnrollments,
  emailCampaigns,
  emailUnsubscribes,
  type EmailSequenceEnrollment,
  type SequenceStepHistoryEntry,
} from '@shared/schema';
import { sendEmail } from './email-service';

const log = createModuleLogger('email-sequence-scheduler');

/**
 * Email sequence / drip scheduler (CRMX-009).
 *
 * email_campaigns store sequence_steps but nothing advanced recipients through
 * them. This scheduler owns per-recipient state (email_sequence_enrollments):
 * it sends each due step through the SendGrid email service, advances to the
 * next step after its delay, and stops on suppression/unsubscribe. Respects a
 * per-tenant daily send limit. Idempotent via an atomic active→sending claim.
 *
 * NOTE: stop-on-reply requires inbound email parsing (CRMX-010) — not wired
 * here; stop-on-unsubscribe (email_unsubscribes) IS enforced.
 */

const DAILY_LIMIT = Number(process.env.EMAIL_SEQUENCE_DAILY_LIMIT || 2000);
const SEND_RETRY_MS = 60 * 60 * 1000; // retry a failed send in 1h
const MAX_STEP_ATTEMPTS = 3;

// deno is not involved here; sequence_steps is freeform jsonb. Interpret defensively.
interface SequenceStep {
  subject?: string;
  html?: string;
  body?: string;
  content?: string;
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
}

function stepDelayMs(step: SequenceStep | undefined): number {
  if (!step) return 0;
  return (
    (Number(step.delayDays) || 0) * 86_400_000 +
    (Number(step.delayHours) || 0) * 3_600_000 +
    (Number(step.delayMinutes) || 0) * 60_000
  );
}

function stepsOf(campaign: { sequenceSteps: unknown }): SequenceStep[] {
  return Array.isArray(campaign.sequenceSteps) ? (campaign.sequenceSteps as SequenceStep[]) : [];
}

async function isSuppressed(tenantId: string, email: string, campaignId: string): Promise<boolean> {
  const rows = await db
    .select({ id: emailUnsubscribes.id })
    .from(emailUnsubscribes)
    .where(
      and(
        eq(emailUnsubscribes.tenantId, tenantId),
        eq(emailUnsubscribes.email, email),
        or(
          eq(emailUnsubscribes.unsubscribeType, 'global'),
          and(
            eq(emailUnsubscribes.unsubscribeType, 'campaign'),
            eq(emailUnsubscribes.campaignId, campaignId),
          ),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function tenantSendsToday(tenantId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailSequenceEnrollments)
    .where(
      and(
        eq(emailSequenceEnrollments.tenantId, tenantId),
        gte(emailSequenceEnrollments.lastSentAt, startOfDay),
      ),
    );
  return Number(count) || 0;
}

/**
 * Enroll a recipient in a campaign's sequence. Idempotent per (campaign, email).
 * Returns the enrollment id, or null if the recipient is already enrolled or
 * globally/campaign suppressed.
 */
export async function enrollRecipient(
  tenantId: string,
  campaignId: string,
  recipient: { email: string; businessRecordId?: string; contactId?: string },
  enrolledBy?: string,
): Promise<string | null> {
  const email = recipient.email?.trim().toLowerCase();
  if (!email) return null;

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!campaign) return null;

  if (await isSuppressed(tenantId, email, campaignId)) return null;

  const steps = stepsOf(campaign);
  const nextSendAt = new Date(Date.now() + stepDelayMs(steps[0]));

  try {
    const [enrollment] = await db
      .insert(emailSequenceEnrollments)
      .values({
        tenantId,
        campaignId,
        recipientEmail: email,
        businessRecordId: recipient.businessRecordId ?? null,
        contactId: recipient.contactId ?? null,
        status: steps.length === 0 ? 'completed' : 'active',
        currentStep: 0,
        nextSendAt: steps.length === 0 ? null : nextSendAt,
        enrolledBy: enrolledBy ?? null,
      })
      .returning();
    return enrollment.id;
  } catch {
    // Unique (campaign, email) — already enrolled.
    const [existing] = await db
      .select({ id: emailSequenceEnrollments.id })
      .from(emailSequenceEnrollments)
      .where(
        and(
          eq(emailSequenceEnrollments.campaignId, campaignId),
          eq(emailSequenceEnrollments.recipientEmail, email),
        ),
      )
      .limit(1);
    return existing?.id ?? null;
  }
}

/** Stop a recipient's sequence. */
export async function unenrollRecipient(
  enrollmentId: string,
  tenantId: string,
  reason = 'manual',
): Promise<boolean> {
  const updated = await db
    .update(emailSequenceEnrollments)
    .set({ status: 'stopped', stoppedReason: reason, nextSendAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(emailSequenceEnrollments.id, enrollmentId),
        eq(emailSequenceEnrollments.tenantId, tenantId),
        or(
          eq(emailSequenceEnrollments.status, 'active'),
          eq(emailSequenceEnrollments.status, 'sending'),
        ),
      ),
    )
    .returning({ id: emailSequenceEnrollments.id });
  return updated.length > 0;
}

async function advanceEnrollment(enrollment: EmailSequenceEnrollment): Promise<void> {
  // Atomic claim: active → sending. Loser (overlapping tick) does nothing.
  const [claimed] = await db
    .update(emailSequenceEnrollments)
    .set({ status: 'sending', nextSendAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(emailSequenceEnrollments.id, enrollment.id),
        eq(emailSequenceEnrollments.status, 'active'),
      ),
    )
    .returning();
  if (!claimed) return;

  const revertActive = async (nextSendAt: Date, reason?: string) => {
    await db
      .update(emailSequenceEnrollments)
      .set({ status: 'active', nextSendAt, stoppedReason: reason ?? null, updatedAt: new Date() })
      .where(eq(emailSequenceEnrollments.id, claimed.id));
  };
  const stop = async (status: string, reason: string) => {
    await db
      .update(emailSequenceEnrollments)
      .set({ status, stoppedReason: reason, nextSendAt: null, updatedAt: new Date() })
      .where(eq(emailSequenceEnrollments.id, claimed.id));
  };

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, claimed.campaignId))
    .limit(1);
  if (!campaign) {
    await stop('failed', 'campaign not found');
    return;
  }
  // Honor a paused/cancelled campaign: hold the recipient, retry later.
  if (campaign.status === 'paused') {
    await revertActive(new Date(Date.now() + SEND_RETRY_MS));
    return;
  }
  if (campaign.status === 'cancelled') {
    await stop('stopped', 'campaign cancelled');
    return;
  }

  const steps = stepsOf(campaign);
  if (claimed.currentStep >= steps.length) {
    await stop('completed', 'sequence complete');
    return;
  }

  if (await isSuppressed(claimed.tenantId, claimed.recipientEmail, claimed.campaignId)) {
    await stop('unsubscribed', 'recipient unsubscribed');
    return;
  }

  if ((await tenantSendsToday(claimed.tenantId)) >= DAILY_LIMIT) {
    await revertActive(new Date(Date.now() + SEND_RETRY_MS), 'tenant daily send limit reached');
    return;
  }

  const step = steps[claimed.currentStep];
  const subject = step.subject || campaign.subject || 'Message';
  const html = step.html || step.body || step.content || '';
  const history = [...(claimed.history ?? [])];

  try {
    const result = await sendEmail({
      to: claimed.recipientEmail,
      subject,
      html,
      from: campaign.senderEmail || undefined,
    });
    const entry: SequenceStepHistoryEntry = {
      step: claimed.currentStep,
      sentAt: new Date().toISOString(),
      status: (result as { success?: boolean })?.success === false ? 'failed' : 'sent',
      messageId: (result as { messageId?: string })?.messageId,
    };
    history.push(entry);

    const nextStep = claimed.currentStep + 1;
    const hasMore = nextStep < steps.length;
    await db
      .update(emailSequenceEnrollments)
      .set({
        currentStep: nextStep,
        sendCount: (claimed.sendCount ?? 0) + 1,
        lastSentAt: new Date(),
        history,
        status: hasMore ? 'active' : 'completed',
        nextSendAt: hasMore ? new Date(Date.now() + stepDelayMs(steps[nextStep])) : null,
        updatedAt: new Date(),
      })
      .where(eq(emailSequenceEnrollments.id, claimed.id));
  } catch (error) {
    const attemptsForStep =
      history.filter((h) => h.step === claimed.currentStep && h.status === 'failed').length + 1;
    history.push({
      step: claimed.currentStep,
      sentAt: new Date().toISOString(),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
    if (attemptsForStep >= MAX_STEP_ATTEMPTS) {
      await db
        .update(emailSequenceEnrollments)
        .set({
          status: 'failed',
          stoppedReason: 'send failed after retries',
          history,
          nextSendAt: null,
          updatedAt: new Date(),
        })
        .where(eq(emailSequenceEnrollments.id, claimed.id));
    } else {
      await db
        .update(emailSequenceEnrollments)
        .set({
          status: 'active',
          history,
          nextSendAt: new Date(Date.now() + SEND_RETRY_MS),
          updatedAt: new Date(),
        })
        .where(eq(emailSequenceEnrollments.id, claimed.id));
    }
    log.warn(`[EmailSeq] send failed for enrollment ${claimed.id}:`, error);
  }
}

/** One sweep: advance all due enrollments. */
export async function tickEmailSequences(limit = 50): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(emailSequenceEnrollments)
    .where(
      and(
        eq(emailSequenceEnrollments.status, 'active'),
        lte(emailSequenceEnrollments.nextSendAt, now),
      ),
    )
    .orderBy(emailSequenceEnrollments.nextSendAt)
    .limit(limit);

  let advanced = 0;
  for (const enrollment of due) {
    try {
      await advanceEnrollment(enrollment);
      advanced++;
    } catch (e) {
      log.error(`[EmailSeq] tick error for ${enrollment.id}:`, e);
    }
  }
  return advanced;
}

let timer: NodeJS.Timeout | null = null;

export function startEmailSequenceScheduler(intervalMs = 60_000): () => void {
  if (timer) return stopEmailSequenceScheduler;
  log.info(`[EmailSeq] starting drip scheduler (every ${intervalMs}ms)`);
  timer = setInterval(() => {
    tickEmailSequences().catch((e) => log.error('[EmailSeq] scheduler tick error:', e));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return stopEmailSequenceScheduler;
}

export function stopEmailSequenceScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
