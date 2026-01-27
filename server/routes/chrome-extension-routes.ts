import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { businessRecords } from '@shared/schema';
import { eq, or, and, sql } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';
import { createApolloClientForTenant } from '../apollo-client';
import { apolloStorage } from '../apollo-storage';
import crypto from 'crypto';

const router = express.Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const quickImportSchema = z.object({
  source: z.enum(['linkedin', 'salesforce']),
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().min(1),
  location: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const checkDuplicateSchema = z.object({
  linkedinUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse full name into first and last name
 */
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const nameParts = fullName.trim().split(/\s+/);

  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }

  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  return { firstName, lastName };
}

/**
 * Enrich contact data using Apollo.io (tenant's API key)
 */
async function enrichViaApollo(
  tenantId: string,
  params: {
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    email?: string;
  },
): Promise<any | null> {
  try {
    const apolloClient = await createApolloClientForTenant(tenantId);

    // Use Apollo's person match endpoint for enrichment
    const person = await apolloClient.enrichPerson({
      first_name: params.firstName,
      last_name: params.lastName,
      organization_name: params.organizationName,
      email: params.email,
    });

    if (person) {
      return {
        email: person.email,
        phone: person.phone_numbers?.[0]?.sanitized_number || person.phone_numbers?.[0]?.raw_number,
        emailStatus: person.email_status,
        linkedinUrl: person.linkedin_url,
        title: person.title,
        seniority: person.seniority,
        departments: person.departments,
        functions: person.functions,
        organizationName: person.organization?.name,
        industry: person.organization?.industry,
        employeeCount: person.organization?.estimated_num_employees,
        companyWebsite: person.organization?.website_url,
        companyDomain: person.organization?.primary_domain,
        city: person.organization?.city,
        state: person.organization?.state,
        country: person.organization?.country,
        apolloId: person.id,
      };
    }

    return null;
  } catch (error: any) {
    console.error('Apollo enrichment error:', error.message);
    return null;
  }
}

/**
 * Check if business record already exists (by LinkedIn URL or email)
 */
async function checkDuplicateRecord(
  tenantId: string,
  params: {
    linkedinUrl?: string;
    email?: string;
    name?: string;
    company?: string;
  },
) {
  const conditions = [eq(businessRecords.tenantId, tenantId)];

  // Primary check: LinkedIn URL (most reliable)
  if (params.linkedinUrl) {
    const normalizedUrl = params.linkedinUrl
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')
      .toLowerCase();

    const [exactMatch] = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          sql`LOWER(REPLACE(REPLACE(${businessRecords.linkedinUrl}, 'https://', ''), 'www.', '')) = ${normalizedUrl}`,
        ),
      )
      .limit(1);

    if (exactMatch) {
      return { exists: true, record: exactMatch, matchType: 'linkedinUrl' };
    }
  }

  // Secondary check: Email (if provided)
  if (params.email) {
    const [emailMatch] = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.email, params.email.toLowerCase()),
        ),
      )
      .limit(1);

    if (emailMatch) {
      return { exists: true, record: emailMatch, matchType: 'email' };
    }
  }

  // Tertiary check: Fuzzy match by name + company
  if (params.name && params.company) {
    const [fuzzyMatch] = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          sql`LOWER(${businessRecords.companyName}) = LOWER(${params.company})`,
          sql`(LOWER(CONCAT(${businessRecords.firstName}, ' ', ${businessRecords.lastName})) = LOWER(${params.name}) OR
               LOWER(CONCAT(${businessRecords.lastName}, ' ', ${businessRecords.firstName})) = LOWER(${params.name}))`,
        ),
      )
      .limit(1);

    if (fuzzyMatch) {
      return { exists: true, record: fuzzyMatch, matchType: 'nameAndCompany' };
    }
  }

  return { exists: false, record: null, matchType: null };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/extension/leads/quick-import
 *
 * Quick import lead from LinkedIn profile
 *
 * Flow:
 * 1. Check for duplicates (LinkedIn URL, email, name+company)
 * 2. If duplicate exists, return existing record
 * 3. If not, enrich via Apollo.io (tenant's API key)
 * 4. Create business_record with enriched data
 * 5. Return created record with enrichment metadata
 */
router.post('/leads/quick-import', isAuthenticated, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.claims?.sub || req.user.id;

    if (!tenantId || !userId) {
      return res.status(403).json({ error: 'No tenant ID or user ID found' });
    }

    // Validate input
    const data = quickImportSchema.parse(req.body);

    // Parse name if not already split
    let firstName = data.firstName;
    let lastName = data.lastName;

    if (!firstName || !lastName) {
      const parsed = parseFullName(data.name);
      firstName = firstName || parsed.firstName;
      lastName = lastName || parsed.lastName;
    }

    console.log(`[Chrome Extension] Quick import request:`, {
      name: data.name,
      company: data.company,
      linkedinUrl: data.linkedinUrl,
      tenantId,
    });

    // Step 1: Check for duplicates
    const duplicateCheck = await checkDuplicateRecord(tenantId, {
      linkedinUrl: data.linkedinUrl,
      email: data.email,
      name: data.name,
      company: data.company,
    });

    if (duplicateCheck.exists) {
      console.log(`[Chrome Extension] Duplicate found via ${duplicateCheck.matchType}`);
      return res.json({
        success: true,
        alreadyExists: true,
        matchType: duplicateCheck.matchType,
        businessRecord: duplicateCheck.record,
        message: `This contact already exists in your CRM (matched by ${duplicateCheck.matchType})`,
      });
    }

    // Step 2: Enrich via Apollo.io (if configured)
    let enrichedData = null;
    let enrichmentSource = 'manual';

    try {
      enrichedData = await enrichViaApollo(tenantId, {
        firstName,
        lastName,
        organizationName: data.company,
        email: data.email,
      });

      if (enrichedData) {
        enrichmentSource = 'apollo';
        console.log(`[Chrome Extension] Enriched via Apollo.io - found email:`, enrichedData.email);
      }
    } catch (error: any) {
      console.log(`[Chrome Extension] Apollo enrichment not available:`, error.message);
      // Continue without enrichment
    }

    // Step 3: Create business record
    const recordData = {
      tenantId,
      recordType: 'lead' as const,
      status: 'new',

      // Basic info from LinkedIn
      firstName: firstName || '',
      lastName: lastName || '',
      jobTitle: data.jobTitle || enrichedData?.title || null,
      companyName: data.company,
      linkedinUrl: data.linkedinUrl || enrichedData?.linkedinUrl || null,

      // Enriched contact info (or from LinkedIn if provided)
      email: enrichedData?.email || data.email || null,
      phone: enrichedData?.phone || data.phone || null,

      // Enriched company info
      website: enrichedData?.companyWebsite || null,
      industry: enrichedData?.industry || null,
      employeeCount: enrichedData?.employeeCount || null,

      // Location
      city: enrichedData?.city || null,
      state: enrichedData?.state || null,
      country: enrichedData?.country || null,

      // Metadata
      leadSource: `Chrome Extension - ${data.source === 'linkedin' ? 'LinkedIn' : 'Salesforce'}`,
      createdBy: userId,
      ownerId: userId,

      // Tags for tracking
      tags:
        enrichmentSource === 'apollo'
          ? ['Apollo.io Enriched', 'Chrome Extension']
          : ['Chrome Extension'],
    };

    const [businessRecord] = await db.insert(businessRecords).values(recordData).returning();

    console.log(`[Chrome Extension] Created business record:`, businessRecord.id);

    // Step 4: Track in Apollo if enriched
    if (enrichmentSource === 'apollo' && enrichedData?.apolloId) {
      try {
        // Store in centralized Apollo contacts cache
        await apolloStorage.createOrUpdateCentralizedContact({
          apolloId: enrichedData.apolloId,
          firstName,
          lastName,
          name: data.name,
          title: enrichedData.title,
          email: enrichedData.email,
          emailStatus: enrichedData.emailStatus,
          linkedinUrl: enrichedData.linkedinUrl,
          phoneNumbers: enrichedData.phone ? [enrichedData.phone] : [],
          organizationName: enrichedData.organizationName,
          industry: enrichedData.industry,
          employeeCount: enrichedData.employeeCount,
          websiteUrl: enrichedData.companyWebsite,
          companyDomain: enrichedData.companyDomain,
          seniority: enrichedData.seniority,
          departments: enrichedData.departments || [],
          functions: enrichedData.functions || [],
          rawData: enrichedData,
        });

        // Track as tenant lead
        await apolloStorage.createTenantLead({
          tenantId,
          apolloContactId: enrichedData.apolloId,
          apolloId: enrichedData.apolloId,
          status: 'added_to_crm',
          addedToCrm: true,
          businessRecordId: businessRecord.id,
          discoveredVia: 'chrome_extension',
          addedAt: new Date(),
          addedBy: userId,
        });
      } catch (storageError) {
        console.error('[Chrome Extension] Failed to track in Apollo storage:', storageError);
        // Non-critical error, continue
      }
    }

    // Step 5: Return response
    return res.json({
      success: true,
      alreadyExists: false,
      businessRecord,
      enrichmentSource,
      enrichedFields: enrichedData
        ? {
            email: !!enrichedData.email,
            phone: !!enrichedData.phone,
            title: !!enrichedData.title,
            company: !!enrichedData.organizationName,
            industry: !!enrichedData.industry,
          }
        : null,
      message:
        enrichmentSource === 'apollo'
          ? 'Contact added and enriched with Apollo.io data'
          : 'Contact added successfully (enrichment not available)',
    });
  } catch (error: any) {
    console.error('[Chrome Extension] Quick import error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to import contact',
      message: error.message,
    });
  }
});

