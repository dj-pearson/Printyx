/**
 * Company Deduplication Service
 * Handles detection and merging of duplicate company records
 *
 * Duplicates are identified by matching: business_name + billing_city + billing_state (case-insensitive)
 * When merging, contacts and related records are moved to the surviving company (oldest record)
 */

import { db } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('company-deduplication-service');

import {
  companies,
  companyContacts,
  enhancedContacts,
  businessRecordActivities,
} from '../../shared/schema';
import { contactMergeHistory } from '../../shared/gdpr-core-schema';

// ============= TYPES =============

export interface Company {
  id: string;
  tenantId: string;
  businessName: string;
  billingCity: string | null;
  billingState: string | null;
  phone: string | null;
  createdAt: Date | null;
  [key: string]: any;
}

export interface DuplicateGroup {
  key: string; // normalized "name|city|state"
  companies: Company[];
  survivorId: string;
  duplicateIds: string[];
  contactCount: number;
}

export interface MergeResult {
  success: boolean;
  survivorId: string;
  mergedCompanyIds: string[];
  contactsMoved: number;
  activitiesMoved: number;
  enhancedContactsMoved: number;
  error?: string;
}

export interface DeduplicationSummary {
  totalCompanies: number;
  duplicateGroups: number;
  totalDuplicates: number;
  groups: DuplicateGroup[];
}

// ============= UTILITY FUNCTIONS =============

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Create a unique key for grouping duplicates
 */
function createGroupKey(company: Company): string {
  const name = normalizeString(company.businessName);
  const city = normalizeString(company.billingCity);
  const state = normalizeString(company.billingState);
  return `${name}|${city}|${state}`;
}

/**
 * Select the survivor from a group of duplicates
 * Strategy: oldest record (by createdAt) wins - most likely to have original data
 */
function selectSurvivor(companies: Company[]): Company {
  return companies.reduce((oldest, current) => {
    if (!oldest.createdAt) return current;
    if (!current.createdAt) return oldest;
    return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
  });
}

// ============= MAIN SERVICE FUNCTIONS =============

/**
 * Find all duplicate groups for a tenant
 * Returns groups where there are 2+ companies with the same name + city + state
 */
export async function findDuplicateGroups(tenantId: string): Promise<DeduplicationSummary> {
  // Fetch all companies for the tenant
  const allCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.tenantId, tenantId))
    .orderBy(companies.createdAt);

  // Group by normalized key
  const groupMap = new Map<string, Company[]>();

  for (const company of allCompanies) {
    const key = createGroupKey(company as Company);
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(company as Company);
  }

  // Filter to only groups with duplicates (count > 1)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, companyList] of groupMap) {
    if (companyList.length > 1) {
      const survivor = selectSurvivor(companyList);
      const duplicateIds = companyList.filter((c) => c.id !== survivor.id).map((c) => c.id);

      // Count contacts for this group
      const contactCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(companyContacts)
        .where(
          inArray(
            companyContacts.companyId,
            companyList.map((c) => c.id),
          ),
        )
        .then((result) => Number(result[0]?.count || 0));

      duplicateGroups.push({
        key,
        companies: companyList,
        survivorId: survivor.id,
        duplicateIds,
        contactCount,
      });
    }
  }

  return {
    totalCompanies: allCompanies.length,
    duplicateGroups: duplicateGroups.length,
    totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.duplicateIds.length, 0),
    groups: duplicateGroups,
  };
}

/**
 * Merge duplicate companies into a survivor
 * - Moves all contacts to survivor
 * - Moves all activities to survivor
 * - Updates enhanced_contacts references
 * - Logs merge history
 * - Deletes duplicate company records
 */
