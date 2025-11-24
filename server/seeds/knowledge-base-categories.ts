/**
 * Knowledge Base Categories Seed Data
 *
 * This file contains the initial category structure for the Printyx Knowledge Base.
 * Categories are organized by priority and feature area.
 *
 * To run: node -r tsx/register server/seeds/seed-knowledge-base.ts
 */

export const knowledgeBaseCategories = [
  // Priority: Critical
  {
    name: 'Getting Started',
    slug: 'getting-started',
    description:
      'Everything you need to get started with Printyx. Learn the basics, set up your account, and understand the platform navigation.',
    icon: 'Rocket',
    displayOrder: 1,
    isVisible: true,
    articleCategory: 'getting_started' as const,
    metadata: {
      priority: 'critical',
      targetArticles: 15,
      estimatedCompletionTime: '30 minutes',
    },
  },
  {
    name: 'CRM & Sales',
    slug: 'crm-sales',
    description:
      'Master customer relationship management, lead tracking, sales pipeline, quotes, proposals, and sales forecasting.',
    icon: 'Users',
    displayOrder: 2,
    isVisible: true,
    articleCategory: 'crm_sales' as const,
    metadata: {
      priority: 'critical',
      targetArticles: 45,
      keyFeatures: ['Lead Management', 'Business Records', 'Sales Pipeline', 'Quotes & Proposals'],
    },
  },
  {
    name: 'Service Management',
    slug: 'service-management',
    description:
      'Comprehensive service dispatch, mobile field service, phone-in tickets, technician management, and proactive maintenance.',
    icon: 'Wrench',
    displayOrder: 3,
    isVisible: true,
    articleCategory: 'service_management' as const,
    metadata: {
      priority: 'critical',
      targetArticles: 40,
      keyFeatures: [
        'Service Dispatch',
        'Mobile Field Service',
        'Technician Management',
        'Equipment Lifecycle',
      ],
    },
  },

  // Priority: High
  {
    name: 'Meter Billing & Invoicing',
    slug: 'meter-billing',
    description:
      'Usage-based billing, meter collection, invoice management, and advanced billing configurations.',
    icon: 'DollarSign',
    displayOrder: 4,
    isVisible: true,
    articleCategory: 'meter_billing' as const,
    metadata: {
      priority: 'high',
      targetArticles: 25,
      keyFeatures: [
        'Meter Billing',
        'Invoice Management',
        'Contract Billing',
        'Payment Processing',
      ],
    },
  },
  {
    name: 'Inventory & Warehouse',
    slug: 'inventory-warehouse',
    description:
      'Stock tracking, warehouse operations, first pass yield (FPY), purchase orders, and product catalog management.',
    icon: 'Package',
    displayOrder: 5,
    isVisible: true,
    articleCategory: 'inventory_warehouse' as const,
    metadata: {
      priority: 'high',
      targetArticles: 30,
      keyFeatures: ['Inventory Tracking', 'Warehouse Operations', 'FPY Metrics', 'Product Catalog'],
    },
  },
  {
    name: 'Fleet Monitoring',
    slug: 'fleet-monitoring',
    description:
      'SNMP monitoring with Printyx Client, device discovery, meter readings, supply alerts, and manufacturer integrations.',
    icon: 'Activity',
    displayOrder: 6,
    isVisible: true,
    articleCategory: 'fleet_monitoring' as const,
    metadata: {
      priority: 'high',
      targetArticles: 20,
      keyFeatures: [
        'Printyx Client',
        'SNMP Monitoring',
        'Device Discovery',
        'Manufacturer Integration',
      ],
    },
  },
  {
    name: 'Reporting & Analytics',
    slug: 'reporting-analytics',
    description:
      'Standard reports, custom report builder, analytics dashboards, predictive insights, and data visualization.',
    icon: 'BarChart3',
    displayOrder: 7,
    isVisible: true,
    articleCategory: 'reporting_analytics' as const,
    metadata: {
      priority: 'high',
      targetArticles: 30,
      keyFeatures: ['Report Library', 'Custom Reports', 'Analytics', 'Forecasting'],
    },
  },
  {
    name: 'System Setup & Administration',
    slug: 'system-setup',
    description:
      'Tenant configuration, user management, RBAC, integrations, security settings, and subscription management.',
    icon: 'Settings',
    displayOrder: 8,
    isVisible: true,
    articleCategory: 'system_setup' as const,
    metadata: {
      priority: 'high',
      targetArticles: 35,
      keyFeatures: ['Tenant Setup', 'User Management', 'RBAC', 'Integration Hub', 'Security'],
    },
  },
  {
    name: 'Troubleshooting',
    slug: 'troubleshooting',
    description:
      'Common issues, error resolution, integration debugging, performance troubleshooting, and diagnostic guides.',
    icon: 'AlertCircle',
    displayOrder: 9,
    isVisible: true,
    articleCategory: 'troubleshooting' as const,
    metadata: {
      priority: 'high',
      targetArticles: 40,
      keyFeatures: ['Common Issues', 'Integration Debugging', 'Performance', 'Error Resolution'],
    },
  },

  // Priority: Medium
  {
    name: 'Customer Portal',
    slug: 'customer-portal',
    description:
      'Self-service portal for customers, ticket creation, service history, invoice access, and equipment monitoring.',
    icon: 'Globe',
    displayOrder: 10,
    isVisible: true,
    articleCategory: 'customer_portal' as const,
    metadata: {
      priority: 'medium',
      targetArticles: 15,
      keyFeatures: ['Self-Service', 'Ticket Management', 'Invoice Portal', 'Equipment Dashboard'],
    },
  },
  {
    name: 'Workflow Automation',
    slug: 'workflow-automation',
    description:
      'Workflow builder, automated processes, intelligent alerts, triggers, actions, and notification configuration.',
    icon: 'Workflow',
    displayOrder: 11,
    isVisible: true,
    articleCategory: 'workflow_automation' as const,
    metadata: {
      priority: 'medium',
      targetArticles: 20,
      keyFeatures: ['Workflow Builder', 'Automation', 'Intelligent Alerts', 'Triggers'],
    },
  },
  {
    name: 'AI Features',
    slug: 'ai-features',
    description:
      'AI-powered lead scoring, Claude AI integration, content generation, predictive maintenance, and natural language search.',
    icon: 'Sparkles',
    displayOrder: 12,
    isVisible: true,
    articleCategory: 'ai_features' as const,
    metadata: {
      priority: 'medium',
      targetArticles: 15,
      keyFeatures: ['Lead Scoring', 'Claude AI', 'Predictive Analytics', 'NL Search'],
    },
  },
  {
    name: 'Best Practices',
    slug: 'best-practices',
    description:
      'Industry best practices, optimization tips, security guidelines, workflow efficiency, and strategy recommendations.',
    icon: 'Award',
    displayOrder: 13,
    isVisible: true,
    articleCategory: 'best_practices' as const,
    metadata: {
      priority: 'medium',
      targetArticles: 25,
      keyFeatures: ['CRM Best Practices', 'Service Optimization', 'Security', 'Efficiency'],
    },
  },

  // Priority: Low (Ongoing)
  {
    name: 'Release Notes',
    slug: 'release-notes',
    description:
      'Monthly platform updates, new feature announcements, bug fixes, deprecated features, and migration guides.',
    icon: 'FileText',
    displayOrder: 14,
    isVisible: true,
    articleCategory: 'best_practices' as const, // Using best_practices as enum doesn't have release_notes
    metadata: {
      priority: 'low',
      targetArticles: 'ongoing',
      updateFrequency: 'monthly',
    },
  },

  // Special Categories
  {
    name: 'FAQs',
    slug: 'faqs',
    description:
      'Frequently asked questions organized by category. Quick answers to common questions about all Printyx features.',
    icon: 'HelpCircle',
    displayOrder: 15,
    isVisible: true,
    articleCategory: 'best_practices' as const, // Using best_practices as enum doesn't have faq
    metadata: {
      priority: 'high',
      targetArticles: 50,
      format: 'Q&A',
    },
  },
];

