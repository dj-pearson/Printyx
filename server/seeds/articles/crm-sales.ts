/**
 * CRM & Sales Articles
 *
 * Customer relationship management, lead tracking, and sales process articles
 */

export const crmSalesArticles = [
  {
    title: "Creating and Managing Business Records",
    slug: "creating-managing-business-records",
    categorySlug: "crm-sales",
    excerpt: "Master Printyx's unified business records system. Learn how leads and customers are managed in a zero-data-loss architecture that preserves your entire customer journey.",
    contentType: "tutorial",
    difficultyLevel: "beginner",
    estimatedReadingTime: 15,
    featured: true,
    keywords: ["business records", "leads", "customers", "CRM", "lead-to-customer"],
    tags: ["crm", "leads", "customers", "sales"],
    content: {
      sections: [
        {
          type: "header",
          content: "Understanding Business Records",
          order: 1
        },
        {
          type: "paragraph",
          content: "Printyx uses a revolutionary unified business records system. Unlike traditional CRMs that separate leads and customers, our approach treats them as a single entity with different lifecycle stages. This means zero data loss when converting a lead to a customer!",
          order: 2
        },
        {
          type: "callout",
          content: "🎯 **Key Advantage**: When you convert a lead to a customer, all historical data, notes, interactions, and attachments are automatically preserved. No manual data migration needed!",
          formatting: { style: "success" },
          order: 3
        },
        {
          type: "header",
          content: "Creating a New Lead",
          order: 4
        },
        {
          type: "paragraph",
          content: "To create a new lead, navigate to CRM → Business Records → Create New. You'll be prompted to enter:",
          order: 5
        },
        {
          type: "list",
          content: [
            "**Company Name**: The business name (required)",
            "**Contact Information**: Primary contact, phone, email",
            "**Lead Source**: How did you acquire this lead?",
            "**Lead Score**: AI-powered qualification score (auto-calculated)",
            "**Assigned To**: Sales rep responsible for this lead",
            "**Notes**: Initial context or conversation details"
          ],
          order: 6
        },
        {
          type: "code",
          content: `// Example API call to create a business record
POST /api/business-records

{
  "companyName": "Acme Corporation",
  "contactName": "John Smith",
  "email": "john@acme.com",
  "phone": "(555) 123-4567",
  "leadSource": "website_form",
  "status": "lead",
  "assignedTo": "user-uuid-here",
  "tags": ["hot-lead", "enterprise"],
  "notes": "Interested in lease program for 5 copiers"
}`,
          formatting: { language: "json" },
          order: 7
        },
        {
          type: "header",
          content: "Lead Qualification Process",
          order: 8
        },
        {
          type: "paragraph",
          content: "Printyx automatically scores leads based on multiple factors including company size, engagement level, budget indicators, and timeline. The AI-powered lead scoring helps you prioritize your sales efforts.",
          order: 9
        },
        {
          type: "table",
          content: {
            headers: ["Score Range", "Priority", "Typical Action"],
            rows: [
              ["90-100", "🔥 Hot", "Immediate follow-up, assign to senior rep"],
              ["70-89", "⚡ Warm", "Follow up within 24 hours"],
              ["50-69", "📊 Qualified", "Standard nurture process"],
              ["30-49", "🔍 Developing", "Add to nurture campaign"],
              ["0-29", "❄️ Cold", "Long-term nurture or disqualify"]
            ]
          },
          order: 10
        },
        {
          type: "header",
          content: "Converting Leads to Customers",
          order: 11
        },
        {
          type: "paragraph",
          content: "When a lead is ready to become a customer (e.g., they've signed a contract), simply change the status from 'Lead' to 'Customer'. That's it! All data is automatically retained.",
          order: 12
        },
        {
          type: "callout",
          content: "💡 **Pro Tip**: Before converting, ensure you've added all relevant notes, attachments, and interaction history. Your service team will thank you for the complete customer context!",
          formatting: { style: "info" },
          order: 13
        },
        {
          type: "header",
          content: "Managing Customer Relationships",
          order: 14
        },
        {
          type: "paragraph",
          content: "Once converted to a customer, additional fields become available such as contract details, billing information, installed equipment, and service history. The customer view provides a 360-degree perspective of the relationship.",
          order: 15
        },
        {
          type: "list",
          content: [
            "**Overview Tab**: Quick stats and recent activity",
            "**Equipment Tab**: All installed devices and service contracts",
            "**Service History**: Complete service call records",
            "**Billing Tab**: Invoices, payments, and meter billing",
            "**Documents**: Contracts, quotes, and attachments",
            "**Activity Timeline**: Complete interaction history"
          ],
          order: 16
        },
        {
          type: "header",
          content: "Best Practices",
          order: 17
        },
        {
          type: "list",
          content: [
            "✅ Log every customer interaction in the notes",
            "✅ Use tags liberally for easy filtering and segmentation",
            "✅ Keep contact information up-to-date",
            "✅ Attach important documents (contracts, emails, quotes)",
            "✅ Set follow-up reminders to stay proactive",
            "✅ Review lead scores weekly to prioritize efforts"
          ],
          order: 18
        }
      ]
    },
    htmlContent: `<h2>Understanding Business Records</h2><p>Printyx uses a revolutionary unified business records system...</p>`,
    metaTitle: "Creating and Managing Business Records in Printyx",
    metaDescription: "Complete guide to Printyx's unified business records system for leads and customers with zero data loss.",
    relatedArticleSlugs: ["lead-scoring-guide", "sales-pipeline-management"],
    status: "published"
  },
  {
    title: "Sales Pipeline Management: From Lead to Close",
    slug: "sales-pipeline-management",
    categorySlug: "crm-sales",
    excerpt: "Optimize your sales process with Printyx's visual pipeline. Track deals, forecast revenue, and never miss a follow-up opportunity.",
    contentType: "tutorial",
    difficultyLevel: "intermediate",
    estimatedReadingTime: 12,
    featured: true,
    keywords: ["sales pipeline", "deals", "opportunities", "forecasting", "sales process"],
    tags: ["sales", "pipeline", "deals"],
    content: {
      sections: [
        {
          type: "header",
          content: "Understanding the Sales Pipeline",
          order: 1
        },
        {
          type: "paragraph",
          content: "The sales pipeline visualizes your opportunities from initial contact through closed-won. Each stage represents a milestone in your sales process, helping you forecast revenue and identify bottlenecks.",
          order: 2
        },
        {
          type: "header",
          content: "Default Pipeline Stages",
          order: 3
        },
        {
          type: "table",
          content: {
            headers: ["Stage", "Description", "Average Duration", "Win Rate"],
            rows: [
              ["Prospect", "Initial contact made", "7 days", "30%"],
              ["Qualification", "Needs and budget verified", "14 days", "45%"],
              ["Proposal", "Quote or proposal sent", "10 days", "60%"],
              ["Negotiation", "Terms being discussed", "14 days", "75%"],
              ["Closed Won", "Deal successfully closed", "N/A", "100%"],
              ["Closed Lost", "Opportunity lost", "N/A", "0%"]
            ]
          },
          order: 4
        },
        {
          type: "header",
          content: "Creating a New Opportunity",
          order: 5
        },
        {
          type: "paragraph",
          content: "Opportunities represent potential revenue. To create one, navigate to Sales → Pipeline → New Opportunity:",
          order: 6
        },
        {
          type: "list",
          content: [
            "**Select Business Record**: Choose the associated customer/lead",
            "**Opportunity Name**: Descriptive title (e.g., '5 MFP Lease Deal')",
            "**Expected Value**: Estimated deal size",
            "**Close Date**: Expected closing date",
            "**Probability**: Likelihood of closing (auto-calculated by stage)",
            "**Products/Services**: What you're selling"
          ],
          order: 7
        },
        {
          type: "callout",
          content: "📊 **Forecasting**: Printyx automatically calculates weighted pipeline value by multiplying opportunity value by win probability for accurate revenue forecasting.",
          formatting: { style: "info" },
          order: 8
        },
        {
          type: "header",
          content: "Moving Deals Through the Pipeline",
          order: 9
        },
        {
          type: "paragraph",
          content: "Simply drag and drop opportunities between stages in the visual pipeline view. Each stage change updates the win probability and triggers any configured automation workflows.",
          order: 10
        },
        {
          type: "header",
          content: "Pipeline Metrics to Monitor",
          order: 11
        },
        {
          type: "list",
          content: [
            "**Conversion Rates**: Percentage moving from stage to stage",
            "**Average Deal Size**: Track by product type or customer segment",
            "**Sales Velocity**: Time from prospect to close",
            "**Win Rate**: Overall and by sales rep",
            "**Pipeline Value**: Total weighted forecast",
            "**Bottleneck Identification**: Which stages have the most stagnant deals"
          ],
          order: 12
        },
        {
          type: "header",
          content: "Sales Activities and Follow-ups",
          order: 13
        },
        {
          type: "paragraph",
          content: "Each opportunity has an activity timeline showing all interactions: calls, emails, meetings, quotes sent, and contract negotiations. Set reminders to ensure timely follow-ups.",
          order: 14
        },
        {
          type: "callout",
          content: "⚡ **Automation Tip**: Set up workflow automations to notify you when deals have been in a stage too long, or when a high-value opportunity isn't receiving attention.",
          formatting: { style: "success" },
          order: 15
        }
      ]
    },
    htmlContent: `<h2>Understanding the Sales Pipeline</h2><p>The sales pipeline visualizes your opportunities...</p>`,
    metaTitle: "Sales Pipeline Management in Printyx",
    metaDescription: "Master the sales pipeline in Printyx with visual deal tracking, forecasting, and sales process optimization.",
    relatedArticleSlugs: ["creating-managing-business-records", "creating-quotes-proposals"],
    status: "published"
  },
  {
    title: "Creating Professional Quotes and Proposals",
    slug: "creating-quotes-proposals",
    categorySlug: "crm-sales",
    excerpt: "Generate professional, branded quotes and proposals in minutes. Include equipment specs, pricing tiers, lease options, and digital signatures.",
    contentType: "how_to",
    difficultyLevel: "beginner",
    estimatedReadingTime: 10,
    featured: false,
    keywords: ["quotes", "proposals", "pricing", "documents", "contracts"],
    tags: ["quotes", "proposals", "sales"],
    content: {
      sections: [
        {
          type: "header",
          content: "Quote Builder Overview",
          order: 1
        },
        {
          type: "paragraph",
          content: "Printyx's quote builder helps you create professional quotes quickly. Pull from your product catalog, apply pricing rules, and generate polished PDFs ready for customer review.",
          order: 2
        },
        {
          type: "header",
          content: "Step-by-Step: Creating a Quote",
          order: 3
        },
        {
          type: "list",
          content: [
            "**Step 1**: Navigate to Sales → Quotes → Create New Quote",
            "**Step 2**: Select the customer/lead from business records",
            "**Step 3**: Add products from your catalog (search by model, type, or manufacturer)",
            "**Step 4**: Adjust quantities and pricing (discount rules auto-apply)",
            "**Step 5**: Add optional items like extended warranties or service contracts",
            "**Step 6**: Include lease/finance options if applicable",
            "**Step 7**: Add terms, conditions, and validity period",
            "**Step 8**: Preview and send via email or download PDF"
          ],
          order: 4
        },
        {
          type: "header",
          content: "Quote Sections Explained",
          order: 5
        },
        {
          type: "table",
          content: {
            headers: ["Section", "Required?", "Purpose"],
            rows: [
              ["Customer Info", "✅ Yes", "Auto-populated from business record"],
              ["Line Items", "✅ Yes", "Products/services with pricing"],
              ["Pricing Summary", "✅ Yes", "Subtotal, tax, total"],
              ["Payment Terms", "✅ Yes", "NET 30, COD, lease, etc."],
              ["Lease Options", "❌ Optional", "Monthly payment calculations"],
              ["Service Contract", "❌ Optional", "Maintenance agreement details"],
              ["Terms & Conditions", "✅ Yes", "Legal terms and acceptance"],
              ["Digital Signature", "❌ Optional", "Enable for online acceptance"]
            ]
          },
          order: 6
        },
        {
          type: "callout",
          content: "💰 **Pricing Tip**: Set up automated discount rules based on quantity, customer tier, or promotional periods. The quote builder will auto-apply the best price!",
          formatting: { style: "success" },
          order: 7
        },
        {
          type: "header",
          content: "Quote Templates",
          order: 8
        },
        {
          type: "paragraph",
          content: "Save time with quote templates for common scenarios like '5 MFP Bundle', 'Production Printer Package', or 'Service Contract Renewal'. Templates include pre-configured products, standard pricing, and approved terms.",
          order: 9
        },
        {
          type: "header",
          content: "Tracking Quote Status",
          order: 10
        },
        {
          type: "paragraph",
          content: "Quotes progress through statuses: Draft → Sent → Viewed → Accepted → Won/Lost. Email tracking shows when customers open your quote, helping you time your follow-up perfectly.",
          order: 11
        },
        {
          type: "callout",
          content: "📧 **Follow-up Automation**: Enable automatic reminders 3 days after sending if the quote hasn't been opened, and 7 days before expiration.",
          formatting: { style: "info" },
          order: 12
        }
      ]
    },
    htmlContent: `<h2>Quote Builder Overview</h2><p>Printyx's quote builder helps you create professional quotes quickly...</p>`,
    metaTitle: "Creating Quotes and Proposals in Printyx",
    metaDescription: "Learn how to create professional, branded quotes and proposals with Printyx's powerful quote builder.",
    relatedArticleSlugs: ["sales-pipeline-management", "product-catalog-management"],
    status: "published"
  },
  {
    title: "AI-Powered Lead Scoring: Maximize Your Sales Efficiency",
    slug: "ai-powered-lead-scoring",
    categorySlug: "crm-sales",
    excerpt: "Understand how Printyx's AI analyzes dozens of factors to score and prioritize your leads. Learn to interpret scores and optimize your sales strategy.",
    contentType: "reference",
    difficultyLevel: "advanced",
    estimatedReadingTime: 14,
    featured: false,
    keywords: ["lead scoring", "AI", "machine learning", "prioritization", "qualification"],
    tags: ["ai", "leads", "automation"],
    content: {
      sections: [
        {
          type: "header",
          content: "How AI Lead Scoring Works",
          order: 1
        },
        {
          type: "paragraph",
          content: "Printyx uses machine learning models trained on thousands of successful deals to predict which leads are most likely to convert. The AI analyzes demographic data, behavioral signals, engagement patterns, and historical trends.",
          order: 2
        },
        {
          type: "header",
          content: "Scoring Factors and Weights",
          order: 3
        },
        {
          type: "table",
          content: {
            headers: ["Factor Category", "Weight", "Key Signals"],
            rows: [
              ["Company Demographics", "25%", "Size, industry, revenue, location"],
              ["Engagement Level", "30%", "Website visits, email opens, content downloads"],
              ["Behavioral Signals", "20%", "Pricing page views, demo requests, competitor research"],
              ["Timeline Indicators", "15%", "Urgency keywords, current contract end dates"],
              ["Historical Patterns", "10%", "Similar companies that converted"]
            ]
          },
          order: 4
        },
        {
          type: "callout",
          content: "🤖 **AI Insight**: The model continuously learns from your closed-won and closed-lost deals, improving accuracy over time. Scores automatically recalculate as new data arrives.",
          formatting: { style: "info" },
          order: 5
        },
        {
          type: "header",
          content: "Interpreting Lead Scores",
          order: 6
        },
        {
          type: "paragraph",
          content: "Scores range from 0-100. Here's how to use them strategically:",
          order: 7
        },
        {
          type: "list",
          content: [
            "**90-100 (Hot Leads)**: Immediate outreach by senior sales reps. These leads show strong buying signals and should be contacted within hours.",
            "**70-89 (Warm Leads)**: Qualified prospects. Assign to standard sales process with follow-up within 24 hours.",
            "**50-69 (Qualified Leads)**: Potential customers but lower urgency. Enter into nurture campaigns.",
            "**30-49 (Developing Leads)**: Early stage. Add to long-term nurture sequences.",
            "**0-29 (Cold Leads)**: Low conversion probability. Consider disqualifying or minimal touch nurture."
          ],
          order: 8
        },
        {
          type: "header",
          content: "Custom Scoring Rules",
          order: 9
        },
        {
          type: "paragraph",
          content: "While the AI provides a baseline score, you can add custom rules specific to your business. For example, boost scores for leads in your geographic sweet spot, or decrease scores for industries you don't serve well.",
          order: 10
        },
        {
          type: "code",
          content: `// Example: Custom scoring rule configuration
{
  "customRules": [
    {
      "condition": "location.state == 'CA'",
      "scoreModifier": +10,
      "reason": "California is our strongest market"
    },
    {
      "condition": "industry == 'healthcare' && companySize > 100",
      "scoreModifier": +15,
      "reason": "Large healthcare is ideal customer profile"
    },
    {
      "condition": "leadSource == 'referral'",
      "scoreModifier": +20,
      "reason": "Referrals have 3x conversion rate"
    }
  ]
}`,
          formatting: { language: "json" },
          order: 11
        },
        {
          type: "header",
          content: "Using Scores to Optimize Sales Process",
          order: 12
        },
        {
          type: "list",
          content: [
            "**Route High-Value Leads**: Auto-assign 90+ scores to your best closers",
            "**Prioritize Daily Work**: Sort your lead list by score to focus efforts",
            "**Segment Marketing**: Send different nurture campaigns based on score ranges",
            "**Forecast More Accurately**: Weight pipeline by lead scores",
            "**Measure Lead Quality**: Track average scores by source to optimize marketing spend"
          ],
          order: 13
        },
        {
          type: "callout",
          content: "📈 **Success Story**: Dealers using AI lead scoring report 35% higher conversion rates and 50% reduction in time wasted on unqualified leads.",
          formatting: { style: "success" },
          order: 14
        }
      ]
    },
    htmlContent: `<h2>How AI Lead Scoring Works</h2><p>Printyx uses machine learning models trained on thousands of successful deals...</p>`,
    metaTitle: "AI-Powered Lead Scoring in Printyx",
    metaDescription: "Master AI lead scoring in Printyx to prioritize prospects and maximize sales efficiency.",
    relatedArticleSlugs: ["creating-managing-business-records", "sales-forecasting"],
    status: "published"
  }
];
