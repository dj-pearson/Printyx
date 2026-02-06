import { db } from './db';
import { sql } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-subscription-plans');

import {
  subscriptionPlans,
  subscriptionFeatures,
  NewSubscriptionPlan,
  NewSubscriptionFeature,
} from '@shared/schema';

/**
 * SUBSCRIPTION PLANS SEED DATA
 *
 * This file seeds the database with default subscription plans and features.
 * Run this after database migration to set up initial plans.
 */

// Define all available features
const features: NewSubscriptionFeature[] = [
  // Core CRM Features
  {
    name: 'Lead Management',
    slug: 'lead_management',
    description: 'Capture and manage leads from multiple sources',
    category: 'CRM',
    isCore: true,
    displayOrder: 1,
  },
  {
    name: 'Customer Management',
    slug: 'customer_management',
    description: 'Full customer lifecycle management',
    category: 'CRM',
    isCore: true,
    displayOrder: 2,
  },
  {
    name: 'Deal Pipeline',
    slug: 'deal_pipeline',
    description: 'Visual deal tracking and pipeline management',
    category: 'CRM',
    isCore: true,
    displayOrder: 3,
  },
  {
    name: 'Contact Management',
    slug: 'contact_management',
    description: 'Unlimited contacts per business record',
    category: 'CRM',
    isCore: true,
    displayOrder: 4,
  },
  {
    name: 'Activity Tracking',
    slug: 'activity_tracking',
    description: 'Track calls, emails, meetings, and tasks',
    category: 'CRM',
    isCore: true,
    displayOrder: 5,
  },

  // Service Management
  {
    name: 'Service Tickets',
    slug: 'service_tickets',
    description: 'Create and manage service tickets',
    category: 'Service',
    isCore: true,
    displayOrder: 10,
  },
  {
    name: 'Technician Dispatch',
    slug: 'technician_dispatch',
    description: 'Assign and dispatch technicians',
    category: 'Service',
    isCore: true,
    displayOrder: 11,
  },
  {
    name: 'Equipment Tracking',
    slug: 'equipment_tracking',
    description: 'Track customer equipment and maintenance',
    category: 'Service',
    isCore: true,
    displayOrder: 12,
  },
  {
    name: 'Service History',
    slug: 'service_history',
    description: 'Complete service history for each customer',
    category: 'Service',
    isCore: true,
    displayOrder: 13,
  },
  {
    name: 'Preventive Maintenance',
    slug: 'preventive_maintenance',
    description: 'Automated maintenance scheduling',
    category: 'Service',
    isCore: false,
    displayOrder: 14,
  },

  // Inventory Management
  {
    name: 'Parts Inventory',
    slug: 'parts_inventory',
    description: 'Track parts and supplies',
    category: 'Inventory',
    isCore: true,
    displayOrder: 20,
  },
  {
    name: 'Stock Levels',
    slug: 'stock_levels',
    description: 'Monitor stock levels and low stock alerts',
    category: 'Inventory',
    isCore: true,
    displayOrder: 21,
  },
  {
    name: 'Purchase Orders',
    slug: 'purchase_orders',
    description: 'Create and manage purchase orders',
    category: 'Inventory',
    isCore: false,
    displayOrder: 22,
  },
  {
    name: 'Multi-Warehouse',
    slug: 'multi_warehouse',
    description: 'Manage inventory across multiple warehouses',
    category: 'Inventory',
    isCore: false,
    displayOrder: 23,
  },
  {
    name: 'Barcode Scanning',
    slug: 'barcode_scanning',
    description: 'Mobile barcode scanning for inventory',
    category: 'Inventory',
    isCore: false,
    displayOrder: 24,
  },

  // Billing & Invoicing
  {
    name: 'Invoice Generation',
    slug: 'invoice_generation',
    description: 'Create professional invoices',
    category: 'Billing',
    isCore: true,
    displayOrder: 30,
  },
  {
    name: 'Meter Billing',
    slug: 'meter_billing',
    description: 'Automated meter reading and billing',
    category: 'Billing',
    isCore: false,
    displayOrder: 31,
  },
  {
    name: 'Contract Management',
    slug: 'contract_management',
    description: 'Manage service contracts and agreements',
    category: 'Billing',
    isCore: false,
    displayOrder: 32,
  },
  {
    name: 'Payment Processing',
    slug: 'payment_processing',
    description: 'Accept payments online',
    category: 'Billing',
    isCore: false,
    displayOrder: 33,
  },
  {
    name: 'Recurring Billing',
    slug: 'recurring_billing',
    description: 'Automated recurring invoices',
    category: 'Billing',
    isCore: false,
    displayOrder: 34,
  },

  // Analytics & Reporting
  {
    name: 'Basic Reports',
    slug: 'basic_reports',
    description: 'Standard business reports',
    category: 'Analytics',
    isCore: true,
    displayOrder: 40,
  },
  {
    name: 'Advanced Analytics',
    slug: 'advanced_analytics',
    description: 'In-depth analytics and insights',
    category: 'Analytics',
    isCore: false,
    displayOrder: 41,
  },
  {
    name: 'Custom Dashboards',
    slug: 'custom_dashboards',
    description: 'Create custom analytics dashboards',
    category: 'Analytics',
    isCore: false,
    displayOrder: 42,
  },
  {
    name: 'Predictive Maintenance',
    slug: 'predictive_maintenance',
    description: 'AI-powered predictive maintenance',
    category: 'Analytics',
    isCore: false,
    displayOrder: 43,
  },
  {
    name: 'Data Export',
    slug: 'data_export',
    description: 'Export data to CSV, Excel, PDF',
    category: 'Analytics',
    isCore: true,
    displayOrder: 44,
  },

  // Integrations
  {
    name: 'Email Integration',
    slug: 'email_integration',
    description: 'Sync with email providers',
    category: 'Integrations',
    isCore: true,
    displayOrder: 50,
  },
  {
    name: 'QuickBooks Integration',
    slug: 'quickbooks_integration',
    description: 'Two-way QuickBooks sync',
    category: 'Integrations',
    isCore: false,
    displayOrder: 51,
  },
  {
    name: 'Salesforce Integration',
    slug: 'salesforce_integration',
    description: 'Salesforce data synchronization',
    category: 'Integrations',
    isCore: false,
    displayOrder: 52,
  },
  {
    name: 'E-Automate Integration',
    slug: 'eautomate_integration',
    description: 'E-Automate MPS platform integration',
    category: 'Integrations',
    isCore: false,
    displayOrder: 53,
  },
  {
    name: 'API Access',
    slug: 'api_access',
    description: 'Full REST API access',
    category: 'Integrations',
    isCore: false,
    displayOrder: 54,
  },
  {
    name: 'Webhook Support',
    slug: 'webhook_support',
    description: 'Real-time webhooks for events',
    category: 'Integrations',
    isCore: false,
    displayOrder: 55,
  },

  // Collaboration
  {
    name: 'Team Collaboration',
    slug: 'team_collaboration',
    description: 'Internal notes and mentions',
    category: 'Collaboration',
    isCore: true,
    displayOrder: 60,
  },
  {
    name: 'Document Storage',
    slug: 'document_storage',
    description: 'Upload and attach documents',
    category: 'Collaboration',
    isCore: true,
    displayOrder: 61,
  },
  {
    name: 'Shared Calendars',
    slug: 'shared_calendars',
    description: 'Team calendar and scheduling',
    category: 'Collaboration',
    isCore: false,
    displayOrder: 62,
  },

  // Security & Compliance
  {
    name: 'Role-Based Access',
    slug: 'role_based_access',
    description: 'Granular permission controls',
    category: 'Security',
    isCore: true,
    displayOrder: 70,
  },
  {
    name: 'Audit Logs',
    slug: 'audit_logs',
    description: 'Complete activity audit trail',
    category: 'Security',
    isCore: false,
    displayOrder: 71,
  },
  {
    name: 'Data Encryption',
    slug: 'data_encryption',
    description: 'End-to-end data encryption',
    category: 'Security',
    isCore: true,
    displayOrder: 72,
  },
  {
    name: 'SSO Integration',
    slug: 'sso_integration',
    description: 'Single Sign-On support',
    category: 'Security',
    isCore: false,
    displayOrder: 73,
  },
  {
    name: 'IP Whitelisting',
    slug: 'ip_whitelisting',
    description: 'Restrict access by IP address',
    category: 'Security',
    isCore: false,
    displayOrder: 74,
  },

  // Support
  {
    name: 'Email Support',
    slug: 'email_support',
    description: 'Email support within 24 hours',
    category: 'Support',
    isCore: true,
    displayOrder: 80,
  },
  {
    name: 'Priority Support',
    slug: 'priority_support',
    description: 'Priority email and chat support',
    category: 'Support',
    isCore: false,
    displayOrder: 81,
  },
  {
    name: 'Phone Support',
    slug: 'phone_support',
    description: 'Dedicated phone support',
    category: 'Support',
    isCore: false,
    displayOrder: 82,
  },
  {
    name: 'Dedicated Account Manager',
    slug: 'dedicated_account_manager',
    description: 'Personal account manager',
    category: 'Support',
    isCore: false,
    displayOrder: 83,
  },
  {
    name: 'Onboarding Assistance',
    slug: 'onboarding_assistance',
    description: 'Guided onboarding and training',
    category: 'Support',
    isCore: false,
    displayOrder: 84,
  },
  {
    name: 'SLA Guarantee',
    slug: 'sla_guarantee',
    description: '99.9% uptime SLA with guaranteed response times',
    category: 'Support',
    isCore: false,
    displayOrder: 85,
  },

  // Mobile & Field Service
  {
    name: 'Mobile Service App',
    slug: 'mobile_service_app',
    description: 'Mobile app for field technicians with offline capabilities',
    category: 'Service',
    isCore: false,
    displayOrder: 90,
  },
  {
    name: 'GPS Tracking',
    slug: 'gps_tracking',
    description: 'Real-time technician location tracking',
    category: 'Service',
    isCore: false,
    displayOrder: 91,
  },
  {
    name: 'Mobile Photo Capture',
    slug: 'mobile_photo_capture',
    description: 'Capture and attach photos from mobile devices',
    category: 'Service',
    isCore: false,
    displayOrder: 92,
  },
  {
    name: 'Digital Signatures',
    slug: 'digital_signatures',
    description: 'Collect customer signatures on mobile devices',
    category: 'Service',
    isCore: false,
    displayOrder: 93,
  },

  // Enterprise Features
  {
    name: 'White Label Options',
    slug: 'white_label',
    description: 'Custom branding with your logo and domain',
    category: 'Platform',
    isCore: false,
    displayOrder: 100,
  },
  {
    name: 'Custom Integrations',
    slug: 'custom_integrations',
    description: 'Build custom integrations with external systems',
    category: 'Integrations',
    isCore: false,
    displayOrder: 101,
  },
  {
    name: 'Advanced Forecasting',
    slug: 'advanced_forecasting',
    description: 'AI-powered analytics and revenue forecasting',
    category: 'Analytics',
    isCore: false,
    displayOrder: 102,
  },
  {
    name: 'AI CSV Import',
    slug: 'ai_csv_import',
    description: 'AI-powered CSV import with automatic column mapping and data cleaning',
    category: 'Data',
    isCore: false,
    displayOrder: 103,
  },
];

