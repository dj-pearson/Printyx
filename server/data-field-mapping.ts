/**
 * Data Field Mapping System
 * Handles mapping between frontend interfaces and database schema fields
 * Ensures consistency across the application and external system integrations
 */

// Business Records Field Mapping
export const BUSINESS_RECORDS_FIELD_MAP = {
  // Frontend -> Database mapping
  frontendToDb: {
    // Basic Information
    companyName: 'company_name',
    primaryContactName: 'primary_contact_name',
    primaryContactEmail: 'primary_contact_email',
    primaryContactPhone: 'primary_contact_phone',
    primaryContactTitle: 'primary_contact_title',
    
    // Contact Information
    billingContactName: 'billing_contact_name',
    billingContactEmail: 'billing_contact_email',
    billingContactPhone: 'billing_contact_phone',
    
    // Address Information
    addressLine1: 'address_line1',
    addressLine2: 'address_line2',
    postalCode: 'postal_code',
    billingAddressLine1: 'billing_address_1',
    billingAddressLine2: 'billing_address_2',
    billingCity: 'billing_city',
    billingState: 'billing_state',
    billingPostalCode: 'billing_zip_code',
    
    // Financial Information
    estimatedDealValue: 'estimated_amount',
    creditLimit: 'credit_limit',
    paymentTerms: 'payment_terms',
    billingTerms: 'billing_terms',
    taxExempt: 'tax_exempt',
    taxId: 'tax_id',
    
    // Lead/Sales Information
    leadSource: 'source',
    salesStage: 'sales_stage',
    interestLevel: 'interest_level',
    leadScore: 'lead_score',
    closeDate: 'close_date',
    
    // Customer Information
    customerNumber: 'customer_number',
    customerSince: 'customer_since',
    customerTier: 'customer_tier',
    currentBalance: 'current_balance',
    
    // Service Information
    preferredTechnician: 'preferred_technician',
    lastServiceDate: 'last_service_date',
    nextScheduledService: 'next_scheduled_service',
    
    // Tracking Information
    lastContactDate: 'last_contact_date',
    nextFollowUpDate: 'next_follow_up_date',
    
    // Record Management
    recordType: 'record_type',
    status: 'status',
    priority: 'priority',
    ownerId: 'owner_id',
    assignedSalesRep: 'assigned_sales_rep',
    territory: 'territory',
    
    // External System Fields
    externalCustomerId: 'external_customer_id',
    externalSystemId: 'external_system_id',
    migrationStatus: 'migration_status',
    lastSyncDate: 'last_sync_date',
    externalData: 'external_data',
    
    // Timestamps
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    createdBy: 'created_by',
    convertedBy: 'converted_by'
  },
  
  // Database -> Frontend mapping (reverse)
  dbToFrontend: {} as Record<string, string>
};

// Auto-generate reverse mapping
Object.entries(BUSINESS_RECORDS_FIELD_MAP.frontendToDb).forEach(([frontend, db]) => {
  BUSINESS_RECORDS_FIELD_MAP.dbToFrontend[db] = frontend;
});

// Equipment Field Mapping
export const EQUIPMENT_FIELD_MAP = {
  frontendToDb: {
    serialNumber: 'serial_number',
    modelNumber: 'model_number',
    manufacturer: 'manufacturer',
    equipmentType: 'equipment_type',
    installDate: 'install_date',
    warrantyExpiration: 'warranty_expiration',
    purchaseDate: 'purchase_date',
    purchasePrice: 'purchase_price',
    currentValue: 'current_value',
    leaseEndDate: 'lease_end_date',
    customerId: 'customer_id',
    locationId: 'location_id',
    serviceContract: 'service_contract',
    nextServiceDate: 'next_service_date',
    lastServiceDate: 'last_service_date',
    meterType: 'meter_type',
    currentMeterReading: 'current_meter_reading',
    previousMeterReading: 'previous_meter_reading',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  dbToFrontend: {} as Record<string, string>
};

// Auto-generate reverse mapping for equipment
Object.entries(EQUIPMENT_FIELD_MAP.frontendToDb).forEach(([frontend, db]) => {
  EQUIPMENT_FIELD_MAP.dbToFrontend[db] = frontend;
});

// Service Ticket Field Mapping
export const SERVICE_TICKET_FIELD_MAP = {
  frontendToDb: {
    ticketNumber: 'ticket_number',
    customerId: 'customer_id',
    equipmentId: 'equipment_id',
    technicianId: 'technician_id',
    issueDescription: 'issue_description',
    serviceType: 'service_type',
    priority: 'priority',
    status: 'status',
    scheduledDate: 'scheduled_date',
    completedDate: 'completed_date',
    laborHours: 'labor_hours',
    laborCost: 'labor_cost',
    partsCost: 'parts_cost',
    totalCost: 'total_cost',
    customerSatisfaction: 'customer_satisfaction',
    resolutionNotes: 'resolution_notes',
    followUpRequired: 'follow_up_required',
    followUpDate: 'follow_up_date',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  dbToFrontend: {} as Record<string, string>
};

// Auto-generate reverse mapping for service tickets
Object.entries(SERVICE_TICKET_FIELD_MAP.frontendToDb).forEach(([frontend, db]) => {
  SERVICE_TICKET_FIELD_MAP.dbToFrontend[db] = frontend;
});

/**
 * Transform object keys from frontend format to database format
 */
export function transformFrontendToDb<T extends Record<string, any>>(
  data: T,
  fieldMap: typeof BUSINESS_RECORDS_FIELD_MAP.frontendToDb
): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const dbKey = fieldMap[key] || key;
    transformed[dbKey] = value;
  });
  
  return transformed;
}