/**
 * GET /api/extension/leads/check-duplicate
 *
 * Check if lead already exists before importing
 * Query params: linkedinUrl, email, name, company
 */
router.get('/leads/check-duplicate', isAuthenticated, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(403).json({ error: 'No tenant ID found' });
    }

    // Validate query params
    const params = checkDuplicateSchema.parse(req.query);

    const duplicateCheck = await checkDuplicateRecord(tenantId, params);

    return res.json({
      exists: duplicateCheck.exists,
      matchType: duplicateCheck.matchType,
      record: duplicateCheck.exists
        ? {
            id: duplicateCheck.record.id,
            name: `${duplicateCheck.record.firstName} ${duplicateCheck.record.lastName}`.trim(),
            email: duplicateCheck.record.email,
            company: duplicateCheck.record.companyName,
            jobTitle: duplicateCheck.record.jobTitle,
            status: duplicateCheck.record.status,
            createdAt: duplicateCheck.record.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error('[Chrome Extension] Duplicate check error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to check for duplicates',
      message: error.message,
    });
  }
});

/**
 * POST /api/extension/auth/generate-key
 *
 * Generate API key for Chrome extension authentication
 * This creates a persistent API key that the extension stores securely
 */
router.post('/auth/generate-key', isAuthenticated, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.claims?.sub || req.user.id;

    if (!tenantId || !userId) {
      return res.status(403).json({ error: 'No tenant ID or user ID found' });
    }

    // Generate a secure random API key
    const apiKey = `pyx_ext_${crypto.randomBytes(32).toString('hex')}`;

    // TODO: Store API key in database (create extension_api_keys table)
    // For now, we'll return it and rely on session-based auth
    // In production, you should:
    // 1. Create a table for API keys
    // 2. Hash the API key before storing
    // 3. Associate with user/tenant
    // 4. Add expiration date
    // 5. Track usage

    return res.json({
      success: true,
      apiKey,
      tenantId,
      userId,
      expiresAt: null, // TODO: Add expiration
      message: 'API key generated successfully. Keep this secure!',
      warning: 'This key will only be shown once. Store it securely in the Chrome extension.',
    });
  } catch (error: any) {
    console.error('[Chrome Extension] API key generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate API key',
      message: error.message,
    });
  }
});

/**
 * GET /api/extension/health
 *
 * Health check endpoint for extension to verify API connectivity
 */
router.get('/health', isAuthenticated, async (req: any, res) => {
  const tenantId = req.user.tenantId;
  const userId = req.user.claims?.sub || req.user.id;

  // Check Apollo.io integration status
  let apolloConfigured = false;
  try {
    const { storage } = await import('../storage');
    const credential = await storage.getIntegrationCredentialByProvider(tenantId, 'apollo');
    apolloConfigured = !!(credential && credential.apiKey && credential.status === 'active');
  } catch (error) {
    // Apollo not configured
  }

  return res.json({
    status: 'healthy',
    version: '1.0.0',
    tenant: {
      id: tenantId,
      userId,
    },
    integrations: {
      apollo: apolloConfigured,
      zoominfo: false, // TODO: Check ZoomInfo when implemented
    },
    features: {
      quickImport: true,
      duplicateCheck: true,
      enrichment: apolloConfigured,
    },
  });
});

export default router;
