/**
 * Comprehensive Data Consistency Fix
 * Addresses all identified issues:
 * 1. Hardcoded tenant IDs throughout backend
 * 2. Mock/sample data fallbacks in API routes
 * 3. Field name inconsistencies (frontend vs database)
 * 4. Business Records schema alignment
 * 5. Missing external system integration utilization
 */

import { TenantRequest } from './middleware/tenancy';
import { BusinessRecordsTransformer } from './data-field-mapping';

// Routes that need hardcoded tenant ID replacement
export const ROUTES_TO_FIX = [
  'routes-business-records.ts',
  'routes-demo-scheduling.ts', 
  'routes-sales-forecasting.ts',
  'routes-esignature.ts',
  'routes-preventive-maintenance.ts',
  'routes-service-dispatch.ts',
  'routes-customer-success.ts',
  'routes-remote-monitoring.ts',
  'routes-document-management.ts',
  'routes-mobile.ts',
  'routes-analytics.ts',
  'routes-business-process-optimization.ts',
  'routes-workflow-automation.ts',
  'routes-incident-response.ts',
  'routes-security-compliance.ts'
];

// Mock data patterns to replace with real database queries
export const MOCK_DATA_PATTERNS = {
  'sampleDemos': 'demoSchedules',
  'sampleForecasts': 'salesForecasts', 
  'sampleRequests': 'esignatureRequests',
  'sampleTemplates': 'esignatureTemplates',
  'sampleTickets': 'serviceTickets',
  'sampleAlerts': 'maintenanceAlerts',
  'sampleCustomers': 'businessRecords',
  'sampleMetrics': 'performanceMetrics',
  'sampleDevices': 'iotDevices',
  'sampleDocuments': 'documentRecords',
  'sampleWorkflows': 'workflowExecutions',
  'sampleIncidents': 'incidentRecords'
};

// Frontend-Database field mappings for all major entities
export const ENTITY_FIELD_MAPPINGS = {
  businessRecords: {
    companyName: 'company_name',
    primaryContactName: 'primary_contact_name',
    primaryContactEmail: 'primary_contact_email',
    recordType: 'record_type',
    customerNumber: 'customer_number',
    salesStage: 'sales_stage',
    leadSource: 'source',
    estimatedDealValue: 'estimated_amount',
    closeDate: 'close_date',
    lastContactDate: 'last_contact_date',
    nextFollowUpDate: 'next_follow_up_date',
    assignedSalesRep: 'assigned_sales_rep',
    externalCustomerId: 'external_customer_id',
    externalSystemId: 'external_system_id',
    migrationStatus: 'migration_status',
    lastSyncDate: 'last_sync_date'
  },
  equipment: {
    serialNumber: 'serial_number',
    modelNumber: 'model_number',
    installDate: 'install_date',
    warrantyExpiration: 'warranty_expiration',
    serviceContract: 'service_contract',
    nextServiceDate: 'next_service_date',
    lastServiceDate: 'last_service_date',
    currentMeterReading: 'current_meter_reading',
    customerId: 'customer_id',
    locationId: 'location_id'
  },
  serviceTickets: {
    ticketNumber: 'ticket_number',
    customerId: 'customer_id',
    equipmentId: 'equipment_id',
    technicianId: 'technician_id',
    issueDescription: 'issue_description',
    serviceType: 'service_type',
    scheduledDate: 'scheduled_date',
    completedDate: 'completed_date',
    laborHours: 'labor_hours',
    laborCost: 'labor_cost',
    partsCost: 'parts_cost',
    totalCost: 'total_cost',
    customerSatisfaction: 'customer_satisfaction',
    resolutionNotes: 'resolution_notes',
    followUpRequired: 'follow_up_required'
  }
};

// Standard route transformation template
export function createTenantAwareRoute(routeFunction: string, entityName: string) {
  return `
// Replace hardcoded tenant ID with session-based resolution
app.get("${routeFunction}", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    
    // Query actual database instead of returning mock data
    const records = await db.select().from(${entityName})
      .where(eq(${entityName}.tenantId, tenantId))
      .orderBy(desc(${entityName}.createdAt));

    // Transform database fields to frontend format if needed
    const transformedRecords = records.map(record => 
      transformDbToFrontend(record, ENTITY_FIELD_MAPPINGS.${entityName.replace(/s$/, '')})
    );
    
    res.json(transformedRecords);
  } catch (error) {
    console.error('Error fetching ${entityName}:', error);
    res.status(500).json({ message: 'Failed to fetch ${entityName}' });
  }
});`;
}

// Business Records unified lifecycle management
export const BUSINESS_RECORD_STATUSES = {
  lead: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'lost'],
  customer: ['active', 'inactive', 'churned', 'expired', 'competitor_switch', 'non_payment']
};

export function getValidStatusTransitions(currentStatus: string, recordType: 'lead' | 'customer') {
  const transitions: Record<string, string[]> = {
    // Lead statuses
    'new': ['contacted', 'lost'],
    'contacted': ['qualified', 'lost'],
    'qualified': ['proposal_sent', 'lost'],
    'proposal_sent': ['negotiating', 'active', 'lost'], // active = converted to customer
    'negotiating': ['active', 'lost'], // active = converted to customer
    
    // Customer statuses
    'active': ['inactive', 'churned', 'expired'],
    'inactive': ['active', 'churned'],
    'churned': ['active'], // Can be reactivated
    'expired': ['active'], // Contract can be renewed
    'competitor_switch': [], // Terminal state
    'non_payment': ['active', 'churned'] // Can resolve payment issues
  };
  
  return transitions[currentStatus] || [];
}

