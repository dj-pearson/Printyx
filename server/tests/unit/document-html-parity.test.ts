// Locks the two copies of the purchase-agreement renderer together.
//
// server/lib/document-html.ts (Express side) and
// supabase/functions/_shared/document-html.ts (Deno) render the same agreement.
// This one produces a document rather than a number, so a drift is less
// dangerous than the quote-math one — but a customer could still receive a
// different contract depending on which backend served the export, which is not
// a difference anyone would notice until it mattered.
import { describe, it, expect } from 'vitest';
import { generateDocumentHTML as expressRender } from '../../lib/document-html';
import { generateDocumentHtml as edgeRender } from '../../../supabase/functions/_shared/document-html';

const full = {
  id: 'doc-1',
  agreementNumber: 'PA-2026-0042',
  customerName: 'Des Moines Public Schools',
  buyerName: 'DMPS Purchasing',
  buyerAddress: '2100 Fleur Dr\nDes Moines, IA 50321',
  shipToName: 'DMPS Warehouse',
  shipToAddress: '1801 16th St, Des Moines, IA',
  poNumber: 'PO-99881',
  orderDate: '2026-03-02',
  includeServiceContract: true,
  serviceTerm: 48,
  serviceStartDate: '2026-04-01',
  autoRenewal: true,
  minimumBlackPrints: 8000,
  minimumColorPrints: 1500,
  monthlyBase: 245.5,
  blackRate: 0.0072,
  colorRate: 0.0489,
  includeBlackSupplies: true,
  includeColorSupplies: false,
  paymentTerms: 'net_30',
  specialTerms: 'Delivery restricted to school holidays.',
  authorizedSignerTitle: 'Director of Operations',
  lineItems: [
    {
      quantity: 3,
      description: 'Canon imageRUNNER C5560i',
      unitPrice: 8499.99,
      totalPrice: 25499.97,
    },
    { quantity: 1, description: 'Finisher unit', unitPrice: 1299.5, totalPrice: 1299.5 },
  ],
};

// Each case pokes a different branch in the template.
const CASES: Array<[string, Record<string, unknown>]> = [
  ['fully populated agreement', full],
  ['no service contract', { ...full, includeServiceContract: false }],
  ['service contract without auto-renewal', { ...full, autoRenewal: false }],
  ['colour supplies included', { ...full, includeColorSupplies: true }],
  ['no line items', { ...full, lineItems: [] }],
  ['missing line item fields', { ...full, lineItems: [{}] }],
  ['no special terms', { ...full, specialTerms: undefined }],
  ['net 15 terms', { ...full, paymentTerms: 'net_15' }],
  ['net 60 terms', { ...full, paymentTerms: 'net_60' }],
  ['due on receipt', { ...full, paymentTerms: 'due_on_receipt' }],
  ['ship-to falls back to buyer', { ...full, shipToName: undefined, shipToAddress: undefined }],
  ['buyer falls back to customer name', { ...full, buyerName: undefined, buyerAddress: undefined }],
  [
    'service defaults when unset',
    {
      ...full,
      serviceTerm: undefined,
      minimumBlackPrints: undefined,
      minimumColorPrints: undefined,
      monthlyBase: undefined,
      blackRate: undefined,
      colorRate: undefined,
    },
  ],
  ['no signer title', { ...full, authorizedSignerTitle: undefined }],
];

describe('purchase-agreement renderer parity', () => {
  it.each(CASES)('renders identically: %s', (_label, doc) => {
    expect(edgeRender(doc)).toBe(expressRender(doc));
  });

  it('includes the agreement number and totals the line items', () => {
    const html = edgeRender(full);
    expect(html).toContain('PA-2026-0042');
    expect(html).toContain('26799.47');
  });

  it('omits the maintenance section when there is no service contract', () => {
    const html = edgeRender({ ...full, includeServiceContract: false });
    expect(html).not.toContain('MAINTENANCE SERVICE AGREEMENT');
  });
});
