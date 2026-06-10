// PROP-004: insertable starter sections for the proposal template editor.
//
// Seeded with the copy QuoteTransformer used to hard-code (QuoteTransformer.tsx),
// but with the per-quote interpolations replaced by {{merge.tokens}} from
// shared/proposal-merge-fields.ts so a template built once can be reused on every
// quote. The merge engine (PROP-005) resolves the tokens at generation time.

export interface StarterSection {
  type: string;
  label: string;
  title: string;
  content: string;
}

export const STARTER_SECTIONS: StarterSection[] = [
  {
    type: 'cover_page',
    label: 'Cover Page',
    title: 'Cover Page',
    content: `
<div style="text-align:center;padding:60px 0;">
  {{branding.logo}}
  <h1 style="font-size:48px;margin:20px 0;">{{quote.title}}</h1>
  <h2 style="font-size:24px;margin-bottom:40px;color:#666;">Professional Proposal</h2>
  <div style="margin-bottom:40px;">
    <h3 style="font-size:20px;margin-bottom:10px;">Prepared for:</h3>
    <p style="font-size:18px;font-weight:bold;">{{customer.companyName}}</p>
    <p style="font-size:16px;">{{contact.name}}</p>
  </div>
  <div style="margin-top:80px;">
    <p style="font-size:16px;color:#666;">Quote Reference: {{quote.number}}</p>
    <p style="font-size:16px;color:#666;">Valid Until: {{quote.validUntil}}</p>
  </div>
</div>`.trim(),
  },
  {
    type: 'executive_summary',
    label: 'Executive Summary',
    title: 'Executive Summary',
    content: `
<h2>Executive Summary</h2>
<p>We are pleased to present this comprehensive proposal for {{customer.companyName}}. This document outlines our recommended solution to address your business requirements with a total investment of <strong>{{quote.totalAmount}}</strong>.</p>
<h3>Key Benefits:</h3>
<ul>
  <li>Professional-grade equipment and services</li>
  <li>Comprehensive support and maintenance</li>
  <li>Proven implementation methodology</li>
  <li>Competitive pricing with transparent terms</li>
</ul>`.trim(),
  },
  {
    type: 'solution_overview',
    label: 'Solution Overview',
    title: 'Proposed Solution',
    content: `
<h2>Proposed Solution</h2>
<p>Based on our analysis of {{customer.companyName}}'s requirements, we have designed a comprehensive solution tailored to your organization. The full breakdown of equipment, services, and accessories is detailed in the investment summary below.</p>`.trim(),
  },
  {
    type: 'pricing',
    label: 'Investment Summary',
    title: 'Investment Summary',
    content: `
<h2>Investment Summary</h2>
<div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
  {{quote.lineItemsTable}}
  <p style="text-align:right;font-size:18px;font-weight:bold;margin-top:12px;">Total Investment: {{quote.totalAmount}}</p>
  <p style="text-align:right;color:#666;">Recurring: {{quote.recurringTotal}}</p>
</div>
<p><em>This pricing is valid until {{quote.validUntil}}.</em></p>`.trim(),
  },
  {
    type: 'terms',
    label: 'Terms & Conditions',
    title: 'Terms & Conditions',
    content: `
<h2>Terms &amp; Conditions</h2>
<p>This proposal is valid until {{quote.validUntil}}. Pricing reflects the configuration described above and is subject to the standard terms of sale.</p>
<ul>
  <li>Payment terms: Net 30 from invoice date unless otherwise agreed.</li>
  <li>Delivery and installation scheduled upon contract execution.</li>
  <li>Warranty and service levels as specified per line item.</li>
</ul>`.trim(),
  },
  {
    type: 'next_steps',
    label: 'Next Steps',
    title: 'Next Steps',
    content: `
<h2>Next Steps</h2>
<p>We're excited about the opportunity to work with {{customer.companyName}}. To move forward with this proposal:</p>
<ol>
  <li><strong>Review &amp; Approval:</strong> Review this proposal and let us know if you have questions.</li>
  <li><strong>Contract Execution:</strong> Once approved, we'll prepare the formal contract.</li>
  <li><strong>Implementation Planning:</strong> Our team schedules an implementation session.</li>
  <li><strong>Delivery &amp; Installation:</strong> We coordinate delivery at your convenience.</li>
  <li><strong>Training &amp; Support:</strong> Comprehensive training and ongoing support.</li>
</ol>
<div style="background:#e3f2fd;padding:20px;border-left:4px solid #0066CC;margin:20px 0;">
  <h3 style="margin-top:0;">Contact Information</h3>
  <p>For questions or to proceed, please contact:</p>
  <p><strong>{{branding.companyName}}</strong><br>{{branding.phone}}<br>{{branding.email}}</p>
</div>`.trim(),
  },
  {
    type: 'signature',
    label: 'Signature Block',
    title: 'Acceptance & Signature',
    content: `
<h2>Acceptance</h2>
<p>By signing below, {{customer.companyName}} accepts this proposal ({{quote.number}}) and authorizes {{branding.companyName}} to proceed.</p>
<table style="width:100%;margin-top:40px;">
  <tr>
    <td style="width:50%;padding-right:24px;">
      <div style="border-top:1px solid #333;padding-top:6px;">Authorized Signature</div>
    </td>
    <td style="width:50%;">
      <div style="border-top:1px solid #333;padding-top:6px;">Date</div>
    </td>
  </tr>
</table>`.trim(),
  },
];
