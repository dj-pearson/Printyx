import axios, { AxiosInstance } from "axios";

export interface ApolloSearchFilters {
  personTitles?: string[];
  personSeniorities?: string[];
  personDepartments?: string[];
  personLocations?: string[];
  contactEmailStatus?: string[];
  organizationNumEmployeesRanges?: string[];
  organizationIndustries?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloContact {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  phone_numbers: Array<{ raw_number: string; sanitized_number: string }>;
  organization_id: string | null;
  organization: {
    id: string;
    name: string;
    website_url: string | null;
    primary_domain: string | null;
    num_employees_enum: string | null;
    estimated_num_employees: number | null;
    industry: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  seniority: string | null;
  departments: string[];
  functions: string[];
}

export interface ApolloSearchResponse {
  people: ApolloContact[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  breadcrumbs: any[];
}

export class ApolloClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: "https://api.apollo.io",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      timeout: 30000, // 30 second timeout
    });
  }

  async searchPeople(filters: ApolloSearchFilters): Promise<ApolloSearchResponse> {
    try {
      const response = await this.client.post<ApolloSearchResponse>(
        "/v1/mixed_people/search",
        {
          page: filters.page || 1,
          per_page: filters.perPage || 25,
          person_titles: filters.personTitles,
          person_seniorities: filters.personSeniorities,
          person_departments: filters.personDepartments,
          person_locations: filters.personLocations,
          contact_email_status: filters.contactEmailStatus || ["verified"],
          organization_num_employees_ranges: filters.organizationNumEmployeesRanges,
          organization_industries: filters.organizationIndustries,
          prospected_by_current_team: ["no"], // Only show new leads
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Apollo API error: ${error.response.status} - ${
            error.response.data?.message || error.response.statusText
          }`
        );
      }
      throw error;
    }
  }

  async enrichPerson(params: {
    email?: string;
    first_name?: string;
    last_name?: string;
    organization_name?: string;
  }): Promise<ApolloContact> {
    try {
      const response = await this.client.post<{ person: ApolloContact }>(
        "/v1/people/match",
        params
      );

      return response.data.person;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Apollo API error: ${error.response.status} - ${
            error.response.data?.message || error.response.statusText
          }`
        );
      }
      throw error;
    }
  }

  async bulkEnrichPeople(
    people: Array<{
      email?: string;
      first_name?: string;
      last_name?: string;
      organization_name?: string;
    }>
  ): Promise<ApolloContact[]> {
    try {
      const response = await this.client.post<{ people: ApolloContact[] }>(
        "/v1/people/bulk_match",
        { details: people.slice(0, 10) } // Max 10 at a time
      );

      return response.data.people;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Apollo API error: ${error.response.status} - ${
            error.response.data?.message || error.response.statusText
          }`
        );
      }
      throw error;
    }
  }
}

// Helper to create Apollo client with tenant-specific API key
export const createApolloClientForTenant = async (tenantId: string): Promise<ApolloClient> => {
  const { storage } = await import("./storage");
  
  // Retrieve tenant's Apollo.io credentials from database
  const credential = await storage.getIntegrationCredentialByProvider(tenantId, "apollo");
  
  if (!credential || !credential.apiKey) {
    throw new Error("Apollo.io API key not configured for this company. Please add your Apollo.io API key in Integration Hub → Apollo.io");
  }
  
  if (credential.status !== "active") {
    throw new Error(`Apollo.io integration is ${credential.status}. Please activate it in Integration Hub.`);
  }
  
  return new ApolloClient(credential.apiKey as string);
};

// Legacy: Create singleton instance with API key from environment (fallback for platform-level testing)
export const createApolloClient = () => {
  const apiKey = process.env.APOLLOIO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLOIO_API_KEY environment variable is not set");
  }
  return new ApolloClient(apiKey);
};