// Define subscription plans
const plans: NewSubscriptionPlan[] = [
  // Starter Plan
  {
    name: 'Starter',
    slug: 'starter',
    description:
      'Perfect for small copier dealers (5-20 employees) with core contract management and meter billing',
    monthlyPrice: '79.00',
    annualPrice: '758.00',
    annualDiscount: 20, // 20% discount on annual
    maxUsers: 20,
    maxStorage: 100, // 100 GB included
    maxApiCalls: 10000,
    maxLocations: 3,
    maxBusinessRecords: 1000,
    trialEnabled: true,
    trialDays: 30,
    trialRequiresPayment: false,
    features: [
      'lead_management',
      'customer_management',
      'deal_pipeline',
      'contact_management',
      'activity_tracking',
      'service_tickets',
      'technician_dispatch',
      'equipment_tracking',
      'service_history',
      'parts_inventory',
      'stock_levels',
      'invoice_generation',
      'basic_reports',
      'data_export',
      'email_integration',
      'team_collaboration',
      'document_storage',
      'role_based_access',
      'data_encryption',
      'email_support',
    ],
    displayOrder: 1,
    isPopular: false,
    isVisible: true,
    isActive: true,
  },

  // Professional Plan
  {
    name: 'Professional',
    slug: 'professional',
    description:
      'For growing copier dealers (20-100 employees) with service dispatch, mobile app, and advanced inventory',
    monthlyPrice: '99.00',
    annualPrice: '950.00',
    annualDiscount: 20, // 20% discount on annual
    maxUsers: 100,
    maxStorage: 100, // 100 GB included
    maxApiCalls: 50000,
    maxLocations: 10,
    maxBusinessRecords: -1, // Unlimited contracts
    trialEnabled: true,
    trialDays: 30,
    trialRequiresPayment: false,
    features: [
      // All Starter features
      'lead_management',
      'customer_management',
      'deal_pipeline',
      'contact_management',
      'activity_tracking',
      'service_tickets',
      'technician_dispatch',
      'equipment_tracking',
      'service_history',
      'parts_inventory',
      'stock_levels',
      'invoice_generation',
      'basic_reports',
      'data_export',
      'email_integration',
      'team_collaboration',
      'document_storage',
      'role_based_access',
      'data_encryption',
      'email_support',
      // Additional Professional features
      'preventive_maintenance',
      'purchase_orders',
      'multi_warehouse',
      'meter_billing',
      'contract_management',
      'payment_processing',
      'recurring_billing',
      'advanced_analytics',
      'custom_dashboards',
      'quickbooks_integration',
      'salesforce_integration',
      'eautomate_integration',
      'api_access',
      'shared_calendars',
      'audit_logs',
      'priority_support',
      'phone_support',
      // Mobile & Field Service
      'mobile_service_app',
      'gps_tracking',
      'mobile_photo_capture',
      'digital_signatures',
      // AI Features
      'ai_csv_import',
    ],
    displayOrder: 2,
    isPopular: true,
    isVisible: true,
    isActive: true,
  },

  // Enterprise Plan
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description:
      'For large copier dealers (100+ employees) with dedicated account manager, API access, and SLA guarantees',
    monthlyPrice: '149.00',
    annualPrice: '1430.00',
    annualDiscount: 20, // 20% discount on annual
    maxUsers: -1, // Unlimited
    maxStorage: -1, // Unlimited (100GB included, $50/100GB additional)
    maxApiCalls: -1, // Unlimited (included up to limit, then $0.001/call)
    maxLocations: -1, // Unlimited
    maxBusinessRecords: -1, // Unlimited
    trialEnabled: true,
    trialDays: 30,
    trialRequiresPayment: true, // Enterprise requires payment method upfront
    features: [
      // All features
      'lead_management',
      'customer_management',
      'deal_pipeline',
      'contact_management',
      'activity_tracking',
      'service_tickets',
      'technician_dispatch',
      'equipment_tracking',
      'service_history',
      'parts_inventory',
      'stock_levels',
      'invoice_generation',
      'basic_reports',
      'data_export',
      'email_integration',
      'team_collaboration',
      'document_storage',
      'role_based_access',
      'data_encryption',
      'email_support',
      'preventive_maintenance',
      'purchase_orders',
      'multi_warehouse',
      'barcode_scanning',
      'meter_billing',
      'contract_management',
      'payment_processing',
      'recurring_billing',
      'advanced_analytics',
      'custom_dashboards',
      'predictive_maintenance',
      'quickbooks_integration',
      'salesforce_integration',
      'eautomate_integration',
      'api_access',
      'webhook_support',
      'shared_calendars',
      'audit_logs',
      'sso_integration',
      'ip_whitelisting',
      'priority_support',
      'phone_support',
      'dedicated_account_manager',
      'onboarding_assistance',
      // Mobile & Field Service
      'mobile_service_app',
      'gps_tracking',
      'mobile_photo_capture',
      'digital_signatures',
      // Enterprise Features
      'white_label',
      'custom_integrations',
      'advanced_forecasting',
      'sla_guarantee',
      // AI Features
      'ai_csv_import',
    ],
    displayOrder: 3,
    isPopular: false,
    isVisible: true,
    isActive: true,
  },
];

