/**
 * CRM Object Registry
 * Maps each CRM object type to its configuration: fields, filters, views, board support, record layout.
 * Used by CrmIndexShell and all CRM components for consistent behavior across object types.
 */

export type CrmObjectType = 'deals' | 'leads' | 'contacts' | 'companies' | 'opportunities';

export interface CrmFieldDef {
  field: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'email' | 'phone' | 'badge';
  sortable?: boolean;
  editable?: boolean;
  width?: string;
  options?: Array<{ value: string; label: string; color?: string }>;
  format?: string;
}

export interface CrmQuickFilter {
  field: string;
  label: string;
  serverKey: string;
  options: Array<{ value: string; label: string }>;
}

export interface CrmStatusConfig {
  value: string;
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

export interface CrmDefaultView {
  name: string;
  isDefault?: boolean;
  filterDefinition?: Array<{ field: string; operator: string; value: any }>;
  sortConfig?: { field: string; direction: 'asc' | 'desc' };
}

export interface CrmObjectConfig {
  objectType: CrmObjectType;
  label: string;
  labelPlural: string;
  icon: string; // Lucide icon name
  apiEndpoint: string;
  detailPath: string;
  hasBoardView: boolean;
  pipelineField?: string; // Field used for board columns (e.g., 'stage', 'status')
  fields: CrmFieldDef[];
  defaultColumns: string[]; // field names for default table columns
  quickFilters: CrmQuickFilter[];
  statusConfigs: CrmStatusConfig[];
  defaultViews: CrmDefaultView[];
  recordType?: string; // For business records API
}

// ─── Deals Configuration ───────────────────────────────────────────

const dealsConfig: CrmObjectConfig = {
  objectType: 'deals',
  label: 'Deal',
  labelPlural: 'Deals',
  icon: 'DollarSign',
  apiEndpoint: '/api/deals-management/deals',
  detailPath: '/deals',
  hasBoardView: true,
  pipelineField: 'stage',
  fields: [
    { field: 'title', label: 'Deal Name', type: 'text', sortable: true, editable: true, width: 'min-w-[250px]' },
    { field: 'value', label: 'Amount', type: 'currency', sortable: true, editable: true, width: 'min-w-[120px]' },
    { field: 'stage', label: 'Stage', type: 'select', sortable: true, editable: true, width: 'min-w-[150px]' },
    { field: 'probability', label: 'Probability', type: 'number', sortable: true, editable: true, width: 'min-w-[100px]' },
    { field: 'expectedCloseDate', label: 'Close Date', type: 'date', sortable: true, editable: true, width: 'min-w-[130px]' },
    { field: 'assignedToName', label: 'Owner', type: 'text', sortable: true, width: 'min-w-[150px]' },
    { field: 'customerName', label: 'Company', type: 'text', sortable: true, width: 'min-w-[180px]' },
    { field: 'status', label: 'Status', type: 'badge', sortable: true, width: 'min-w-[100px]' },
    { field: 'priority', label: 'Priority', type: 'badge', sortable: true, editable: true, width: 'min-w-[100px]' },
    { field: 'createdAt', label: 'Created', type: 'date', sortable: true, width: 'min-w-[130px]' },
  ],
  defaultColumns: ['title', 'value', 'stage', 'probability', 'expectedCloseDate', 'assignedToName', 'customerName'],
  quickFilters: [
    {
      field: 'stage',
      label: 'Stage',
      serverKey: 'stage',
      options: [
        { value: 'prospecting', label: 'Prospecting' },
        { value: 'qualification', label: 'Qualification' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'negotiation', label: 'Negotiation' },
        { value: 'closed_won', label: 'Closed Won' },
        { value: 'closed_lost', label: 'Closed Lost' },
      ],
    },
    {
      field: 'priority',
      label: 'Priority',
      serverKey: 'priority',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ],
    },
  ],
  statusConfigs: [
    { value: 'open', label: 'Open', variant: 'default', className: 'bg-blue-100 text-blue-800' },
    { value: 'won', label: 'Won', variant: 'default', className: 'bg-green-100 text-green-800' },
    { value: 'lost', label: 'Lost', variant: 'destructive', className: 'bg-red-100 text-red-800' },
  ],
  defaultViews: [
    { name: 'All Deals', isDefault: true },
    { name: 'My Deals', filterDefinition: [{ field: 'assignedToId', operator: 'eq', value: '__CURRENT_USER__' }] },
    { name: 'Recently Modified', sortConfig: { field: 'updatedAt', direction: 'desc' } },
  ],
};

// ─── Leads Configuration ───────────────────────────────────────────

