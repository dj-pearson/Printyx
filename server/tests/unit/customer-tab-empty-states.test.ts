// UI-DEAD-BUTTONS-001 (round 203). The customer detail tabs each ended their
// empty state on a "Create First X" button with no handler, and the invoices
// tab's Send Statements did nothing. Each now reaches a create flow that
// already exists, and Send Statements emails through the real endpoint.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sendStatements, statementSendToast } from '../../../client/src/lib/invoice-statements';

const read = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/(?<![:/'"`])\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const C = 'client/src/components/customer/';

describe('empty-state create buttons', () => {
  it('equipment opens the existing Add dialog', () => {
    expect(read(C + 'CustomerEquipment.tsx')).toMatch(
      /<Button onClick=\{\(\) => setAddOpen\(true\)\}>\s*<Plus[^>]*\/>\s*Add First Equipment/,
    );
  });

  it('quotes open the builder prefilled with this customer', async () => {
    const src = read(C + 'CustomerQuotes.tsx');
    expect(src).toMatch(/<Link href=\{newQuoteHref\(customerId, customerName\)\}>/);
    const { newQuoteHref } = await import('../../../client/src/components/customer/CustomerQuotes');
    const url = new URL(newQuoteHref('c-1', 'Acme & Co'), 'https://x');
    expect(url.pathname).toBe('/quotes/new');
    expect(url.searchParams.get('leadId')).toBe('c-1');
    expect(url.searchParams.get('prefill')).toBe('true');
    expect(url.searchParams.get('companyName')).toBe('Acme & Co');
    // The builder reads exactly these names.
    const qb = read('client/src/components/quote-builder/QuoteBuilder.tsx');
    expect(qb).toContain("urlParams.get('leadId')");
    expect(qb).toContain("urlParams.get('prefill') === 'true'");
  });

  it('contracts open the create dialog with the customer filled in, once', () => {
    expect(read(C + 'CustomerContracts.tsx')).toMatch(
      /<Link href=\{`\/contracts\?action=new&customerId=\$\{encodeURIComponent\(customerId\)\}`\}>/,
    );
    const page = read('client/src/pages/contracts.tsx');
    expect(page).toMatch(/params\.get\('action'\) === 'new' \|\| customerIdFromUrl/);
    expect(page).toMatch(
      /setContractForm\(\(prev\) => \(\{ \.\.\.prev, customerId: customerIdFromUrl \}\)\)/,
    );
    // Stripped, so a refresh does not reopen the dialog.
    expect(page).toContain("params.delete('action');");
    expect(page).toContain("params.delete('customerId');");
    expect(page).toMatch(/window\.history\.replaceState\(/);
  });

  it('invoices open the generator and tickets the service hub, both of which read ?action=new', () => {
    expect(read(C + 'CustomerInvoices.tsx')).toContain('<Link href="/invoices?action=new">');
    expect(read('client/src/pages/Invoices.tsx')).toMatch(
      /quickAction === 'new'\) setIsGenerateDialogOpen\(true\)/,
    );
    const svc = read(C + 'CustomerServiceHistory.tsx');
    expect(svc).toMatch(
      /activeTab === 'tickets' && \(\s*<Button asChild>\s*<Link href="\/service-hub\?action=new">/,
    );
    expect(svc).not.toContain('Create First Service Call');
    expect(read('client/src/pages/ServiceHub.tsx')).toMatch(
      /quickAction === 'new'\) setShowPhoneInCreator\(true\)/,
    );
  });
});

describe('Send Statements', () => {
  it('emails each selected invoice through the billing endpoint after a confirm', () => {
    const src = read(C + 'CustomerInvoices.tsx');
    expect(src).toMatch(/onClick=\{\(\) => void handleSendStatements\(\)\}/);
    const at = src.indexOf('const handleSendStatements');
    const body = src.slice(at, src.indexOf('\n  };', at));
    expect(body.indexOf('await confirm(')).toBeGreaterThan(-1);
    expect(body.indexOf('await confirm(')).toBeLessThan(body.indexOf('sendStatements('));
    expect(body).toContain('`/api/billing/invoices/${id}/email`');
    expect(body).toContain('setSelectedInvoices(outcome.failed)');
  });

  it('counts what was sent, carries on past a failure, and keeps failures', async () => {
    const outcome = await sendStatements(['a', 'b', 'c'], async (id) => {
      if (id === 'b') throw new Error('400: no email');
    });
    expect(outcome).toEqual({ sent: ['a', 'c'], failed: ['b'] });
    const t = statementSendToast(outcome);
    expect(t.variant).toBe('destructive');
    expect(t.description).toContain('Emailed 2 of 3');
  });

  it('never reports a failed send as a success', () => {
    expect(statementSendToast({ sent: [], failed: ['a'] }).title).toBe('Nothing sent');
    expect(statementSendToast({ sent: ['a'], failed: [] })).toEqual({
      title: 'Statements sent',
      description: 'Emailed 1 invoice.',
    });
    expect(statementSendToast({ sent: [], failed: [] }).title).toBe('Nothing selected');
  });
});
