// =====================================================================
// REPORT DEFINITIONS SEED DATA
// Phase 1 Implementation - Basic Reports for Sales, Service, Finance
// =====================================================================

import { db } from './storage';
import { reportDefinitions, kpiDefinitions } from '../shared/reporting-schema';

// =====================================================================
// SALES DEPARTMENT REPORT DEFINITIONS
// =====================================================================

export const SALES_REPORTS = [
  {
    id: 'sales_pipeline_overview',
    name: 'Sales Pipeline Overview',
    code: 'sales_pipeline_overview',
    description: 'Complete pipeline analysis with stage progression, conversion rates, and forecasting',
    category: 'sales' as const,
    organizationalScope: 'location' as const,
    requiredPermissions: { canViewSalesReports: true },
    sqlQuery: `
      WITH pipeline_data AS (
        SELECT 
          br.id,
          br.company_name,
          br.estimated_amount,
          br.status,
          br.lead_source,
          br.owner_id,
          br.created_at,
          br.updated_at,
          u.first_name || ' ' || u.last_name as owner_name,
          l.name as location_name,
          r.name as region_name,
          -- Stage progression calculations
          CASE 
            WHEN br.status IN ('new', 'contacted') THEN 'Prospecting'
            WHEN br.status IN ('qualified', 'proposal') THEN 'Qualified'
            WHEN br.status = 'negotiation' THEN 'Negotiation'
            WHEN br.status = 'closed_won' THEN 'Closed Won'
            WHEN br.status = 'closed_lost' THEN 'Closed Lost'
            ELSE 'Other'
          END as pipeline_stage,
          -- Aging calculations
          EXTRACT(DAYS FROM NOW() - br.created_at) as days_in_pipeline,
          EXTRACT(DAYS FROM NOW() - br.updated_at) as days_since_last_activity
        FROM business_records br
        LEFT JOIN users u ON br.owner_id = u.id
        LEFT JOIN locations l ON u.primary_location_id = l.id
        LEFT JOIN regions r ON l.region_id = r.id
        WHERE br.tenant_id = :tenantId
          AND br.record_type = 'lead'
          AND br.status NOT IN ('closed_won', 'closed_lost')
          AND (:locationIds IS NULL OR l.id = ANY(:locationIds))
          AND (:regionIds IS NULL OR r.id = ANY(:regionIds))
          AND (:fromDate IS NULL OR br.created_at >= :fromDate)
          AND (:toDate IS NULL OR br.created_at <= :toDate)
      )
      SELECT 
        *,
        -- Performance indicators
        CASE 
          WHEN days_since_last_activity > 30 THEN 'Stale'
          WHEN days_since_last_activity > 14 THEN 'Needs Attention'
          ELSE 'Active'
        END as activity_status,
        -- Pipeline value weights
        CASE pipeline_stage
          WHEN 'Prospecting' THEN estimated_amount * 0.1
          WHEN 'Qualified' THEN estimated_amount * 0.3
          WHEN 'Negotiation' THEN estimated_amount * 0.7
          ELSE estimated_amount
        END as weighted_value
      FROM pipeline_data
      ORDER BY estimated_amount DESC, days_since_last_activity DESC
    `,
    defaultParameters: {
      tenantId: null,
      locationIds: null,
      regionIds: null,
      fromDate: null,
      toDate: null
    },
    availableFilters: {
      dateRange: { type: 'dateRange', label: 'Date Range' },
      pipelineStage: { type: 'multiSelect', options: ['Prospecting', 'Qualified', 'Negotiation'] },
      leadSource: { type: 'multiSelect', options: ['Website', 'Referral', 'Cold Call', 'Trade Show'] },
      owner: { type: 'userSelect', label: 'Sales Rep' },
      amountRange: { type: 'numberRange', label: 'Deal Value' }
    },
    availableGroupings: {
      stage: 'pipeline_stage',
      owner: 'owner_name',
      location: 'location_name',
      source: 'lead_source',
      month: 'DATE_TRUNC(\'month\', created_at)'
    },
    chartConfig: {
      defaultChartType: 'pipeline',
      xAxis: 'pipeline_stage',
      yAxis: 'estimated_amount',
      colorBy: 'activity_status'
    },
    supportsDrillDown: true
  },

  {
    id: 'sales_rep_performance',
    name: 'Sales Rep Performance Analytics',
    code: 'sales_rep_performance',
    description: 'Individual sales rep performance with activity metrics, conversion rates, and coaching insights',
    category: 'sales' as const,
    organizationalScope: 'team' as const,
    requiredPermissions: { canViewSalesReports: true, canViewTeamData: true },
    sqlQuery: `
      WITH rep_metrics AS (
        SELECT 
          u.id as rep_id,
          u.first_name || ' ' || u.last_name as rep_name,
          l.name as location_name,
          
          -- Lead metrics
          COUNT(CASE WHEN br.record_type = 'lead' THEN 1 END) as total_leads,
          COUNT(CASE WHEN br.record_type = 'lead' AND br.status = 'qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN br.record_type = 'lead' AND br.status = 'closed_won' THEN 1 END) as won_deals,
          COUNT(CASE WHEN br.record_type = 'lead' AND br.status = 'closed_lost' THEN 1 END) as lost_deals,
          
          -- Revenue metrics
          SUM(CASE WHEN br.status = 'closed_won' THEN br.estimated_amount ELSE 0 END) as total_revenue,
          SUM(br.estimated_amount) as pipeline_value,
          AVG(CASE WHEN br.status = 'closed_won' THEN br.estimated_amount END) as avg_deal_size,
          
          -- Activity metrics (would need activities table)
          -- COUNT(a.id) as total_activities,
          -- COUNT(CASE WHEN a.activity_type = 'call' THEN 1 END) as calls_made,
          -- COUNT(CASE WHEN a.activity_type = 'meeting' THEN 1 END) as meetings_held,
          
          -- Time-based metrics
          AVG(EXTRACT(DAYS FROM 
            CASE WHEN br.status IN ('closed_won', 'closed_lost') 
            THEN br.updated_at - br.created_at 
            END
          )) as avg_sales_cycle_days
          
        FROM users u
        LEFT JOIN business_records br ON u.id = br.owner_id
        LEFT JOIN locations l ON u.primary_location_id = l.id
        WHERE u.tenant_id = :tenantId
          AND u.role_id IN (SELECT id FROM roles WHERE department = 'sales')
          AND (:locationIds IS NULL OR l.id = ANY(:locationIds))
          AND (:fromDate IS NULL OR br.created_at >= :fromDate)
          AND (:toDate IS NULL OR br.created_at <= :toDate)
        GROUP BY u.id, u.first_name, u.last_name, l.name
      )
      SELECT 
        *,
        -- Conversion rates
        CASE WHEN total_leads > 0 
          THEN ROUND((qualified_leads::DECIMAL / total_leads) * 100, 2) 
          ELSE 0 
        END as qualification_rate,
        
        CASE WHEN qualified_leads > 0 
          THEN ROUND((won_deals::DECIMAL / qualified_leads) * 100, 2) 
          ELSE 0 
        END as close_rate,
        
        CASE WHEN total_leads > 0 
          THEN ROUND((won_deals::DECIMAL / total_leads) * 100, 2) 
          ELSE 0 
        END as overall_conversion_rate,
        
        -- Performance indicators
        CASE 
          WHEN won_deals >= 5 AND qualification_rate >= 30 THEN 'High Performer'
          WHEN won_deals >= 2 AND qualification_rate >= 20 THEN 'Solid Performer'
          WHEN total_leads >= 10 THEN 'Developing'
          ELSE 'Needs Coaching'
        END as performance_tier
        
      FROM rep_metrics
      ORDER BY total_revenue DESC, won_deals DESC
    `,
    availableFilters: {
      dateRange: { type: 'dateRange', label: 'Performance Period' },
      performanceTier: { type: 'multiSelect', options: ['High Performer', 'Solid Performer', 'Developing', 'Needs Coaching'] },
      location: { type: 'locationSelect', label: 'Location' }
    },
    chartConfig: {
      defaultChartType: 'scatter',
      xAxis: 'qualification_rate',
      yAxis: 'close_rate',
      sizeBy: 'total_revenue',
      colorBy: 'performance_tier'
    },
    isRealTime: false,
    supportsDrillDown: true
  }
];

