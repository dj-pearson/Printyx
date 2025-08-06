/**
 * Data Transformation and Mapping System
 * Handles data mapping between different integration providers and internal data models
 */

export interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: any) => any;
  required?: boolean;
  defaultValue?: any;
}

export interface DataMappingRule {
  id: string;
  name: string;
  description: string;
  provider: string;
  sourceEntity: string;
  targetEntity: string;
  enabled: boolean;
  fieldMappings: FieldMapping[];
  conditions?: MappingCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MappingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';
  value: any;
}

export interface TransformationResult {
  success: boolean;
  data?: any;
  errors?: string[];
  warnings?: string[];
}

export class DataMapper {
  private static mappingRules: Map<string, DataMappingRule> = new Map();

  /**
   * Initialize predefined mapping rules for common integrations
   */
  static initializeDefaultMappings() {
    // Salesforce Account to Customer mapping
    this.addMappingRule({
      id: 'salesforce-account-to-customer',
      name: 'Salesforce Account to Customer',
      description: 'Maps Salesforce Account records to internal Customer records',
      provider: 'salesforce',
      sourceEntity: 'Account',
      targetEntity: 'Customer',
      enabled: true,
      fieldMappings: [
        { source: 'Id', target: 'externalSalesforceId', required: true },
        { source: 'Name', target: 'companyName', required: true },
        { source: 'Website', target: 'website' },
        { source: 'Phone', target: 'phone' },
        { source: 'Industry', target: 'industry' },
        { source: 'BillingStreet', target: 'billingAddressLine1' },
        { source: 'BillingCity', target: 'billingCity' },
        { source: 'BillingState', target: 'billingState' },
        { source: 'BillingPostalCode', target: 'billingPostalCode' },
        { source: 'BillingCountry', target: 'billingCountry' },
        { source: 'AnnualRevenue', target: 'annualRevenue', transform: (value) => value ? parseFloat(value) : null },
        { source: 'NumberOfEmployees', target: 'employeeCount', transform: (value) => value ? parseInt(value) : null }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Salesforce Contact to Company Contact mapping
    this.addMappingRule({
      id: 'salesforce-contact-to-company-contact',
      name: 'Salesforce Contact to Company Contact',
      description: 'Maps Salesforce Contact records to internal Company Contact records',
      provider: 'salesforce',
      sourceEntity: 'Contact',
      targetEntity: 'CompanyContact',
      enabled: true,
      fieldMappings: [
        { source: 'Id', target: 'externalSalesforceId', required: true },
        { source: 'FirstName', target: 'firstName' },
        { source: 'LastName', target: 'lastName', required: true },
        { source: 'Email', target: 'email' },
        { source: 'Phone', target: 'phone' },
        { source: 'Title', target: 'title' },
        { source: 'AccountId', target: 'companyId' },
        { source: 'MailingStreet', target: 'addressLine1' },
        { source: 'MailingCity', target: 'city' },
        { source: 'MailingState', target: 'state' },
        { source: 'MailingPostalCode', target: 'postalCode' },
        { source: 'MailingCountry', target: 'country' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Stripe Customer to Customer mapping
    this.addMappingRule({
      id: 'stripe-customer-to-customer',
      name: 'Stripe Customer to Customer',
      description: 'Maps Stripe Customer records to internal Customer records',
      provider: 'stripe',
      sourceEntity: 'Customer',
      targetEntity: 'Customer',
      enabled: true,
      fieldMappings: [
        { source: 'id', target: 'externalStripeId', required: true },
        { source: 'name', target: 'companyName' },
        { source: 'email', target: 'primaryContactEmail' },
        { source: 'phone', target: 'phone' },
        { source: 'address.line1', target: 'billingAddressLine1' },
        { source: 'address.line2', target: 'billingAddressLine2' },
        { source: 'address.city', target: 'billingCity' },
        { source: 'address.state', target: 'billingState' },
        { source: 'address.postal_code', target: 'billingPostalCode' },
        { source: 'address.country', target: 'billingCountry' },
        { source: 'created', target: 'createdAt', transform: (value) => new Date(value * 1000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // QuickBooks Customer to Customer mapping
    this.addMappingRule({
      id: 'quickbooks-customer-to-customer',
      name: 'QuickBooks Customer to Customer',
      description: 'Maps QuickBooks Customer records to internal Customer records',
      provider: 'quickbooks',
      sourceEntity: 'Customer',
      targetEntity: 'Customer',
      enabled: true,
      fieldMappings: [
        { source: 'Id', target: 'externalQuickBooksId', required: true },
        { source: 'Name', target: 'companyName', required: true },
        { source: 'CompanyName', target: 'companyName' },
        { source: 'PrimaryEmailAddr.Address', target: 'primaryContactEmail' },
        { source: 'PrimaryPhone.FreeFormNumber', target: 'phone' },
        { source: 'WebAddr.URI', target: 'website' },
        { source: 'BillAddr.Line1', target: 'billingAddressLine1' },
        { source: 'BillAddr.City', target: 'billingCity' },
        { source: 'BillAddr.CountrySubDivisionCode', target: 'billingState' },
        { source: 'BillAddr.PostalCode', target: 'billingPostalCode' },
        { source: 'BillAddr.Country', target: 'billingCountry' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Google Calendar Event mapping
    this.addMappingRule({
      id: 'google-calendar-event-to-appointment',
      name: 'Google Calendar Event to Appointment',
      description: 'Maps Google Calendar events to internal appointments',
      provider: 'google-calendar',
      sourceEntity: 'Event',
      targetEntity: 'Appointment',
      enabled: true,
      fieldMappings: [
        { source: 'id', target: 'externalGoogleId', required: true },
        { source: 'summary', target: 'title', required: true },
        { source: 'description', target: 'description' },
        { source: 'start.dateTime', target: 'startTime', transform: (value) => new Date(value) },
        { source: 'end.dateTime', target: 'endTime', transform: (value) => new Date(value) },
        { source: 'location', target: 'location' },
        { source: 'status', target: 'status' },
        { source: 'creator.email', target: 'createdBy' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Add a new mapping rule
   */
  static addMappingRule(rule: DataMappingRule) {
    this.mappingRules.set(rule.id, rule);
  }

  /**
   * Get mapping rule by ID
   */
  static getMappingRule(id: string): DataMappingRule | undefined {
    return this.mappingRules.get(id);
  }

  /**
   * Get mapping rules by provider and source entity
   */
  static getMappingRulesForEntity(provider: string, sourceEntity: string): DataMappingRule[] {
    return Array.from(this.mappingRules.values()).filter(
      rule => rule.provider === provider && rule.sourceEntity === sourceEntity && rule.enabled
    );
  }

  /**
   * Transform data using mapping rules
   */
  static transformData(
    provider: string,
    sourceEntity: string,
    sourceData: any
  ): TransformationResult {
    const mappingRules = this.getMappingRulesForEntity(provider, sourceEntity);
    
    if (mappingRules.length === 0) {
      return {
        success: false,
        errors: [`No mapping rules found for ${provider}.${sourceEntity}`]
      };
    }

    const results: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of mappingRules) {
      try {
        const transformedData = this.applyMappingRule(rule, sourceData);
        if (transformedData) {
          results.push(transformedData);
        }
      } catch (error) {
        errors.push(`Error applying rule ${rule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results.length === 1 ? results[0] : results,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Apply a single mapping rule to source data
   */
  private static applyMappingRule(rule: DataMappingRule, sourceData: any): any | null {
    // Check conditions first
    if (rule.conditions && !this.evaluateConditions(rule.conditions, sourceData)) {
      return null;
    }

    const targetData: any = {};
    const errors: string[] = [];

    for (const mapping of rule.fieldMappings) {
      try {
        const sourceValue = this.getNestedValue(sourceData, mapping.source);
        
        if (sourceValue === undefined || sourceValue === null) {
          if (mapping.required) {
            errors.push(`Required field ${mapping.source} is missing`);
            continue;
          }
          
          if (mapping.defaultValue !== undefined) {
            this.setNestedValue(targetData, mapping.target, mapping.defaultValue);
          }
          continue;
        }

        let transformedValue = sourceValue;
        
        // Apply transformation if specified
        if (mapping.transform) {
          transformedValue = mapping.transform(sourceValue);
        }

        // Set the transformed value in target data
        this.setNestedValue(targetData, mapping.target, transformedValue);
        
      } catch (error) {
        errors.push(`Error mapping ${mapping.source} to ${mapping.target}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Mapping errors: ${errors.join(', ')}`);
    }

    return targetData;
  }

  /**
   * Evaluate mapping conditions
   */
  private static evaluateConditions(conditions: MappingCondition[], data: any): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
        case 'starts_with':
          return typeof fieldValue === 'string' && fieldValue.startsWith(condition.value);
        case 'ends_with':
          return typeof fieldValue === 'string' && fieldValue.endsWith(condition.value);
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null;
        case 'not_exists':
          return fieldValue === undefined || fieldValue === null;
        default:
          return false;
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * Test a mapping rule with sample data
   */
  static testMappingRule(ruleId: string, sampleData: any): TransformationResult {
    const rule = this.getMappingRule(ruleId);
    
    if (!rule) {
      return {
        success: false,
        errors: [`Mapping rule ${ruleId} not found`]
      };
    }

    try {
      const transformedData = this.applyMappingRule(rule, sampleData);
      return {
        success: true,
        data: transformedData
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get all mapping rules
   */
  static getAllMappingRules(): DataMappingRule[] {
    return Array.from(this.mappingRules.values());
  }

  /**
   * Update a mapping rule
   */
  static updateMappingRule(id: string, updates: Partial<DataMappingRule>): boolean {
    const rule = this.mappingRules.get(id);
    if (!rule) return false;

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };

    this.mappingRules.set(id, updatedRule);
    return true;
  }

  /**
   * Delete a mapping rule
   */
  static deleteMappingRule(id: string): boolean {
    return this.mappingRules.delete(id);
  }
}

// Initialize default mappings when the module loads
DataMapper.initializeDefaultMappings();