const leadsConfig: CrmObjectConfig = {
  objectType: 'leads',
  label: 'Lead',
  labelPlural: 'Leads',
  icon: 'UserPlus',
  apiEndpoint: '/api/business-records',
  detailPath: '/leads',
  hasBoardView: true,
  pipelineField: 'status',
  recordType: 'lead',
  fields: [
    { field: 'companyName', label: 'Company', type: 'text', sortable: true, editable: true, width: 'min-w-[200px]' },
    { field: 'primaryContactName', label: 'Contact', type: 'text', sortable: true, editable: true, width: 'min-w-[180px]' },
    { field: 'primaryContactEmail', label: 'Email', type: 'email', sortable: true, width: 'min-w-[200px]' },
    { field: 'status', label: 'Status', type: 'badge', sortable: true, editable: true, width: 'min-w-[120px]' },
    { field: 'priority', label: 'Priority', type: 'badge', sortable: true, editable: true, width: 'min-w-[100px]' },
    { field: 'leadSource', label: 'Source', type: 'text', sortable: true, width: 'min-w-[120px]' },
    { field: 'estimatedAmount', label: 'Value', type: 'currency', sortable: true, editable: true, width: 'min-w-[120px]' },
    { field: 'industry', label: 'Industry', type: 'text', sortable: true, width: 'min-w-[130px]' },
    { field: 'ownerId', label: 'Owner', type: 'text', sortable: true, width: 'min-w-[150px]' },
    { field: 'createdAt', label: 'Created', type: 'date', sortable: true, width: 'min-w-[130px]' },
  ],
  defaultColumns: ['companyName', 'primaryContactName', 'status', 'priority', 'leadSource', 'estimatedAmount', 'createdAt'],
  quickFilters: [
    {
      field: 'status',
      label: 'Status',
      serverKey: 'status',
      options: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'qualified', label: 'Qualified' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'negotiation', label: 'Negotiation' },
        { value: 'closed_won', label: 'Closed Won' },
        { value: 'closed_lost', label: 'Closed Lost' },
      ],
    },
    {
      field: 'priority',
      label: 'Priority',
      serverKey: 'priority',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ],
    },
    {
      field: 'leadSource',
      label: 'Source',
      serverKey: 'leadSource',
      options: [
        { value: 'website', label: 'Website' },
        { value: 'referral', label: 'Referral' },
        { value: 'cold_call', label: 'Cold Call' },
        { value: 'trade_show', label: 'Trade Show' },
        { value: 'social_media', label: 'Social Media' },
      ],
    },
  ],
  statusConfigs: [
    { value: 'new', label: 'New', variant: 'default', className: 'bg-blue-100 text-blue-800' },
    { value: 'contacted', label: 'Contacted', variant: 'default', className: 'bg-yellow-100 text-yellow-800' },
    { value: 'qualified', label: 'Qualified', variant: 'default', className: 'bg-green-100 text-green-800' },
    { value: 'proposal', label: 'Proposal', variant: 'default', className: 'bg-purple-100 text-purple-800' },
    { value: 'negotiation', label: 'Negotiation', variant: 'default', className: 'bg-orange-100 text-orange-800' },
    { value: 'closed_won', label: 'Closed Won', variant: 'default', className: 'bg-green-200 text-green-900' },
    { value: 'closed_lost', label: 'Closed Lost', variant: 'destructive', className: 'bg-red-100 text-red-800' },
  ],
  defaultViews: [
    { name: 'All Leads', isDefault: true },
    { name: 'My Leads', filterDefinition: [{ field: 'ownerId', operator: 'eq', value: '__CURRENT_USER__' }] },
    { name: 'Recently Modified', sortConfig: { field: 'updatedAt', direction: 'desc' } },
  ],
};

// ─── Contacts Configuration ────────────────────────────────────────

