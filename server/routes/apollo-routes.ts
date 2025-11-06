import express from "express";
import { apolloStorage } from "../apollo-storage";
import { createApolloClientForTenant, ApolloSearchFilters, ApolloContact } from "../apollo-client";
import { db } from "../db";
import { businessRecords } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";

const router = express.Router();

// Helper to transform Apollo contact to our schema
function transformApolloContact(apolloContact: ApolloContact) {
  return {
    apolloId: apolloContact.id,
    firstName: apolloContact.first_name,
    lastName: apolloContact.last_name,
    name: apolloContact.name,
    title: apolloContact.title,
    email: apolloContact.email,
    emailStatus: apolloContact.email_status,
    linkedinUrl: apolloContact.linkedin_url,
    phoneNumbers: apolloContact.phone_numbers?.map(p => p.sanitized_number || p.raw_number) || [],
    organizationId: apolloContact.organization_id,
    organizationName: apolloContact.organization?.name,
    websiteUrl: apolloContact.organization?.website_url,
    companyDomain: apolloContact.organization?.primary_domain,
    companySize: apolloContact.organization?.num_employees_enum,
    employeeCount: apolloContact.organization?.estimated_num_employees,
    industry: apolloContact.organization?.industry,
    companyLocation: apolloContact.organization?.city 
      ? `${apolloContact.organization.city}, ${apolloContact.organization.state || ''} ${apolloContact.organization.country || ''}`.trim()
      : null,
    seniority: apolloContact.seniority,
    departments: apolloContact.departments || [],
    functions: apolloContact.functions || [],
    rawData: apolloContact,
  };
}

// POST /api/apollo/search - Search for leads with filters
router.post("/search", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const filters: ApolloSearchFilters = req.body;
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

    // Generate search hash for caching
    const searchHash = apolloStorage.generateSearchHash(filters);

    // Check cache first
    const cached = await apolloStorage.getSearchCache(searchHash);
    if (cached && cached.apolloIds) {
      console.log(`Cache hit for search ${searchHash}`);
      
      // Get full contact data from centralized cache
      const contacts = await apolloStorage.getCentralizedContactsByIds(cached.apolloIds as string[]);
      
      // Check which contacts this tenant has already seen
      const tenantLeadPromises = contacts.map(c => 
        apolloStorage.getTenantLeadByApolloId(c.apolloId, tenantId)
      );
      const tenantLeads = await Promise.all(tenantLeadPromises);
      
      // Merge contact data with tenant status
      const results = contacts.map((contact, idx) => ({
        ...contact,
        tenantStatus: tenantLeads[idx]?.status || "new",
        addedToCrm: tenantLeads[idx]?.addedToCrm || false,
        tenantLeadId: tenantLeads[idx]?.id,
      }));

      return res.json({
        contacts: results,
        pagination: {
          page: filters.page || 1,
          perPage: filters.perPage || 25,
          totalEntries: cached.totalAvailable,
          totalPages: Math.ceil(cached.totalAvailable / (filters.perPage || 25)),
        },
        fromCache: true,
      });
    }

    // Cache miss - call Apollo API
    console.log(`Cache miss for search ${searchHash} - calling Apollo API`);
    const startTime = Date.now();
    
    // Get tenant-specific Apollo client
    const apolloClient = await createApolloClientForTenant(tenantId);
    const apolloResponse = await apolloClient.searchPeople(filters);
    
    const responseTime = Date.now() - startTime;

    // Track API usage
    await apolloStorage.trackApiUsage({
      tenantId,
      endpoint: "/v1/mixed_people/search",
      method: "POST",
      requestParams: filters,
      statusCode: 200,
      success: true,
      creditsUsed: 1,
      responseTimeMs: responseTime,
      userId,
    });

    // Store contacts in centralized cache
    const contactPromises = apolloResponse.people.map(async (apolloContact) => {
      const transformed = transformApolloContact(apolloContact);
      return await apolloStorage.createOrUpdateCentralizedContact(transformed);
    });
    const storedContacts = await Promise.all(contactPromises);

    // Create search cache entry (expires in 1 hour)
    await apolloStorage.createSearchCache({
      searchHash,
      searchFilters: filters,
      resultCount: apolloResponse.people.length,
      totalAvailable: apolloResponse.pagination.total_entries,
      apolloIds: storedContacts.map(c => c.apolloId),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      apiCreditsUsed: 1,
    });

    // Check tenant status for each contact
    const tenantLeadPromises = storedContacts.map(c => 
      apolloStorage.getTenantLeadByApolloId(c.apolloId, tenantId)
    );
    const tenantLeads = await Promise.all(tenantLeadPromises);

    const results = storedContacts.map((contact, idx) => ({
      ...contact,
      tenantStatus: tenantLeads[idx]?.status || "new",
      addedToCrm: tenantLeads[idx]?.addedToCrm || false,
      tenantLeadId: tenantLeads[idx]?.id,
    }));

    return res.json({
      contacts: results,
      pagination: apolloResponse.pagination,
      fromCache: false,
    });
  } catch (error: any) {
    console.error("Apollo search error:", error);
    
    // Track failed API call
    if (req.session?.user) {
      await apolloStorage.trackApiUsage({
        tenantId: req.session.user.tenantId,
        endpoint: "/v1/mixed_people/search",
        method: "POST",
        requestParams: req.body,
        statusCode: error.response?.status || 500,
        success: false,
        errorMessage: error.message,
        creditsUsed: 0,
        userId: req.session.user.id,
      });
    }

    return res.status(500).json({ 
      error: "Failed to search leads", 
      message: error.message 
    });
  }
});