// =====================================================================
// SERVICE DEPARTMENT REPORT DEFINITIONS
// =====================================================================

export const SERVICE_REPORTS = [
  {
    id: 'service_sla_performance',
    name: 'Service SLA Performance Dashboard',
    code: 'service_sla_performance',
    description: 'Real-time SLA monitoring with response times, resolution rates, and breach analysis',
    category: 'service' as const,
    organizationalScope: 'location' as const,
    requiredPermissions: { canViewServiceReports: true },
    sqlQuery: `
      WITH sla_metrics AS (
        SELECT 
          st.id as ticket_id,
          st.ticket_number,
          st.priority,
          st.status,
          st.service_type,
          st.created_at,
          st.resolved_at,
          st.assigned_technician_id,
          u.first_name || ' ' || u.last_name as technician_name,
          l.name as location_name,
          c.company_name as customer_name,
          
          -- Response time calculation (first technician assignment)
          EXTRACT(MINUTES FROM st.first_response_at - st.created_at) as response_time_minutes,
          
          -- Resolution time calculation
          EXTRACT(HOURS FROM st.resolved_at - st.created_at) as resolution_time_hours,
          
          -- SLA targets based on priority
          CASE st.priority
            WHEN 'critical' THEN 30   -- 30 minute response
            WHEN 'high' THEN 120      -- 2 hour response
            WHEN 'medium' THEN 480    -- 8 hour response
            WHEN 'low' THEN 1440      -- 24 hour response
            ELSE 480
          END as response_sla_minutes,
          
          CASE st.priority
            WHEN 'critical' THEN 4    -- 4 hour resolution
            WHEN 'high' THEN 24       -- 24 hour resolution
            WHEN 'medium' THEN 72     -- 72 hour resolution
            WHEN 'low' THEN 168       -- 7 day resolution
            ELSE 72
          END as resolution_sla_hours
          
        FROM service_tickets st
        LEFT JOIN users u ON st.assigned_technician_id = u.id
        LEFT JOIN locations l ON st.location_id = l.id
        LEFT JOIN companies c ON st.customer_id = c.id
        WHERE st.tenant_id = :tenantId
          AND (:locationIds IS NULL OR st.location_id = ANY(:locationIds))
          AND (:fromDate IS NULL OR st.created_at >= :fromDate)
          AND (:toDate IS NULL OR st.created_at <= :toDate)
          AND (:priority IS NULL OR st.priority = :priority)
      )
      SELECT 
        *,
        -- SLA breach indicators
        CASE 
          WHEN response_time_minutes IS NULL THEN 'Pending Response'
          WHEN response_time_minutes <= response_sla_minutes THEN 'Response Met'
          ELSE 'Response Breached'
        END as response_sla_status,
        
        CASE 
          WHEN status != 'resolved' THEN 'In Progress'
          WHEN resolution_time_hours <= resolution_sla_hours THEN 'Resolution Met'
          ELSE 'Resolution Breached'
        END as resolution_sla_status,
        
        -- Performance calculations
        ROUND((response_sla_minutes - response_time_minutes) / response_sla_minutes::DECIMAL * 100, 2) as response_performance_pct,
        ROUND((resolution_sla_hours - resolution_time_hours) / resolution_sla_hours::DECIMAL * 100, 2) as resolution_performance_pct
        
      FROM sla_metrics
      ORDER BY created_at DESC
    `,
    availableFilters: {
      dateRange: { type: 'dateRange', label: 'Service Period' },
      priority: { type: 'select', options: ['critical', 'high', 'medium', 'low'] },
      status: { type: 'multiSelect', options: ['open', 'in_progress', 'resolved', 'closed'] },
      technician: { type: 'userSelect', label: 'Technician' },
      slaStatus: { type: 'multiSelect', options: ['Response Met', 'Response Breached', 'Resolution Met', 'Resolution Breached'] }
    },
    chartConfig: {
      defaultChartType: 'gauge',
      primaryMetric: 'response_performance_pct',
      secondaryMetric: 'resolution_performance_pct'
    },
    isRealTime: true,
    cacheDuration: 60 // 1 minute cache for real-time SLA monitoring
  },

  {
    id: 'technician_productivity',
    name: 'Technician Productivity Analysis',
    code: 'technician_productivity',
    description: 'Comprehensive technician performance including utilization, efficiency, and customer satisfaction',
    category: 'service' as const,
    organizationalScope: 'team' as const,
    requiredPermissions: { canViewServiceReports: true, canViewTeamData: true },
    sqlQuery: `
      WITH tech_metrics AS (
        SELECT 
          u.id as technician_id,
          u.first_name || ' ' || u.last_name as technician_name,
          l.name as location_name,
          
          -- Ticket metrics
          COUNT(st.id) as total_tickets,
          COUNT(CASE WHEN st.status = 'resolved' THEN 1 END) as resolved_tickets,
          COUNT(CASE WHEN st.first_time_fix = true THEN 1 END) as first_time_fixes,
          
          -- Time metrics
          AVG(EXTRACT(HOURS FROM st.resolved_at - st.created_at)) as avg_resolution_time,
          SUM(EXTRACT(HOURS FROM st.work_ended_at - st.work_started_at)) as total_work_hours,
          SUM(EXTRACT(HOURS FROM st.travel_ended_at - st.travel_started_at)) as total_travel_hours,
          
          -- Customer satisfaction (would need ratings table)
          -- AVG(cr.rating) as avg_customer_rating,
          
          -- Parts usage efficiency
          -- AVG(pu.parts_cost) as avg_parts_cost_per_ticket
          
        FROM users u
        LEFT JOIN service_tickets st ON u.id = st.assigned_technician_id
        LEFT JOIN locations l ON u.primary_location_id = l.id
        WHERE u.tenant_id = :tenantId
          AND u.role_id IN (SELECT id FROM roles WHERE department = 'service')
          AND (:locationIds IS NULL OR l.id = ANY(:locationIds))
          AND (:fromDate IS NULL OR st.created_at >= :fromDate)
          AND (:toDate IS NULL OR st.created_at <= :toDate)
        GROUP BY u.id, u.first_name, u.last_name, l.name
      )
      SELECT 
        *,
        -- Productivity calculations
        CASE WHEN total_tickets > 0 
          THEN ROUND((resolved_tickets::DECIMAL / total_tickets) * 100, 2) 
          ELSE 0 
        END as resolution_rate,
        
        CASE WHEN resolved_tickets > 0 
          THEN ROUND((first_time_fixes::DECIMAL / resolved_tickets) * 100, 2) 
          ELSE 0 
        END as first_time_fix_rate,
        
        CASE WHEN (total_work_hours + total_travel_hours) > 0 
          THEN ROUND((total_work_hours / (total_work_hours + total_travel_hours)) * 100, 2) 
          ELSE 0 
        END as work_efficiency_pct,
        
        CASE WHEN total_work_hours > 0 
          THEN ROUND(resolved_tickets / total_work_hours, 2) 
          ELSE 0 
        END as tickets_per_hour,
        
        -- Performance tier
        CASE 
          WHEN resolution_rate >= 95 AND first_time_fix_rate >= 85 THEN 'Elite'
          WHEN resolution_rate >= 90 AND first_time_fix_rate >= 75 THEN 'Proficient'
          WHEN resolution_rate >= 80 AND first_time_fix_rate >= 65 THEN 'Developing'
          ELSE 'Needs Training'
        END as performance_tier
        
      FROM tech_metrics
      WHERE total_tickets > 0
      ORDER BY resolution_rate DESC, first_time_fix_rate DESC
    `,
    availableFilters: {
      dateRange: { type: 'dateRange', label: 'Performance Period' },
      performanceTier: { type: 'multiSelect', options: ['Elite', 'Proficient', 'Developing', 'Needs Training'] },
      location: { type: 'locationSelect', label: 'Location' }
    },
    chartConfig: {
      defaultChartType: 'radar',
      metrics: ['resolution_rate', 'first_time_fix_rate', 'work_efficiency_pct', 'tickets_per_hour']
    }
  }
];