const contactsConfig: CrmObjectConfig = {
  objectType: 'contacts',
  label: 'Contact',
  labelPlural: 'Contacts',
  icon: 'Users',
  apiEndpoint: '/api/company-contacts',
  detailPath: '/contacts',
  hasBoardView: false,
  fields: [
    { field: 'firstName', label: 'First Name', type: 'text', sortable: true, editable: true, width: 'min-w-[150px]' },
    { field: 'lastName', label: 'Last Name', type: 'text', sortable: true, editable: true, width: 'min-w-[150px]' },
    { field: 'email', label: 'Email', type: 'email', sortable: true, editable: true, width: 'min-w-[220px]' },
    { field: 'phone', label: 'Phone', type: 'phone', sortable: true, editable: true, width: 'min-w-[140px]' },
    { field: 'jobTitle', label: 'Job Title', type: 'text', sortable: true, editable: true, width: 'min-w-[180px]' },
    { field: 'department', label: 'Department', type: 'text', sortable: true, width: 'min-w-[150px]' },
    { field: 'isPrimary', label: 'Primary', type: 'badge', sortable: true, width: 'min-w-[80px]' },
    { field: 'isActive', label: 'Active', type: 'badge', sortable: true, width: 'min-w-[80px]' },
    { field: 'createdAt', label: 'Created', type: 'date', sortable: true, width: 'min-w-[130px]' },
  ],
  defaultColumns: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'department', 'isPrimary'],
  quickFilters: [
    {
      field: 'department',
      label: 'Department',
      serverKey: 'department',
      options: [
        { value: 'sales', label: 'Sales' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'operations', label: 'Operations' },
        { value: 'finance', label: 'Finance' },
        { value: 'it', label: 'IT' },
      ],
    },
  ],
  statusConfigs: [
    { value: 'active', label: 'Active', variant: 'default', className: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', variant: 'secondary', className: 'bg-gray-100 text-gray-800' },
  ],
  defaultViews: [
    { name: 'All Contacts', isDefault: true },
    { name: 'My Contacts', filterDefinition: [{ field: 'ownerId', operator: 'eq', value: '__CURRENT_USER__' }] },
    { name: 'Recently Modified', sortConfig: { field: 'updatedAt', direction: 'desc' } },
  ],
};

// ─── Companies Configuration ───────────────────────────────────────

const companiesConfig: CrmObjectConfig = {
  objectType: 'companies',
  label: 'Company',
  labelPlural: 'Companies',
  icon: 'Building2',
  apiEndpoint: '/api/companies',
  detailPath: '/companies',
  hasBoardView: false,
  fields: [
    { field: 'name', label: 'Company Name', type: 'text', sortable: true, editable: true, width: 'min-w-[250px]' },
    { field: 'industry', label: 'Industry', type: 'text', sortable: true, editable: true, width: 'min-w-[150px]' },
    { field: 'website', label: 'Website', type: 'text', sortable: true, width: 'min-w-[200px]' },
    { field: 'phone', label: 'Phone', type: 'phone', sortable: true, editable: true, width: 'min-w-[140px]' },
    { field: 'city', label: 'City', type: 'text', sortable: true, width: 'min-w-[120px]' },
    { field: 'state', label: 'State', type: 'text', sortable: true, width: 'min-w-[100px]' },
    { field: 'employeeCount', label: 'Employees', type: 'number', sortable: true, width: 'min-w-[100px]' },
    { field: 'annualRevenue', label: 'Revenue', type: 'currency', sortable: true, width: 'min-w-[130px]' },
    { field: 'createdAt', label: 'Created', type: 'date', sortable: true, width: 'min-w-[130px]' },
  ],
  defaultColumns: ['name', 'industry', 'website', 'phone', 'city', 'state', 'employeeCount'],
  quickFilters: [
    {
      field: 'industry',
      label: 'Industry',
      serverKey: 'industry',
      options: [
        { value: 'technology', label: 'Technology' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'finance', label: 'Finance' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'retail', label: 'Retail' },
        { value: 'education', label: 'Education' },
      ],
    },
  ],
  statusConfigs: [
    { value: 'active', label: 'Active', variant: 'default', className: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', variant: 'secondary', className: 'bg-gray-100 text-gray-800' },
  ],
  defaultViews: [
    { name: 'All Companies', isDefault: true },
    { name: 'My Companies', filterDefinition: [{ field: 'ownerId', operator: 'eq', value: '__CURRENT_USER__' }] },
    { name: 'Recently Modified', sortConfig: { field: 'updatedAt', direction: 'desc' } },
  ],
};

// ─── Registry ──────────────────────────────────────────────────────

const registry: Record<CrmObjectType, CrmObjectConfig> = {
  deals: dealsConfig,
  leads: leadsConfig,
  contacts: contactsConfig,
  companies: companiesConfig,
  opportunities: dealsConfig, // Shares config with deals
};

export function getCrmObjectConfig(objectType: CrmObjectType): CrmObjectConfig {
  const config = registry[objectType];
  if (!config) {
    throw new Error(`Unknown CRM object type: ${objectType}`);
  }
  return config;
}

export function getAllCrmObjectTypes(): CrmObjectType[] {
  return ['deals', 'leads', 'contacts', 'companies'];
}

export function getObjectTypesWithBoardView(): CrmObjectType[] {
  return Object.values(registry)
    .filter((c) => c.hasBoardView)
    .map((c) => c.objectType);
}