// POST /api/apollo/leads/:contactId/add-to-crm - Add single lead to CRM
router.post("/leads/:contactId/add-to-crm", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    if (!tenantId || !userId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const { contactId } = req.params;

    // Get contact from centralized cache
    const contact = await apolloStorage.getCentralizedContact(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Check if already added
    const existingLead = await apolloStorage.getTenantLeadByApolloId(contactId, tenantId);
    if (existingLead?.addedToCrm) {
      return res.status(400).json({ 
        error: "Lead already added to CRM",
        businessRecordId: existingLead.businessRecordId 
      });
    }

    // Check for duplicate in business records by email
    if (contact.email) {
      const [duplicate] = await db
        .select()
        .from(businessRecords)
        .where(eq(businessRecords.email, contact.email))
        .limit(1);
      
      if (duplicate) {
        return res.status(400).json({
          error: "Contact with this email already exists in CRM",
          existingRecord: duplicate,
        });
      }
    }

    // Create business record
    const [businessRecord] = await db
      .insert(businessRecords)
      .values({
        tenantId,
        recordType: "lead",
        status: "new",
        companyName: contact.organizationName || "Unknown Company",
        website: contact.websiteUrl,
        industry: contact.industry,
        employeeCount: contact.employeeCount,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phoneNumbers?.[0] || null,
        jobTitle: contact.title,
        linkedinUrl: contact.linkedinUrl,
        leadSource: "Apollo.io",
        createdBy: userId,
        ownerId: userId,
      })
      .returning();

    // Create or update tenant lead record
    if (existingLead) {
      await apolloStorage.markLeadAsAddedToCrm(
        existingLead.id,
        tenantId,
        userId,
        businessRecord.id
      );
    } else {
      await apolloStorage.createTenantLead({
        tenantId,
        apolloContactId: contact.id,
        apolloId: contact.apolloId,
        status: "added_to_crm",
        addedToCrm: true,
        businessRecordId: businessRecord.id,
        discoveredVia: "apollo_search",
        addedAt: new Date(),
        addedBy: userId,
      });
    }

    return res.json({
      success: true,
      businessRecord,
      message: "Lead successfully added to CRM",
    });
  } catch (error: any) {
    console.error("Add to CRM error:", error);
    return res.status(500).json({ 
      error: "Failed to add lead to CRM", 
      message: error.message 
    });
  }
});

// POST /api/apollo/leads/bulk-add - Bulk add leads to CRM
router.post("/leads/bulk-add", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    if (!tenantId || !userId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const { contactIds } = req.body as { contactIds: string[] };

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "contactIds array is required" });
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const contactId of contactIds) {
      try {
        const contact = await apolloStorage.getCentralizedContact(contactId);
        if (!contact) {
          results.errors.push(`Contact ${contactId} not found`);
          results.skipped++;
          continue;
        }

        // Check if already added
        const existingLead = await apolloStorage.getTenantLeadByApolloId(contactId, tenantId);
        if (existingLead?.addedToCrm) {
          results.skipped++;
          continue;
        }

        // Check for duplicate email
        if (contact.email) {
          const [duplicate] = await db
            .select()
            .from(businessRecords)
            .where(eq(businessRecords.email, contact.email))
            .limit(1);
          
          if (duplicate) {
            results.skipped++;
            continue;
          }
        }

        // Create business record
        const [businessRecord] = await db
          .insert(businessRecords)
          .values({
            tenantId,
            recordType: "lead",
            status: "new",
            companyName: contact.organizationName || "Unknown Company",
            website: contact.websiteUrl,
            industry: contact.industry,
            employeeCount: contact.employeeCount,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phoneNumbers?.[0] || null,
            jobTitle: contact.title,
            linkedinUrl: contact.linkedinUrl,
            leadSource: "Apollo.io",
            createdBy: userId,
            ownerId: userId,
          })
          .returning();

        // Create or update tenant lead record
        if (existingLead) {
          await apolloStorage.markLeadAsAddedToCrm(
            existingLead.id,
            tenantId,
            userId,
            businessRecord.id
          );
        } else {
          await apolloStorage.createTenantLead({
            tenantId,
            apolloContactId: contact.id,
            apolloId: contact.apolloId,
            status: "added_to_crm",
            addedToCrm: true,
            businessRecordId: businessRecord.id,
            discoveredVia: "apollo_search",
            addedAt: new Date(),
            addedBy: userId,
          });
        }

        results.added++;
      } catch (error: any) {
        results.errors.push(`Failed to add ${contactId}: ${error.message}`);
        results.skipped++;
      }
    }

    return res.json(results);
  } catch (error: any) {
    console.error("Bulk add error:", error);
    return res.status(500).json({ 
      error: "Failed to bulk add leads", 
      message: error.message 
    });
  }
});

