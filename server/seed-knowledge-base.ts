/**
 * Knowledge Base Seeding Script
 * Seeds initial knowledge base with comprehensive platform documentation
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import {
  knowledgeCategories,
  knowledgeArticles,
  type InsertKnowledgeCategory,
  type InsertKnowledgeArticle,
} from '@shared/schema';

const DEMO_TENANT_ID = '1d4522ad-b3d8-4018-8890-f9294b2efbe6'; // Demo Copier Dealer
const SYSTEM_USER_ID = 'fb0bafa4-b8ec-4297-b48f-f7e3f66b582c'; // Knowledge Base System User

interface CategoryMap {
  [key: string]: string;
}

/**
 * Seed knowledge base categories
 */
async function seedCategories(): Promise<CategoryMap> {
  console.log('📚 Seeding knowledge base categories...');

  const categories: Array<{ name: string; description: string; icon: string; slug: string }> = [
    {
      name: 'Getting Started',
      description: 'Essential guides for new users to get up and running quickly',
      icon: 'rocket',
      slug: 'getting-started',
    },
    {
      name: 'CRM & Sales Management',
      description: 'Lead tracking, customer management, and sales pipeline documentation',
      icon: 'users',
      slug: 'crm-sales',
    },
    {
      name: 'Service Management',
      description: 'Service dispatch, technician workflow, and field service guides',
      icon: 'wrench',
      slug: 'service-management',
    },
    {
      name: 'Meter Billing',
      description: 'Meter reading collection, billing automation, and invoicing',
      icon: 'calculator',
      slug: 'meter-billing',
    },
    {
      name: 'Inventory & Warehouse',
      description: 'Equipment tracking, parts inventory, and warehouse operations',
      icon: 'box',
      slug: 'inventory-warehouse',
    },
    {
      name: 'Fleet Monitoring',
      description: 'Remote monitoring, toner tracking, and client monitoring setup',
      icon: 'monitor',
      slug: 'fleet-monitoring',
    },
    {
      name: 'Workflow Automation',
      description: 'Automated workflows, triggers, and business process automation',
      icon: 'zap',
      slug: 'workflow-automation',
    },
    {
      name: 'AI Features',
      description: 'AI-powered features including documentation, search, and insights',
      icon: 'brain',
      slug: 'ai-features',
    },
    {
      name: 'Customer Portal',
      description: 'Self-service portal setup and customer access management',
      icon: 'globe',
      slug: 'customer-portal',
    },
    {
      name: 'Troubleshooting',
      description: 'Common issues, error messages, and solutions',
      icon: 'help-circle',
      slug: 'troubleshooting',
    },
  ];

  const categoryMap: CategoryMap = {};

  for (const cat of categories) {
    const [inserted] = await db
      .insert(knowledgeCategories)
      .values({
        tenantId: DEMO_TENANT_ID,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        createdBy: SYSTEM_USER_ID,
      })
      .returning();

    categoryMap[cat.slug] = inserted.id;
    console.log(`✅ Created category: ${cat.name}`);
  }

  return categoryMap;
}

/**
 * Seed knowledge base articles
 */