/**
 * Category-to-Article Type Mapping
 * Suggests appropriate content types for each category
 */
export const categoryContentTypeMapping = {
  getting_started: ['tutorial', 'how_to', 'reference'],
  crm_sales: ['how_to', 'tutorial', 'reference', 'best_practice'],
  service_management: ['tutorial', 'how_to', 'reference', 'troubleshooting'],
  meter_billing: ['how_to', 'reference', 'tutorial'],
  inventory_warehouse: ['how_to', 'tutorial', 'reference'],
  fleet_monitoring: ['how_to', 'tutorial', 'troubleshooting', 'reference'],
  customer_portal: ['tutorial', 'how_to', 'reference'],
  reporting_analytics: ['how_to', 'tutorial', 'reference'],
  workflow_automation: ['tutorial', 'how_to', 'best_practice'],
  ai_features: ['tutorial', 'reference', 'how_to'],
  system_setup: ['how_to', 'reference', 'tutorial'],
  troubleshooting: ['troubleshooting', 'how_to'],
  best_practices: ['best_practice', 'reference'],
};

/**
 * Difficulty Level Distribution Recommendations
 * Suggested distribution of difficulty levels per category
 */
export const difficultyDistribution = {
  getting_started: { beginner: 0.8, intermediate: 0.15, advanced: 0.05 },
  crm_sales: { beginner: 0.4, intermediate: 0.4, advanced: 0.2 },
  service_management: { beginner: 0.35, intermediate: 0.45, advanced: 0.2 },
  meter_billing: { beginner: 0.3, intermediate: 0.5, advanced: 0.2 },
  inventory_warehouse: { beginner: 0.35, intermediate: 0.45, advanced: 0.2 },
  fleet_monitoring: { beginner: 0.25, intermediate: 0.5, advanced: 0.25 },
  customer_portal: { beginner: 0.7, intermediate: 0.25, advanced: 0.05 },
  reporting_analytics: { beginner: 0.3, intermediate: 0.5, advanced: 0.2 },
  workflow_automation: { beginner: 0.2, intermediate: 0.5, advanced: 0.3 },
  ai_features: { beginner: 0.3, intermediate: 0.4, advanced: 0.3 },
  system_setup: { beginner: 0.25, intermediate: 0.5, advanced: 0.25 },
  troubleshooting: { beginner: 0.4, intermediate: 0.4, advanced: 0.2 },
  best_practices: { beginner: 0.2, intermediate: 0.6, advanced: 0.2 },
};
