/**
 * Meter Billing & Invoicing Articles
 *
 * Usage-based billing, meter collection, and invoice management
 */

export const meterBillingArticles = [
  {
    title: 'Meter Billing Fundamentals: Automating Your Revenue Stream',
    slug: 'meter-billing-fundamentals',
    categorySlug: 'meter-billing',
    excerpt:
      'Master usage-based billing with automated meter collection, tiered pricing, and contract billing. Transform meter billing from tedious manual work to a streamlined revenue engine.',
    contentType: 'tutorial',
    difficultyLevel: 'intermediate',
    estimatedReadingTime: 14,
    featured: true,
    keywords: [
      'meter billing',
      'usage billing',
      'automated billing',
      'copier billing',
      'meter reading',
    ],
    tags: ['billing', 'meters', 'automation', 'invoicing'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Understanding Meter Billing',
          order: 1,
        },
        {
          type: 'paragraph',
          content:
            "Meter billing (also called cost-per-copy or usage-based billing) charges customers based on actual equipment usage rather than flat fees. It's the dominant billing model for copiers and MFPs, typically measured in black & white and color pages printed.",
          order: 2,
        },
        {
          type: 'callout',
          content:
            '💰 **Revenue Impact**: Dealers using automated meter billing report 95% billing accuracy (vs. 70% manual) and collect payments 12 days faster on average.',
          formatting: { style: 'success' },
          order: 3,
        },
        {
          type: 'header',
          content: 'Meter Billing Components',
          order: 4,
        },
        {
          type: 'table',
          content: {
            headers: ['Component', 'Description', 'Example'],
            rows: [
              ['Base Rate', 'Minimum monthly charge', '$150/month minimum'],
              ['B&W Rate', 'Cost per black & white page', '$0.008 per page'],
              ['Color Rate', 'Cost per color page', '$0.065 per page'],
              ['Overage Tier', 'Discounted rate above threshold', '$0.006 above 10,000 pages'],
              ['Included Volume', 'Pages included in base rate', 'First 2,000 pages free'],
              ['Equipment Rental', 'Device lease/rental fee', '$250/month equipment'],
              ['Supplies', 'Toner, drums, maintenance kits', 'Included in cost-per-copy'],
            ],
          },
          order: 5,
        },
        {
          type: 'header',
          content: 'Setting Up Meter Billing Contracts',
          order: 6,
        },
        {
          type: 'paragraph',
          content: 'Navigate to Billing → Contracts → New Meter Billing Contract:',
          order: 7,
        },
        {
          type: 'list',
          content: [
            '**Select Customer**: Choose from business records',
            '**Add Equipment**: Select devices covered under this contract',
            '**Configure Pricing**: Set base rate, per-page costs, and tiers',
            '**Billing Cycle**: Monthly, quarterly, or custom',
            '**Invoice Due Date**: NET 15, NET 30, etc.',
            '**Auto-Collection**: Enable/disable automatic meter reading',
            '**Contract Term**: Start/end dates, auto-renewal settings',
          ],
          order: 8,
        },
        {
          type: 'header',
          content: 'Automated Meter Collection',
          order: 9,
        },
        {
          type: 'paragraph',
          content: 'Printyx supports three meter collection methods:',
          order: 10,
        },
        {
          type: 'list',
          content: [
            '**SNMP Monitoring (Recommended)**: Printyx Client automatically reads meters nightly via network',
            '**Email to Customer**: Auto-send meter reading requests, customers reply with readings',
            '**Manual Entry**: Staff enters readings manually (legacy method)',
            '**Service Call Collection**: Technicians capture readings during on-site visits',
          ],
          order: 11,
        },
        {
          type: 'code',
          content: `// Example: Meter reading data structure
{
  "deviceId": "device-12345",
  "serialNumber": "ABC123456",
  "readingDate": "2025-01-15T08:00:00Z",
  "collectionMethod": "snmp-auto",
  "meters": {
    "totalBW": 125430,
    "totalColor": 34567,
    "totalPrints": 159997,
    "totalCopies": 148923,
    "totalScans": 12543,
    "totalFaxes": 1234
  },
  "previousReading": {
    "date": "2024-12-15T08:00:00Z",
    "totalBW": 118234,
    "totalColor": 32112
  },
  "billingPeriodUsage": {
    "bwPages": 7196,
    "colorPages": 2455,
    "total": 9651
  }
}`,
          formatting: { language: 'json' },
          order: 12,
        },
        {
          type: 'header',
          content: 'Tiered Pricing Strategies',
          order: 13,
        },
        {
          type: 'paragraph',
          content: 'Volume discounts encourage higher usage and customer loyalty:',
          order: 14,
        },
        {
          type: 'table',
          content: {
            headers: ['Tier', 'Volume Range', 'B&W Rate', 'Color Rate'],
            rows: [
              ['Tier 1', '0 - 5,000 pages', '$0.010', '$0.070'],
              ['Tier 2', '5,001 - 15,000 pages', '$0.008', '$0.065'],
              ['Tier 3', '15,001 - 30,000 pages', '$0.007', '$0.060'],
              ['Tier 4', '30,001+ pages', '$0.006', '$0.055'],
            ],
          },
          order: 15,
        },
        {
          type: 'callout',
          content:
            "💡 **Pricing Strategy**: Set tier thresholds slightly above customer's average usage to encourage growth while maintaining profitability.",
          formatting: { style: 'info' },
          order: 16,
        },
        {
          type: 'header',
          content: 'Invoice Generation',
          order: 17,
        },
        {
          type: 'paragraph',
          content:
            'Printyx automatically generates invoices based on your billing cycle settings. The process runs nightly:',
          order: 18,
        },
        {
          type: 'list',
          content: [
            '**Day 1**: Collect final meter readings for billing period',
            '**Day 2**: Calculate usage, apply tiered pricing',
            '**Day 3**: Generate invoice PDFs with detailed usage breakdown',
            '**Day 4**: Email invoices to customers, post to customer portal',
            '**Day 5**: Sync to QuickBooks/accounting system if integrated',
            '**Payment Tracking**: Monitor payments, send reminders for overdue invoices',
          ],
          order: 19,
        },
        {
          type: 'header',
          content: 'Handling Common Billing Scenarios',
          order: 20,
        },
        {
          type: 'paragraph',
          content: '**Scenario: Meter appears to have decreased**',
          order: 21,
        },
        {
          type: 'list',
          content: [
            'System flags anomaly for review',
            'Check if meter was reset (device replacement/repair)',
            'Verify reading accuracy (could be read error)',
            'Manually adjust if confirmed legitimate reset',
            'Document reason for audit trail',
          ],
          order: 22,
        },
        {
          type: 'paragraph',
          content: '**Scenario: Device offline, unable to collect meter**',
          order: 23,
        },
        {
          type: 'list',
          content: [
            'System attempts collection for 3 consecutive nights',
            'If still offline, sends alert to customer and tech',
            'Option to estimate based on average usage',
            'Or skip billing for this device with customer notification',
          ],
          order: 24,
        },
        {
          type: 'header',
          content: 'Billing Analytics',
          order: 25,
        },
        {
          type: 'paragraph',
          content: 'Monitor these metrics to optimize your billing operations:',
          order: 26,
        },
        {
          type: 'list',
          content: [
            '**Collection Success Rate**: Target 98%+ automated collection',
            '**Billing Accuracy**: Disputes should be <2% of invoices',
            '**Days Sales Outstanding (DSO)**: How quickly customers pay',
            '**Revenue Per Device**: Track profitability by equipment type',
            '**Usage Trends**: Identify accounts with declining usage',
            '**Overage Revenue**: Income from usage above base minimums',
          ],
          order: 27,
        },
      ],
    },
    htmlContent: `<h2>Understanding Meter Billing</h2><p>Meter billing charges customers based on actual equipment usage...</p>`,
    metaTitle: 'Meter Billing Fundamentals - Printyx',
    metaDescription:
      'Complete guide to automated meter billing in Printyx with usage-based pricing, tiered rates, and automatic invoice generation.',
    relatedArticleSlugs: ['fleet-monitoring-setup', 'invoice-management'],
    status: 'published',
  },
];