async function seedArticles(categoryMap: CategoryMap): Promise<void> {
  console.log('📝 Seeding knowledge base articles...');

  const articles = [
    // Getting Started Articles
    {
      category: 'getting-started',
      title: 'Welcome to Printyx - Platform Overview',
      excerpt: 'Learn about the key features and capabilities of the Printyx platform',
      difficultyLevel: 'beginner',
      contentType: 'tutorial',
      tags: ['overview', 'introduction', 'basics'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'What is Printyx?',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Printyx is a comprehensive SaaS platform designed specifically for copier dealers to manage their entire business operations. From CRM and service dispatch to meter billing and inventory management, Printyx provides all the tools you need in one unified system.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Key Features',
            order: 3,
          },
          {
            type: 'list',
            content: [
              'CRM & Sales Management - Track leads, manage customers, and close deals',
              'Service Management - Dispatch technicians and track service calls',
              'Meter Billing - Automate meter collection and invoice generation',
              'Inventory Management - Track equipment and parts inventory',
              'Fleet Monitoring - Monitor equipment remotely with real-time alerts',
              'Customer Portal - Give customers self-service access',
              'AI-Powered Features - Leverage AI for documentation, search, and insights',
            ],
            order: 4,
          },
        ],
      },
    },
    {
      category: 'getting-started',
      title: 'Quick Start Guide - Your First 15 Minutes',
      excerpt: 'Get started with Printyx in just 15 minutes with this step-by-step guide',
      difficultyLevel: 'beginner',
      contentType: 'tutorial',
      tags: ['quickstart', 'setup', 'onboarding'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Step 1: Set Up Your Company Profile',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Navigate to Settings > Company Profile and enter your company information, including name, address, contact details, and logo.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Step 2: Add Your First Customer',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'Go to CRM > Customers and click "Add Customer". Fill in the customer details and save.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Step 3: Add Equipment',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Navigate to Equipment > Add Equipment and enter the equipment details for your customer.',
            order: 6,
          },
        ],
      },
    },

    // CRM & Sales Articles
    {
      category: 'crm-sales',
      title: 'Managing Leads and Opportunities',
      excerpt: 'Learn how to track leads, qualify opportunities, and manage your sales pipeline',
      difficultyLevel: 'beginner',
      contentType: 'how_to',
      tags: ['crm', 'leads', 'opportunities', 'sales'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Creating a New Lead',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Leads can be created manually or imported from various sources. To create a lead manually, navigate to CRM > Leads and click "Add Lead".',
            order: 2,
          },
          {
            type: 'header',
            content: 'Lead Qualification',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'The platform includes AI-powered lead scoring to help you prioritize your outreach. Leads are automatically scored based on factors like company size, industry, and engagement.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Converting Leads to Opportunities',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Once a lead is qualified, convert it to an opportunity by clicking the "Convert to Opportunity" button. This preserves all lead history while moving it into your active sales pipeline.',
            order: 6,
          },
        ],
      },
    },

    // Fleet Monitoring Articles
    {
      category: 'fleet-monitoring',
      title: 'Setting Up Fleet Monitoring and Toner Tracking',
      excerpt: 'Configure remote monitoring to track toner levels and equipment status in real-time',
      difficultyLevel: 'intermediate',
      contentType: 'tutorial',
      tags: ['fleet monitoring', 'toner', 'monitoring', 'setup'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Overview',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Fleet monitoring allows you to track equipment status, toner levels, and receive alerts when supplies are low. This enables proactive service and automated toner ordering.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Installation',
            order: 3,
          },
          {
            type: 'list',
            content: [
              'Download the Printyx monitoring client from Settings > Fleet Monitoring',
              'Install the client on a computer in the customer\'s network',
              'Configure network settings and enter the API key',
              'The client will automatically discover network devices',
              'Approve discovered devices in the admin panel',
            ],
            order: 4,
          },
          {
            type: 'header',
            content: 'Configuring Toner Alerts',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Set toner alert thresholds in Settings > Fleet Monitoring > Alert Rules. The default threshold is 15%, but you can customize this per customer or equipment type.',
            order: 6,
          },
          {
            type: 'header',
            content: 'Automatic Toner Ordering',
            order: 7,
          },
          {
            type: 'paragraph',
            content: 'Enable automatic toner ordering in the workflow automation section. When toner levels reach the threshold, the system will automatically create a supply order and notify the customer.',
            order: 8,
          },
        ],
      },
    },

    // Service Management Articles
    {
      category: 'service-management',
      title: 'Dispatching Service Calls to Technicians',
      excerpt: 'Learn how to create, assign, and track service calls efficiently',
      difficultyLevel: 'beginner',
      contentType: 'how_to',
      tags: ['service', 'dispatch', 'technicians', 'service calls'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Creating a Service Call',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Navigate to Service > Service Calls and click "Create Service Call". Select the customer, equipment, and enter the issue description.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Assigning to a Technician',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'The system will suggest technicians based on availability, location, and skill set. You can also manually assign a technician from the dropdown.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Mobile Technician Access',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Technicians receive notifications on their mobile devices and can view service call details, update status, and upload photos from the field.',
            order: 6,
          },
        ],
      },
    },

    // Meter Billing Articles
    {
      category: 'meter-billing',
      title: 'Setting Up Automated Meter Billing',
      excerpt: 'Configure meter billing rules, rates, and automated invoice generation',
      difficultyLevel: 'intermediate',
      contentType: 'tutorial',
      tags: ['billing', 'meters', 'invoicing', 'automation'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Meter Reading Collection',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Meter readings can be collected automatically via network monitoring, manually entered, or submitted by customers through the portal.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Configuring Billing Rates',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'Set up tiered billing rates in Settings > Billing > Rate Tables. You can define different rates for black & white and color copies, with volume tiers and overages.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Invoice Generation',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Invoices are automatically generated based on your billing cycle settings. The system calculates copy counts, applies rate tables, and generates itemized invoices.',
            order: 6,
          },
        ],
      },
    },

    // AI Features Articles
    {
      category: 'ai-features',
      title: 'Using AI-Powered Knowledge Base Search',
      excerpt: 'Find answers quickly using semantic search and AI-generated responses',
      difficultyLevel: 'beginner',
      contentType: 'how_to',
      tags: ['ai', 'search', 'knowledge base', 'semantic search'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Semantic Search',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'The knowledge base uses AI-powered semantic search to understand the intent of your questions and find relevant articles, even if they don\'t contain the exact keywords you used.',
            order: 2,
          },
          {
            type: 'header',
            content: 'AI-Generated Answers',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'When you search, the AI analyzes multiple articles and generates a comprehensive answer that synthesizes information from various sources, with citations to the source articles.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Providing Feedback',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Rate answers as helpful or unhelpful to improve the AI\'s accuracy over time. You can also suggest corrections if information is outdated or incorrect.',
            order: 6,
          },
        ],
      },
    },

    // Workflow Automation Articles
    {
      category: 'workflow-automation',
      title: 'Creating Automated Workflows',
      excerpt: 'Build custom workflows to automate repetitive business processes',
      difficultyLevel: 'advanced',
      contentType: 'tutorial',
      tags: ['automation', 'workflows', 'triggers', 'actions'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Workflow Triggers',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Workflows can be triggered by events (like new service calls), schedules (daily, weekly), or manually. Choose the trigger that best fits your use case.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Available Actions',
            order: 3,
          },
          {
            type: 'list',
            content: [
              'Send Email - Send customized emails to customers or staff',
              'Send SMS - Send text message notifications',
              'Create Task - Automatically create tasks for team members',
              'Update Record - Modify customer or equipment records',
              'Create Service Call - Automatically dispatch service calls',
              'Order Supplies - Place supply orders when thresholds are met',
              'Run Webhook - Integrate with external systems',
            ],
            order: 4,
          },
          {
            type: 'header',
            content: 'Example: Automatic Toner Ordering',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'Trigger: When toner level < 15%. Actions: 1) Check if customer has toner included in contract, 2) Create supply order for appropriate toner, 3) Send email notification to customer, 4) Update equipment status.',
            order: 6,
          },
        ],
      },
    },

    // Troubleshooting Articles
    {
      category: 'troubleshooting',
      title: 'Common Login Issues and Solutions',
      excerpt: 'Troubleshoot login problems, password resets, and account access',
      difficultyLevel: 'beginner',
      contentType: 'troubleshooting',
      tags: ['login', 'authentication', 'password', 'troubleshooting'],
      content: {
        sections: [
          {
            type: 'header',
            content: 'Forgot Password',
            order: 1,
          },
          {
            type: 'paragraph',
            content: 'Click "Forgot Password" on the login page and enter your email address. You\'ll receive a password reset link within a few minutes. Check your spam folder if you don\'t see it.',
            order: 2,
          },
          {
            type: 'header',
            content: 'Account Locked',
            order: 3,
          },
          {
            type: 'paragraph',
            content: 'After 5 failed login attempts, your account is temporarily locked for security. Wait 15 minutes and try again, or contact your administrator to unlock your account.',
            order: 4,
          },
          {
            type: 'header',
            content: 'Multi-Factor Authentication Issues',
            order: 5,
          },
          {
            type: 'paragraph',
            content: 'If you\'re having trouble with MFA codes, ensure your device\'s time is synchronized. You can also use backup codes provided during MFA setup, or contact your administrator to reset MFA.',
            order: 6,
          },
        ],
      },
    },
  ];

  for (const article of articles) {
    const categoryId = categoryMap[article.category];
    if (!categoryId) {
      console.error(`Category not found: ${article.category}`);
      continue;
    }

    const plainText = extractPlainText(article.content);
    const wordCount = countWords(plainText);

    await db.insert(knowledgeArticles).values({
      tenantId: DEMO_TENANT_ID,
      title: article.title,
      slug: generateSlug(article.title),
      excerpt: article.excerpt,
      content: article.content as any,
      plainTextContent: plainText,
      categoryId,
      contentType: article.contentType as any,
      difficultyLevel: article.difficultyLevel as any,
      status: 'published',
      tags: article.tags as any,
      wordCount,
      estimatedReadingTime: Math.ceil(wordCount / 200),
      isPublic: true,
      publishedAt: new Date(),
      createdBy: SYSTEM_USER_ID,
    });

    console.log(`✅ Created article: ${article.title}`);
  }
}

// Helper functions
function extractPlainText(content: any): string {
  if (!content.sections) return '';

  return content.sections
    .map((section: any) => {
      if (typeof section.content === 'string') {
        return section.content;
      } else if (Array.isArray(section.content)) {
        return section.content.join(' ');
      }
      return '';
    })
    .join('\n\n');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Main seeding function
 */
async function seedKnowledgeBase(): Promise<void> {
  console.log('🌱 Starting knowledge base seeding...\n');

  try {
    // Seed categories first
    const categoryMap = await seedCategories();
    console.log('');

    // Seed articles
    await seedArticles(categoryMap);
    console.log('');

    console.log('✅ Knowledge base seeding completed successfully!');
    console.log(`📊 Created ${Object.keys(categoryMap).length} categories`);
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
    throw error;
  }
}

// Run if executed directly (ES modules check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedKnowledgeBase()
    .then(() => {
      console.log('\n✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedKnowledgeBase };
