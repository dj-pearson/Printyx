// Unified Data Enrichment System for ZoomInfo and Apollo.io Integration
// Supports comprehensive prospecting workflow with essential lead information

export interface DataEnrichmentFieldMapping {
  sourceField: string;
  targetField: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'decimal' | 'json';
  required?: boolean;
  transform?: (value: any) => any;
}

export interface DataEnrichmentTableMapping {
  sourceSystem: 'zoominfo' | 'apollo';
  sourceObject: string;
  printixTable: string;
  primaryKey: string;
  fields: DataEnrichmentFieldMapping[];
}

// Unified Data Enrichment Field Mappings
export const DATA_ENRICHMENT_MAPPINGS: DataEnrichmentTableMapping[] = [
  // =================================================================
  // CONTACT/PERSON ENRICHMENT DATA
  // =================================================================
  {
    sourceSystem: 'zoominfo',
    sourceObject: 'person',
    printixTable: 'enriched_contacts',
    primaryKey: 'id',
    fields: [
      // Core Identity
      { sourceField: 'id', targetField: 'zoominfo_contact_id', dataType: 'string' },
      { sourceField: 'firstName', targetField: 'first_name', dataType: 'string', required: true },
      { sourceField: 'lastName', targetField: 'last_name', dataType: 'string', required: true },
      { sourceField: 'name', targetField: 'full_name', dataType: 'string' },
      { sourceField: 'email', targetField: 'email', dataType: 'string' },
      { sourceField: 'phone', targetField: 'direct_phone', dataType: 'string' },
      { sourceField: 'mobile', targetField: 'mobile_phone', dataType: 'string' },
      
      // Professional Information
      { sourceField: 'title', targetField: 'job_title', dataType: 'string' },
      { sourceField: 'managementLevel', targetField: 'management_level', dataType: 'string' },
      { sourceField: 'department', targetField: 'department', dataType: 'string' },
      { sourceField: 'subDepartment', targetField: 'sub_department', dataType: 'string' },
      { sourceField: 'jobFunction', targetField: 'job_function', dataType: 'string' },
      
      // Company Context
      { sourceField: 'companyId', targetField: 'company_external_id', dataType: 'string' },
      { sourceField: 'companyName', targetField: 'company_name', dataType: 'string' },
      { sourceField: 'companyDomain', targetField: 'company_domain', dataType: 'string' },
      
      // Location Information
      { sourceField: 'city', targetField: 'city', dataType: 'string' },
      { sourceField: 'state', targetField: 'state', dataType: 'string' },
      { sourceField: 'country', targetField: 'country', dataType: 'string' },
      { sourceField: 'timeZone', targetField: 'time_zone', dataType: 'string' },
      
      // Social Media & Professional Networks
      { sourceField: 'linkedInUrl', targetField: 'linkedin_url', dataType: 'string' },
      { sourceField: 'twitterUrl', targetField: 'twitter_url', dataType: 'string' },
      { sourceField: 'facebookUrl', targetField: 'facebook_url', dataType: 'string' },
      
      // Enrichment Metadata
      { sourceField: 'personScore', targetField: 'person_score', dataType: 'number' },
      { sourceField: 'verified', targetField: 'is_verified', dataType: 'boolean' },
      { sourceField: 'lastUpdatedDate', targetField: 'last_enriched_date', dataType: 'date' },
      
      // Professional History (JSON fields)
      { sourceField: 'workHistory', targetField: 'work_history', dataType: 'json' },
      { sourceField: 'educationHistory', targetField: 'education_history', dataType: 'json' },
      { sourceField: 'skills', targetField: 'skills', dataType: 'json' },
    ]
  },
  
  {
    sourceSystem: 'apollo',
    sourceObject: 'people',
    printixTable: 'enriched_contacts',
    primaryKey: 'id',
    fields: [
      // Core Identity
      { sourceField: 'id', targetField: 'apollo_contact_id', dataType: 'string' },
      { sourceField: 'first_name', targetField: 'first_name', dataType: 'string', required: true },
      { sourceField: 'last_name', targetField: 'last_name', dataType: 'string', required: true },
      { sourceField: 'name', targetField: 'full_name', dataType: 'string' },
      { sourceField: 'email', targetField: 'email', dataType: 'string' },
      { sourceField: 'phone', targetField: 'direct_phone', dataType: 'string' },
      { sourceField: 'mobile_phone', targetField: 'mobile_phone', dataType: 'string' },
      
      // Professional Information
      { sourceField: 'title', targetField: 'job_title', dataType: 'string' },
      { sourceField: 'seniority', targetField: 'management_level', dataType: 'string' },
      { sourceField: 'departments', targetField: 'department', dataType: 'json' },
      { sourceField: 'functions', targetField: 'job_function', dataType: 'json' },
      
      // Company Context
      { sourceField: 'organization_id', targetField: 'company_external_id', dataType: 'string' },
      { sourceField: 'organization_name', targetField: 'company_name', dataType: 'string' },
      { sourceField: 'website_url', targetField: 'company_domain', dataType: 'string' },
      
      // Location Information
      { sourceField: 'city', targetField: 'city', dataType: 'string' },
      { sourceField: 'state', targetField: 'state', dataType: 'string' },
      { sourceField: 'country', targetField: 'country', dataType: 'string' },
      { sourceField: 'time_zone', targetField: 'time_zone', dataType: 'string' },
      
      // Social Media & Professional Networks
      { sourceField: 'linkedin_url', targetField: 'linkedin_url', dataType: 'string' },
      { sourceField: 'twitter_url', targetField: 'twitter_url', dataType: 'string' },
      { sourceField: 'facebook_url', targetField: 'facebook_url', dataType: 'string' },
      
      // Enrichment Metadata
      { sourceField: 'person_score', targetField: 'person_score', dataType: 'number' },
      { sourceField: 'email_status', targetField: 'email_verification_status', dataType: 'string' },
      { sourceField: 'updated_at', targetField: 'last_enriched_date', dataType: 'date' },
      
      // Professional History (JSON fields)
      { sourceField: 'employment_history', targetField: 'work_history', dataType: 'json' },
    ]
  },

  // =================================================================
  // COMPANY ENRICHMENT DATA
  // =================================================================
  {
    sourceSystem: 'zoominfo',
    sourceObject: 'company',
    printixTable: 'enriched_companies',
    primaryKey: 'id',
    fields: [
      // Core Identity
      { sourceField: 'id', targetField: 'zoominfo_company_id', dataType: 'string' },
      { sourceField: 'name', targetField: 'company_name', dataType: 'string', required: true },
      { sourceField: 'website', targetField: 'website', dataType: 'string' },
      { sourceField: 'domain', targetField: 'primary_domain', dataType: 'string' },
      { sourceField: 'phone', targetField: 'main_phone', dataType: 'string' },
      
      // Business Information
      { sourceField: 'industry', targetField: 'primary_industry', dataType: 'string' },
      { sourceField: 'subIndustry', targetField: 'sub_industry', dataType: 'string' },
      { sourceField: 'employees', targetField: 'employee_count', dataType: 'number' },
      { sourceField: 'employeesRange', targetField: 'employee_range', dataType: 'string' },
      { sourceField: 'revenue', targetField: 'annual_revenue', dataType: 'decimal' },
      { sourceField: 'revenueRange', targetField: 'revenue_range', dataType: 'string' },
      { sourceField: 'founded', targetField: 'founded_year', dataType: 'number' },
      { sourceField: 'type', targetField: 'company_type', dataType: 'string' },
      
      // Location Information
      { sourceField: 'street', targetField: 'street_address', dataType: 'string' },
      { sourceField: 'city', targetField: 'city', dataType: 'string' },
      { sourceField: 'state', targetField: 'state', dataType: 'string' },
      { sourceField: 'zipCode', targetField: 'zip_code', dataType: 'string' },
      { sourceField: 'country', targetField: 'country', dataType: 'string' },
      
      // Corporate Structure
      { sourceField: 'parentCompanyId', targetField: 'parent_company_id', dataType: 'string' },
      { sourceField: 'parentCompanyName', targetField: 'parent_company_name', dataType: 'string' },
      
      // Technology & Business Intelligence
      { sourceField: 'technologies', targetField: 'technologies', dataType: 'json' },
      { sourceField: 'departments', targetField: 'departments', dataType: 'json' },
      { sourceField: 'keyExecutives', targetField: 'key_executives', dataType: 'json' },
      
      // Enrichment Metadata
      { sourceField: 'companyScore', targetField: 'company_score', dataType: 'number' },
      { sourceField: 'lastUpdatedDate', targetField: 'last_enriched_date', dataType: 'date' },
    ]
  },

  {
    sourceSystem: 'apollo',
    sourceObject: 'organizations',
    printixTable: 'enriched_companies',
    primaryKey: 'id',
    fields: [
      // Core Identity
      { sourceField: 'id', targetField: 'apollo_company_id', dataType: 'string' },
      { sourceField: 'name', targetField: 'company_name', dataType: 'string', required: true },
      { sourceField: 'website_url', targetField: 'website', dataType: 'string' },
      { sourceField: 'primary_domain', targetField: 'primary_domain', dataType: 'string' },
      { sourceField: 'phone', targetField: 'main_phone', dataType: 'string' },
      
      // Business Information
      { sourceField: 'industry', targetField: 'primary_industry', dataType: 'string' },
      { sourceField: 'estimated_num_employees', targetField: 'employee_count', dataType: 'number' },
      { sourceField: 'annual_revenue', targetField: 'annual_revenue', dataType: 'decimal' },
      { sourceField: 'publicly_traded_symbol', targetField: 'stock_ticker', dataType: 'string' },
      
      // Location Information
      { sourceField: 'street_address', targetField: 'street_address', dataType: 'string' },
      { sourceField: 'city', targetField: 'city', dataType: 'string' },
      { sourceField: 'state', targetField: 'state', dataType: 'string' },
      { sourceField: 'postal_code', targetField: 'zip_code', dataType: 'string' },
      { sourceField: 'country', targetField: 'country', dataType: 'string' },
      
      // Corporate Structure
      { sourceField: 'owned_by_organization_id', targetField: 'parent_company_id', dataType: 'string' },
      
      // Technology & Business Intelligence
      { sourceField: 'technology_names', targetField: 'technologies', dataType: 'json' },
      { sourceField: 'keywords', targetField: 'business_keywords', dataType: 'json' },
      
      // Funding Information
      { sourceField: 'total_funding', targetField: 'total_funding', dataType: 'decimal' },
      { sourceField: 'latest_funding_stage', targetField: 'funding_stage', dataType: 'string' },
      { sourceField: 'latest_funding_round_date', targetField: 'last_funding_date', dataType: 'date' },
      
      // Enrichment Metadata
      { sourceField: 'updated_at', targetField: 'last_enriched_date', dataType: 'date' },
    ]
  },

  // =================================================================
  // INTENT & ENGAGEMENT DATA
  // =================================================================
  {
    sourceSystem: 'zoominfo',
    sourceObject: 'intent',
    printixTable: 'enriched_intent_data',
    primaryKey: 'companyId',
    fields: [
      { sourceField: 'companyId', targetField: 'company_external_id', dataType: 'string' },
      { sourceField: 'companyName', targetField: 'company_name', dataType: 'string' },
      { sourceField: 'topicName', targetField: 'intent_topic', dataType: 'string' },
      { sourceField: 'topicCategory', targetField: 'topic_category', dataType: 'string' },
      { sourceField: 'intentScore', targetField: 'intent_score', dataType: 'number' },
      { sourceField: 'intentLevel', targetField: 'intent_level', dataType: 'string' },
      { sourceField: 'buyingStage', targetField: 'buying_stage', dataType: 'string' },
      { sourceField: 'decisionTimeframe', targetField: 'decision_timeframe', dataType: 'string' },
      { sourceField: 'trending', targetField: 'is_trending', dataType: 'boolean' },
      { sourceField: 'lastSeenDate', targetField: 'last_activity_date', dataType: 'date' },
      { sourceField: 'keywords', targetField: 'intent_keywords', dataType: 'json' },
    ]
  },

  // =================================================================
  // ORGANIZATIONAL HIERARCHY DATA
  // =================================================================
  {
    sourceSystem: 'zoominfo',
    sourceObject: 'org_chart',
    printixTable: 'enriched_org_hierarchy',
    primaryKey: 'personId',
    fields: [
      { sourceField: 'companyId', targetField: 'company_external_id', dataType: 'string' },
      { sourceField: 'personId', targetField: 'person_external_id', dataType: 'string' },
      { sourceField: 'managerId', targetField: 'manager_person_id', dataType: 'string' },
      { sourceField: 'departmentName', targetField: 'department_name', dataType: 'string' },
      { sourceField: 'level', targetField: 'organizational_level', dataType: 'number' },
      { sourceField: 'teamSize', targetField: 'team_size', dataType: 'number' },
      { sourceField: 'directReports', targetField: 'direct_reports_count', dataType: 'number' },
      { sourceField: 'decisionMakingPower', targetField: 'decision_making_power', dataType: 'string' },
      { sourceField: 'budgetAuthority', targetField: 'has_budget_authority', dataType: 'boolean' },
      { sourceField: 'influenceScore', targetField: 'influence_score', dataType: 'number' },
      { sourceField: 'hierarchy', targetField: 'hierarchy_path', dataType: 'json' },
    ]
  }
];

