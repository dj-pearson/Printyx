// PROP-004 / PROP-005: canonical proposal merge-field registry.
//
// One source of truth for the {{tokens}} a proposal template may contain. The
// template editor (PROP-004) offers these in an "Insert field" menu; the merge
// engine (PROP-005) resolves them against a real quote/branding record. Keeping
// the list here (a Node- AND Deno-importable plain module, no runtime deps) means
// the editor and the renderer can never drift.

export type MergeFieldGroup = 'customer' | 'contact' | 'quote' | 'branding';

export interface MergeField {
  /** The token as it appears in template content, e.g. "{{customer.name}}". */
  token: string;
  /** Human label for the insert menu. */
  label: string;
  group: MergeFieldGroup;
  /** Sample value used for live preview in the editor. */
  sample: string;
  /** True when the token expands to an HTML block (not inline text). */
  isHtmlBlock?: boolean;
}

export const MERGE_FIELDS: MergeField[] = [
  // Customer
  {
    token: '{{customer.name}}',
    label: 'Customer Name',
    group: 'customer',
    sample: 'Acme Corporation',
  },
  {
    token: '{{customer.companyName}}',
    label: 'Customer Company',
    group: 'customer',
    sample: 'Acme Corporation',
  },
  // Contact
  { token: '{{contact.name}}', label: 'Contact Name', group: 'contact', sample: 'Jane Buyer' },
  // Quote
  { token: '{{quote.number}}', label: 'Quote Number', group: 'quote', sample: 'PROP-2026-0042' },
  {
    token: '{{quote.title}}',
    label: 'Quote Title',
    group: 'quote',
    sample: 'Office Print Fleet Proposal',
  },
  { token: '{{quote.validUntil}}', label: 'Valid Until', group: 'quote', sample: 'July 31, 2026' },
  {
    token: '{{quote.lineItemsTable}}',
    label: 'Line Items Table',
    group: 'quote',
    sample:
      '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead><tbody><tr><td>Sample Copier MX-100</td><td style="text-align:center">2</td><td style="text-align:right">$3,500</td><td style="text-align:right">$7,000</td></tr></tbody></table>',
    isHtmlBlock: true,
  },
  { token: '{{quote.oneTimeTotal}}', label: 'One-time Total', group: 'quote', sample: '$7,000' },
  {
    token: '{{quote.recurringTotal}}',
    label: 'Recurring Total',
    group: 'quote',
    sample: '$120 / month',
  },
  { token: '{{quote.totalAmount}}', label: 'Total Amount', group: 'quote', sample: '$7,000' },
  // Branding
  {
    token: '{{branding.logo}}',
    label: 'Company Logo',
    group: 'branding',
    sample:
      '<div style="display:inline-block;padding:8px 16px;border:1px dashed #999;border-radius:4px;color:#666;font-size:12px">LOGO</div>',
    isHtmlBlock: true,
  },
  {
    token: '{{branding.companyName}}',
    label: 'Your Company Name',
    group: 'branding',
    sample: 'Your Print Co.',
  },
  {
    token: '{{branding.address}}',
    label: 'Your Address',
    group: 'branding',
    sample: '123 Main St, Suite 100, City, ST 00000',
  },
  { token: '{{branding.phone}}', label: 'Your Phone', group: 'branding', sample: '(555) 123-4567' },
  {
    token: '{{branding.email}}',
    label: 'Your Email',
    group: 'branding',
    sample: 'sales@yourco.com',
  },
];

export const MERGE_FIELD_GROUPS: { group: MergeFieldGroup; label: string }[] = [
  { group: 'branding', label: 'Your Company' },
  { group: 'customer', label: 'Customer' },
  { group: 'contact', label: 'Contact' },
  { group: 'quote', label: 'Quote' },
];

const SAMPLE_BY_TOKEN: Record<string, string> = Object.fromEntries(
  MERGE_FIELDS.map((f) => [f.token, f.sample]),
);

/**
 * Replace every known token with its sample value — used for live preview in the
 * editor. Unknown {{...}} tokens are left untouched so authors can see typos.
 */
export function renderWithSampleData(html: string): string {
  if (!html) return html;
  return html.replace(/\{\{\s*[\w.]+\s*\}\}/g, (match) => {
    const normalized = match.replace(/\s+/g, '');
    return SAMPLE_BY_TOKEN[normalized] ?? match;
  });
}

/** Every valid token string, for validation/highlighting. */
export const MERGE_TOKENS: string[] = MERGE_FIELDS.map((f) => f.token);