/**
 * Seed subscription plans and features
 */
export async function seedSubscriptionPlans() {
  log.info('🌱 Seeding subscription features...');

  try {
    // Insert features
    const insertedFeatures = await db
      .insert(subscriptionFeatures)
      .values(features)
      .onConflictDoUpdate({
        target: subscriptionFeatures.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          category: sql`excluded.category`,
          isCore: sql`excluded.is_core`,
          displayOrder: sql`excluded.display_order`,
        },
      })
      .returning();

    log.info(`✅ Seeded ${insertedFeatures.length} features`);

    // Insert plans
    log.info('🌱 Seeding subscription plans...');

    const insertedPlans = await db
      .insert(subscriptionPlans)
      .values(plans)
      .onConflictDoUpdate({
        target: subscriptionPlans.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          monthlyPrice: sql`excluded.monthly_price`,
          annualPrice: sql`excluded.annual_price`,
          annualDiscount: sql`excluded.annual_discount`,
          maxUsers: sql`excluded.max_users`,
          maxStorage: sql`excluded.max_storage`,
          maxApiCalls: sql`excluded.max_api_calls`,
          maxLocations: sql`excluded.max_locations`,
          maxBusinessRecords: sql`excluded.max_business_records`,
          trialEnabled: sql`excluded.trial_enabled`,
          trialDays: sql`excluded.trial_days`,
          trialRequiresPayment: sql`excluded.trial_requires_payment`,
          features: sql`excluded.features`,
          displayOrder: sql`excluded.display_order`,
          isPopular: sql`excluded.is_popular`,
          isVisible: sql`excluded.is_visible`,
          isActive: sql`excluded.isActive`,
        },
      })
      .returning();

    log.info(`✅ Seeded ${insertedPlans.length} plans`);

    log.info('✅ Subscription plans seeding completed successfully!');
    return { features: insertedFeatures, plans: insertedPlans };
  } catch (error) {
    log.error('❌ Error seeding subscription plans:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedSubscriptionPlans()
    .then(() => {
      log.info('🎉 Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      log.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}