// Data Transformation Utilities
export class DataEnrichmentTransformer {
  static transformZoomInfoContact(rawData: any): any {
    return {
      // Apply standard transformations for ZoomInfo contact data
      management_level: this.normalizeManagementLevel(rawData.managementLevel),
      employee_count: this.parseEmployeeCount(rawData.employees || rawData.employeesRange),
      annual_revenue: this.parseRevenue(rawData.revenue || rawData.revenueRange),
      is_verified: Boolean(rawData.verified),
      work_history: this.parseWorkHistory(rawData.workHistory),
      education_history: this.parseEducationHistory(rawData.educationHistory),
      skills: this.parseSkills(rawData.skills),
    };
  }

  static transformApolloContact(rawData: any): any {
    return {
      // Apply standard transformations for Apollo contact data
      management_level: this.normalizeManagementLevel(rawData.seniority),
      email_verification_status: this.normalizeEmailStatus(rawData.email_status),
      work_history: this.parseApolloEmploymentHistory(rawData.employment_history),
      department: this.parseDepartments(rawData.departments),
      job_function: this.parseJobFunctions(rawData.functions),
    };
  }

  static transformZoomInfoCompany(rawData: any): any {
    return {
      employee_count: this.parseEmployeeCount(rawData.employees),
      annual_revenue: this.parseRevenue(rawData.revenue),
      founded_year: this.parseYear(rawData.founded),
      technologies: this.parseTechnologies(rawData.technologies),
      key_executives: this.parseExecutives(rawData.keyExecutives),
    };
  }

  static transformApolloCompany(rawData: any): any {
    return {
      employee_count: rawData.estimated_num_employees,
      annual_revenue: this.parseRevenue(rawData.annual_revenue),
      technologies: this.parseApolloTechnologies(rawData.technology_names),
      total_funding: this.parseRevenue(rawData.total_funding),
    };
  }

  // Helper transformation methods
  private static normalizeManagementLevel(level: string): string {
    if (!level) return null;
    const normalized = level.toLowerCase();
    if (normalized.includes('c-level') || normalized.includes('ceo') || normalized.includes('cto')) return 'C-Level';
    if (normalized.includes('vp') || normalized.includes('vice president')) return 'VP';
    if (normalized.includes('director')) return 'Director';
    if (normalized.includes('manager')) return 'Manager';
    return 'Individual Contributor';
  }

  private static parseEmployeeCount(employees: any): number | null {
    if (typeof employees === 'number') return employees;
    if (typeof employees === 'string') {
      const match = employees.match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  }

  private static parseRevenue(revenue: any): number | null {
    if (typeof revenue === 'number') return revenue;
    if (typeof revenue === 'string') {
      const match = revenue.replace(/[,$]/g, '').match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  }

  private static parseYear(year: any): number | null {
    if (typeof year === 'number') return year;
    if (typeof year === 'string') {
      const match = year.match(/(\d{4})/);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  }

  private static normalizeEmailStatus(status: string): string {
    if (!status) return 'unknown';
    return status.toLowerCase();
  }

  private static parseWorkHistory(history: any): any {
    if (typeof history === 'string') {
      try {
        return JSON.parse(history);
      } catch {
        return [{ description: history }];
      }
    }
    return history || [];
  }

  private static parseEducationHistory(education: any): any {
    if (typeof education === 'string') {
      try {
        return JSON.parse(education);
      } catch {
        return [{ description: education }];
      }
    }
    return education || [];
  }

  private static parseSkills(skills: any): any {
    if (typeof skills === 'string') {
      try {
        return JSON.parse(skills);
      } catch {
        return skills.split(',').map(s => s.trim());
      }
    }
    return skills || [];
  }

  private static parseApolloEmploymentHistory(history: any): any {
    if (Array.isArray(history)) {
      return history.map(job => ({
        company: job.organization_name,
        title: job.title,
        start_date: job.start_date,
        end_date: job.end_date,
        current: job.current
      }));
    }
    return history || [];
  }

  private static parseDepartments(departments: any): string {
    if (Array.isArray(departments)) {
      return departments.join(', ');
    }
    return departments || null;
  }

  private static parseJobFunctions(functions: any): string {
    if (Array.isArray(functions)) {
      return functions.join(', ');
    }
    return functions || null;
  }

  private static parseTechnologies(technologies: any): any {
    if (typeof technologies === 'string') {
      try {
        return JSON.parse(technologies);
      } catch {
        return technologies.split(',').map(t => t.trim());
      }
    }
    return technologies || [];
  }

  private static parseApolloTechnologies(technologies: any): any {
    if (Array.isArray(technologies)) {
      return technologies.map(tech => ({
        name: tech,
        category: 'Unknown'
      }));
    }
    return technologies || [];
  }

  private static parseExecutives(executives: any): any {
    if (typeof executives === 'string') {
      try {
        return JSON.parse(executives);
      } catch {
        return [];
      }
    }
    return executives || [];
  }
}

// Prospecting Query Builder
export class ProspectingQueryBuilder {
  static buildZoomInfoPersonSearch(criteria: any) {
    return {
      query: {
        personName: criteria.name,
        companyName: criteria.company,
        jobTitle: criteria.title,
        companyRevenue: { min: criteria.minRevenue, max: criteria.maxRevenue },
        companyEmployees: { min: criteria.minEmployees, max: criteria.maxEmployees },
        managementLevel: criteria.managementLevels || ['C-Level', 'VP', 'Director', 'Manager'],
        departments: criteria.departments || ['IT', 'Finance', 'Operations'],
        locations: criteria.locations || ['United States'],
        industries: criteria.industries,
        intentTopics: criteria.intentTopics || ['Office Technology', 'Managed Print Services']
      },
      sort: { field: 'lastUpdatedDate', direction: 'desc' },
      page: criteria.page || 1,
      rpp: criteria.limit || 100
    };
  }

  static buildApolloPersonSearch(criteria: any) {
    return {
      q_person_name: criteria.name,
      q_person_title: criteria.title,
      q_organization_name: criteria.company,
      person_titles: criteria.titles,
      organization_locations: criteria.locations || ['United States'],
      organization_industries: criteria.industries,
      organization_num_employees_ranges: criteria.employeeRanges,
      person_seniorities: criteria.seniorities || ['c_suite', 'vp', 'director', 'manager'],
      contact_email_status: ['verified'],
      departments: criteria.departments,
      technologies: criteria.technologies,
      page: criteria.page || 1,
      per_page: criteria.limit || 25
    };
  }
}

export default DATA_ENRICHMENT_MAPPINGS;