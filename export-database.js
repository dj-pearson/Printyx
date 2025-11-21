#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import path from 'path';

const sql = neon(process.env.DATABASE_URL);

// List of all tables to export
const TABLES = [
  'accounts_payable', 'accounts_receivable', 'audit_logs', 'automated_tasks', 'automation_rules',
  'billing_adjustments', 'billing_configurations', 'billing_cycles', 'billing_invoices', 'billing_line_items',
  'budget_vs_actual', 'business_intelligence_dashboards', 'business_record_activities', 'business_records',
  'cash_flow_projections', 'commission_analytics', 'commission_calculations', 'commission_disputes',
  'commission_payments', 'commission_sales_data', 'commission_structures', 'commission_transactions',
  'companies', 'company_contacts', 'company_pricing_settings', 'contracts', 'cpc_rates',
  'customer_activities', 'customer_contacts', 'customer_equipment', 'customer_interactions',
  'customer_meter_submissions', 'customer_notifications', 'customer_number_config', 'customer_number_history',
  'customer_payments', 'customer_portal_access', 'customer_portal_activity_log', 'customer_related_records',
  'customer_service_requests', 'customer_supply_order_items', 'customer_supply_orders', 'customers',
  'deal_activities', 'deal_stages', 'deals', 'device_metrics', 'device_performance_trends',
  'device_registrations', 'device_telemetry', 'documents', 'enabled_products', 'enhanced_roles',
  'enriched_companies', 'enriched_contacts', 'equipment', 'equipment_asset_tracking',
  'equipment_delivery_schedules', 'equipment_installations', 'equipment_lifecycle_stages',
  'equipment_packages', 'equipment_purchase_orders', 'equipment_status_monitoring', 'field_technicians',
  'field_work_orders', 'financial_forecasts', 'financial_kpis', 'forecast_line_items', 'forecast_metrics',
  'forecast_pipeline_items', 'forecast_rules', 'gl_accounts', 'gps_tracking_points',
  'integration_audit_logs', 'inventory_items', 'invoice_line_items', 'invoices', 'iot_devices',
  'knowledge_base_articles', 'lead_activities', 'lead_contacts', 'lead_related_records', 'leads',
  'locations', 'maintenance_notifications', 'maintenance_schedules', 'maintenance_tasks',
  'managed_services', 'manufacturer_integrations', 'master_product_accessories',
  'master_product_accessory_relationships', 'master_product_models', 'meter_readings',
  'mobile_app_sessions', 'mobile_field_metrics', 'mobile_field_orders', 'mobile_order_line_items',
  'mobile_parts_inventory', 'mobile_work_orders', 'monitoring_dashboards', 'onboarding_checklists',
  'onboarding_dynamic_sections', 'onboarding_equipment', 'onboarding_network_config',
  'onboarding_print_management', 'onboarding_tasks', 'organizational_units', 'payment_methods',
  'payment_schedules', 'payment_terms', 'performance_benchmarks', 'phone_in_tickets', 'po_line_items',
  'predictive_alerts', 'process_automation_logs', 'product_accessories', 'product_models',
  'product_pricing', 'product_tags', 'professional_services', 'profitability_analysis',
  'proposal_analytics', 'proposal_comments', 'proposal_line_items', 'proposal_templates', 'proposals',
  'prospecting_campaigns', 'purchase_orders', 'qb_customers', 'qb_invoices', 'qb_items', 'qb_vendors',
  'quickbooks_integrations', 'quote_line_items', 'quote_pricing', 'quote_pricing_line_items', 'quotes',
  'regions', 'role_permissions', 'roles', 'sales_forecasts', 'sales_quotas', 'sales_representatives',
  'seo_pages', 'seo_settings', 'service_performance_metrics', 'service_products', 'service_requests',
  'service_templates', 'service_ticket_updates', 'service_tickets', 'service_trend_analysis', 'sessions',
  'social_media_cron_jobs', 'social_media_posts', 'software_products', 'supplies', 'supply_order_items',
  'supply_orders', 'system_integrations', 'system_permissions', 'teams', 'technician_availability',
  'technician_locations', 'technician_performance_analytics', 'technician_sessions',
  'technician_time_tracking', 'technicians', 'tenant_catalog_settings', 'tenants',
  'ticket_parts_requests', 'user_location_assignments', 'user_role_assignments', 'user_settings',
  'users', 'vendor_bills', 'voice_notes', 'workflow_executions', 'workflow_step_executions',
  'workflow_steps', 'workflow_templates'
];

async function exportDatabase() {
  console.log('🔄 Starting database export...');
  
  // Create exports directory
  await fs.mkdir('database-exports', { recursive: true });
  
  // Export each table
  for (const table of TABLES) {
    try {
      console.log(`📊 Exporting table: ${table}`);
      
      // Get table data
      const rows = await sql`SELECT * FROM ${sql(table)}`;
      
      if (rows.length === 0) {
        console.log(`   ⚠️  Table ${table} is empty, skipping...`);
        continue;
      }
      
      // Create INSERT statements
      const columns = Object.keys(rows[0]);
      const tableName = table;
      
      let sqlContent = `-- Export for table: ${tableName}\n`;
      sqlContent += `-- Generated on: ${new Date().toISOString()}\n`;
      sqlContent += `-- Total rows: ${rows.length}\n\n`;
      
      // Add TRUNCATE statement (commented out for safety)
      sqlContent += `-- TRUNCATE TABLE "${tableName}" CASCADE;\n\n`;
      
      for (const row of rows) {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          if (typeof value === 'boolean') return value ? 'true' : 'false';
          if (value instanceof Date) return `'${value.toISOString()}'`;
          if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          return value;
        }).join(', ');
        
        sqlContent += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values});\n`;
      }
      
      sqlContent += '\n';
      
      // Write to file
      await fs.writeFile(`database-exports/${tableName}.sql`, sqlContent);
      console.log(`   ✅ Exported ${rows.length} rows to ${tableName}.sql`);
      
    } catch (error) {
      console.error(`   ❌ Error exporting ${table}:`, error.message);
    }
  }
  
  // Create a combined export file
  console.log('📦 Creating combined export file...');
  
  let combinedSql = `-- Printyx Database Export\n`;
  combinedSql += `-- Generated on: ${new Date().toISOString()}\n`;
  combinedSql += `-- Total tables: ${TABLES.length}\n\n`;
  
  for (const table of TABLES) {
    try {
      const content = await fs.readFile(`database-exports/${table}.sql`, 'utf-8');
      combinedSql += content + '\n';
    } catch (error) {
      console.log(`   ⚠️  Skipping ${table} (empty or error)`);
    }
  }
  
  await fs.writeFile('database-exports/complete-database-export.sql', combinedSql);
  
  console.log('✅ Database export completed!');
  console.log('\n📁 Files created:');
  console.log('   • Individual table exports in database-exports/ folder');
  console.log('   • Complete combined export: database-exports/complete-database-export.sql');
  console.log('\n📝 You can now download these files for production import');
}

// Run the export
exportDatabase().catch(console.error);