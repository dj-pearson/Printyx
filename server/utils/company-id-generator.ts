import { eq, sql, and } from "drizzle-orm";
import { businessRecords } from "../../shared/schema.js";
import { db } from "../db.js";

/**
 * Generates a unique 8-digit company display ID
 * Format: Random 8-digit number (e.g., "43443425")
 */
export async function generateCompanyDisplayId(tenantId: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Generate random 8-digit number
    const displayId = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    // Check if this ID already exists in this tenant
    const existing = await db
      .select({ id: businessRecords.id })
      .from(businessRecords)
      .where(
        sql`${businessRecords.tenantId} = ${tenantId} AND ${businessRecords.companyDisplayId} = ${displayId}`
      )
      .limit(1);

    if (existing.length === 0) {
      return displayId;
    }

    attempts++;
  }

  // Fallback: use timestamp-based ID if random generation fails
  const timestamp = Date.now().toString();
  return timestamp.slice(-8).padStart(8, '0');
}

/**
 * Generates a URL-friendly slug from company name and display ID
 * Format: "{recordType}-{company-name-slug}-{displayId}"
 * Example: "customer-new-customer-company-43443425"
 */
export function generateUrlSlug(
  recordType: string, 
  companyName: string, 
  displayId: string
): string {
  // Clean and normalize the company name
  const cleanCompanyName = companyName
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and dashes
    .replace(/[^a-z0-9\s\-]/g, '')
    // Replace multiple spaces/dashes with single dash
    .replace(/[\s\-]+/g, '-')
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, '')
    // Limit length to avoid extremely long URLs
    .substring(0, 50)
    .replace(/-+$/, ''); // Remove trailing dashes after truncation

  // Ensure we have a valid company name part
  const companySlug = cleanCompanyName || 'company';
  
  return `${recordType}-${companySlug}-${displayId}`;
}

/**
 * Validates that a URL slug is unique within a tenant
 */
export async function isSlugUnique(slug: string, tenantId: string, excludeId?: string): Promise<boolean> {
  let whereCondition = and(
    eq(businessRecords.tenantId, tenantId),
    eq(businessRecords.urlSlug, slug)
  );

  if (excludeId) {
    whereCondition = and(
      eq(businessRecords.tenantId, tenantId),
      eq(businessRecords.urlSlug, slug),
      sql`${businessRecords.id} != ${excludeId}`
    );
  }

  const existing = await db
    .select({ id: businessRecords.id })
    .from(businessRecords)
    .where(whereCondition)
    .limit(1);

  return existing.length === 0;
}

/**
 * Generates a unique URL slug, adding a suffix if needed
 */
export async function generateUniqueUrlSlug(
  recordType: string,
  companyName: string,
  displayId: string,
  tenantId: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = generateUrlSlug(recordType, companyName, displayId);
  
  // Check if base slug is unique
  if (await isSlugUnique(baseSlug, tenantId, excludeId)) {
    return baseSlug;
  }

  // If not unique, try adding a suffix
  for (let i = 2; i <= 10; i++) {
    const suffixedSlug = `${baseSlug}-${i}`;
    if (await isSlugUnique(suffixedSlug, tenantId, excludeId)) {
      return suffixedSlug;
    }
  }

  // Fallback: add timestamp suffix
  const timestamp = Date.now().toString().slice(-6);
  return `${baseSlug}-${timestamp}`;
}

/**
 * Updates an existing business record with display ID and URL slug
 */
export async function updateBusinessRecordWithIdentifiers(
  recordId: string,
  tenantId: string,
  recordType: string,
  companyName: string
): Promise<{ companyDisplayId: string; urlSlug: string }> {
  const displayId = await generateCompanyDisplayId(tenantId);
  const urlSlug = await generateUniqueUrlSlug(recordType, companyName, displayId, tenantId, recordId);

  await db
    .update(businessRecords)
    .set({
      companyDisplayId: displayId,
      urlSlug: urlSlug,
      updatedAt: new Date()
    })
    .where(eq(businessRecords.id, recordId));

  return { companyDisplayId: displayId, urlSlug };
}

/**
 * Batch update existing records without display IDs
 */
export async function backfillExistingRecords(tenantId: string, limit = 100): Promise<number> {
  // Get records without display IDs
  const recordsToUpdate = await db
    .select({
      id: businessRecords.id,
      recordType: businessRecords.recordType,
      companyName: businessRecords.companyName
    })
    .from(businessRecords)
    .where(
      sql`${businessRecords.tenantId} = ${tenantId} AND ${businessRecords.companyDisplayId} IS NULL`
    )
    .limit(limit);

  let updatedCount = 0;

  for (const record of recordsToUpdate) {
    try {
      await updateBusinessRecordWithIdentifiers(
        record.id,
        tenantId,
        record.recordType || 'lead',
        record.companyName || 'Unnamed Company'
      );
      updatedCount++;
    } catch (error) {
      console.error(`Failed to update record ${record.id}:`, error);
    }
  }

  return updatedCount;
}