// =====================================================================
// FINANCE DEPARTMENT REPORT DEFINITIONS
// =====================================================================

export const FINANCE_REPORTS = [
  {
    id: 'accounts_receivable_aging',
    name: 'Accounts Receivable Aging Analysis',
    code: 'ar_aging_analysis',
    description: 'Comprehensive AR aging with DSO calculations, collection effectiveness, and risk assessment',
    category: 'finance' as const,
    organizationalScope: 'company' as const,
    requiredPermissions: { canViewFinanceReports: true, canViewSensitiveFinancials: true },
    containsSensitiveData: true,
    sqlQuery: `
      WITH ar_aging AS (
        SELECT 
          i.id as invoice_id,
          i.invoice_number,
          i.customer_id,
          c.company_name as customer_name,
          c.billing_city,
          c.billing_state,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.paid_amount,
          (i.total_amount - COALESCE(i.paid_amount, 0)) as outstanding_balance,
          i.status as invoice_status,
          l.name as location_name,
          
          -- Aging calculations
          CURRENT_DATE - i.due_date as days_past_due,
          
          CASE 
            WHEN i.status = 'paid' THEN 'Paid'
            WHEN CURRENT_DATE <= i.due_date THEN 'Current'
            WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 30 THEN '1-30 Days'
            WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31-60 Days'
            WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN '61-90 Days'
            WHEN CURRENT_DATE - i.due_date BETWEEN 91 AND 120 THEN '91-120 Days'
            ELSE '120+ Days'
          END as aging_bucket,
          
          -- Risk scoring
          CASE 
            WHEN i.status = 'paid' THEN 0
            WHEN CURRENT_DATE - i.due_date <= 30 THEN 1
            WHEN CURRENT_DATE - i.due_date <= 60 THEN 2
            WHEN CURRENT_DATE - i.due_date <= 90 THEN 3
            WHEN CURRENT_DATE - i.due_date <= 120 THEN 4
            ELSE 5
          END as risk_score
          
        FROM invoices i
        LEFT JOIN companies c ON i.customer_id = c.id
        LEFT JOIN locations l ON c.location_id = l.id
        WHERE i.tenant_id = :tenantId
          AND i.status != 'void'
          AND (:locationIds IS NULL OR l.id = ANY(:locationIds))
          AND (:fromDate IS NULL OR i.invoice_date >= :fromDate)
          AND (:toDate IS NULL OR i.invoice_date <= :toDate)
      )
      SELECT 
        *,
        -- Collection priority
        CASE 
          WHEN risk_score >= 4 AND outstanding_balance >= 5000 THEN 'Critical'
          WHEN risk_score >= 3 AND outstanding_balance >= 1000 THEN 'High'
          WHEN risk_score >= 2 THEN 'Medium'
          ELSE 'Low'
        END as collection_priority,
        
        -- Days Sales Outstanding contribution
        outstanding_balance * days_past_due as dso_contribution
        
      FROM ar_aging
      WHERE outstanding_balance > 0
      ORDER BY collection_priority DESC, outstanding_balance DESC, days_past_due DESC
    `,
    availableFilters: {
      dateRange: { type: 'dateRange', label: 'Invoice Date Range' },
      agingBucket: { type: 'multiSelect', options: ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days'] },
      collectionPriority: { type: 'multiSelect', options: ['Critical', 'High', 'Medium', 'Low'] },
      amountRange: { type: 'numberRange', label: 'Outstanding Balance' },
      customer: { type: 'customerSelect', label: 'Customer' }
    },
    chartConfig: {
      defaultChartType: 'aging_chart',
      primaryAxis: 'aging_bucket',
      valueAxis: 'outstanding_balance',
      colorBy: 'collection_priority'
    }
  }
];

// =====================================================================
// KPI DEFINITIONS
// =====================================================================

export const SALES_KPIS = [
  {
    code: 'pipeline_value',
    name: 'Total Pipeline Value',
    description: 'Sum of all open opportunities weighted by stage probability',
    category: 'sales' as const,
    organizationalScope: 'location' as const,
    requiredPermissions: { canViewSalesReports: true },
    calculationSql: `
      SELECT SUM(
        CASE status
          WHEN 'qualified' THEN estimated_amount * 0.3
          WHEN 'proposal' THEN estimated_amount * 0.5
          WHEN 'negotiation' THEN estimated_amount * 0.7
          ELSE estimated_amount * 0.1
        END
      ) as value
      FROM business_records 
      WHERE tenant_id = :tenantId 
        AND record_type = 'lead' 
        AND status NOT IN ('closed_won', 'closed_lost')
        AND (:locationIds IS NULL OR location_id = ANY(:locationIds))
    `,
    displayFormat: 'currency' as const,
    targetType: 'absolute' as const,
    refreshFrequency: 1800 // 30 minutes
  },
  
  {
    code: 'monthly_revenue',
    name: 'Monthly Revenue',
    description: 'Total revenue from closed won deals in current month',
    category: 'sales' as const,
    organizationalScope: 'location' as const,
    requiredPermissions: { canViewSalesReports: true },
    calculationSql: `
      SELECT COALESCE(SUM(estimated_amount), 0) as value
      FROM business_records 
      WHERE tenant_id = :tenantId 
        AND record_type = 'lead' 
        AND status = 'closed_won'
        AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND (:locationIds IS NULL OR location_id = ANY(:locationIds))
    `,
    displayFormat: 'currency' as const,
    targetType: 'absolute' as const
  }
];

export const SERVICE_KPIS = [
  {
    code: 'sla_compliance_rate',
    name: 'SLA Compliance Rate',
    description: 'Percentage of tickets resolved within SLA timeframes',
    category: 'service' as const,
    organizationalScope: 'location' as const,
    requiredPermissions: { canViewServiceReports: true },
    calculationSql: `
      WITH sla_check AS (
        SELECT 
          CASE 
            WHEN priority = 'critical' AND EXTRACT(HOURS FROM resolved_at - created_at) <= 4 THEN 1
            WHEN priority = 'high' AND EXTRACT(HOURS FROM resolved_at - created_at) <= 24 THEN 1
            WHEN priority = 'medium' AND EXTRACT(HOURS FROM resolved_at - created_at) <= 72 THEN 1
            WHEN priority = 'low' AND EXTRACT(HOURS FROM resolved_at - created_at) <= 168 THEN 1
            ELSE 0
          END as sla_met
        FROM service_tickets 
        WHERE tenant_id = :tenantId 
          AND status = 'resolved'
          AND resolved_at IS NOT NULL
          AND DATE_TRUNC('month', resolved_at) = DATE_TRUNC('month', CURRENT_DATE)
          AND (:locationIds IS NULL OR location_id = ANY(:locationIds))
      )
      SELECT ROUND(AVG(sla_met) * 100, 2) as value FROM sla_check
    `,
    displayFormat: 'percentage' as const,
    targetValue: 95,
    targetType: 'percentage' as const,
    alertEnabled: true,
    alertThresholds: { critical: 90, warning: 93 }
  }
];

// =====================================================================
// SEED FUNCTION TO POPULATE REPORT DEFINITIONS
// =====================================================================

export async function seedReportDefinitions(tenantId: string): Promise<void> {
  try {
    console.log('🌱 Seeding report definitions for tenant:', tenantId);
    
    const allReports = [...SALES_REPORTS, ...SERVICE_REPORTS, ...FINANCE_REPORTS];
    const allKPIs = [...SALES_KPIS, ...SERVICE_KPIS];
    
    // Insert report definitions
    for (const report of allReports) {
      await db.insert(reportDefinitions).values({
        tenantId,
        ...report,
        createdBy: 'system'
      }).onConflictDoNothing();
    }
    
    // Insert KPI definitions
    for (const kpi of allKPIs) {
      await db.insert(kpiDefinitions).values({
        tenantId,
        ...kpi,
        createdBy: 'system'
      }).onConflictDoNothing();
    }
    
    console.log(`✅ Successfully seeded ${allReports.length} reports and ${allKPIs.length} KPIs`);
    
  } catch (error) {
    console.error('❌ Error seeding report definitions:', error);
    throw error;
  }
}
