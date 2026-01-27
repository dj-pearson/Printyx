/**
 * Customer Data Transformer
 * Flattens nested API responses into clean, flat structures for components
 */

import type { Database } from '@/types/supabase';

// Raw API response types (nested structure from Supabase)
export interface RawCustomerAPI {
  id: string;
  tenant_id: string;
  company_id: string;
  contact_id: string;
  lead_source?: string;
  lead_status?: string;
  estimated_amount?: number;
  probability?: number;
  close_date?: string | null;
  owner_id?: string | null;
  lead_score?: number;
  priority?: string;
  notes?: string | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Nested relations from API
  companies?: {
    id: string;
    business_name: string;
    customer_number?: string;
    account_number?: string;
    phone?: string;
    email?: string;
    website?: string;
    industry?: string;
    billing_address?: string;
    billing_city?: string;
    billing_state?: string;
    billing_zip?: string;
    customer_since?: string;
    company_size?: string;
    employee_count?: number;
    annual_revenue?: number;
  };

  company_contacts?:
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        title?: string;
        is_primary: boolean;
      }>
    | {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        title?: string;
        is_primary: boolean;
      };
}

// Flattened customer type for components
export interface FlatCustomer {
  // Core customer fields
  id: string;
  tenantId: string;
  companyId: string;
  contactId: string;
  leadSource: string;
  leadStatus: string;
  status: string; // Alias for leadStatus
  recordType: 'customer' | 'lead';
  estimatedAmount: number;
  probability: number;
  closeDate: string | null;
  ownerId: string | null;
  leadScore: number;
  priority: string;
  notes: string | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  // Flattened company fields
  companyName: string;
  customerNumber: string | null;
  accountNumber: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  customerSince: string | null;
  companySize: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;

  // Flattened address fields
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  location: string | null; // Combined city, state

  // Flattened primary contact fields
  primaryContactName: string | null;
  primaryContactFirstName: string | null;
  primaryContactLastName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;

  // Display helpers
  displayName: string; // For UI display
  urlSlug: string; // For routing
}

/**
 * Transform raw nested API response to flat structure
 */
export function transformCustomer(raw: RawCustomerAPI): FlatCustomer {
  // Extract nested company data
  const company = raw.companies || {};

  // Extract primary contact (handle both array and single object)
  const contacts = Array.isArray(raw.company_contacts)
    ? raw.company_contacts
    : raw.company_contacts
      ? [raw.company_contacts]
      : [];

  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0] || {};

  // Build flattened structure
  const flat: FlatCustomer = {
    // Core fields
    id: raw.id,
    tenantId: raw.tenantId,
    companyId: raw.companyId,
    contactId: raw.contactId,
    leadSource: raw.lead_source || 'unknown',
    leadStatus: raw.lead_status || 'active',
    status: raw.lead_status || 'active',
    recordType: raw.lead_status === 'customer' ? 'customer' : 'lead',
    estimatedAmount: raw.estimated_amount || 0,
    probability: raw.probability || 0,
    closeDate: raw.close_date || null,
    ownerId: raw.ownerId || null,
    leadScore: raw.lead_score || 0,
    priority: raw.priority || 'medium',
    notes: raw.notes || null,
    lastContactDate: raw.last_contact_date || null,
    nextFollowUpDate: raw.next_follow_up_date || null,
    createdBy: raw.createdBy || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,

    // Company fields
    companyName: company.businessName || `Customer ${raw.id.slice(0, 8)}`,
    customerNumber: company.customer_number || null,
    accountNumber: company.account_number || null,
    phone: company.phone || null,
    email: company.email || null,
    website: company.website || null,
    industry: company.industry || null,
    customerSince: company.customer_since || null,
    companySize: company.company_size || null,
    employeeCount: company.employee_count || null,
    annualRevenue: company.annual_revenue || null,

    // Address fields
    addressLine1: company.billing_address || null,
    city: company.billing_city || null,
    state: company.billing_state || null,
    postalCode: company.billing_zip || null,
    location: [company.billing_city, company.billing_state].filter(Boolean).join(', ') || null,

    // Primary contact fields
    primaryContactName:
      primaryContact.firstName && primaryContact.lastName
        ? `${primaryContact.firstName} ${primaryContact.lastName}`
        : primaryContact.firstName || primaryContact.lastName || null,
    primaryContactFirstName: primaryContact.firstName || null,
    primaryContactLastName: primaryContact.lastName || null,
    primaryContactEmail: primaryContact.email || null,
    primaryContactPhone: primaryContact.phone || null,
    primaryContactTitle: primaryContact.title || null,

    // Display helpers
    displayName: company.businessName || `Customer ${raw.id.slice(0, 8)}`,
    urlSlug: raw.id, // Can be customized later
  };

  return flat;
}

/**
 * Transform array of raw customers
 */
export function transformCustomers(rawCustomers: RawCustomerAPI[]): FlatCustomer[] {
  return rawCustomers.map(transformCustomer);
}

/**
 * Transform for list view (lighter version)
 */
export function transformCustomerForList(raw: RawCustomerAPI): Partial<FlatCustomer> {
  const company = raw.companies || {};
  const contacts = Array.isArray(raw.company_contacts)
    ? raw.company_contacts
    : raw.company_contacts
      ? [raw.company_contacts]
      : [];
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0] || {};

  return {
    id: raw.id,
    companyName: company.businessName || `Customer ${raw.id.slice(0, 8)}`,
    status: raw.lead_status || 'active',
    recordType: raw.lead_status === 'customer' ? 'customer' : 'lead',
    location: [company.billing_city, company.billing_state].filter(Boolean).join(', ') || null,
    phone: company.phone || null,
    website: company.website || null,
    industry: company.industry || null,
    primaryContactEmail: primaryContact.email || null,
    displayName: company.businessName || `Customer ${raw.id.slice(0, 8)}`,
    urlSlug: raw.id,
  };
}
