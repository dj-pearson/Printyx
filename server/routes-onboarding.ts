import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  insertOnboardingChecklistSchema,
  insertOnboardingEquipmentSchema,
  insertOnboardingNetworkConfigSchema,
  insertOnboardingPrintManagementSchema,
  insertOnboardingDynamicSectionSchema,
  insertOnboardingTaskSchema,
  type OnboardingChecklist,
  type OnboardingEquipment,
  type OnboardingNetworkConfig,
  type OnboardingPrintManagement,
  type OnboardingDynamicSection,
  type OnboardingTask,
  businessRecords,
  quotes,
  quoteLineItems,
} from "@shared/schema";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { db } from "./db";
import puppeteer from "puppeteer";
// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
    
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // If we have session userId, get user details from storage
    if (req.session?.userId && !req.user) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        };
      }
    }
    
    // Ensure tenantId is available
    if (!req.user?.tenantId && req.session?.tenantId) {
      req.user = { ...req.user, tenantId: req.session.tenantId };
    }
    
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
};

// PDF Generation Service
class OnboardingPDFService {
  private async generateChecklistHTML(
    checklist: OnboardingChecklist,
    equipment: OnboardingEquipment[],
    networkConfigs: OnboardingNetworkConfig[],
    printConfigs: OnboardingPrintManagement[],
    dynamicSections: OnboardingDynamicSection[],
    tasks: OnboardingTask[]
  ): Promise<string> {
    const customerData = (checklist.customerData as any) || {};
    const siteData = (checklist.siteInformation as any) || {};

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Onboarding Checklist - ${checklist.checklistTitle}</title>
      <style>
        @page { margin: 1in; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 25px; page-break-inside: avoid; }
        .section-title { background: #f5f5f5; padding: 8px; border-left: 4px solid #007bff; font-weight: bold; font-size: 14px; }
        .field-group { display: flex; margin-bottom: 8px; }
        .field-label { font-weight: bold; width: 150px; }
        .field-value { flex: 1; }
        .equipment-item { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
        .task-item { padding: 8px; border-left: 3px solid #28a745; margin: 5px 0; background: #f8f9fa; }
        .checkbox { width: 15px; height: 15px; border: 1px solid #333; display: inline-block; margin-right: 5px; }
        .status-completed { background: #28a745; color: white; padding: 2px 8px; border-radius: 3px; }
        .status-pending { background: #ffc107; color: black; padding: 2px 8px; border-radius: 3px; }
        .dynamic-section { border: 1px solid #e9ecef; padding: 15px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Equipment Installation & Onboarding Checklist</h1>
        <h2>${checklist.checklistTitle}</h2>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p>Status: <span class="status-${
          checklist.status === "completed" ? "completed" : "pending"
        }">${checklist.status?.toUpperCase()}</span></p>
      </div>

      <div class="section">
        <div class="section-title">Customer Information</div>
        <div class="field-group">
          <div class="field-label">Company:</div>
          <div class="field-value">${customerData.companyName || "N/A"}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Primary Contact:</div>
          <div class="field-value">${customerData.primaryContact || "N/A"}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Phone:</div>
          <div class="field-value">${customerData.phone || "N/A"}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Email:</div>
          <div class="field-value">${customerData.email || "N/A"}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Installation Type:</div>
          <div class="field-value">${checklist.installationType
            ?.replace("_", " ")
            .toUpperCase()}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Scheduled Install:</div>
          <div class="field-value">${
            checklist.scheduledInstallDate
              ? new Date(checklist.scheduledInstallDate).toLocaleDateString()
              : "TBD"
          }</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Site Information</div>
        <div class="field-group">
          <div class="field-label">Installation Address:</div>
          <div class="field-value">${siteData.address || "N/A"}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Access Requirements:</div>
          <div class="field-value">${
            checklist.accessRequirements || "None specified"
          }</div>
        </div>
        <div class="field-group">
          <div class="field-label">Special Instructions:</div>
          <div class="field-value">${
            checklist.specialInstructions || "None"
          }</div>
        </div>
      </div>

      ${
        equipment.length > 0
          ? `
      <div class="section">
        <div class="section-title">Equipment Details</div>
        ${equipment
          .map(
            (item) => `
          <div class="equipment-item">
            <h4>${item.manufacturer} ${item.model}</h4>
            <div class="field-group">
              <div class="field-label">Serial Number:</div>
              <div class="field-value">${item.serialNumber || "TBD"}</div>
            </div>
            <div class="field-group">
              <div class="field-label">Location:</div>
              <div class="field-value">${item.buildingLocation || ""} ${
              item.roomLocation || ""
            } ${item.specificLocation || ""}</div>
            </div>
            <div class="field-group">
              <div class="field-label">IP Address:</div>
              <div class="field-value">${item.targetIpAddress || "TBD"}</div>
            </div>
            <div class="field-group">
              <div class="field-label">Hostname:</div>
              <div class="field-value">${item.hostname || "TBD"}</div>
            </div>
            <div class="field-group">
              <div class="field-label">Installed:</div>
              <div class="field-value"><span class="checkbox">${
                item.isInstalled ? "✓" : ""
              }</span> ${item.isInstalled ? "Yes" : "No"}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        dynamicSections.length > 0
          ? `
      <div class="section">
        <div class="section-title">Additional Requirements</div>
        ${dynamicSections
          .map(
            (section) => `
          <div class="dynamic-section">
            <h4>${section.sectionTitle}</h4>
            <p>${section.sectionDescription || ""}</p>
            <div class="field-group">
              <div class="field-label">Status:</div>
              <div class="field-value"><span class="checkbox">${
                section.isCompleted ? "✓" : ""
              }</span> ${section.isCompleted ? "Completed" : "Pending"}</div>
            </div>
            ${
              section.notes
                ? `<p><strong>Notes:</strong> ${section.notes}</p>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        tasks.length > 0
          ? `
      <div class="section">
        <div class="section-title">Installation Tasks</div>
        ${tasks
          .map(
            (task) => `
          <div class="task-item">
            <div class="field-group">
              <div class="field-label"><span class="checkbox">${
                task.status === "completed" ? "✓" : ""
              }</span></div>
              <div class="field-value">
                <strong>${task.taskTitle}</strong>
                <p>${task.taskDescription || ""}</p>
                <small>Priority: ${task.priority} | Status: ${
              task.status
            }</small>
                ${
                  task.assignedTo
                    ? `<br><small>Assigned to: ${task.assignedTo}</small>`
                    : ""
                }
              </div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      <div class="section">
        <div class="section-title">Completion Summary</div>
        <div class="field-group">
          <div class="field-label">Progress:</div>
          <div class="field-value">${
            checklist.progressPercentage || 0
          }% Complete (${checklist.completedSections || 0}/${
      checklist.totalSections || 0
    } sections)</div>
        </div>
        <div class="field-group">
          <div class="field-label">Created By:</div>
          <div class="field-value">${checklist.createdBy}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Created Date:</div>
          <div class="field-value">${new Date(
            checklist.createdAt
          ).toLocaleDateString()}</div>
        </div>
        ${
          checklist.actualInstallDate
            ? `
        <div class="field-group">
          <div class="field-label">Installation Completed:</div>
          <div class="field-value">${new Date(
            checklist.actualInstallDate
          ).toLocaleDateString()}</div>
        </div>
        `
            : ""
        }
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
        <h3>Signatures</h3>
        <table>
          <tr>
            <td style="width: 50%; height: 60px;">
              <strong>Technician Signature:</strong><br>
              <div style="margin-top: 30px;">_________________________</div>
              <small>Date: ___________</small>
            </td>
            <td style="width: 50%; height: 60px;">
              <strong>Customer Signature:</strong><br>
              <div style="margin-top: 30px;">_________________________</div>
              <small>Date: ___________</small>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
    `;
  }

  async generatePDF(checklistId: string, tenantId: string): Promise<string> {
    try {
      // Get checklist data
      const checklist = await storage.getOnboardingChecklist(
        checklistId,
        tenantId
      );
      if (!checklist) {
        throw new Error("Checklist not found");
      }

      // Get related data
      const [equipment, networkConfigs, printConfigs, dynamicSections, tasks] =
        await Promise.all([
          storage.getOnboardingEquipment(checklistId, tenantId),
          storage.getOnboardingNetworkConfig(checklistId, tenantId),
          storage.getOnboardingPrintManagement(checklistId, tenantId),
          storage.getOnboardingDynamicSections(checklistId, tenantId),
          storage.getOnboardingTasks(checklistId, tenantId),
        ]);

      // Generate HTML
      const html = await this.generateChecklistHTML(
        checklist,
        equipment,
        networkConfigs,
        printConfigs,
        dynamicSections,
        tasks
      );

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
      });

      await browser.close();

      // Upload to object storage
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Upload the PDF
      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      formData.append("file", blob, `checklist-${checklistId}.pdf`);

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: pdfBuffer,
        headers: {
          "Content-Type": "application/pdf",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload PDF to object storage");
      }

      // Get the object path and set ACL policy
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadResponse.url,
        {
          owner: checklist.createdBy,
          visibility: "private", // Only accessible by tenant users
        }
      );

      // Update checklist with PDF URL
      await storage.updateOnboardingChecklist(checklistId, tenantId, {
        pdfUrl: objectPath,
        pdfGeneratedAt: new Date(),
      });

      return objectPath;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }
}

// Enhanced API endpoints for auto-population
async function searchBusinessRecords(req: Request, res: Response) {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { search, limit = 10 } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    let query = db
      .select()
      .from(businessRecords)
      .where(eq(businessRecords.tenantId, tenantId))
      .limit(Number(limit));

    if (search && typeof search === "string") {
      query = query.where(
        or(
          ilike(businessRecords.companyName, `%${search}%`),
          ilike(businessRecords.firstName, `%${search}%`),
          ilike(businessRecords.lastName, `%${search}%`)
        )
      );
    }

    const records = await query.execute();
    res.json(records);
  } catch (error) {
    console.error("Error searching business records:", error);
    res.status(500).json({ error: "Failed to search business records" });
  }
}

async function searchQuotes(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const { search, businessRecordId, limit = 10 } = req.query;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const tenantId = user.tenantId;

    let query = db
      .select()
      .from(quotes)
      .where(eq(quotes.tenantId, tenantId))
      .limit(Number(limit));

    if (businessRecordId && typeof businessRecordId === "string") {
      query = query.where(
        and(
          eq(quotes.tenantId, tenantId),
          or(
            eq(quotes.leadId, businessRecordId),
            eq(quotes.customerId, businessRecordId)
          )
        )
      );
    }

    if (search && typeof search === "string") {
      query = query.where(
        and(
          eq(quotes.tenantId, tenantId),
          or(
            ilike(quotes.quoteNumber, `%${search}%`),
            ilike(quotes.title, `%${search}%`),
            ilike(quotes.notes, `%${search}%`)
          )
        )
      );
    }

    const quotesData = await query.execute();
    res.json(quotesData);
  } catch (error) {
    console.error("Error searching quotes:", error);
    res.status(500).json({ error: "Failed to search quotes" });
  }
}

async function getQuoteLineItems(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const { quoteId } = req.params;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const tenantId = user.tenantId;

    const lineItems = await db
      .select()
      .from(quoteLineItems)
      .where(
        and(
          eq(quoteLineItems.tenantId, tenantId),
          eq(quoteLineItems.quoteId, quoteId)
        )
      )
      .execute();

    res.json(lineItems);
  } catch (error) {
    console.error("Error fetching quote line items:", error);
    res.status(500).json({ error: "Failed to fetch quote line items" });
  }
}

async function getCompanyContacts(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const { businessRecordId } = req.params;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const tenantId = user.tenantId;

    // First get the business record to find the company
    const businessRecord = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.id, businessRecordId)
        )
      )
      .limit(1)
      .execute();

    if (!businessRecord.length) {
      return res.status(404).json({ error: "Business record not found" });
    }

    // For now, return the business record contact info as primary contact
    // This can be enhanced when company_contacts table is properly linked
    const primaryContact = {
      id: businessRecord[0].id,
      first_name: businessRecord[0].firstName,
      last_name: businessRecord[0].lastName,
      email: businessRecord[0].email,
      phone: businessRecord[0].phone,
      is_primary: true,
    };

    res.json([primaryContact]);
  } catch (error) {
    console.error("Error fetching company contacts:", error);
    res.status(500).json({ error: "Failed to fetch company contacts" });
  }
}

export function registerOnboardingRoutes(app: Express): void {
  const pdfService = new OnboardingPDFService();

  // Get all onboarding checklists for a tenant
  app.get("/api/onboarding/checklists", async (req: any, res: Response) => {
    try {
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tenantId = user.tenantId;

      const checklists = await storage.getOnboardingChecklists(tenantId);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching onboarding checklists:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get a specific onboarding checklist with all related data
  app.get("/api/onboarding/checklists/:id", async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tenantId = user.tenantId;

      const checklist = await storage.getOnboardingChecklist(id, tenantId);
      if (!checklist) {
        return res.status(404).json({ error: "Checklist not found" });
      }

      // Get related data
      const [equipment, networkConfigs, printConfigs, dynamicSections, tasks] =
        await Promise.all([
          storage.getOnboardingEquipment(id, tenantId),
          storage.getOnboardingNetworkConfig(id, tenantId),
          storage.getOnboardingPrintManagement(id, tenantId),
          storage.getOnboardingDynamicSections(id, tenantId),
          storage.getOnboardingTasks(id, tenantId),
        ]);

      res.json({
        checklist,
        equipment,
        networkConfigs,
        printConfigs,
        dynamicSections,
        tasks,
      });
    } catch (error) {
      console.error("Error fetching onboarding checklist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new onboarding checklist
  app.post("/api/onboarding/checklists", async (req: any, res: Response) => {
    try {
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tenantId = user.tenantId;
      const userId = user.id;

      console.log('[DEBUG] Raw request body:', JSON.stringify(req.body, null, 2));
      
      const validatedData = insertOnboardingChecklistSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });
      
      console.log('[DEBUG] Validated data:', JSON.stringify(validatedData, null, 2));

      const checklist = await storage.createOnboardingChecklist(validatedData);
      res.status(201).json(checklist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating onboarding checklist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update an onboarding checklist
  app.put("/api/onboarding/checklists/:id", async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tenantId = user.tenantId;
      const userId = user.id;

      const updateData = {
        ...req.body,
        lastModifiedBy: userId,
      };

      const checklist = await storage.updateOnboardingChecklist(
        id,
        tenantId,
        updateData
      );
      if (!checklist) {
        return res.status(404).json({ error: "Checklist not found" });
      }

      res.json(checklist);
    } catch (error) {
      console.error("Error updating onboarding checklist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete an onboarding checklist
  app.delete(
    "/api/onboarding/checklists/:id",
    async (req: any, res: Response) => {
      try {
        const { id } = req.params;

        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await storage.getUser(req.session.userId);
        if (!user?.tenantId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const tenantId = user.tenantId;

        await storage.deleteOnboardingChecklist(id, tenantId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting onboarding checklist:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Generate PDF for a checklist
  app.post(
    "/api/onboarding/checklists/:id/generate-pdf",
    async (req: any, res: Response) => {
      try {
        const { id } = req.params;

        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await storage.getUser(req.session.userId);
        if (!user?.tenantId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const tenantId = user.tenantId;

        const pdfUrl = await pdfService.generatePDF(id, tenantId);
        res.json({ pdfUrl });
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  );

  // Equipment routes
  app.post(
    "/api/onboarding/checklists/:checklistId/equipment",
    async (req: any, res: Response) => {
      try {
        const { checklistId } = req.params;

        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await storage.getUser(req.session.userId);
        if (!user?.tenantId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const tenantId = user.tenantId;

        const validatedData = insertOnboardingEquipmentSchema.parse({
          ...req.body,
          tenantId,
          checklistId,
        });

        const equipment = await storage.createOnboardingEquipment(
          validatedData
        );
        res.status(201).json(equipment);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating equipment:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Dynamic sections routes
  app.post(
    "/api/onboarding/checklists/:checklistId/sections",
    async (req: any, res: Response) => {
      try {
        const { checklistId } = req.params;

        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await storage.getUser(req.session.userId);
        if (!user?.tenantId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const tenantId = user.tenantId;

        const validatedData = insertOnboardingDynamicSectionSchema.parse({
          ...req.body,
          tenantId,
          checklistId,
        });

        const section = await storage.createOnboardingDynamicSection(
          validatedData
        );
        res.status(201).json(section);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating dynamic section:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  app.put("/api/onboarding/sections/:id", async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      // Fixed auth above
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const section = await storage.updateOnboardingDynamicSection(
        id,
        tenantId,
        req.body
      );
      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }

      res.json(section);
    } catch (error) {
      console.error("Error updating dynamic section:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete(
    "/api/onboarding/sections/:id",
    async (req: any, res: Response) => {
      try {
        const { id } = req.params;
        // Fixed auth above
        if (!tenantId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        await storage.deleteOnboardingDynamicSection(id, tenantId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting dynamic section:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Tasks routes
  app.post(
    "/api/onboarding/checklists/:checklistId/tasks",
    async (req: any, res: Response) => {
      try {
        const { checklistId } = req.params;
        // Fixed auth above
        if (!tenantId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const validatedData = insertOnboardingTaskSchema.parse({
          ...req.body,
          tenantId,
          checklistId,
        });

        const task = await storage.createOnboardingTask(validatedData);
        res.status(201).json(task);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating task:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  app.put("/api/onboarding/tasks/:id", async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      // Fixed auth above
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const task = await storage.updateOnboardingTask(id, tenantId, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/onboarding/tasks/:id", async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      // Fixed auth above
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await storage.deleteOnboardingTask(id, tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Enhanced API endpoints for auto-population
  app.get("/api/business-records", searchBusinessRecords);
  app.get("/api/quotes", requireAuth, searchQuotes);
  app.get("/api/quotes/:quoteId/line-items", requireAuth, getQuoteLineItems);
  app.get("/api/companies/:businessRecordId/contacts", requireAuth, getCompanyContacts);
}
