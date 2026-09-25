// Round 207. The predictive-failure agent inserted "draft" tickets with status
// 'pending_review', which migration 0078's CHECK refuses on every INSERT, so no
// predicted-failure ticket was ever created and approving one dispatched
// nothing. The ticket is created on approval now.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ticketFromPrediction } from '../../../supabase/functions/predictive-failure/_ticket';
import { SERVICE_TICKET_STATUSES } from '../../../supabase/functions/_shared/service-ticket-vocabulary';

const strip = (s: string) =>
  s.replace(/(?<![:/'"`])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const SRC = strip(readFileSync('supabase/functions/predictive-failure/index.ts', 'utf8'));
const input = { tenantId: 't1', userId: 'u1', now: new Date('2026-09-23'), ticketNumber: 'PF-x' };
const prediction = {
  id: 'p1',
  machine_id: 'm1',
  confidence: '0.9',
  predicted_window_end: '2026-10-07T00:00:00Z',
  signals: { suggested_parts: ['fuser', 'drum'] },
};

describe('ticketFromPrediction', () => {
  it('builds a dispatchable ticket in the vocabulary, owned by the approver', () => {
    const plan = ticketFromPrediction(prediction, { customer_id: 'c1' }, input);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(SERVICE_TICKET_STATUSES).toContain(plan.payload.status as never);
    expect(plan.payload).toMatchObject({
      tenant_id: 't1',
      customer_id: 'c1',
      equipment_id: 'm1',
      status: 'open',
      priority: 'high',
      created_by: 'u1',
      required_parts: ['fuser', 'drum'],
      scheduled_date: '2026-10-07T00:00:00Z',
    });
  });

  it('medium priority below 0.85, and no parts reads "none"', () => {
    const plan = ticketFromPrediction(
      { ...prediction, confidence: 0.6, signals: null },
      { customer_id: 'c1' },
      input,
    );
    expect(plan.ok && plan.payload.priority).toBe('medium');
    expect(plan.ok && String(plan.payload.description)).toContain('Suggested parts: none');
  });

  it('refuses a machine with no customer rather than inserting a ticket that cannot save', () => {
    expect(ticketFromPrediction(prediction, { customer_id: null }, input)).toMatchObject({
      ok: false,
      code: 'NO_CUSTOMER',
    });
    expect(ticketFromPrediction(prediction, null, input).ok).toBe(false);
  });
});

describe('predictive-failure edge function', () => {
  it('scoring creates no ticket and never writes pending_review', () => {
    const score = SRC.slice(
      SRC.indexOf('let aboveThreshold = 0;'),
      SRC.indexOf('function handlePredictionAction'),
    );
    expect(score).not.toContain("from('service_tickets')");
    expect(SRC).not.toContain('pending_review');
    expect(score).toMatch(/if \(s\.confidence >= threshold\) aboveThreshold\+\+;/);
  });

  it('approval claims the prediction, then inserts, then releases the claim on failure', () => {
    const at = SRC.indexOf("if (action === 'approve') {");
    const body = SRC.slice(at, SRC.indexOf("if (action === 'snooze') {", at));
    const claim = body.indexOf(".update({ ...base, status: 'approved' })");
    const insert = body.indexOf('.insert(plan.payload)');
    const release = body.indexOf('.update({ status: prediction.status, reviewed_by_user_id: null');
    expect(claim).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(claim);
    expect(release).toBeGreaterThan(insert);
    // The claim is conditional, so two racing approvals create one ticket.
    const claimChain = body.slice(claim, insert);
    expect(claimChain).toContain(".eq('status', prediction.status)");
    expect(claimChain).toContain(".is('service_ticket_id', null)");
    expect(claimChain).toMatch(/if \(!claimed \|\| claimed\.length === 0\)[\s\S]{0,200}409/);
    // Already approved answers 409 before anything is written.
    expect(body.indexOf('ALREADY_APPROVED')).toBeLessThan(claim);
  });

  it('dismiss no longer tries to cancel a ticket that cannot exist', () => {
    const at = SRC.indexOf("if (action === 'dismiss') {");
    const body = SRC.slice(at, SRC.indexOf('return createCorsResponse', at));
    expect(body).not.toContain("from('service_tickets')");
  });
});
