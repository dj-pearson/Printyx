import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  formatCurrency,
  formatDate,
  escapeHtml,
  type MergeData,
  type MergeTemplate,
} from '@shared/proposal-merge';

const branding = {
  logoUrl: 'https://cdn.example.com/logo.png',
  companyName: 'Printyx Dealer',
  address: '1 Main St',
  phone: '(555) 111-2222',
  email: 'sales@dealer.com',
};

const baseData: MergeData = {
  customer: { name: 'Acme Corp', companyName: 'Acme Corp' },
  contact: { name: 'Jane Buyer' },
  quote: {
    number: 'PROP-2026-0042',
    title: 'Fleet Proposal',
    validUntil: '2026-07-31T00:00:00.000Z',
    totalAmount: 7000,
    oneTimeTotal: 7000,
    lineItems: [
      {
        productName: 'Copier MX-100',
        description: 'A3 color',
        quantity: 2,
        unitPrice: 3500,
        totalPrice: 7000,
      },
    ],
  },
  branding,
};

describe('proposal-merge formatters', () => {
  it('formats currency as USD with thousands + 2 decimals', () => {
    expect(formatCurrency(7000)).toBe('$7,000.00');
    expect(formatCurrency('1234.5')).toBe('$1,234.50');
    expect(formatCurrency(null)).toBe('$0.00');
  });

  it('formats dates as long en-US, empty for invalid/missing', () => {
    expect(formatDate('2026-07-31T00:00:00.000Z')).toBe('July 31, 2026');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('escapes HTML in data values', () => {
    expect(escapeHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
  });
});

describe('renderTemplate token substitution', () => {
  it('replaces scalar tokens with formatted, escaped values', () => {
    const tpl: MergeTemplate = {
      sections: [
        {
          id: 'c',
          type: 'cover_page',
          title: 'Cover',
          content:
            '<h1>{{quote.title}}</h1><p>For {{customer.companyName}} ({{contact.name}})</p><p>{{quote.number}} valid until {{quote.validUntil}} — {{quote.totalAmount}}</p>',
        },
      ],
    };
    const { html, warnings } = renderTemplate(tpl, baseData);
    expect(html).toContain('<h1>Fleet Proposal</h1>');
    expect(html).toContain('For Acme Corp (Jane Buyer)');
    expect(html).toContain('PROP-2026-0042 valid until July 31, 2026 — $7,000.00');
    expect(warnings).toHaveLength(0);
  });

  it('renders the branding logo as an img with the profile URL', () => {
    const tpl: MergeTemplate = {
      sections: [{ id: 'l', type: 'cover_page', title: 'C', content: '{{branding.logo}}' }],
    };
    const { html } = renderTemplate(tpl, baseData);
    expect(html).toContain('<img src="https://cdn.example.com/logo.png"');
    expect(html).toContain('alt="Printyx Dealer"');
  });

  it('escapes injected data so quote values cannot inject markup', () => {
    const tpl: MergeTemplate = {
      sections: [
        { id: 'x', type: 'custom', title: 'X', content: '<p>{{customer.companyName}}</p>' },
      ],
    };
    const data: MergeData = {
      ...baseData,
      customer: { companyName: '<img src=x onerror=alert(1)>' },
    };
    const { html } = renderTemplate(tpl, data);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('renderTemplate line items table', () => {
  it('renders a customer table with name/qty/unit/total and no cost or margin', () => {
    const tpl: MergeTemplate = {
      sections: [
        { id: 'p', type: 'pricing', title: 'Pricing', content: '{{quote.lineItemsTable}}' },
      ],
    };
    const { html } = renderTemplate(tpl, baseData);
    expect(html).toContain('Copier MX-100');
    expect(html).toContain('A3 color');
    expect(html).toContain('$3,500.00'); // unit
    expect(html).toContain('$7,000.00'); // line total + one-time total
    expect(html).toContain('One-time Total:');
    expect(html.toLowerCase()).not.toContain('margin');
    expect(html.toLowerCase()).not.toContain('cost');
  });

  it('applies a per-line discount to the effective unit/total', () => {
    const tpl: MergeTemplate = {
      sections: [{ id: 'p', type: 'pricing', title: 'P', content: '{{quote.lineItemsTable}}' }],
    };
    const data: MergeData = {
      quote: {
        lineItems: [
          { productName: 'Widget', quantity: 1, unitPrice: 100, totalPrice: 80, discount: 20 },
        ],
      },
    };
    const { html } = renderTemplate(tpl, data);
    expect(html).toContain('$80.00'); // discounted total
    expect(html).not.toContain('$100.00'); // pre-discount unit not shown
  });

  it('splits recurring lines into their own labeled block', () => {
    const tpl: MergeTemplate = {
      sections: [{ id: 'p', type: 'pricing', title: 'P', content: '{{quote.lineItemsTable}}' }],
    };
    const data: MergeData = {
      quote: {
        oneTimeTotal: 3500,
        lineItems: [
          { productName: 'Copier', quantity: 1, unitPrice: 3500, totalPrice: 3500 },
          {
            productName: 'Service Plan',
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            isRecurring: true,
            recurringFrequency: 'monthly',
          },
        ],
      },
    };
    const { html } = renderTemplate(tpl, data);
    expect(html).toContain('Recurring Charges');
    expect(html).toContain('Service Plan');
    expect(html).toContain('One-time Total:');
  });

  it('renders nothing for an empty line items table', () => {
    const tpl: MergeTemplate = {
      sections: [{ id: 'p', type: 'pricing', title: 'P', content: 'x{{quote.lineItemsTable}}y' }],
    };
    const { html } = renderTemplate(tpl, { quote: { lineItems: [] } });
    expect(html).toBe('xy');
  });
});

describe('renderTemplate fallbacks & warnings', () => {
  it('renders known tokens with missing data as empty string, no warning', () => {
    const tpl: MergeTemplate = {
      sections: [
        { id: 's', type: 'custom', title: 'S', content: '[{{branding.phone}}][{{quote.title}}]' },
      ],
    };
    const { html, warnings } = renderTemplate(tpl, {});
    expect(html).toBe('[][]');
    expect(warnings).toHaveLength(0);
  });

  it('renders unknown tokens as empty and reports them once', () => {
    const tpl: MergeTemplate = {
      sections: [
        {
          id: 's',
          type: 'custom',
          title: 'S',
          content: '{{customer.bogus}} {{nope.here}} {{customer.bogus}}',
        },
      ],
    };
    const { html, warnings } = renderTemplate(tpl, baseData);
    expect(html.trim()).toBe('');
    expect(warnings).toContain('Unknown merge token: {{customer.bogus}}');
    expect(warnings).toContain('Unknown merge token: {{nope.here}}');
    expect(warnings).toHaveLength(2); // deduped
  });

  it('skips sections marked not visible', () => {
    const tpl: MergeTemplate = {
      sections: [
        { id: 'a', type: 'custom', title: 'A', content: 'visible', isVisible: true },
        { id: 'b', type: 'custom', title: 'B', content: 'hidden', isVisible: false },
      ],
    };
    const { sections } = renderTemplate(tpl, {});
    expect(sections).toHaveLength(1);
    expect(sections[0].html).toBe('visible');
  });
});
