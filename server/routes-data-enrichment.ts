// Data Enrichment API Routes - ZoomInfo and Apollo.io Integration
import type { Express } from "express";
import { z } from "zod";
import { db } from "./db";
import { 
  enrichedContacts, 
  enrichedCompanies, 
  enrichedIntentData,
  enrichedOrgHierarchy,
  enrichmentActivities,
  prospectingCampaigns,
  insertEnrichedContactSchema,
  insertEnrichedCompanySchema,
  insertEnrichedIntentDataSchema,
  insertEnrichedOrgHierarchySchema,
  insertEnrichmentActivitySchema,
  insertProspectingCampaignSchema,
  type EnrichedContact,
  type EnrichedCompany,
} from "@shared/schema";
import { eq, and, desc, asc, sql, like, ilike, gt, lt, gte, lte } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth";
import { 
  DATA_ENRICHMENT_MAPPINGS, 
  DataEnrichmentTransformer, 
  ProspectingQueryBuilder 
} from "./data-enrichment-mapping";

// Request validation schemas
const enrichContactSearchSchema = z.object({
  query: z.string().optional(),
  managementLevels: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  companySize: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  leadScore: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  prospectingStatus: z.array(z.string()).optional(),
  enrichmentSource: z.array(z.string()).optional(),
  page: z.number().default(1),
  limit: z.number().default(25),
  sortBy: z.string().default('last_enriched_date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const enrichCompanySearchSchema = z.object({
  query: z.string().optional(),
  industries: z.array(z.string()).optional(),
  companyTypes: z.array(z.string()).optional(),
  employeeCount: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  revenue: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  technologies: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  targetTier: z.array(z.string()).optional(),
  page: z.number().default(1),
  limit: z.number().default(25),
  sortBy: z.string().default('last_enriched_date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const prospectingCampaignSchema = z.object({
  campaign_name: z.string().min(1),
  campaign_description: z.string().optional(),
  campaign_type: z.enum(['email_sequence', 'call_campaign', 'linkedin_outreach', 'multi_channel']),
  target_industries: z.array(z.string()).optional(),
  target_company_sizes: z.array(z.string()).optional(),
  target_job_titles: z.array(z.string()).optional(),
  target_management_levels: z.array(z.string()).optional(),
  target_technologies: z.array(z.string()).optional(),
  sequence_steps: z.array(z.object({
    step_number: z.number(),
    step_type: z.string(),
    delay_days: z.number(),
    template_content: z.string(),
  })).optional(),
});

export function registerDataEnrichmentRoutes(app: Express) {
  
  // =====================================================================
  // ENRICHED CONTACTS ENDPOINTS
  // =====================================================================

  // Get enriched contacts with advanced filtering
  app.get("/api/enrichment/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const searchParams = enrichContactSearchSchema.parse(req.query);
      
      let query = db
        .select()
        .from(enrichedContacts)
        .where(eq(enrichedContacts.tenantId, tenantId));

      // Apply filters
      const conditions = [eq(enrichedContacts.tenantId, tenantId)];

      if (searchParams.query) {
        conditions.push(
          sql`(${enrichedContacts.first_name} ILIKE ${`%${searchParams.query}%`} OR 
               ${enrichedContacts.last_name} ILIKE ${`%${searchParams.query}%`} OR 
               ${enrichedContacts.company_name} ILIKE ${`%${searchParams.query}%`} OR 
               ${enrichedContacts.job_title} ILIKE ${`%${searchParams.query}%`})`
        );
      }

      if (searchParams.managementLevels?.length) {
        conditions.push(sql`${enrichedContacts.management_level} = ANY(${searchParams.managementLevels})`);
      }

      if (searchParams.departments?.length) {
        conditions.push(sql`${enrichedContacts.department} = ANY(${searchParams.departments})`);
      }

      if (searchParams.prospectingStatus?.length) {
        conditions.push(sql`${enrichedContacts.prospecting_status} = ANY(${searchParams.prospectingStatus})`);
      }

      if (searchParams.enrichmentSource?.length) {
        conditions.push(sql`${enrichedContacts.enrichment_source} = ANY(${searchParams.enrichmentSource})`);
      }

      if (searchParams.leadScore?.min !== undefined) {
        conditions.push(gte(enrichedContacts.lead_score, searchParams.leadScore.min));
      }

      if (searchParams.leadScore?.max !== undefined) {
        conditions.push(lte(enrichedContacts.lead_score, searchParams.leadScore.max));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      // Apply sorting
      const orderBy = searchParams.sortOrder === 'asc' 
        ? asc(enrichedContacts[searchParams.sortBy as keyof typeof enrichedContacts])
        : desc(enrichedContacts[searchParams.sortBy as keyof typeof enrichedContacts]);

      const contacts = await db
        .select()
        .from(enrichedContacts)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(searchParams.limit)
        .offset((searchParams.page - 1) * searchParams.limit);

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrichedContacts)
        .where(whereClause);

      const total = totalResult[0]?.count || 0;

      res.json({
        contacts,
        pagination: {
          page: searchParams.page,
          limit: searchParams.limit,
          total,
          totalPages: Math.ceil(total / searchParams.limit),
        },
      });
    } catch (error) {
      console.error("Error fetching enriched contacts:", error);
      res.status(500).json({ message: "Failed to fetch enriched contacts" });
    }
  });

  // Get enriched contact by ID
  app.get("/api/enrichment/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const contact = await db
        .select()
        .from(enrichedContacts)
        .where(and(
          eq(enrichedContacts.id, id),
          eq(enrichedContacts.tenantId, tenantId)
        ))
        .limit(1);

      if (!contact.length) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact[0]);
    } catch (error) {
      console.error("Error fetching enriched contact:", error);
      res.status(500).json({ message: "Failed to fetch enriched contact" });
    }
  });

  // Create/update enriched contact
  app.post("/api/enrichment/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const contactData = insertEnrichedContactSchema.parse({
        ...req.body,
        tenantId,
      });

      const [contact] = await db
        .insert(enrichedContacts)
        .values(contactData)
        .returning();

      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating enriched contact:", error);
      res.status(500).json({ message: "Failed to create enriched contact" });
    }
  });

  // Update enriched contact
  app.put("/api/enrichment/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: new Date() };

      const [contact] = await db
        .update(enrichedContacts)
        .set(updateData)
        .where(and(
          eq(enrichedContacts.id, id),
          eq(enrichedContacts.tenantId, tenantId)
        ))
        .returning();

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error updating enriched contact:", error);
      res.status(500).json({ message: "Failed to update enriched contact" });
    }
  });

  // =====================================================================
  // ENRICHED COMPANIES ENDPOINTS
  // =====================================================================

  // Get enriched companies with advanced filtering
  app.get("/api/enrichment/companies", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const searchParams = enrichCompanySearchSchema.parse(req.query);
      
      const conditions = [eq(enrichedCompanies.tenantId, tenantId)];

      if (searchParams.query) {
        conditions.push(
          sql`(${enrichedCompanies.company_name} ILIKE ${`%${searchParams.query}%`} OR 
               ${enrichedCompanies.primary_domain} ILIKE ${`%${searchParams.query}%`} OR 
               ${enrichedCompanies.primary_industry} ILIKE ${`%${searchParams.query}%`})`
        );
      }

      if (searchParams.industries?.length) {
        conditions.push(sql`${enrichedCompanies.primary_industry} = ANY(${searchParams.industries})`);
      }

      if (searchParams.companyTypes?.length) {
        conditions.push(sql`${enrichedCompanies.company_type} = ANY(${searchParams.companyTypes})`);
      }

      if (searchParams.employeeCount?.min !== undefined) {
        conditions.push(gte(enrichedCompanies.employee_count, searchParams.employeeCount.min));
      }

      if (searchParams.employeeCount?.max !== undefined) {
        conditions.push(lte(enrichedCompanies.employee_count, searchParams.employeeCount.max));
      }

      if (searchParams.revenue?.min !== undefined) {
        conditions.push(gte(enrichedCompanies.annual_revenue, searchParams.revenue.min));
      }

      if (searchParams.revenue?.max !== undefined) {
        conditions.push(lte(enrichedCompanies.annual_revenue, searchParams.revenue.max));
      }

      if (searchParams.targetTier?.length) {
        conditions.push(sql`${enrichedCompanies.target_account_tier} = ANY(${searchParams.targetTier})`);
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      // Apply sorting
      const orderBy = searchParams.sortOrder === 'asc' 
        ? asc(enrichedCompanies[searchParams.sortBy as keyof typeof enrichedCompanies])
        : desc(enrichedCompanies[searchParams.sortBy as keyof typeof enrichedCompanies]);

      const companies = await db
        .select()
        .from(enrichedCompanies)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(searchParams.limit)
        .offset((searchParams.page - 1) * searchParams.limit);

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrichedCompanies)
        .where(whereClause);

      const total = totalResult[0]?.count || 0;

      res.json({
        companies,
        pagination: {
          page: searchParams.page,
          limit: searchParams.limit,
          total,
          totalPages: Math.ceil(total / searchParams.limit),
        },
      });
    } catch (error) {
      console.error("Error fetching enriched companies:", error);
      res.status(500).json({ message: "Failed to fetch enriched companies" });
    }
  });

  // Get enriched company by ID
  app.get("/api/enrichment/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const company = await db
        .select()
        .from(enrichedCompanies)
        .where(and(
          eq(enrichedCompanies.id, id),
          eq(enrichedCompanies.tenantId, tenantId)
        ))
        .limit(1);

      if (!company.length) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company[0]);
    } catch (error) {
      console.error("Error fetching enriched company:", error);
      res.status(500).json({ message: "Failed to fetch enriched company" });
    }
  });

  // Create/update enriched company
  app.post("/api/enrichment/companies", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const companyData = insertEnrichedCompanySchema.parse({
        ...req.body,
        tenantId,
      });

      const [company] = await db
        .insert(enrichedCompanies)
        .values(companyData)
        .returning();

      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating enriched company:", error);
      res.status(500).json({ message: "Failed to create enriched company" });
    }
  });

  // =====================================================================
  // INTENT DATA ENDPOINTS
  // =====================================================================

  // Get intent data for companies
  app.get("/api/enrichment/intent", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { companyId, intentLevel, buyingStage } = req.query;

      let whereConditions = [eq(enrichedIntentData.tenantId, tenantId)];

      if (companyId) {
        whereConditions.push(eq(enrichedIntentData.company_external_id, companyId as string));
      }

      if (intentLevel) {
        whereConditions.push(eq(enrichedIntentData.intent_level, intentLevel as string));
      }

      if (buyingStage) {
        whereConditions.push(eq(enrichedIntentData.buying_stage, buyingStage as string));
      }

      const intentData = await db
        .select()
        .from(enrichedIntentData)
        .where(and(...whereConditions))
        .orderBy(desc(enrichedIntentData.last_activity_date))
        .limit(100);

      res.json(intentData);
    } catch (error) {
      console.error("Error fetching intent data:", error);
      res.status(500).json({ message: "Failed to fetch intent data" });
    }
  });

  // =====================================================================
  // PROSPECTING CAMPAIGNS ENDPOINTS
  // =====================================================================

  // Get prospecting campaigns
  app.get("/api/enrichment/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { status } = req.query;

      let whereConditions = [eq(prospectingCampaigns.tenantId, tenantId)];

      if (status) {
        whereConditions.push(eq(prospectingCampaigns.status, status as string));
      }

      const campaigns = await db
        .select()
        .from(prospectingCampaigns)
        .where(and(...whereConditions))
        .orderBy(desc(prospectingCampaigns.createdAt));

      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Create prospecting campaign
  app.post("/api/enrichment/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.claims.sub;
      
      const campaignData = prospectingCampaignSchema.parse(req.body);
      
      const [campaign] = await db
        .insert(prospectingCampaigns)
        .values({
          ...campaignData,
          tenantId,
          campaign_owner_id: userId,
        })
        .returning();

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  // =====================================================================
  // DATA IMPORT ENDPOINTS
  // =====================================================================

  // Import contacts from ZoomInfo
  app.post("/api/enrichment/import/zoominfo/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { contacts: rawContacts } = req.body;

      if (!Array.isArray(rawContacts)) {
        return res.status(400).json({ message: "Contacts must be an array" });
      }

      const processedContacts = rawContacts.map(contact => {
        const transformed = DataEnrichmentTransformer.transformZoomInfoContact(contact);
        return {
          tenantId,
          zoominfo_contact_id: contact.id,
          first_name: contact.firstName,
          last_name: contact.lastName,
          full_name: contact.name,
          email: contact.email,
          direct_phone: contact.phone,
          mobile_phone: contact.mobile,
          job_title: contact.title,
          management_level: transformed.management_level,
          department: contact.department,
          sub_department: contact.subDepartment,
          job_function: contact.jobFunction,
          company_external_id: contact.companyId,
          company_name: contact.companyName,
          company_domain: contact.companyDomain,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          time_zone: contact.timeZone,
          linkedin_url: contact.linkedInUrl,
          twitter_url: contact.twitterUrl,
          facebook_url: contact.facebookUrl,
          person_score: contact.personScore,
          is_verified: transformed.is_verified,
          work_history: transformed.work_history,
          education_history: transformed.education_history,
          skills: transformed.skills,
          enrichment_source: 'zoominfo',
          last_enriched_date: new Date(),
        };
      });

      const results = await db
        .insert(enrichedContacts)
        .values(processedContacts)
        .returning();

      res.json({
        message: `Successfully imported ${results.length} contacts from ZoomInfo`,
        imported: results.length,
        contacts: results,
      });
    } catch (error) {
      console.error("Error importing ZoomInfo contacts:", error);
      res.status(500).json({ message: "Failed to import ZoomInfo contacts" });
    }
  });

  // Import contacts from Apollo.io
  app.post("/api/enrichment/import/apollo/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { people: rawContacts } = req.body;

      if (!Array.isArray(rawContacts)) {
        return res.status(400).json({ message: "People must be an array" });
      }

      const processedContacts = rawContacts.map(contact => {
        const transformed = DataEnrichmentTransformer.transformApolloContact(contact);
        return {
          tenantId,
          apollo_contact_id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          full_name: contact.name,
          email: contact.email,
          direct_phone: contact.phone,
          mobile_phone: contact.mobile_phone,
          job_title: contact.title,
          management_level: transformed.management_level,
          department: transformed.department,
          job_function: transformed.job_function,
          company_external_id: contact.organization_id,
          company_name: contact.organization_name,
          company_domain: contact.website_url,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          time_zone: contact.time_zone,
          linkedin_url: contact.linkedin_url,
          twitter_url: contact.twitter_url,
          facebook_url: contact.facebook_url,
          person_score: contact.person_score,
          email_verification_status: transformed.email_verification_status,
          work_history: transformed.work_history,
          enrichment_source: 'apollo',
          last_enriched_date: new Date(),
        };
      });

      const results = await db
        .insert(enrichedContacts)
        .values(processedContacts)
        .returning();

      res.json({
        message: `Successfully imported ${results.length} contacts from Apollo.io`,
        imported: results.length,
        contacts: results,
      });
    } catch (error) {
      console.error("Error importing Apollo contacts:", error);
      res.status(500).json({ message: "Failed to import Apollo contacts" });
    }
  });

  // =====================================================================
  // ANALYTICS & REPORTING ENDPOINTS
  // =====================================================================

  // Get enrichment analytics
  app.get("/api/enrichment/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Get contact counts by source
      const contactsBySource = await db
        .select({
          source: enrichedContacts.enrichment_source,
          count: sql<number>`count(*)`,
        })
        .from(enrichedContacts)
        .where(eq(enrichedContacts.tenantId, tenantId))
        .groupBy(enrichedContacts.enrichment_source);

      // Get contact counts by prospecting status
      const contactsByStatus = await db
        .select({
          status: enrichedContacts.prospecting_status,
          count: sql<number>`count(*)`,
        })
        .from(enrichedContacts)
        .where(eq(enrichedContacts.tenantId, tenantId))
        .groupBy(enrichedContacts.prospecting_status);

      // Get contact counts by management level
      const contactsByLevel = await db
        .select({
          level: enrichedContacts.management_level,
          count: sql<number>`count(*)`,
        })
        .from(enrichedContacts)
        .where(eq(enrichedContacts.tenantId, tenantId))
        .groupBy(enrichedContacts.management_level);

      // Get company counts by industry
      const companiesByIndustry = await db
        .select({
          industry: enrichedCompanies.primary_industry,
          count: sql<number>`count(*)`,
        })
        .from(enrichedCompanies)
        .where(eq(enrichedCompanies.tenantId, tenantId))
        .groupBy(enrichedCompanies.primary_industry)
        .limit(10);

      res.json({
        contacts: {
          bySource: contactsBySource,
          byStatus: contactsByStatus,
          byLevel: contactsByLevel,
        },
        companies: {
          byIndustry: companiesByIndustry,
        },
      });
    } catch (error) {
      console.error("Error fetching enrichment analytics:", error);
      res.status(500).json({ message: "Failed to fetch enrichment analytics" });
    }
  });

  // =====================================================================
  // PROSPECTING SEARCH ENDPOINTS
  // =====================================================================

  // Build ZoomInfo search query
  app.post("/api/enrichment/search/zoominfo/build", isAuthenticated, async (req: any, res) => {
    try {
      const searchCriteria = req.body;
      const query = ProspectingQueryBuilder.buildZoomInfoPersonSearch(searchCriteria);
      
      res.json({
        query,
        endpoint: '/search/person',
        method: 'POST',
      });
    } catch (error) {
      console.error("Error building ZoomInfo query:", error);
      res.status(500).json({ message: "Failed to build ZoomInfo query" });
    }
  });

  // Build Apollo search query
  app.post("/api/enrichment/search/apollo/build", isAuthenticated, async (req: any, res) => {
    try {
      const searchCriteria = req.body;
      const query = ProspectingQueryBuilder.buildApolloPersonSearch(searchCriteria);
      
      res.json({
        query,
        endpoint: '/v1/mixed_people/search',
        method: 'POST',
      });
    } catch (error) {
      console.error("Error building Apollo query:", error);
      res.status(500).json({ message: "Failed to build Apollo query" });
    }
  });
}