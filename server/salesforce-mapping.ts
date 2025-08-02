// Salesforce to Printyx Database Field Mapping Configuration
// Supports dual-platform data migration: E-Automate (90% dealers) + Salesforce

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  targetTable: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'decimal' | 'json';
  required?: boolean;
  defaultValue?: any;
  transform?: (value: any) => any;
}

export interface TableMapping {
  salesforceObject: string;
  printixTable: string;
  primaryKey: string;
  fields: FieldMapping[];
}

// Comprehensive Salesforce to Printyx field mappings
export const SALESFORCE_FIELD_MAPPINGS: TableMapping[] = [
  // Account (Company) Object → business_records table
  {
    salesforceObject: 'Account',
    printixTable: 'business_records',
    primaryKey: 'Id',
    fields: [
      { sourceField: 'Id', targetField: 'externalSalesforceId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Name', targetField: 'companyName', targetTable: 'business_records', dataType: 'string', required: true },
      { sourceField: 'AccountNumber', targetField: 'accountNumber', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Type', targetField: 'accountType', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Industry', targetField: 'industry', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'NumberOfEmployees', targetField: 'employeeCount', targetTable: 'business_records', dataType: 'number' },
      { sourceField: 'AnnualRevenue', targetField: 'annualRevenue', targetTable: 'business_records', dataType: 'decimal' },
      { sourceField: 'Rating', targetField: 'customerRating', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'BillingStreet', targetField: 'billingAddressLine1', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'BillingCity', targetField: 'billingCity', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'BillingState', targetField: 'billingState', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'BillingPostalCode', targetField: 'billingPostalCode', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'BillingCountry', targetField: 'billingCountry', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ShippingStreet', targetField: 'shippingAddressLine1', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ShippingCity', targetField: 'shippingCity', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ShippingState', targetField: 'shippingState', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ShippingPostalCode', targetField: 'shippingPostalCode', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ShippingCountry', targetField: 'shippingCountry', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Phone', targetField: 'phone', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Fax', targetField: 'fax', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Website', targetField: 'website', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'OwnerId', targetField: 'ownerId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ParentId', targetField: 'parentAccountId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'CustomerPriority__c', targetField: 'customerPriority', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'SLA__c', targetField: 'slaLevel', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Active__c', targetField: 'isActive', targetTable: 'business_records', dataType: 'boolean' },
      { sourceField: 'UpsellOpportunity__c', targetField: 'upsellOpportunity', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Description', targetField: 'accountNotes', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Territory__c', targetField: 'territory', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'PaymentTerms__c', targetField: 'paymentTerms', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'CreditLimit__c', targetField: 'creditLimit', targetTable: 'business_records', dataType: 'decimal' },
      { sourceField: 'TaxExempt__c', targetField: 'taxExempt', targetTable: 'business_records', dataType: 'boolean' },
      { sourceField: 'TaxID__c', targetField: 'taxId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'PreferredContactMethod__c', targetField: 'preferredContactMethod', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', targetTable: 'business_records', dataType: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', targetTable: 'business_records', dataType: 'date' },
      { sourceField: 'LastActivityDate', targetField: 'lastActivityDate', targetTable: 'business_records', dataType: 'date' }
    ]
  },

  // Contact Object → enhanced_contacts table
  {
    salesforceObject: 'Contact',
    printixTable: 'enhanced_contacts',
    primaryKey: 'Id',
    fields: [
      { sourceField: 'Id', targetField: 'externalContactId', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'AccountId', targetField: 'externalAccountId', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'FirstName', targetField: 'firstName', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'LastName', targetField: 'lastName', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Name', targetField: 'fullName', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Title', targetField: 'title', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Department', targetField: 'department', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Email', targetField: 'email', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Phone', targetField: 'workPhone', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MobilePhone', targetField: 'mobilePhone', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'HomePhone', targetField: 'homePhone', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'OtherPhone', targetField: 'otherPhone', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Fax', targetField: 'fax', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MailingStreet', targetField: 'mailingAddressLine1', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MailingCity', targetField: 'mailingCity', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MailingState', targetField: 'mailingState', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MailingPostalCode', targetField: 'mailingPostalCode', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'MailingCountry', targetField: 'mailingCountry', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'OwnerId', targetField: 'ownerId', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'ReportsToId', targetField: 'reportsToContactId', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Level__c', targetField: 'contactLevel', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Languages__c', targetField: 'languages', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'LeadSource', targetField: 'leadSource', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'HasOptedOutOfEmail', targetField: 'hasOptedOutOfEmail', targetTable: 'enhanced_contacts', dataType: 'boolean' },
      { sourceField: 'DoNotCall', targetField: 'doNotCall', targetTable: 'enhanced_contacts', dataType: 'boolean' },
      { sourceField: 'Birthdate', targetField: 'birthdate', targetTable: 'enhanced_contacts', dataType: 'date' },
      { sourceField: 'AssistantName', targetField: 'assistantName', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'AssistantPhone', targetField: 'assistantPhone', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Description', targetField: 'description', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'IsPersonAccount', targetField: 'isPersonAccount', targetTable: 'enhanced_contacts', dataType: 'boolean' },
      { sourceField: 'Salutation', targetField: 'salutation', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'Suffix', targetField: 'suffix', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'PreferredContactMethod__c', targetField: 'preferredContactMethod', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'ContactRole__c', targetField: 'contactRole', targetTable: 'enhanced_contacts', dataType: 'string' },
      { sourceField: 'DecisionMaker__c', targetField: 'isDecisionMaker', targetTable: 'enhanced_contacts', dataType: 'boolean' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', targetTable: 'enhanced_contacts', dataType: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', targetTable: 'enhanced_contacts', dataType: 'date' },
      { sourceField: 'LastActivityDate', targetField: 'lastActivityDate', targetTable: 'enhanced_contacts', dataType: 'date' }
    ]
  },

  // Lead Object → business_records table (with recordType = 'lead')
  {
    salesforceObject: 'Lead',
    printixTable: 'business_records',
    primaryKey: 'Id',
    fields: [
      { sourceField: 'Id', targetField: 'externalLeadId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'FirstName', targetField: 'primaryContactName', targetTable: 'business_records', dataType: 'string', 
        transform: (value, record) => `${value || ''} ${record.LastName || ''}`.trim() },
      { sourceField: 'Company', targetField: 'companyName', targetTable: 'business_records', dataType: 'string', required: true },
      { sourceField: 'Title', targetField: 'primaryContactTitle', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Email', targetField: 'primaryContactEmail', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Phone', targetField: 'primaryContactPhone', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'MobilePhone', targetField: 'phone', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Website', targetField: 'website', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Street', targetField: 'addressLine1', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'City', targetField: 'city', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'State', targetField: 'state', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'PostalCode', targetField: 'postalCode', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Country', targetField: 'country', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Status', targetField: 'status', targetTable: 'business_records', dataType: 'string',
        transform: (value) => {
          const statusMap = {
            'Open': 'new',
            'Contacted': 'contacted', 
            'Qualified': 'qualified',
            'Unqualified': 'unqualified',
            'Converted': 'converted'
          };
          return statusMap[value] || 'new';
        }
      },
      { sourceField: 'Rating', targetField: 'customerRating', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'LeadSource', targetField: 'leadSource', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Industry', targetField: 'industry', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'AnnualRevenue', targetField: 'annualRevenue', targetTable: 'business_records', dataType: 'decimal' },
      { sourceField: 'NumberOfEmployees', targetField: 'employeeCount', targetTable: 'business_records', dataType: 'number' },
      { sourceField: 'OwnerId', targetField: 'ownerId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'ConvertedDate', targetField: 'closeDate', targetTable: 'business_records', dataType: 'date' },
      { sourceField: 'ConvertedAccountId', targetField: 'externalSalesforceId', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'IsConverted', targetField: 'recordType', targetTable: 'business_records', dataType: 'string',
        transform: (value) => value ? 'customer' : 'lead'
      },
      { sourceField: 'HasOptedOutOfEmail', targetField: 'preferredContactMethod', targetTable: 'business_records', dataType: 'string',
        transform: (value) => value ? 'phone' : 'email'
      },
      { sourceField: 'Description', targetField: 'notes', targetTable: 'business_records', dataType: 'string' },
      { sourceField: 'Budget__c', targetField: 'estimatedAmount', targetTable: 'business_records', dataType: 'decimal' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', targetTable: 'business_records', dataType: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', targetTable: 'business_records', dataType: 'date' },
      { sourceField: 'LastActivityDate', targetField: 'lastActivityDate', targetTable: 'business_records', dataType: 'date' }
    ]
  },

  // Opportunity Object → opportunities table
  {
    salesforceObject: 'Opportunity',
    printixTable: 'opportunities',
    primaryKey: 'Id',
    fields: [
      { sourceField: 'Id', targetField: 'externalOpportunityId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'AccountId', targetField: 'externalAccountId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'Name', targetField: 'opportunityName', targetTable: 'opportunities', dataType: 'string', required: true },
      { sourceField: 'StageName', targetField: 'stageName', targetTable: 'opportunities', dataType: 'string', required: true },
      { sourceField: 'Amount', targetField: 'amount', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'Probability', targetField: 'probability', targetTable: 'opportunities', dataType: 'number' },
      { sourceField: 'CloseDate', targetField: 'closeDate', targetTable: 'opportunities', dataType: 'date' },
      { sourceField: 'Type', targetField: 'opportunityType', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'LeadSource', targetField: 'leadSource', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'OwnerId', targetField: 'ownerId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'CampaignId', targetField: 'campaignId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'IsWon', targetField: 'isWon', targetTable: 'opportunities', dataType: 'boolean' },
      { sourceField: 'IsClosed', targetField: 'isClosed', targetTable: 'opportunities', dataType: 'boolean' },
      { sourceField: 'IsPrivate', targetField: 'isPrivate', targetTable: 'opportunities', dataType: 'boolean' },
      { sourceField: 'Description', targetField: 'description', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'NextStep', targetField: 'nextStep', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'ForecastCategoryName', targetField: 'forecastCategory', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'HasOpportunityLineItem', targetField: 'hasLineItems', targetTable: 'opportunities', dataType: 'boolean' },
      { sourceField: 'Pricebook2Id', targetField: 'priceBookId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'TotalOpportunityQuantity', targetField: 'totalQuantity', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'ExpectedRevenue', targetField: 'expectedRevenue', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'MainCompetitors__c', targetField: 'mainCompetitors', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'DeliveryInstallationStatus__c', targetField: 'deliveryStatus', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'TrackingNumber__c', targetField: 'trackingNumber', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'OrderNumber__c', targetField: 'orderNumber', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'CurrentSituation__c', targetField: 'currentSituation', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'ProductType__c', targetField: 'productType', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'Financing__c', targetField: 'financingType', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'MonthlyPayment__c', targetField: 'monthlyPayment', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'LeaseTerm__c', targetField: 'leaseTermMonths', targetTable: 'opportunities', dataType: 'number' },
      { sourceField: 'CommissionRate__c', targetField: 'commissionRate', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'GrossMargin__c', targetField: 'grossMarginPercent', targetTable: 'opportunities', dataType: 'decimal' },
      { sourceField: 'Territory__c', targetField: 'territory', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'PartnerAccount__c', targetField: 'partnerAccountId', targetTable: 'opportunities', dataType: 'string' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', targetTable: 'opportunities', dataType: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', targetTable: 'opportunities', dataType: 'date' },
      { sourceField: 'LastActivityDate', targetField: 'lastActivityDate', targetTable: 'opportunities', dataType: 'date' }
    ]
  },

  // Product2 Object → enhanced_products table
  {
    salesforceObject: 'Product2',
    printixTable: 'enhanced_products',
    primaryKey: 'Id',
    fields: [
      { sourceField: 'Id', targetField: 'externalProductId', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Name', targetField: 'productName', targetTable: 'enhanced_products', dataType: 'string', required: true },
      { sourceField: 'ProductCode', targetField: 'productCode', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Description', targetField: 'description', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Family', targetField: 'productFamily', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'IsActive', targetField: 'isActive', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'CanUseQuantitySchedule', targetField: 'canUseQuantitySchedule', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'CanUseRevenueSchedule', targetField: 'canUseRevenueSchedule', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'QuantityUnitOfMeasure', targetField: 'quantityUnitOfMeasure', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'StockKeepingUnit', targetField: 'sku', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'DisplayUrl', targetField: 'displayUrl', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'ExternalDataSourceId', targetField: 'externalDataSourceId', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'ExternalId', targetField: 'externalId', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Manufacturer__c', targetField: 'manufacturer', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'ModelNumber__c', targetField: 'modelNumber', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Category__c', targetField: 'category', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Subcategory__c', targetField: 'subcategory', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Type__c', targetField: 'productType', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'Specifications__c', targetField: 'specifications', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'WarrantyPeriod__c', targetField: 'warrantyPeriodMonths', targetTable: 'enhanced_products', dataType: 'number' },
      { sourceField: 'Weight__c', targetField: 'weight', targetTable: 'enhanced_products', dataType: 'decimal' },
      { sourceField: 'Dimensions__c', targetField: 'dimensions', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'PowerRequirements__c', targetField: 'powerRequirements', targetTable: 'enhanced_products', dataType: 'string' },
      { sourceField: 'MonthlyDutyCycle__c', targetField: 'monthlyDutyCycle', targetTable: 'enhanced_products', dataType: 'number' },
      { sourceField: 'PrintSpeed__c', targetField: 'printSpeedPpm', targetTable: 'enhanced_products', dataType: 'number' },
      { sourceField: 'ColorCapable__c', targetField: 'isColorCapable', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'DuplexCapable__c', targetField: 'isDuplexCapable', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'NetworkCapable__c', targetField: 'isNetworkCapable', targetTable: 'enhanced_products', dataType: 'boolean' },
      { sourceField: 'Cost__c', targetField: 'productCost', targetTable: 'enhanced_products', dataType: 'decimal' },
      { sourceField: 'MSRP__c', targetField: 'msrp', targetTable: 'enhanced_products', dataType: 'decimal' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', targetTable: 'enhanced_products', dataType: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', targetTable: 'enhanced_products', dataType: 'date' }
    ]
  }
];

// Data transformation utilities
export class SalesforceDataTransformer {
  
  /**
   * Transform Salesforce record to Printyx database format
   */
  static transformRecord(salesforceRecord: any, mapping: TableMapping, tenantId: string): any {
    const result: any = {
      tenantId,
      externalSystemId: 'salesforce',
      migrationStatus: 'completed',
      lastSyncDate: new Date().toISOString()
    };

    // Set record type for leads/accounts
    if (mapping.salesforceObject === 'Lead') {
      result.recordType = 'lead';
    } else if (mapping.salesforceObject === 'Account') {
      result.recordType = 'customer';
    }

    // Apply field mappings
    for (const fieldMapping of mapping.fields) {
      const sourceValue = salesforceRecord[fieldMapping.sourceField];
      
      if (sourceValue !== undefined && sourceValue !== null) {
        let transformedValue = sourceValue;
        
        // Apply custom transformation if provided
        if (fieldMapping.transform) {
          transformedValue = fieldMapping.transform(sourceValue, salesforceRecord);
        }
        
        // Type conversion
        transformedValue = this.convertDataType(transformedValue, fieldMapping.dataType);
        
        result[fieldMapping.targetField] = transformedValue;
      } else if (fieldMapping.defaultValue !== undefined) {
        result[fieldMapping.targetField] = fieldMapping.defaultValue;
      }
    }

    return result;
  }

  /**
   * Convert data types for database compatibility
   */
  static convertDataType(value: any, dataType: string): any {
    if (value === null || value === undefined) return value;
    
    switch (dataType) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'decimal':
        return parseFloat(value);
      case 'date':
        return new Date(value);
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      default:
        return value;
    }
  }

  /**
   * Get mapping configuration for Salesforce object
   */
  static getMappingForObject(salesforceObject: string): TableMapping | undefined {
    return SALESFORCE_FIELD_MAPPINGS.find(mapping => mapping.salesforceObject === salesforceObject);
  }

  /**
   * Validate required fields are present
   */
  static validateRequiredFields(record: any, mapping: TableMapping): string[] {
    const errors: string[] = [];
    
    for (const fieldMapping of mapping.fields) {
      if (fieldMapping.required && (!record[fieldMapping.sourceField] || record[fieldMapping.sourceField] === '')) {
        errors.push(`Required field ${fieldMapping.sourceField} is missing or empty`);
      }
    }
    
    return errors;
  }
}

// Export the mapping configuration
export default {
  SALESFORCE_FIELD_MAPPINGS,
  SalesforceDataTransformer
};