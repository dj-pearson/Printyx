/**
 * Business Record Updater
 * Creates new leads in the business_records table
 */

import { BaseUpdater, UpdaterOptions } from '../core/BaseUpdater';
import { db } from '../../db';
import { businessRecords } from '../../../shared/schema';

export interface BusinessRecordData {
  id: string;
  tenantId: string;
  recordType: string;
  status: string;
  companyName: string;
  website?: string;
  industry: string;
  companySize?: string;
  annualRevenue?: number;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  primaryContactTitle?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  source: string;
  interestLevel?: string;
  accountManagerId?: string;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  salesStage?: string;
  estimatedDealValue?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessRecordUpdater extends BaseUpdater {
  private leadSources = {
    'website': 0.30,
    'referral': 0.25,
    'cold_call': 0.15,
    'trade_show': 0.10,
    'social_media': 0.10,
    'advertisement': 0.05,
    'partner': 0.05,
  };

  private industries = {
    'healthcare': 0.20,
    'legal': 0.15,
    'education': 0.15,
    'manufacturing': 0.12,
    'retail': 0.10,
    'professional_services': 0.10,
    'government': 0.08,
    'non_profit': 0.05,
    'real_estate': 0.05,
  };

  private companySizes = {
    '1-10': 0.25,
    '11-50': 0.30,
    '51-200': 0.25,
    '201-500': 0.15,
    '500+': 0.05,
  };

  private interestLevels = {
    'cold': 0.30,
    'warm': 0.40,
    'hot': 0.25,
    'qualified': 0.05,
  };

  private salesStages = {
    'initial_contact': 0.40,
    'qualified': 0.25,
    'needs_analysis': 0.20,
    'proposal': 0.10,
    'negotiation': 0.05,
  };

  constructor(options: UpdaterOptions) {
    super('business_records', options);
  }

  /**
   * Validate execution conditions
   */
  protected async validateExecution(): Promise<void> {
    // No specific validation needed for creating new leads
    this.logger.debug('Business record updater validation complete');
  }

  /**
   * Generate new lead records
   */
  protected async generateData(): Promise<BusinessRecordData[]> {
    const leads: BusinessRecordData[] = [];
    
    // Generate 1 new lead per execution (daily frequency)
    const leadCount = 1;
    
    for (let i = 0; i < leadCount; i++) {
      const lead = await this.generateSingleLead();
      leads.push(lead);
    }

    return leads;
  }

  /**
   * Insert leads into database
   */
  protected async insertData(leads: BusinessRecordData[]): Promise<number> {
    if (this.dryRun) {
      this.logger.info(`DRY RUN: Would insert ${leads.length} new leads`);
      return leads.length;
    }

    try {
      // Insert leads in a transaction
      await db.transaction(async (tx) => {
        for (const lead of leads) {
          await tx.insert(businessRecords).values({
            id: lead.id,
            tenantId: lead.tenantId,
            recordType: lead.recordType,
            status: lead.status,
            companyName: lead.companyName,
            website: lead.website,
            industry: lead.industry,
            companySize: lead.companySize,
            annualRevenue: lead.annualRevenue,
            primaryContactName: lead.primaryContactName,
            primaryContactEmail: lead.primaryContactEmail,
            primaryContactPhone: lead.primaryContactPhone,
            primaryContactTitle: lead.primaryContactTitle,
            addressLine1: lead.addressLine1,
            city: lead.city,
            state: lead.state,
            postalCode: lead.postalCode,
            country: lead.country,
            source: lead.source,
            interestLevel: lead.interestLevel,
            accountManagerId: lead.accountManagerId,
            lastContactDate: lead.lastContactDate,
            nextFollowUpDate: lead.nextFollowUpDate,
            salesStage: lead.salesStage,
            estimatedDealValue: lead.estimatedDealValue,
            createdBy: lead.createdBy,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
          });
        }
      });

      this.logger.info(`Successfully inserted ${leads.length} new leads`);
      return leads.length;
    } catch (error) {
      this.logger.error('Failed to insert new leads', error);
      throw error;
    }
  }

  /**
   * Generate a single realistic lead
   */
  private async generateSingleLead(): Promise<BusinessRecordData> {
    const industry = this.selectFromDistribution(this.industries);
    const source = this.selectFromDistribution(this.leadSources);
    const companySize = this.selectFromDistribution(this.companySizes);
    const interestLevel = this.selectFromDistribution(this.interestLevels);
    const salesStage = this.selectFromDistribution(this.salesStages);
    
    const companyName = this.generateCompanyName(industry);
    const contactInfo = this.generateContactInfo(companyName);
    const address = this.generateAddress();

    const lead: BusinessRecordData = {
      id: this.generateUuid(),
      tenantId: this.tenantId,
      recordType: 'lead',
      status: 'new',
      companyName,
      website: this.generateWebsite(companyName),
      industry,
      companySize,
      annualRevenue: this.generateAnnualRevenue(companySize),
      primaryContactName: contactInfo.name,
      primaryContactEmail: contactInfo.email,
      primaryContactPhone: contactInfo.phone,
      primaryContactTitle: contactInfo.title,
      addressLine1: address.line1,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: 'US',
      source,
      interestLevel,
      salesStage,
      estimatedDealValue: this.generateEstimatedDealValue(companySize, industry),
      nextFollowUpDate: this.generateFollowUpDate(),
      createdBy: 'system-user', // You might want to fetch actual user IDs
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Set last contact date for some leads
    if (Math.random() > 0.3) {
      lead.lastContactDate = this.generateRecentContactDate();
    }

    return lead;
  }

  /**
   * Generate realistic company names based on industry
   */
  private generateCompanyName(industry: string): string {
    const industryPrefixes = {
      healthcare: ['MedCare', 'HealthFirst', 'Care', 'Medical', 'Wellness', 'Premier Health'],
      legal: ['Law Offices of', 'Legal Services', 'Associates', 'Partners', 'Legal Group'],
      education: ['Academy', 'Learning Center', 'Educational', 'School District', 'University'],
      manufacturing: ['Industries', 'Manufacturing', 'Systems', 'Technologies', 'Solutions'],
      retail: ['Retail Group', 'Store', 'Market', 'Shopping', 'Commerce'],
      professional_services: ['Consulting', 'Services', 'Professional', 'Advisory', 'Group'],
      government: ['Department of', 'City of', 'County', 'Municipal', 'Public'],
      non_profit: ['Foundation', 'Organization', 'Society', 'Association', 'Institute'],
      real_estate: ['Properties', 'Realty', 'Real Estate', 'Development', 'Holdings'],
    };

    const commonSuffixes = ['Inc', 'LLC', 'Corp', 'Co', 'Group', 'Associates', 'Partners'];
    
    const prefixes = industryPrefixes[industry as keyof typeof industryPrefixes] || ['Company'];
    const businessNames = [
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Prime', 'Apex', 'Elite', 'Summit', 'Pinnacle',
      'Metro', 'Central', 'Regional', 'National', 'Global', 'United', 'American', 'First',
      'Advanced', 'Progressive', 'Modern', 'Innovative', 'Creative', 'Dynamic', 'Strategic',
      'Reliable', 'Quality', 'Premier', 'Professional', 'Excellence', 'Superior', 'Optimal',
    ];

    const prefix = this.randomFromArray(prefixes);
    const businessName = this.randomFromArray(businessNames);
    const suffix = this.randomFromArray(commonSuffixes);

    // Different naming patterns
    const patterns = [
      `${businessName} ${prefix}`,
      `${prefix} ${businessName}`,
      `${businessName} ${prefix} ${suffix}`,
      `${businessName} ${suffix}`,
    ];

    return this.randomFromArray(patterns);
  }

  /**
   * Generate contact information
   */
  private generateContactInfo(companyName: string) {
    const firstNames = [
      'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
      'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
      'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol',
      'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul',
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
      'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    ];

    const titles = [
      'Office Manager', 'Operations Manager', 'General Manager', 'Executive Assistant',
      'Facilities Manager', 'IT Manager', 'Administrative Manager', 'Business Manager',
      'Director of Operations', 'VP Operations', 'CFO', 'CEO', 'President', 'Owner',
      'Purchasing Manager', 'Facilities Coordinator', 'Office Administrator',
    ];

    const firstName = this.randomFromArray(firstNames);
    const lastName = this.randomFromArray(lastNames);
    const title = this.randomFromArray(titles);

    // Generate email based on name and company
    const emailDomain = this.generateEmailDomain(companyName);
    const emailPatterns = [
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}@${emailDomain}`,
      `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${emailDomain}`,
    ];

    return {
      name: `${firstName} ${lastName}`,
      email: this.randomFromArray(emailPatterns),
      phone: this.generatePhoneNumber(),
      title,
    };
  }

  /**
   * Generate email domain from company name
   */
  private generateEmailDomain(companyName: string): string {
    // Simplify company name for domain
    let domain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/(inc|llc|corp|co|group|associates|partners)$/i, '');

    // Truncate if too long
    if (domain.length > 15) {
      domain = domain.substring(0, 15);
    }

    return `${domain}.com`;
  }

  /**
   * Generate website URL
   */
  private generateWebsite(companyName: string): string {
    const domain = this.generateEmailDomain(companyName);
    return `https://www.${domain}`;
  }

  /**
   * Generate phone number
   */
  private generatePhoneNumber(): string {
    const area = this.randomInRange(200, 999);
    const exchange = this.randomInRange(200, 999);
    const number = this.randomInRange(1000, 9999);
    
    return `(${area}) ${exchange}-${number}`;
  }

  /**
   * Generate address information
   */
  private generateAddress() {
    const streetNumbers = this.randomInRange(100, 9999);
    const streetNames = [
      'Main St', 'First St', 'Second St', 'Park Ave', 'Oak St', 'Pine St', 'Maple Ave',
      'Cedar St', 'Elm St', 'Washington St', 'Lincoln Ave', 'Jefferson St', 'Madison Ave',
      'Jackson St', 'Franklin St', 'Business Pkwy', 'Corporate Blvd', 'Industrial Way',
      'Technology Dr', 'Commerce St', 'Professional Dr', 'Executive Blvd',
    ];

    const cities = [
      'Springfield', 'Franklin', 'Greenville', 'Bristol', 'Clinton', 'Georgetown',
      'Arlington', 'Fairview', 'Madison', 'Washington', 'Chester', 'Marion',
      'Oxford', 'Ashland', 'Burlington', 'Manchester', 'Auburn', 'Salem',
    ];

    const states = [
      'NY', 'CA', 'TX', 'FL', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI',
      'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
    ];

    return {
      line1: `${streetNumbers} ${this.randomFromArray(streetNames)}`,
      city: this.randomFromArray(cities),
      state: this.randomFromArray(states),
      postalCode: String(this.randomInRange(10000, 99999)),
    };
  }

  /**
   * Generate annual revenue based on company size
   */
  private generateAnnualRevenue(companySize: string): number {
    const revenueRanges = {
      '1-10': { min: 100000, max: 1000000 },
      '11-50': { min: 500000, max: 5000000 },
      '51-200': { min: 2000000, max: 20000000 },
      '201-500': { min: 10000000, max: 50000000 },
      '500+': { min: 25000000, max: 500000000 },
    };

    const range = revenueRanges[companySize as keyof typeof revenueRanges] || revenueRanges['11-50'];
    return this.randomInRange(range.min, range.max);
  }

  /**
   * Generate estimated deal value based on company size and industry
   */
  private generateEstimatedDealValue(companySize: string, industry: string): number {
    const baseDealValues = {
      '1-10': { min: 5000, max: 25000 },
      '11-50': { min: 15000, max: 75000 },
      '51-200': { min: 35000, max: 150000 },
      '201-500': { min: 75000, max: 300000 },
      '500+': { min: 150000, max: 1000000 },
    };

    // Industry multipliers
    const industryMultipliers = {
      healthcare: 1.3,
      legal: 1.2,
      education: 0.8,
      manufacturing: 1.4,
      retail: 1.1,
      professional_services: 1.0,
      government: 0.9,
      non_profit: 0.7,
      real_estate: 1.1,
    };

    const baseRange = baseDealValues[companySize as keyof typeof baseDealValues] || baseDealValues['11-50'];
    const multiplier = industryMultipliers[industry as keyof typeof industryMultipliers] || 1.0;

    const minValue = Math.round(baseRange.min * multiplier);
    const maxValue = Math.round(baseRange.max * multiplier);

    return this.randomInRange(minValue, maxValue);
  }

  /**
   * Generate follow-up date (1-5 business days out)
   */
  private generateFollowUpDate(): Date {
    const daysOut = this.randomInRange(1, 5);
    return this.generateBusinessHoursDate(daysOut);
  }

  /**
   * Generate recent contact date (within last 2 weeks)
   */
  private generateRecentContactDate(): Date {
    const daysBack = this.randomInRange(1, 14);
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    
    // Set random business hour
    const hour = this.randomInRange(9, 17);
    const minute = this.randomInRange(0, 59);
    date.setHours(hour, minute, 0, 0);
    
    return date;
  }
}

export default BusinessRecordUpdater;
