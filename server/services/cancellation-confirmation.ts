/**
 * Cancellation confirmation (LEGAL-011).
 *
 * Several state auto-renewal statutes require an acknowledgement when a
 * subscriber cancels. The cancellation flow itself was already sound - self
 * serve, both immediate and end-of-period, same medium as signup, no retention
 * gauntlet - but nothing confirmed it to the customer.
 *
 * Worth being precise about what was missing, because it was not "no code".
 * cancelSubscription already wrote a subscription_events row and a
 * subscription_notifications row with channels ['in_app', 'email']. The event
 * and the in-app notification were real. The email was not: nothing anywhere
 * reads subscription_notifications with status 'pending' and sends it. The
 * channels array was recorded and never acted on, which is the same shape of
 * bug as the cookie banner in LEGAL-001 - a stored intention with no mechanism
 * behind it.
 *
 * So this module sends the mail, and states the effective date and the data
 * consequence, which is what the statutes actually care about.
 */

import { createModuleLogger } from '../lib/logger';
import { sendEmail } from './email-service';
import { PURGE_GRACE_DAYS } from './tenant-purge-service';

const log = createModuleLogger('cancellation-confirmation');

export interface CancellationConfirmationInput {
  recipientEmail: string;
  tenantName: string;
  planName?: string;
  /** True when the subscription ended now, false when it runs to period end. */
  immediate: boolean;
  /** The date access actually ends. */
  effectiveDate: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * The data-handling sentence.
 *
 * Deliberately describes the CURRENT behavior rather than the aspirational
 * policy. The 30-day purge (LEGAL-005) ships report-only until someone enables
 * it, so promising deletion "within 30 days" in an email would be the same kind
 * of untrue statement this workstream exists to remove. It states the export
 * window, which is true either way, and points at the policy for the rest.
 */
export function dataHandlingSentence(effectiveDate: Date): string {
  const exportUntil = new Date(effectiveDate.getTime() + PURGE_GRACE_DAYS * 86_400_000);
  return (
    `You can export your data until ${formatDate(exportUntil)}, ${PURGE_GRACE_DAYS} days after ` +
    `your access ends. After that, account and business data is deleted or anonymized, except ` +
    `records we are required to keep for longer (invoices and financial records, security and ` +
    `audit logs, and support history). Our Privacy Policy sets out each period.`
  );
}

export function buildCancellationEmail(input: CancellationConfirmationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { tenantName, planName, immediate, effectiveDate } = input;
  const plan = planName ? `${planName} ` : '';
  const dateStr = formatDate(effectiveDate);

  const whatHappens = immediate
    ? `Your ${plan}subscription was canceled immediately and access ended on ${dateStr}.`
    : `Your ${plan}subscription is canceled and will not renew. You keep full access until ${dateStr}.`;

  const subject = immediate
    ? 'Your Printyx subscription has been canceled'
    : `Your Printyx subscription is canceled and ends ${dateStr}`;

  const dataSentence = dataHandlingSentence(effectiveDate);

  const text = [
    `Cancellation confirmed for ${tenantName}.`,
    '',
    whatHappens,
    '',
    'You will not be charged again.',
    '',
    dataSentence,
    '',
    'Changed your mind? You can resubscribe at any time from Settings > Subscription.',
    '',
    'If you did not request this cancellation, contact support@printyx.net immediately.',
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; line-height: 1.6; color: #1f2937;">
      <h2 style="font-size: 20px; margin: 0 0 16px;">Cancellation confirmed</h2>
      <p style="margin: 0 0 16px;">This confirms the cancellation of the Printyx subscription for <strong>${tenantName}</strong>.</p>
      <p style="margin: 0 0 16px;">${whatHappens}</p>
      <p style="margin: 0 0 16px;"><strong>You will not be charged again.</strong></p>
      <h3 style="font-size: 16px; margin: 24px 0 8px;">What happens to your data</h3>
      <p style="margin: 0 0 16px;">${dataSentence}</p>
      <p style="margin: 0 0 16px;">Changed your mind? You can resubscribe at any time from Settings &gt; Subscription.</p>
      <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
        If you did not request this cancellation, contact
        <a href="mailto:support@printyx.net">support@printyx.net</a> immediately.
      </p>
    </div>
  `.trim();

  return { subject, html, text };
}

/**
 * Send the confirmation.
 *
 * Never throws. A cancellation that succeeded must not be reported as failed
 * because the mail server was down, but the failure is logged rather than
 * swallowed, because an unconfirmed cancellation is the thing the statutes are
 * about.
 */
export async function sendCancellationConfirmation(
  input: CancellationConfirmationInput,
): Promise<{ sent: boolean; error?: string }> {
  const { subject, html, text } = buildCancellationEmail(input);

  try {
    const result = await sendEmail({ to: input.recipientEmail, subject, html, text });
    if (!result?.success) {
      log.error(
        { to: input.recipientEmail, error: result?.error },
        'cancellation confirmation email failed',
      );
      return { sent: false, error: result?.error ?? 'unknown email failure' };
    }
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ to: input.recipientEmail, error }, 'cancellation confirmation email threw');
    return { sent: false, error };
  }
}