// GET /api/apollo/stats - Get API usage stats
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const stats = await apolloStorage.getApiUsageStats(tenantId, startDate, endDate);

    return res.json(stats);
  } catch (error: any) {
    console.error("Stats error:", error);
    return res.status(500).json({ 
      error: "Failed to get stats", 
      message: error.message 
    });
  }
});

// ============================================================================
// APOLLO.IO CREDENTIAL MANAGEMENT - Admin endpoints for tenant API key configuration
// ============================================================================

// GET /api/apollo/credentials - Get tenant's Apollo.io credentials (masked)
router.get("/credentials", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const { storage } = await import("../storage");
    const credential = await storage.getIntegrationCredentialByProvider(tenantId, "apollo");

    if (!credential) {
      return res.json({ configured: false });
    }

    // Return masked credentials (never expose actual API key)
    return res.json({
      configured: true,
      id: credential.id,
      status: credential.status,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      apiKeyMasked: credential.credentials?.api_key 
        ? `${String(credential.credentials.api_key).substring(0, 10)}...${String(credential.credentials.api_key).slice(-4)}`
        : null,
      metadata: credential.metadata,
    });
  } catch (error: any) {
    console.error("Get credentials error:", error);
    return res.status(500).json({ 
      error: "Failed to get credentials", 
      message: error.message 
    });
  }
});

// POST /api/apollo/credentials - Save Apollo.io API key for tenant
router.post("/credentials", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    
    if (!tenantId || !userId) {
      return res.status(403).json({ error: "No tenant ID or user ID found" });
    }

    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "API key is required" });
    }

    const { storage } = await import("../storage");
    
    // Check if credential already exists
    const existing = await storage.getIntegrationCredentialByProvider(tenantId, "apollo");

    if (existing) {
      // Update existing credential
      const updated = await storage.updateIntegrationCredential(
        existing.id,
        tenantId,
        {
          credentials: { api_key: apiKey.trim() },
          status: "active",
          updatedBy: userId,
          updatedAt: new Date(),
          metadata: {
            ...existing.metadata,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
          },
        }
      );

      return res.json({
        success: true,
        message: "Apollo.io API key updated successfully",
        credentialId: updated?.id,
      });
    } else {
      // Create new credential
      const created = await storage.createIntegrationCredential({
        tenantId,
        provider: "apollo",
        integrationName: "Apollo.io Lead Enrichment",
        providerType: "data_enrichment",
        credentials: { api_key: apiKey.trim() },
        status: "active",
        createdBy: userId,
        updatedBy: userId,
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: userId,
        },
      });

      return res.json({
        success: true,
        message: "Apollo.io API key saved successfully",
        credentialId: created.id,
      });
    }
  } catch (error: any) {
    console.error("Save credentials error:", error);
    return res.status(500).json({ 
      error: "Failed to save credentials", 
      message: error.message 
    });
  }
});

// POST /api/apollo/credentials/verify - Test Apollo.io API key
router.post("/credentials/verify", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const { apiKey } = req.body;
    
    // If apiKey provided, test it directly (before saving)
    // Otherwise, test the saved credential
    let testApiKey: string;
    
    if (apiKey) {
      testApiKey = apiKey.trim();
    } else {
      const { storage } = await import("../storage");
      const credential = await storage.getIntegrationCredentialByProvider(tenantId, "apollo");
      
      if (!credential || !credential.credentials?.api_key) {
        return res.status(400).json({ 
          valid: false,
          error: "No API key configured. Please save an API key first." 
        });
      }
      
      testApiKey = credential.credentials.api_key as string;
    }

    // Test the API key with a minimal search
    const { ApolloClient } = await import("../apollo-client");
    const testClient = new ApolloClient(testApiKey);
    
    const startTime = Date.now();
    await testClient.searchPeople({
      page: 1,
      perPage: 1,
      personTitles: ["CEO"], // Minimal test query
    });
    const responseTime = Date.now() - startTime;

    return res.json({
      valid: true,
      message: "API key is valid and working",
      responseTimeMs: responseTime,
    });
  } catch (error: any) {
    console.error("Verify credentials error:", error);
    
    // Parse error message for better user feedback
    if (error.message?.includes("401") || error.message?.includes("403")) {
      return res.json({
        valid: false,
        error: "Invalid API key. Please check your Apollo.io API key and try again.",
      });
    }
    
    return res.json({
      valid: false,
      error: `Failed to verify API key: ${error.message}`,
    });
  }
});

// DELETE /api/apollo/credentials/:id - Remove Apollo.io credentials
router.delete("/credentials/:id", isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant ID found" });
    }

    const { id } = req.params;
    const { storage } = await import("../storage");

    await storage.deleteIntegrationCredential(id, tenantId);

    return res.json({
      success: true,
      message: "Apollo.io credentials removed successfully",
    });
  } catch (error: any) {
    console.error("Delete credentials error:", error);
    return res.status(500).json({ 
      error: "Failed to delete credentials", 
      message: error.message 
    });
  }
});

export default router;
