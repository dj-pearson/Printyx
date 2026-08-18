/**
 * Unit Tests: server/services/cancellation-confirmation.ts (LEGAL-011)
 *
 * The cancellation FLOW was already fine: self-serve, both modes, same medium
 * as signup, no retention gaunttlet. What was missing was the acknowledgement
 * several state auto-renewal statutes require.
 *
 * And it was missing in a specific way worth remembering: cancelSubscription
 * already wrote a notification row with channels ['in_app', 'email'], and
 * nothing anywhere read that table and sent anything. A recorded intention with
 * no mechanism behind it, which is the same shape as the cookie banner in
 * LEGAL-001.
 *
 * These tests pin the two things a statute would actually be read against: the
 * effective date is stated, and the data consequence is described truthfully.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCancellationEmail,
  dataHandlingSentence,
} from '../../services/cancellation-confirmation';

const BASE = {
  recipientEmail: 'owner@dealer.example',
  tenantName: 'Northgate Office Systems',
  effectiveDate: new Date('2026-09-15T00:00:00Z'),
};

describe('buildCancellationEmail', () => {
  it('states the effective date for an end-of-period cancellation', () => {
    const { subject, text, html } = buildCancellationEmail({ ...BASE, immediate: false });
    expect(subject).toContain('September 15, 2026');
    expect(text).toContain('September 15, 2026');
    expect(html).toContain('September 15, 2026');
  });

  it('distinguishes immediate from end-of-period, because they mean different things', () => {
    const immediate = buildCancellationEmail({ ...BASE, immediate: true });
    const endOfPeriod = buildCancellationEmail({ ...BASE, immediate: false });

    expect(immediate.text).toContain('access ended');
    expect(endOfPeriod.text).toContain('keep full access until');
    expect(immediate.subject).not.toBe(endOfPeriod.subject);
  });

  it('says plainly that no further charge will be made', () => {
    // The single sentence an auto-renewal complaint turns on.
    const { text } = buildCancellationEmail({ ...BASE, immediate: false });
    expect(text).toContain('will not be charged again');
  });

  it('names the organization so the recipient knows which account this is', () => {
    const { text, html } = buildCancellationEmail({ ...BASE, immediate: false });
    expect(text).toContain('Northgate Office Systems');
    expect(html).toContain('Northgate Office Systems');
  });

  it('tells the recipient what to do if they did not request it', () => {
    const { text } = buildCancellationEmail({ ...BASE, immediate: true });
    expect(text).toContain('did not request this cancellation');
    expect(text).toContain('support@printyx.net');
  });

  it('includes the plan name when there is one, and reads correctly without', () => {
    const withPlan = buildCancellationEmail({
      ...BASE,
      immediate: false,
      planName: 'Professional',
    });
    expect(withPlan.text).toContain('Professional subscription');

    const withoutPlan = buildCancellationEmail({ ...BASE, immediate: false });
    // No double space where the plan name would have been.
    expect(withoutPlan.text).not.toMatch(/ {2}/);
  });
});

describe('dataHandlingSentence', () => {
  it('gives the export deadline as 30 days after access ends', () => {
    const sentence = dataHandlingSentence(new Date('2026-09-15T00:00:00Z'));
    expect(sentence).toContain('October 15, 2026');
  });

  it('names the categories kept longer rather than implying everything goes', () => {
    const sentence = dataHandlingSentence(BASE.effectiveDate);
    expect(sentence).toContain('invoices');
    expect(sentence).toContain('audit');
    expect(sentence).toContain('support');
  });

  it('does not promise deletion has already happened', () => {
    // LEGAL-005's purge ships report-only until someone enables it. Promising
    // completed deletion here would be exactly the kind of untrue statement
    // this workstream exists to remove.
    const sentence = dataHandlingSentence(BASE.effectiveDate);
    expect(sentence).not.toMatch(/has been deleted|was deleted|already deleted/i);
  });
});