/**
 * Transform object keys from database format to frontend format
 */
export function transformDbToFrontend<T extends Record<string, any>>(
  data: T,
  fieldMap: typeof BUSINESS_RECORDS_FIELD_MAP.dbToFrontend
): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const frontendKey = fieldMap[key] || key;
    transformed[frontendKey] = value;
  });
  
  return transformed;
}

/**
 * Business Records specific transformers
 */
export const BusinessRecordsTransformer = {
  toDb: (data: Record<string, any>) => 
    transformFrontendToDb(data, BUSINESS_RECORDS_FIELD_MAP.frontendToDb),
  
  toFrontend: (data: Record<string, any>) => 
    transformDbToFrontend(data, BUSINESS_RECORDS_FIELD_MAP.dbToFrontend),
  
  // Handle record type conversion from frontend format
  normalizeRecordType: (recordType: string): 'lead' | 'customer' => {
    const normalized = recordType.toLowerCase();
    return normalized === 'customer' ? 'customer' : 'lead';
  },
  
  // Handle status conversion with proper lead-to-customer lifecycle
  normalizeStatus: (status: string, recordType: 'lead' | 'customer'): string => {
    const statusMap = {
      lead: {
        'new': 'new',
        'contacted': 'contacted', 
        'qualified': 'qualified',
        'proposal': 'proposal_sent',
        'proposal_sent': 'proposal_sent',
        'negotiating': 'negotiating',
        'closed_won': 'active', // Convert to customer
        'closed_lost': 'lost'
      },
      customer: {
        'active': 'active',
        'inactive': 'inactive',
        'churned': 'churned',
        'expired': 'expired',
        'competitor_switch': 'competitor_switch',
        'non_payment': 'non_payment'
      }
    };
    
    return statusMap[recordType][status.toLowerCase()] || status;
  }
};

/**
 * Equipment specific transformers
 */
export const EquipmentTransformer = {
  toDb: (data: Record<string, any>) => 
    transformFrontendToDb(data, EQUIPMENT_FIELD_MAP.frontendToDb),
  
  toFrontend: (data: Record<string, any>) => 
    transformDbToFrontend(data, EQUIPMENT_FIELD_MAP.dbToFrontend)
};

/**
 * Service Ticket specific transformers
 */
export const ServiceTicketTransformer = {
  toDb: (data: Record<string, any>) => 
    transformFrontendToDb(data, SERVICE_TICKET_FIELD_MAP.frontendToDb),
  
  toFrontend: (data: Record<string, any>) => 
    transformDbToFrontend(data, SERVICE_TICKET_FIELD_MAP.dbToFrontend)
};

/**
 * External System Integration Helpers
 */
export const ExternalSystemHelpers = {
  // Prepare data for E-Automate sync
  prepareForEAutomate: (businessRecord: Record<string, any>) => {
    return {
      // E-Automate required fields
      CompanyName: businessRecord.company_name,
      ContactName: businessRecord.primary_contact_name,
      Address1: businessRecord.address_line1,
      Address2: businessRecord.address_line2,
      City: businessRecord.city,
      State: businessRecord.state,
      ZipCode: businessRecord.postal_code,
      Phone: businessRecord.phone,
      Email: businessRecord.primary_contact_email,
      BillingContact: businessRecord.billing_contact_name,
      BillingAddress1: businessRecord.billing_address_1,
      BillingCity: businessRecord.billing_city,
      BillingState: businessRecord.billing_state,
      BillingZip: businessRecord.billing_zip_code,
      SalesRep: businessRecord.assigned_sales_rep,
      Territory: businessRecord.territory,
      CreditLimit: businessRecord.credit_limit,
      PaymentTerms: businessRecord.payment_terms,
      TaxExempt: businessRecord.tax_exempt,
      TaxID: businessRecord.tax_id,
      CustomerNumber: businessRecord.customer_number,
      // Add external system tracking
      ExternalCustomerId: businessRecord.external_customer_id,
      LastSyncDate: new Date().toISOString()
    };
  },
  
  // Prepare data for Salesforce sync
  prepareForSalesforce: (businessRecord: Record<string, any>) => {
    return {
      // Salesforce Account fields
      Name: businessRecord.company_name,
      Type: businessRecord.record_type === 'customer' ? 'Customer' : 'Prospect',
      Industry: businessRecord.industry,
      AnnualRevenue: businessRecord.annual_revenue,
      NumberOfEmployees: businessRecord.employee_count,
      Rating: businessRecord.customer_rating,
      Phone: businessRecord.phone,
      Fax: businessRecord.fax,
      Website: businessRecord.website,
      BillingStreet: businessRecord.billing_address_1,
      BillingCity: businessRecord.billing_city,
      BillingState: businessRecord.billing_state,
      BillingPostalCode: businessRecord.billing_zip_code,
      BillingCountry: businessRecord.billing_country,
      ShippingStreet: businessRecord.shipping_address_1,
      ShippingCity: businessRecord.shipping_city,
      ShippingState: businessRecord.shipping_state,
      ShippingPostalCode: businessRecord.shipping_zip_code,
      ShippingCountry: businessRecord.shipping_country,
      Description: businessRecord.account_notes,
      // Custom fields
      CustomerPriority__c: businessRecord.customer_priority,
      SLA__c: businessRecord.sla_level,
      Active__c: businessRecord.is_active,
      UpsellOpportunity__c: businessRecord.upsell_opportunity,
      // External system tracking
      ExternalId__c: businessRecord.external_customer_id,
      LastSyncDate__c: new Date().toISOString()
    };
  }
};