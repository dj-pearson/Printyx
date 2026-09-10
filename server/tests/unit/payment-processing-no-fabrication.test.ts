import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * payment-processing/charge inserted a payments row, flipped it to 'completed'
 * one statement later and answered "Payment processed successfully" - with no
 * processor in the call at all. /summary and /history read that same table, so
 * the fabrication was indistinguishable from a settlement downstream.
 *
 * It then wrote to invoices using an id taken straight from the request body,
 * unfiltered by tenant on both the read and the update, through the
 * service-role client: any authenticated user could mark another tenant's
 * invoice paid, by an amount they chose. It wrote the LEGACY `status` column
 * while every read path uses `invoice_status`, and never recomputed balance_due.
 *
 * Both /charge and /refund answer 501 now. Real capture is StripeService.
 */
const SRC = readFileSync('supabase/functions/payment-processing/index.ts', 'utf8');
/** Comments blanked: an absence assertion must not be cleared by the note
 *  explaining the removal. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('payment-processing', () => {
  it('does not touch invoices at all', () => {
    expect(CODE).not.toMatch(/\.from\('invoices'\)/);
  });

  it('never writes a completed payment', () => {
    expect(CODE).not.toMatch(/status:\s*'completed'/);
  });

  it('answers 501 for charge and refund', () => {
    expect(CODE).toMatch(/endpoint === 'charge'[\s\S]{0,400}?501/);
    expect(CODE).toMatch(/endpoint === 'refund'[\s\S]{0,400}?501/);
  });

  it('keeps the real db-backed branches: void, methods, history, summary', () => {
    for (const branch of ['void', 'methods', 'history', 'summary']) {
      expect(CODE).toContain(`endpoint === '${branch}'`);
    }
    // void still scopes to the tenant and only touches a pending payment
    expect(CODE).toMatch(/\.eq\('tenant_id', tenantId\)[\s\S]{0,80}?\.eq\('status', 'pending'\)/);
  });
});
