/**
 * Database Migration Verification Script
 *
 * This script verifies that all expected tables from the Neon migration
 * exist in the production Supabase database.
 *
 * Usage: node scripts/verify-database-migration.mjs
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Expected tables from the original Neon database export (181 tables)
const EXPECTED_TABLES = [
  'accounts_payable',
  'accounts_receivable',
  'audit_logs',
  'automated_tasks',
  'automation_rules',
  'billing_adjustments',
  'billing_configurations',
  'billing_cycles',
  'billing_invoices',
  'billing_line_items',
  'budget_vs_actual',
  'business_intelligence_dashboards',
  'business_record_activities',
  'business_records',
  'cash_flow_projections',
  'commission_analytics',
  'commission_calculations',
  'commission_disputes',
  'commission_payments',
  'commission_sales_data',
  'commission_structures',
  'commission_transactions',
  'companies',
  'company_contacts',
  'company_pricing_settings',
  'contracts',
  'cpc_rates',
  'customer_activities',
  'customer_contacts',
  'customer_equipment',
  'customer_interactions',
  'customer_meter_submissions',
  'customer_notifications',
  'customer_number_config',
  'customer_number_history',
  'customer_payments',
  'customer_portal_access',
  'customer_portal_activity_log',
  'customer_related_records',
  'customer_service_requests',
  'customer_supply_order_items',
  'customer_supply_orders',
  'customers',
  'deal_activities',
  'deal_stages',
  'deals',
  'device_metrics',
  'device_performance_trends',
  'device_registrations',
  'device_telemetry',
  'documents',
  'enabled_products',
  'enhanced_roles',
  'enriched_companies',
  'enriched_contacts',
  'equipment',
  'equipment_asset_tracking',
  'equipment_delivery_schedules',
  'equipment_installations',
  'equipment_lifecycle_stages',
  'equipment_packages',
  'equipment_purchase_orders',
  'equipment_status_monitoring',
  'field_technicians',
  'field_work_orders',
  'financial_forecasts',
  'financial_kpis',
  'forecast_line_items',
  'forecast_metrics',
  'forecast_pipeline_items',
  'forecast_rules',
  'gl_accounts',
  'gps_tracking_points',
  'integration_audit_logs',
  'inventory_items',
  'invoice_line_items',
  'invoices',
  'iot_devices',
  'knowledge_base_articles',
  'lead_activities',
  'lead_contacts',
  'lead_related_records',
  'leads',
  'locations',
  'maintenance_notifications',
  'maintenance_schedules',
  'maintenance_tasks',
  'managed_services',
  'manufacturer_integrations',
  'master_product_accessories',
  'master_product_accessory_relationships',
  'master_product_models',
  'meter_readings',
  'mobile_app_sessions',
  'mobile_field_metrics',
  'mobile_field_orders',
  'mobile_order_line_items',
  'mobile_parts_inventory',
  'mobile_work_orders',
  'monitoring_dashboards',
  'onboarding_checklists',
  'onboarding_dynamic_sections',
  'onboarding_equipment',
  'onboarding_network_config',
  'onboarding_print_management',
  'onboarding_tasks',
  'organizational_units',
  'payment_methods',
  'payment_schedules',
  'payment_terms',
  'performance_benchmarks',
  'phone_in_tickets',
  'po_line_items',
  'predictive_alerts',
  'process_automation_logs',
  'product_accessories',
  'product_models',
  'product_pricing',
  'product_tags',
  'professional_services',
  'profitability_analysis',
  'proposal_analytics',
  'proposal_comments',
  'proposal_line_items',
  'proposal_templates',
  'proposals',
  'prospecting_campaigns',
  'purchase_orders',
  'qb_customers',
  'qb_invoices',
  'qb_items',
  'qb_vendors',
  'quickbooks_integrations',
  'quote_line_items',
  'quote_pricing',
  'quote_pricing_line_items',
  'quotes',
  'regions',
  'role_permissions',
  'roles',
  'sales_forecasts',
  'sales_quotas',
  'sales_representatives',
  'seo_pages',
  'seo_settings',
  'service_performance_metrics',
  'service_products',
  'service_requests',
  'service_templates',
  'service_ticket_updates',
  'service_tickets',
  'service_trend_analysis',
  'sessions',
  'social_media_cron_jobs',
  'social_media_posts',
  'software_products',
  'supplies',
  'supply_order_items',
  'supply_orders',
  'system_integrations',
  'system_permissions',
  'teams',
  'technician_availability',
  'technician_locations',
  'technician_performance_analytics',
  'technician_sessions',
  'technician_time_tracking',
  'technicians',
  'tenant_catalog_settings',
  'tenants',
  'ticket_parts_requests',
  'user_location_assignments',
  'user_role_assignments',
  'user_settings',
  'users',
  'vendor_bills',
  'voice_notes',
  'workflow_executions',
  'workflow_step_executions',
  'workflow_steps',
  'workflow_templates',
];

// Core business tables (critical for operations)
const CORE_TABLES = [
  'users',
  'tenants',
  'companies',
  'customers',
  'leads',
  'quotes',
  'invoices',
  'contracts',
  'roles',
  'teams',
  'equipment',
  'service_tickets',
  'business_records',
  'business_record_activities',
];

async function verifyMigration() {
  console.log('='.repeat(60));
  console.log('DATABASE MIGRATION VERIFICATION REPORT');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(60));
  console.log();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    // Get all tables in the database
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = new Set(result.rows.map((r) => r.table_name));
    const totalExisting = existingTables.size;

    console.log(`📊 SUMMARY`);
    console.log(`-`.repeat(40));
    console.log(`Total tables in Supabase: ${totalExisting}`);
    console.log(`Expected from Neon export: ${EXPECTED_TABLES.length}`);
    console.log();

    // Check core tables
    console.log(`🔑 CORE BUSINESS TABLES (${CORE_TABLES.length})`);
    console.log(`-`.repeat(40));
    let coreFound = 0;
    let coreMissing = [];

    for (const table of CORE_TABLES) {
      if (existingTables.has(table)) {
        console.log(`  ✅ ${table}`);
        coreFound++;
      } else {
        console.log(`  ❌ ${table} - MISSING!`);
        coreMissing.push(table);
      }
    }
    console.log();
    console.log(`Core tables: ${coreFound}/${CORE_TABLES.length} found`);
    console.log();

    // Check all expected tables
    const missingTables = [];
    const foundTables = [];
    const extraTables = [];

    for (const table of EXPECTED_TABLES) {
      if (existingTables.has(table)) {
        foundTables.push(table);
      } else {
        missingTables.push(table);
      }
    }

    // Find extra tables not in the expected list (new features)
    for (const table of existingTables) {
      if (!EXPECTED_TABLES.includes(table)) {
        extraTables.push(table);
      }
    }

    console.log(`📋 MIGRATION STATUS`);
    console.log(`-`.repeat(40));
    console.log(`Tables found: ${foundTables.length}/${EXPECTED_TABLES.length}`);
    console.log(`Tables missing: ${missingTables.length}`);
    console.log(`New tables (not in Neon): ${extraTables.length}`);
    console.log();

    // Report status
    if (missingTables.length === 0) {
      console.log(`✅ ALL EXPECTED TABLES EXIST!`);
      console.log(`   Migration appears complete.`);
    } else if (coreMissing.length === 0) {
      console.log(`⚠️  PARTIAL MIGRATION`);
      console.log(`   Core business tables exist.`);
      console.log(`   ${missingTables.length} secondary tables missing.`);
    } else {
      console.log(`❌ CRITICAL: Core tables missing!`);
      console.log(`   Missing: ${coreMissing.join(', ')}`);
      console.log(`   Migration is INCOMPLETE.`);
    }
    console.log();

    // List missing tables if any
    if (missingTables.length > 0) {
      console.log(`❌ MISSING TABLES (${missingTables.length})`);
      console.log(`-`.repeat(40));
      missingTables.forEach((t) => console.log(`  - ${t}`));
      console.log();
    }

    // List extra tables
    if (extraTables.length > 0) {
      console.log(`✨ NEW TABLES (not in Neon export)`);
      console.log(`-`.repeat(40));
      extraTables.forEach((t) => console.log(`  + ${t}`));
      console.log();
    }

    // Get row counts for core tables
    console.log(`📈 CORE TABLE ROW COUNTS`);
    console.log(`-`.repeat(40));
    for (const table of CORE_TABLES) {
      if (existingTables.has(table)) {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
          console.log(`  ${table}: ${countResult.rows[0].count} rows`);
        } catch (err) {
          console.log(`  ${table}: Error counting - ${err.message}`);
        }
      }
    }
    console.log();

    // Write results to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalInSupabase: totalExisting,
        expectedFromNeon: EXPECTED_TABLES.length,
        found: foundTables.length,
        missing: missingTables.length,
        newTables: extraTables.length,
        coreTablesFound: coreFound,
        coreTotalExpected: CORE_TABLES.length,
      },
      status:
        missingTables.length === 0
          ? 'COMPLETE'
          : coreMissing.length === 0
            ? 'PARTIAL'
            : 'INCOMPLETE',
      missingTables,
      extraTables,
      coreMissing,
    };

    console.log(`=`.repeat(60));
    console.log(`VERIFICATION COMPLETE`);
    console.log(`Status: ${report.status}`);
    console.log(`=`.repeat(60));

    // Return the report object for programmatic use
    return report;
  } catch (err) {
    console.error('❌ CONNECTION ERROR:', err.message);
    console.log();
    console.log('Troubleshooting:');
    console.log('1. Check DATABASE_URL in .env file');
    console.log('2. Verify network connectivity to database server');
    console.log('3. Check if database server is running');
    console.log('4. Verify SSL settings (DB_SSL, DB_SSL_REJECT_UNAUTHORIZED)');
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

verifyMigration();
