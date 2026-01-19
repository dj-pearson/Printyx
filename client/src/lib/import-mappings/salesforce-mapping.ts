/**
 * Salesforce to Printyx Field Mapping Configuration
 * Used for automatic column detection and mapping
 */

export interface FieldMapping {
  // Printyx field name (database column)
  printyxField: string;
  // Salesforce column names (all possible variations)
  salesforceFields: string[];
  // Field type for validation
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone';
  // Is this field required?
  required: boolean;
  // Description for UI
  description: string;
  // Transform function (optional)
  transform?: (value: any) => any;
}

export const SALESFORCE_MAPPINGS: FieldMapping[] = [
  // Company Information
  {
    printyxField: 'company_name',
    salesforceFields: ['Business Name', 'Account Name', 'Company Name', 'Account.Name'],
    type: 'string',
    required: true,
    description: 'Company or business name',
  },
  {
    printyxField: 'external_salesforce_id',
    salesforceFields: ['Business ID', 'Account ID', 'Account.Id', 'SF Account ID'],
    type: 'string',
    required: true,
    description: 'Salesforce Account ID',
  },
  {
    printyxField: 'account_type',
    salesforceFields: ['Business Record Type', 'Account Type', 'Record Type', 'Account.Type'],
    type: 'string',
    required: false,
    description: 'Account type (Customer, Prospect, Partner)',
    transform: (value) => value?.toLowerCase(), // "Customer" -> "customer"
  },
  {
    printyxField: 'website',
    salesforceFields: ['Website', 'Account.Website', 'Company Website'],
    type: 'string',
    required: false,
    description: 'Company website URL',
  },
  {
    printyxField: 'industry',
    salesforceFields: ['Industry', 'Account.Industry', 'Business Industry'],
    type: 'string',
    required: false,
    description: 'Industry or business sector',
  },
  {
    printyxField: 'notes',
    salesforceFields: ['Business Description', 'Description', 'Account.Description', 'Notes'],
    type: 'string',
    required: false,
    description: 'Account notes or description',
  },
  {
    printyxField: 'parent_account_id',
    salesforceFields: [
      'Parent Business',
      'Parent Account',
      'Account.ParentId',
      'Parent Account ID',
    ],
    type: 'string',
    required: false,
    description: 'Parent company Salesforce ID',
  },

  // Sales & Lead Information
  {
    printyxField: 'lead_source',
    salesforceFields: ['Lead Source', 'Source', 'Account.LeadSource'],
    type: 'string',
    required: false,
    description: 'How the lead was acquired',
  },
  {
    printyxField: 'status',
    salesforceFields: ['Prospect Status', 'Status', 'Account Status', 'Account.Status'],
    type: 'string',
    required: false,
    description: 'Current account status',
  },
  {
    printyxField: 'customer_number',
    salesforceFields: [
      'EA Customer Number',
      'Customer Number',
      'Account Number',
      'Account.AccountNumber',
    ],
    type: 'string',
    required: false,
    description: 'E-Automate or custom customer number',
  },

  // Primary Contact Information
  {
    printyxField: 'primary_contact_first_name',
    salesforceFields: ['First Name', 'Contact.FirstName', 'Contact First Name'],
    type: 'string',
    required: false,
    description: 'Primary contact first name',
  },
  {
    printyxField: 'primary_contact_last_name',
    salesforceFields: ['Last Name', 'Contact.LastName', 'Contact Last Name'],
    type: 'string',
    required: false,
    description: 'Primary contact last name',
  },
  {
    printyxField: 'primary_contact_title',
    salesforceFields: ['Title', 'Contact.Title', 'Contact Title', 'Job Title'],
    type: 'string',
    required: false,
    description: 'Primary contact job title',
  },
  {
    printyxField: 'primary_contact_email',
    salesforceFields: ['Email', 'Contact.Email', 'Contact Email', 'Primary Email'],
    type: 'email',
    required: false,
    description: 'Primary contact email address',
  },
  {
    printyxField: 'primary_contact_phone',
    salesforceFields: ['Phone', 'Contact.Phone', 'Contact Phone', 'Primary Phone'],
    type: 'phone',
    required: false,
    description: 'Primary contact phone number',
  },
  {
    printyxField: 'primary_contact_mobile',
    salesforceFields: ['Mobile', 'Contact.Mobile', 'Mobile Phone', 'Cell Phone'],
    type: 'phone',
    required: false,
    description: 'Primary contact mobile number',
  },

  // Mailing Address
  {
    printyxField: 'address_line1',
    salesforceFields: ['Mailing Street', 'Street', 'Address', 'Account.BillingStreet'],
    type: 'string',
    required: false,
    description: 'Street address',
  },
  {
    printyxField: 'city',
    salesforceFields: ['Mailing City', 'City', 'Account.BillingCity'],
    type: 'string',
    required: false,
    description: 'City',
  },
  {
    printyxField: 'state',
    salesforceFields: ['Mailing State/Province', 'State', 'Province', 'Account.BillingState'],
    type: 'string',
    required: false,
    description: 'State or province',
  },
  {
    printyxField: 'postal_code',
    salesforceFields: [
      'Mailing Zip/Postal Code',
      'Zip',
      'Postal Code',
      'Account.BillingPostalCode',
    ],
    type: 'string',
    required: false,
    description: 'ZIP or postal code',
  },
  {
    printyxField: 'country',
    salesforceFields: ['Mailing Country', 'Country', 'Account.BillingCountry'],
    type: 'string',
    required: false,
    description: 'Country',
  },

  // Billing Address
  {
    printyxField: 'billing_address_line1',
    salesforceFields: ['Billing Street', 'Account.ShippingStreet', 'Billing Address'],
    type: 'string',
    required: false,
    description: 'Billing street address',
  },
  {
    printyxField: 'billing_city',
    salesforceFields: ['Billing City', 'Account.ShippingCity'],
    type: 'string',
    required: false,
    description: 'Billing city',
  },
  {
    printyxField: 'billing_state',
    salesforceFields: ['Billing State/Province', 'Billing State', 'Account.ShippingState'],
    type: 'string',
    required: false,
    description: 'Billing state or province',
  },
  {
    printyxField: 'billing_postal_code',
    salesforceFields: ['Billing Zip/Postal Code', 'Billing Zip', 'Account.ShippingPostalCode'],
    type: 'string',
    required: false,
    description: 'Billing ZIP or postal code',
  },

  // Shipping Address
  {
    printyxField: 'shipping_address_line1',
    salesforceFields: ['Shipping Street', 'Delivery Address'],
    type: 'string',
    required: false,
    description: 'Shipping street address',
  },
  {
    printyxField: 'shipping_city',
    salesforceFields: ['Shipping City'],
    type: 'string',
    required: false,
    description: 'Shipping city',
  },
  {
    printyxField: 'shipping_state',
    salesforceFields: ['Shipping State/Province', 'Shipping State'],
    type: 'string',
    required: false,
    description: 'Shipping state or province',
  },
  {
    printyxField: 'shipping_postal_code',
    salesforceFields: ['Shipping Zip/Postal Code', 'Shipping Zip'],
    type: 'string',
    required: false,
    description: 'Shipping ZIP or postal code',
  },

  // Communication
  {
    printyxField: 'phone',
    salesforceFields: ['Phone', 'Account.Phone', 'Business Phone', 'Main Phone'],
    type: 'phone',
    required: false,
    description: 'Business phone number',
  },
  {
    printyxField: 'fax',
    salesforceFields: ['Fax', 'Account.Fax', 'Fax Number'],
    type: 'phone',
    required: false,
    description: 'Fax number',
  },

  // Ownership & Assignment
  {
    printyxField: 'owner_id',
    salesforceFields: ['Business Owner Alias', 'Owner Alias', 'Account.Owner.Alias'],
    type: 'string',
    required: false,
    description: 'Account owner user ID or alias',
  },
  {
    printyxField: 'account_manager_name',
    salesforceFields: ['Business Owner', 'Account Owner', 'Account.Owner.Name', 'Owner Name'],
    type: 'string',
    required: false,
    description: 'Account manager name',
  },
  {
    printyxField: 'contact_owner',
    salesforceFields: ['Contact Owner', 'Contact.Owner', 'Contact Owner Name'],
    type: 'string',
    required: false,
    description: 'Contact owner name',
  },

  // Dates
  {
    printyxField: 'created_at',
    salesforceFields: ['Created Date', 'Account.CreatedDate', 'Date Created'],
    type: 'date',
    required: false,
    description: 'Date record was created',
  },
  {
    printyxField: 'updated_at',
    salesforceFields: ['Last Modified Date', 'Account.LastModifiedDate', 'Modified Date'],
    type: 'date',
    required: false,
    description: 'Date record was last modified',
  },
  {
    printyxField: 'created_by_name',
    salesforceFields: ['Created By', 'Account.CreatedBy.Name', 'Creator'],
    type: 'string',
    required: false,
    description: 'Name of user who created the record',
  },
];