// External system data synchronization helpers
export const EXTERNAL_SYSTEM_SYNC = {
  prepareEAutomateData: (businessRecord: any) => ({
    CompanyName: businessRecord.company_name,
    ContactName: businessRecord.primary_contact_name,
    Address1: businessRecord.address_line1,
    City: businessRecord.city,
    State: businessRecord.state,
    ZipCode: businessRecord.postal_code,
    Phone: businessRecord.phone,
    Email: businessRecord.primary_contact_email,
    SalesRep: businessRecord.assigned_sales_rep,
    Territory: businessRecord.territory,
    CustomerNumber: businessRecord.customer_number,
    ExternalId: businessRecord.external_customer_id,
    LastSync: new Date().toISOString()
  }),
  
  prepareSalesforceData: (businessRecord: any) => ({
    Name: businessRecord.company_name,
    Type: businessRecord.record_type === 'customer' ? 'Customer' : 'Prospect',
    Phone: businessRecord.phone,
    BillingStreet: businessRecord.billing_address_1,
    BillingCity: businessRecord.billing_city,
    BillingState: businessRecord.billing_state,
    BillingPostalCode: businessRecord.billing_zip_code,
    Industry: businessRecord.industry,
    AnnualRevenue: businessRecord.annual_revenue,
    NumberOfEmployees: businessRecord.employee_count,
    Rating: businessRecord.customer_rating,
    ExternalId__c: businessRecord.external_customer_id,
    LastSyncDate__c: new Date().toISOString()
  }),
  
  handleIncomingEAutomateData: (eAutomateRecord: any) => ({
    company_name: eAutomateRecord.CompanyName,
    primary_contact_name: eAutomateRecord.ContactName,
    address_line1: eAutomateRecord.Address1,
    city: eAutomateRecord.City,
    state: eAutomateRecord.State,
    postal_code: eAutomateRecord.ZipCode,
    phone: eAutomateRecord.Phone,
    primary_contact_email: eAutomateRecord.Email,
    assigned_sales_rep: eAutomateRecord.SalesRep,
    territory: eAutomateRecord.Territory,
    customer_number: eAutomateRecord.CustomerNumber,
    external_customer_id: eAutomateRecord.ExternalId,
    external_system_id: 'eautomate',
    migration_status: 'synced',
    last_sync_date: new Date()
  })
};

// Database query optimization helpers
export const OPTIMIZED_QUERIES = {
  getBusinessRecordsWithMetrics: (tenantId: string) => `
    SELECT 
      br.*,
      COUNT(st.id) as service_ticket_count,
      COUNT(e.id) as equipment_count,
      SUM(i.total_amount) as total_invoice_amount,
      MAX(st.completed_date) as last_service_date
    FROM business_records br
    LEFT JOIN service_tickets st ON br.id = st.customer_id
    LEFT JOIN equipment e ON br.id = e.customer_id  
    LEFT JOIN invoices i ON br.id = i.customer_id
    WHERE br.tenant_id = $1
    GROUP BY br.id
    ORDER BY br.created_at DESC
  `,
  
  getLeadConversionPipeline: (tenantId: string) => `
    SELECT 
      sales_stage,
      COUNT(*) as count,
      SUM(estimated_amount) as total_value,
      AVG(probability) as avg_probability
    FROM business_records 
    WHERE tenant_id = $1 AND record_type = 'lead'
    GROUP BY sales_stage
    ORDER BY 
      CASE sales_stage
        WHEN 'new' THEN 1
        WHEN 'contacted' THEN 2
        WHEN 'qualified' THEN 3
        WHEN 'proposal_sent' THEN 4
        WHEN 'negotiating' THEN 5
        ELSE 6
      END
  `,
  
  getCustomerHealthMetrics: (tenantId: string) => `
    SELECT 
      br.id,
      br.company_name,
      br.customer_since,
      COUNT(st.id) as service_calls_last_30_days,
      AVG(st.customer_satisfaction) as avg_satisfaction,
      SUM(CASE WHEN st.status = 'open' THEN 1 ELSE 0 END) as open_tickets,
      br.current_balance,
      br.last_payment_date
    FROM business_records br
    LEFT JOIN service_tickets st ON br.id = st.customer_id 
      AND st.created_at >= NOW() - INTERVAL '30 days'
    WHERE br.tenant_id = $1 AND br.record_type = 'customer'
    GROUP BY br.id, br.company_name, br.customer_since, br.current_balance, br.last_payment_date
    ORDER BY br.company_name
  `
};

// Validation helpers for data consistency
export const DATA_VALIDATION = {
  validateBusinessRecord: (record: any) => {
    const errors: string[] = [];
    
    if (!record.company_name) errors.push('Company name is required');
    if (!record.record_type || !['lead', 'customer'].includes(record.record_type)) {
      errors.push('Valid record type (lead/customer) is required');
    }
    if (record.record_type === 'customer' && !record.customer_number) {
      errors.push('Customer number is required for customer records');
    }
    if (record.primary_contact_email && !isValidEmail(record.primary_contact_email)) {
      errors.push('Valid primary contact email is required');
    }
    
    return errors;
  },
  
  validateStatusTransition: (fromStatus: string, toStatus: string, recordType: 'lead' | 'customer') => {
    const validTransitions = getValidStatusTransitions(fromStatus, recordType);
    return validTransitions.includes(toStatus);
  },
  
  validateLeadToCustomerConversion: (record: any) => {
    const errors: string[] = [];
    
    if (record.record_type !== 'customer') {
      errors.push('Record type must be customer for conversion');
    }
    if (!record.customer_number) {
      errors.push('Customer number must be generated for conversion');
    }
    if (!record.customer_since) {
      errors.push('Customer since date must be set for conversion');
    }
    if (!record.converted_by) {
      errors.push('Converted by user must be tracked');
    }
    
    return errors;
  }
};

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export for use in route files
export { BusinessRecordsTransformer, TenantRequest };