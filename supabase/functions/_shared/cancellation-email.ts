/**
 * Cancellation confirmation email body (LEGAL-011, ported under PROD-014).
 *
 * The cancellation flow itself lived only on Express: the frontend posts to
 * POST /api/subscriptions/cancel, and no edge function answered that path, so
 * in production nobody could cancel at all. Porting it means the edge function
 * has to send the same acknowledgement — several state auto-renewal statutes
 * require one, and a cancellation confirmed on one backend and silent on the
 * other is the failure mode those statutes exist to prevent.
 *
 * Only the body-building is here, because only that is pure. Sending differs
 * (email-service on Node, the SendGrid REST wrapper on Deno).
 * server/services/cancellation-confirmation.ts holds the Node copy and
 * server/tests/unit/cancellation-email-parity.test.ts fails on drift.
 *
 * Deno copy.
 */

/** Days after access ends during which export still works (tenant purge grace). */
export const PURGE_GRACE_DAYS = 30;

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