/**
 * Auto-detect Salesforce columns and suggest Printyx field mappings
 */
export function autoMapSalesforceColumns(csvHeaders: string[]): Map<string, string> {
  const mappings = new Map<string, string>();

  csvHeaders.forEach((csvHeader) => {
    const normalizedHeader = csvHeader.trim();

    // Find matching Printyx field
    const match = SALESFORCE_MAPPINGS.find((mapping) =>
      mapping.salesforceFields.some(
        (sfField) => sfField.toLowerCase() === normalizedHeader.toLowerCase(),
      ),
    );

    if (match) {
      mappings.set(csvHeader, match.printyxField);
    }
  });

  return mappings;
}

/**
 * Calculate mapping confidence score (0-100)
 */
export function calculateMappingConfidence(csvHeaders: string[]): number {
  const mappings = autoMapSalesforceColumns(csvHeaders);
  const requiredFields = SALESFORCE_MAPPINGS.filter((m) => m.required);

  const requiredMatched = requiredFields.filter((field) =>
    Array.from(mappings.values()).includes(field.printyxField),
  ).length;

  const totalMatched = mappings.size;
  const totalFields = csvHeaders.length;

  // Weighted score: 70% for required fields, 30% for total match rate
  const requiredScore = (requiredMatched / Math.max(requiredFields.length, 1)) * 70;
  const totalScore = (totalMatched / Math.max(totalFields, 1)) * 30;

  return Math.round(requiredScore + totalScore);
}

/**
 * Get all available Printyx fields for manual mapping
 */
export function getPrintyxFields(): Array<{ value: string; label: string; description: string }> {
  return SALESFORCE_MAPPINGS.map((mapping) => ({
    value: mapping.printyxField,
    label: mapping.printyxField.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: mapping.description,
  }));
}

/**
 * Validate a mapped value against field type
 */
export function validateFieldValue(value: any, fieldType: string): boolean {
  if (!value || value === '') return true; // Allow empty values

  switch (fieldType) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'phone':
      return /^[\d\s\-\(\)\+\.]+$/.test(value);
    case 'number':
      return !isNaN(Number(value));
    case 'date':
      return !isNaN(Date.parse(value));
    case 'boolean':
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(String(value).toLowerCase());
    default:
      return true;
  }
}
