/**
 * Email Drip Campaign Templates
 *
 * Strategic 7-email sequence emphasizing the 4 competitive moats:
 * - Technical Superiority
 * - Intelligence Layer
 * - Network Effects
 * - Domain Expertise
 */

export interface EmailTemplate {
  id: string;
  dayOffset: number;
  subject: string;
  preheader: string;
  content: {
    greeting: string;
    body: string[];
    cta: {
      text: string;
      url: string;
    };
    signature: string;
  };
  moat: "technical" | "intelligence" | "network" | "expertise";
}

export const dripCampaign: EmailTemplate[] = [
  {
    id: "welcome",
    dayOffset: 0,
    subject: "Welcome to Printyx - Stop Reacting, Start Predicting",
    preheader: "Your 14-day trial starts now. Here's what makes us different.",
    content: {
      greeting: "Welcome to Printyx!",
      body: [
        "Thank you for starting your 14-day trial. You've just gained access to the only predictive intelligence platform built specifically for copier dealers.",
        "While competitors are still fixing equipment failures after they happen, you'll be preventing them 30 days in advance. That's the power of AI-powered predictive maintenance.",
        "Over the next two weeks, you'll discover exactly why Printyx is 2-3 years ahead of legacy platforms like e-automate—and impossible for them to catch up quickly.",
        "Here's what to expect in your trial:\n• Day 1-3: Explore the platform and import your data\n• Day 4-7: Set up predictive intelligence and see your first AI recommendations\n• Day 8-14: Run your operations on Printyx and measure the impact",
        "Ready to get started? Log in now and we'll guide you through the setup."
      ],
      cta: {
        text: "Access Your Dashboard →",
        url: "/login"
      },
      signature: "The Printyx Team\n\nP.S. Need help getting started? Reply to this email and our team will assist within 2 hours."
    },
    moat: "intelligence"
  },
  {
    id: "technical-superiority",
    dayOffset: 2,
    subject: "Why Legacy Systems Can't Match Our Modern Architecture",
    preheader: "Built for 2025, not 2005. Here's the 2-3 year technical advantage.",
    content: {
      greeting: "Hi there,",
      body: [
        "You've probably noticed how fast Printyx feels compared to your old system. There's a reason for that.",
        "We're built on modern cloud-native architecture with React, PostgreSQL, and real-time data sync. Legacy platforms like e-automate were designed 20 years ago when mobile apps didn't exist and AI was science fiction.",
        "Here's what that means for you:",
        "**52 releases per year** vs. 4 for legacy systems\nYou get new features every week, not every quarter. Bug fixes in days, not months.",
        "**Zero downtime deployments**\nUpdates happen instantly without interrupting your team. No more \"maintenance windows\" that shut down operations.",
        "**Offline-first mobile apps**\nTechnicians work seamlessly without connectivity. True native mobile, not clunky web wrappers.",
        "**Real-time data everywhere**\nChanges appear instantly across all devices. No page refreshes or sync delays.",
        "This isn't just about being \"better\"—it's about fundamental architecture that determines what's possible. And rebuilding this foundation takes legacy vendors 2.5-3.5 years minimum.",
        "Want to see the technical comparison? Check out our detailed breakdown."
      ],
      cta: {
        text: "Read Architecture Comparison →",
        url: "/blog/e-automate-vs-modern-cloud-platforms"
      },
      signature: "The Printyx Team"
    },
    moat: "technical"
  },
  {
    id: "predictive-intelligence",
    dayOffset: 4,
    subject: "How AI Predicts Equipment Failures 30 Days in Advance",
    preheader: "30-40% reduction in emergency calls. Here's how it works.",
    content: {
      greeting: "Hi there,",
      body: [
        "By now you've probably seen Printyx's predictive intelligence dashboard. Today I want to explain exactly how it works—and why competitors can't replicate it.",
        "Our AI analyzes four data sources continuously:",
        "1. **Service History** - Timing, frequency, parts used across your entire fleet\n2. **Meter Patterns** - Usage velocity changes that precede failures\n3. **Equipment Specs** - Age, model, known failure patterns\n4. **Technician Notes** - Structured and unstructured service observations",
        "The ML algorithms find patterns humans miss. For example:\n• Meter velocity decreases often indicate fuser failures 15-20 days before they happen\n• Specific error code combinations predict drum replacements with 92% accuracy\n• Service frequency acceleration signals declining equipment health",
        "The result? You get predictions like: \"87% probability this fuser fails within 15-20 days. Schedule preventive maintenance now and save $170 vs emergency repair.\"",
        "**Real dealer results:**\n• 30-40% reduction in emergency service calls\n• 80%+ prediction accuracy\n• 20% decrease in total service costs",
        "But here's the key: This requires modern ML infrastructure that can't be bolted onto legacy systems. Their database schemas weren't designed for time-series analysis. They lack GPU acceleration for model training. They can't support automated retraining pipelines.",
        "**That's an 18-24 month rebuild minimum** - and we keep innovating while they play catch-up.",
        "See it in action on your trial dashboard."
      ],
      cta: {
        text: "View AI Predictions →",
        url: "/ai-service-intelligence"
      },
      signature: "The Printyx Team"
    },
    moat: "intelligence"
  },
  {
    id: "contract-profitability",
    dayOffset: 6,
    subject: "Which of Your Contracts Are Losing Money? (AI Knows)",
    preheader: "15-25% profitability increase through dynamic pricing intelligence.",
    content: {
      greeting: "Hi there,",
      body: [
        "Most dealers have no idea which contracts are actually profitable. They price based on gut feel, competitive pressure, or \"what we've always charged.\"",
        "The result? 20-30% of contracts are underwater, slowly bleeding profit.",
        "Printyx's AI-powered contract profitability analytics solves this:",
        "**Real-time margin tracking** per contract\nSee exactly which contracts make money—factoring in equipment cost, service history, supplies, and technician time.",
        "**Predictive profitability forecasts**\nOur AI predicts next 12 months costs based on equipment age, usage patterns, and historical service data. Know which contracts will decline before they do.",
        "**Dynamic pricing recommendations**\n\"Reprice this contract at +12% at renewal\" or \"This contract will be underwater in 6 months—exit or reprice +25% minimum.\"",
        "**Real dealer results:**\n• Pacific Print Services: $1.2M additional annual profit\n• 23% increase in average contract margins\n• 147 contracts repriced at renewal\n• 6-month payback period",
        "You're probably sitting on $200K-$800K in hidden profit right now. The AI will show you exactly where.",
        "Check your contract profitability dashboard during your trial."
      ],
      cta: {
        text: "Analyze Contract Profitability →",
        url: "/predictive-contract-profitability"
      },
      signature: "The Printyx Team"
    },
    moat: "intelligence"
  },
  {
    id: "network-effects",
    dayOffset: 8,
    subject: "Your Ecosystem, All Connected (Integration Marketplace)",
    preheader: "15+ pre-built integrations. API-first platform. Network that compounds over time.",
    content: {
      greeting: "Hi there,",
      body: [
        "One of our dealers recently said: \"I didn't realize how much time we wasted copying data between systems until it all just...worked together.\"",
        "That's the power of our integration marketplace and API-first architecture.",
        "**15+ Pre-built Integrations:**\n• QuickBooks, NetSuite, Sage (automated invoicing)\n• Salesforce, HubSpot (bi-directional CRM sync)\n• E-Automate (proven migration tools)\n• PrintFleet, PaperCut (MPS platform connections)\n• Apollo, ZoomInfo (lead enrichment)",
        "**Plus our RESTful API** for custom integrations\nFull documentation, webhook events, OAuth 2.0 security, interactive API explorer.",
        "But here's what makes this defensible:",
        "**Network effects compound over time**\nAs more dealers join Printyx, partners build more integrations. Each new integration makes the platform more valuable for everyone.",
        "**Data network effects**\nMore dealers = better AI predictions for all. Our ML models improve daily from collective data.",
        "**Switching costs increase**\nAs you build custom workflows and rely on integrations, the cost of switching away grows exponentially.",
        "Legacy vendors would need to:",
        "1. Rebuild their APIs from scratch (12-18 months)\n2. Convince partners to build integrations for a platform with no users\n3. Catch up on 2+ years of ecosystem development",
        "By then, we're even further ahead. That's a moat competitors can't cross.",
        "Explore the integration marketplace in your trial."
      ],
      cta: {
        text: "See All Integrations →",
        url: "/integration-marketplace"
      },
      signature: "The Printyx Team"
    },
    moat: "network"
  },
  {
    id: "dealer-expertise",
    dayOffset: 10,
    subject: "Why Generic Software Doesn't Understand Your Business",
    preheader: "Built by dealers, for dealers. Domain expertise you can't find elsewhere.",
    content: {
      greeting: "Hi there,",
      body: [
        "Ever tried explaining meter billing to a Salesforce consultant? Or contract renewal workflows to a generic ERP implementation team?",
        "They don't get it. Because they serve 50 industries, none deeply.",
        "Printyx is different. We do nothing but copier dealer management. Every feature, every workflow, every metric—designed by people who've run dealer operations.",
        "**Features only dealers would design:**",
        "• Native meter billing with automated invoicing (not a \"custom field hack\")\n• Service contracts as first-class entities (not forced into \"opportunities\")\n• Equipment cradle-to-grave lifecycle tracking\n• Dealer KPIs: pages/tech, cost/click, contract profitability\n• Mobile app designed for field service reality (offline-first, not web wrappers)",
        "**We speak your language:**\n• We know your pain: meter collection delays, underpriced contracts, emergency call chaos\n• We know your workflow: Lead → Quote → Demo → Install → Service → Renewal\n• We know your metrics: first-time fix rate, pages per tech, contract gross margin",
        "**Active dealer advisory board**\nMonthly sessions with dealers nationwide directly inform our roadmap. Recent impacts:\n• Redesigned service dispatch UI based on tech feedback\n• Added contract profitability alerts\n• Built automated renewal workflow",
        "**Why horizontal SaaS can't catch up:**\nSalesforce serves thousands of industries. They can't invest the engineering resources to deeply understand copier dealerships. We do nothing else.",
        "That depth of expertise takes years to build and can't be copied by a company spread across 50 verticals.",
        "See the dealer-specific features in your trial."
      ],
      cta: {
        text: "Explore Dealer Features →",
        url: "/dealer-expertise"
      },
      signature: "The Printyx Team"
    },
    moat: "expertise"
  },
  {
    id: "trial-ending",
    dayOffset: 12,
    subject: "Your Trial Ends in 2 Days - Here's What Happens Next",
    preheader: "Don't lose access to predictive intelligence and modern tools.",
    content: {
      greeting: "Hi there,",
      body: [
        "Your 14-day Printyx trial ends in 2 days. Here's what you need to know.",
        "**What you've experienced:**\n• 30-40% reduction potential in emergency service calls\n• AI-powered contract profitability insights\n• Modern cloud architecture 2-3 years ahead of legacy systems\n• Integration marketplace connecting your ecosystem\n• Purpose-built dealer workflows",
        "**What happens if you don't subscribe:**\n• You lose access to predictive intelligence (back to reactive mode)\n• Your data stays safe, but you can't access the platform\n• AI predictions stop (emergency calls will increase)\n• Contract profitability insights disappear",
        "**What happens if you subscribe:**\n• Immediate full access continues\n• Data migration support (if coming from e-automate)\n• Dedicated onboarding specialist\n• Priority support\n• Weekly feature updates",
        "**Pricing is transparent:**\n$100/user/month for unlimited features. No hidden fees, no surprise charges. Everything you've seen in the trial is included.",
        "**Real dealer ROI:**\n• 6-7 month average payback period\n• $200K-$800K additional annual profit\n• 4-7 month migration timeline",
        "Ready to make the switch? Subscribe now and we'll ensure a smooth transition."
      ],
      cta: {
        text: "Subscribe Now →",
        url: "/pricing"
      },
      signature: "The Printyx Team\n\nP.S. Questions about pricing, migration, or features? Reply to this email or schedule a call with our team."
    },
    moat: "intelligence"
  }
];

/**
 * Email campaign segments for targeting
 */
export const segments = {
  trialUsers: "users-in-trial",
  legacyUsers: "users-from-e-automate",
  smallDealers: "dealers-under-10-techs",
  mediumDealers: "dealers-10-40-techs",
  largeDealers: "dealers-over-40-techs",
};

/**
 * A/B test variants for subject lines
 */
export const subjectLineVariants = {
  welcome: [
    "Welcome to Printyx - Stop Reacting, Start Predicting",
    "Your Predictive Intelligence Platform is Ready",
    "14-Day Trial Started: Here's What's Different"
  ],
  predictive: [
    "How AI Predicts Equipment Failures 30 Days in Advance",
    "30-40% Fewer Emergency Calls with Predictive Intelligence",
    "See Equipment Failures Before They Happen (AI-Powered)"
  ],
  pricing: [
    "Which of Your Contracts Are Losing Money? (AI Knows)",
    "Hidden Profit in Your Contracts: $200K-$800K Revealed by AI",
    "Dynamic Pricing AI Increased Profitability 15-25%"
  ]
};
