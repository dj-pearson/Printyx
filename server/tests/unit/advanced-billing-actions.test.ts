import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 194. AdvancedBillingEngine's mobile Approve / Remind ran a 1.5s
 * setTimeout and then announced "Invoice approved and sent to customer" and
 * "Payment reminder sent" while sending nothing; the desktop View / Download
 * PDF / Send Invoice buttons had no handlers; and an "AI-Powered Billing
 * Intelligence" row showed invented anomalies, projections and renewal counts.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/AdvancedBillingEngine.tsx'), 'utf8'));
const FN = strip(
  readFileSync(join(root, 'supabase/functions/billing/handlers/invoices.ts'), 'utf8'),
);

describe('invoice actions do what they say', () => {
  it('no simulated send', () => {
    expect(PAGE).not.toMatch(/Simulate processing/);
    expect(PAGE).not.toContain('Invoice approved and sent to customer');
    expect(PAGE).not.toContain('Payment reminder sent');
    const handler = PAGE.slice(PAGE.indexOf('const handleSwipeAction'));
    expect(handler.slice(0, handler.indexOf('\n  };'))).not.toContain('setTimeout');
  });

  it('approve and remind call the billing function send endpoints, which exist', () => {
    expect(PAGE).toMatch(/apiRequest\(`\/api\/billing\/invoices\/\$\{invoiceId\}\/send`, 'PATCH'/);
    expect(PAGE).toMatch(/apiRequest\(`\/api\/billing\/invoices\/\$\{invoiceId\}\/email`, 'POST'/);
    expect(FN).toMatch(/req\.method === 'PATCH' && action === 'send'/);
    expect(FN).toMatch(/req\.method === 'POST' && action === 'email'/);
  });

  it('the desktop buttons are wired', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setPreviewInvoiceId\(invoice\.id\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => void downloadInvoicePdf\(invoice\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => handleSwipeAction\(invoice\.id, 'approve'\)\}/);
    expect(PAGE).toContain('<InvoicePDFPreview');
  });
});

describe('no invented billing intelligence', () => {
  it('the fabricated row is gone', () => {
    for (const s of [
      'ABC Corp',
      'XYZ Manufacturing',
      '* 1.08',
      '* 3.2',
      '+12% MoM',
      '7 contracts',
      '85% confidence',
    ]) {
      expect(PAGE, s).not.toContain(s);
    }
  });
});