export async function mergeCompanies(
  survivorId: string,
  duplicateIds: string[],
  tenantId: string,
  performedBy?: string,
): Promise<MergeResult> {
  if (!duplicateIds.length) {
    return {
      success: true,
      survivorId,
      mergedCompanyIds: [],
      contactsMoved: 0,
      activitiesMoved: 0,
      enhancedContactsMoved: 0,
    };
  }

  try {
    // Verify survivor exists
    const [survivor] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, survivorId), eq(companies.tenantId, tenantId)));

    if (!survivor) {
      return {
        success: false,
        survivorId,
        mergedCompanyIds: [],
        contactsMoved: 0,
        activitiesMoved: 0,
        enhancedContactsMoved: 0,
        error: `Survivor company ${survivorId} not found`,
      };
    }

    // Get duplicate companies for logging
    const duplicateCompanies = await db
      .select()
      .from(companies)
      .where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));

    // 1. Move company_contacts to survivor
    const contactsResult = await db
      .update(companyContacts)
      .set({ companyId: survivorId, updatedAt: new Date() })
      .where(
        and(
          inArray(companyContacts.companyId, duplicateIds),
          eq(companyContacts.tenantId, tenantId),
        ),
      )
      .returning({ id: companyContacts.id });

    const contactsMoved = contactsResult.length;

    // 2. Move business_record_activities to survivor
    const activitiesResult = await db
      .update(businessRecordActivities)
      .set({ companyId: survivorId, updatedAt: new Date() })
      .where(
        and(
          inArray(businessRecordActivities.companyId, duplicateIds),
          eq(businessRecordActivities.tenantId, tenantId),
        ),
      )
      .returning({ id: businessRecordActivities.id });

    const activitiesMoved = activitiesResult.length;

    // 3. Update enhanced_contacts references
    const enhancedResult = await db
      .update(enhancedContacts)
      .set({ companyId: survivorId, updatedAt: new Date() })
      .where(
        and(
          inArray(enhancedContacts.companyId, duplicateIds),
          eq(enhancedContacts.tenantId, tenantId),
        ),
      )
      .returning({ id: enhancedContacts.id });

    const enhancedContactsMoved = enhancedResult.length;

    // 4. Log merge history for each duplicate
    for (const duplicate of duplicateCompanies) {
      await db.insert(contactMergeHistory).values({
        tenantId,
        sourceContactId: duplicate.id,
        targetContactId: survivorId,
        mergedFields: JSON.stringify({
          type: 'company_merge',
          sourceBusinessName: duplicate.businessName,
          targetBusinessName: survivor.businessName,
          contactsMoved: contactsMoved,
          activitiesMoved: activitiesMoved,
        }),
        mergedBy: performedBy || 'system',
        mergedAt: new Date(),
      });
    }

    // 5. Delete duplicate company records
    await db
      .delete(companies)
      .where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));

    return {
      success: true,
      survivorId,
      mergedCompanyIds: duplicateIds,
      contactsMoved,
      activitiesMoved,
      enhancedContactsMoved,
    };
  } catch (error) {
    log.error('Error merging companies:', error);
    return {
      success: false,
      survivorId,
      mergedCompanyIds: [],
      contactsMoved: 0,
      activitiesMoved: 0,
      enhancedContactsMoved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run full deduplication for a tenant
 * Finds all duplicate groups and merges them
 */
export async function runDeduplication(
  tenantId: string,
  options: { dryRun?: boolean; performedBy?: string } = {},
): Promise<{
  summary: DeduplicationSummary;
  results: MergeResult[];
  dryRun: boolean;
}> {
  const { dryRun = true, performedBy } = options;

  // Find all duplicate groups
  const summary = await findDuplicateGroups(tenantId);

  if (dryRun) {
    // In dry-run mode, just return the summary without making changes
    return {
      summary,
      results: [],
      dryRun: true,
    };
  }

  // Execute merges
  const results: MergeResult[] = [];

  for (const group of summary.groups) {
    const result = await mergeCompanies(
      group.survivorId,
      group.duplicateIds,
      tenantId,
      performedBy,
    );
    results.push(result);
  }

  return {
    summary,
    results,
    dryRun: false,
  };
}

/**
 * Check if a company would be a duplicate before creating
 * Returns the existing company if found, null otherwise
 */
export async function findExistingCompany(
  tenantId: string,
  businessName: string,
  billingCity?: string | null,
  billingState?: string | null,
): Promise<Company | null> {
  const normalizedName = normalizeString(businessName);
  const normalizedCity = normalizeString(billingCity);
  const normalizedState = normalizeString(billingState);

  if (!normalizedName) return null;

  // Find companies with matching name
  const candidates = await db.select().from(companies).where(eq(companies.tenantId, tenantId));

  // Filter to exact match on normalized name + city + state
  const match = candidates.find((c) => {
    const candidateName = normalizeString(c.businessName);
    const candidateCity = normalizeString(c.billingCity);
    const candidateState = normalizeString(c.billingState);

    return (
      candidateName === normalizedName &&
      candidateCity === normalizedCity &&
      candidateState === normalizedState
    );
  });

  return match as Company | null;
}

/**
 * Get detailed info about a specific duplicate group
 */
export async function getDuplicateGroupDetails(
  tenantId: string,
  companyIds: string[],
): Promise<{
  companies: Company[];
  contacts: any[];
  activities: any[];
  recommendedSurvivor: Company;
}> {
  const companyList = await db
    .select()
    .from(companies)
    .where(and(inArray(companies.id, companyIds), eq(companies.tenantId, tenantId)));

  const contacts = await db
    .select()
    .from(companyContacts)
    .where(
      and(inArray(companyContacts.companyId, companyIds), eq(companyContacts.tenantId, tenantId)),
    );

  const activities = await db
    .select()
    .from(businessRecordActivities)
    .where(
      and(
        inArray(businessRecordActivities.companyId, companyIds),
        eq(businessRecordActivities.tenantId, tenantId),
      ),
    );

  const recommendedSurvivor = selectSurvivor(companyList as Company[]);

  return {
    companies: companyList as Company[],
    contacts,
    activities,
    recommendedSurvivor,
  };
}

export default {
  findDuplicateGroups,
  mergeCompanies,
  runDeduplication,
  findExistingCompany,
  getDuplicateGroupDetails,
};
