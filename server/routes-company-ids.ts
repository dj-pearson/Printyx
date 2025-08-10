import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "./db";
import { businessRecords } from "../shared/schema";
import { 
  generateCompanyDisplayId, 
  generateUniqueUrlSlug, 
  updateBusinessRecordWithIdentifiers,
  backfillExistingRecords 
} from "./utils/company-id-generator";

const router = Router();

// Simple auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId
    };
  }
  
  next();
};

// Generate display ID and URL slug for a specific business record
router.post("/generate/:recordId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const { recordId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Get the business record
    const record = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.id, recordId),
          eq(businessRecords.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!record[0]) {
      return res.status(404).json({ error: "Business record not found" });
    }

    const businessRecord = record[0];
    
    // Generate identifiers
    const result = await updateBusinessRecordWithIdentifiers(
      recordId,
      tenantId,
      businessRecord.recordType || 'lead',
      businessRecord.companyName || 'Unnamed Company'
    );

    res.json({
      success: true,
      recordId,
      companyDisplayId: result.companyDisplayId,
      urlSlug: result.urlSlug,
      url: `/customer/${result.urlSlug}`
    });
  } catch (error) {
    console.error("Error generating company identifiers:", error);
    res.status(500).json({ error: "Failed to generate company identifiers" });
  }
});

// Backfill existing records without display IDs
router.post("/backfill", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;
    const { limit = 50 } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const updatedCount = await backfillExistingRecords(tenantId, limit);

    res.json({
      success: true,
      message: `Updated ${updatedCount} records with company display IDs and URL slugs`,
      updatedCount
    });
  } catch (error) {
    console.error("Error backfilling company identifiers:", error);
    res.status(500).json({ error: "Failed to backfill company identifiers" });
  }
});

// Get records without display IDs (for admin purposes)
router.get("/missing-ids", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.session?.tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const recordsWithoutIds = await db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        recordType: businessRecords.recordType,
        status: businessRecords.status,
        createdAt: businessRecords.createdAt
      })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          isNull(businessRecords.companyDisplayId)
        )
      )
      .limit(100);

    res.json({
      records: recordsWithoutIds,
      count: recordsWithoutIds.length
    });
  } catch (error) {
    console.error("Error fetching records without IDs:", error);
    res.status(500).json({ error: "Failed to fetch records without IDs" });
  }
});

// Preview URL slug generation for a company name
router.post("/preview-slug", async (req: any, res) => {
  try {
    const { companyName, recordType = 'customer' } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: "Company name is required" });
    }

    // Generate a sample display ID for preview
    const sampleDisplayId = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    // Generate the URL slug
    const urlSlug = generateUniqueUrlSlug(recordType, companyName, sampleDisplayId, 'preview-tenant');

    res.json({
      companyName,
      sampleDisplayId,
      urlSlug,
      previewUrl: `/customer/${urlSlug}`,
      note: "This is a preview - actual display ID will be different when created"
    });
  } catch (error) {
    console.error("Error previewing URL slug:", error);
    res.status(500).json({ error: "Failed to preview URL slug" });
  }
});

export default router;