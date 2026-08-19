// LEGAL-011 / PROD-014 parity lock.
//
// POST /api/subscriptions/cancel existed only on Express, so in production
// nobody could cancel a subscription — the request 404'd. The edge function now
// serves it, which means the acknowledgement email exists twice:
//
//   server/services/cancellation-confirmation.ts   (Node, sends via email-service)
//   supabase/functions/_shared/cancellation-email.ts  (Deno, sends via SendGrid REST)
//
// State auto-renewal statutes are what the email is for, so the two copies
// agreeing is the whole point: a cancellation acknowledged on one backend and
// worded differently on the other is a compliance gap that no test would
// otherwise catch. This imports both and compares the rendered bodies.
import { describe, it, expect } from 'vitest';

import * as node from '../../services/cancellation-confirmation';
import * as edge from '../../../supabase/functions/_shared/cancellation-email';
import { PURGE_GRACE_DAYS } from '../../services/tenant-purge-service';

const EFFECTIVE = new Date('2026-09-01T00:00:00.000Z');

const CASES = [
  {
    recipientEmail: 'a@example.com',
    tenantName: 'Acme Copiers',
    immediate: true,
    effectiveDate: EFFECTIVE,
  },
  {
    recipientEmail: 'a@example.com',
    tenantName: 'Acme Copiers',
    immediate: false,
    effectiveDate: EFFECTIVE,
  },
  {
    recipientEmail: 'a@example.com',
    tenantName: 'Acme Copiers',
    planName: 'Professional',
    immediate: false,
    effectiveDate: EFFECTIVE,
  },
];

describe('cancellation email parity', () => {
  it('agrees on the grace period the email promises', () => {
    expect(edge.PURGE_GRACE_DAYS).toBe(PURGE_GRACE_DAYS);
  });

  it.each(CASES)(
    'renders the same subject, html and text (immediate=$immediate, plan=$planName)',
    (input) => {
      expect(edge.buildCancellationEmail(input)).toEqual(node.buildCancellationEmail(input));
    },
  );

  it('states the same export window on both sides', () => {
    expect(edge.dataHandlingSentence(EFFECTIVE)).toBe(node.dataHandlingSentence(EFFECTIVE));
  });

  it('names the export deadline as the grace period after access ends', () => {
    // October 1 is 30 days after September 1. If either copy drifted to a
    // different grace period, the customer would be told a date they cannot
    // rely on.
    expect(edge.dataHandlingSentence(EFFECTIVE)).toContain('October 1, 2026');
    expect(edge.dataHandlingSentence(EFFECTIVE)).toContain('30 days after');
  });

  it('says access already ended only for an immediate cancellation', () => {
    const now = edge.buildCancellationEmail(CASES[0]);
    const later = edge.buildCancellationEmail(CASES[1]);
    expect(now.text).toContain('access ended on');
    expect(later.text).toContain('You keep full access until');
    expect(now.subject).not.toBe(later.subject);
  });
});
